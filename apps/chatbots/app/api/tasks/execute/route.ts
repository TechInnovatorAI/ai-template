import { NextRequest, NextResponse } from 'next/server';

import { QStashTaskQueue } from '@makerkit/qstash';
import { createHash } from 'crypto';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { z } from 'zod';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import Crawler from '~/lib/chatbots/crawler';
import Parser from '~/lib/chatbots/parser';
import { Database } from '~/lib/database.types';
import { createDocumentsService } from '~/lib/documents/documents.service';
import { createJobsService } from '~/lib/jobs/jobs.service';
import { getVectorStore } from '~/lib/langchain/vector-store';
import { parallelizeBatch } from '~/lib/rx-parallelize-batch';

const DOCUMENT_CHUNK_SIZE = process.env.DOCUMENT_CHUNK_SIZE
  ? Number(process.env.DOCUMENT_CHUNK_SIZE)
  : 1500;

/*
 * This route is called by the Task Queue to crawl a list of links
 */
const MAX_RETRIES = 3;

export const POST = async (req: NextRequest) => {
  const taskQueue = new QStashTaskQueue();
  const logger = await getLogger();

  logger.info(`Received Task message. Authenticating...`);

  try {
    const clone = req.clone();
    const signature = clone.headers.get('Upstash-Signature') ?? '';
    const body = await clone.text();

    await taskQueue.verify({ body, signature });
  } catch (error) {
    logger.error(
      {
        error,
      },
      `Authentication failed.`,
    );

    return new Response(`Invalid Request`, {
      status: 403,
    });
  }

  return handler(req);
};

async function handler(req: NextRequest) {
  const logger = await getLogger();
  const json = await req.json();
  logger.info(`Request authenticated. Validating body...`);

  const retriesHeader = req.headers.get('Upstash-Retries');
  const retries = retriesHeader ? parseInt(retriesHeader) : 0;

  const body = getBodySchema().parse(json);

  logger.info(
    {
      jobId: body.jobId,
    },
    `Body successfully validated`,
  );

  const supabase = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const jobsService = createJobsService(supabase);

  // we fetch the job to make sure it exists
  const jobResponse = await jobsService.getJobById(body.jobId);

  if (jobResponse.error ?? !jobResponse.data) {
    return handleError({
      retries,
      jobId: body.jobId,
      error: jobResponse.error,
    });
  }

  const crawler = new Crawler();
  const parser = new Parser();
  const vectorStore = await getVectorStore(supabase);

  logger.info(
    {
      links: body.links.length,
    },
    `Crawling links...`,
  );

  const service = createDocumentsService(supabase);
  const accountId = jobResponse.data.account_id;

  const requests = body.links.map((url) => {
    return async () => {
      async function fetchPage() {
        try {
          const host = new URL(url).origin;
          const contents = await crawler.crawl(url);

          return await parser.parse(contents, host);
        } catch (e) {
          logger.warn(
            {
              url,
              error: e,
              jobId: body.jobId,
            },
            `Error crawling URL`,
          );

          throw e;
        }
      }

      try {
        const { content, title } = await fetchPage();
        const hash = sha256(content);

        // we try avoid indexing the embedding twice
        // by looking the same hash in the DB
        const existingDocument = await service.getDocumentByHash({
          hash,
          chatbotId: body.chatbotId,
        });

        if (existingDocument.data) {
          logger.info(
            {
              title,
              hash,
              chatbotId: body.chatbotId,
            },
            `Document already indexed. Skipping...`,
          );

          return {
            success: false,
          };
        }

        const documentResponse = await service.insertDocument({
          title,
          content,
          hash,
          chatbotId: body.chatbotId,
        });

        if (documentResponse.error) {
          throw documentResponse.error;
        }

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: DOCUMENT_CHUNK_SIZE,
          chunkOverlap: 0,
        });

        logger.info(
          {
            title,
            accountId,
            ...body,
          },
          `Splitting document...`,
        );

        const splittedDocs = await splitter.splitText(content);

        const documentEmbeddings = splittedDocs.map((item) => {
          return {
            pageContent: item,
            metadata: {
              title: title,
              hash,
              url,
              account_id: accountId,
              chatbot_id: body.chatbotId,
              document_id: documentResponse.data.id,
            },
          };
        });

        logger.info(
          {
            title,
            accountId,
            ...body,
          },
          `Indexing documents...`,
        );

        // generate embeddings and summarize
        await vectorStore.addDocuments(documentEmbeddings);

        logger.info(
          {
            title,
            accountId,
            ...body,
          },
          `Documents indexed.`,
        );

        return {
          success: true,
        };
      } catch (error) {
        console.error(error);

        return {
          success: false,
          error,
        };
      }
    };
  });

  const concurrentRequests = 2;
  const delayBetweenRequestsMs = 1000;

  // run requests in parallel with a delay between each batch
  const tasks = await parallelizeBatch(
    requests,
    concurrentRequests,
    delayBetweenRequestsMs,
  );

  const successfulTasks = tasks.filter((task) => task.success);
  const erroredTasks = tasks.length - successfulTasks.length;

  const processedTasks = successfulTasks.length + erroredTasks;

  logger.info(
    {
      successfulTasks,
      erroredTasks,
    },
    `Finished crawling`,
  );

  logger.info(`Updating job ${body.jobId}...`);

  // we fetch the job again to get the latest version
  const { error, data: job } = await jobsService.getJobById(body.jobId);

  if (error) {
    return handleError({
      retries,
      jobId: body.jobId,
      error,
    });
  }

  const completedTasksCount = job.tasks_completed_count + processedTasks;

  const successfulTasksCount =
    job.tasks_succeeded_count + successfulTasks.length;

  const isStatusFinished = completedTasksCount >= job.tasks_count;
  const status = isStatusFinished ? 'completed' : job.status;

  const updateResponse = await jobsService.updateJob(body.jobId, {
    tasks_completed_count: completedTasksCount,
    tasks_succeeded_count: successfulTasksCount,
    status,
  });

  const docsQuotaResponse = await supabase.rpc('reduce_documents_quota', {
    target_account_id: accountId,
    docs_count: successfulTasks.length,
  });

  if (docsQuotaResponse.error) {
    logger.error(
      {
        error: docsQuotaResponse.error,
        accountId,
        chatbotId: body.chatbotId,
      },
      `Error reducing documents quota.`,
    );
  }

  if (updateResponse.error) {
    return handleError({
      retries,
      jobId: body.jobId,
      error: updateResponse.error,
    });
  }

  return NextResponse.json({
    success: true,
  });
}

async function handleError(params: {
  retries: number;
  jobId: number;
  error: unknown;
}) {
  const logger = await getLogger();

  logger.error(
    {
      jobId: params.jobId,
      error: params.error,
    },
    `Error executing job.`,
  );

  // if we can't fetch the job, we abort. The Task Queue will retry the request
  if (params.retries < MAX_RETRIES) {
    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      },
    );
  }

  // we have retried the request 3 times, so we abort by returning a 200
  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

function getBodySchema() {
  return z.object({
    chatbotId: z.string().uuid(),
    jobId: z.number(),
    links: z.array(z.string().url()),
  });
}
