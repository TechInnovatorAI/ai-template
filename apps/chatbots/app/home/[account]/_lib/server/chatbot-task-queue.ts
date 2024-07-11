import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import { createChatbotsService } from '~/home/[account]/chatbots/_lib/server/chatbots-service';
import Crawler from '~/lib/chatbots/crawler';
import { Database } from '~/lib/database.types';
import { createJobsService } from '~/lib/jobs/jobs.service';
import { parallelizeBatch } from '~/lib/rx-parallelize-batch';

export function createChatbotTasksQueue() {
  return new ChatbotTaskQueue();
}

class ChatbotTaskQueue {
  private static MAX_LINKS_PER_JOB = 30;
  private static DELAY_BETWEEN_JOBS_MS = 500;
  private static DELAY_BETWEEN_TASKS_S = 25;

  async createJob(
    client: SupabaseClient<Database>,
    params: {
      chatbotId: string;

      filters: {
        allow: string[];
        disallow: string[];
      };
    },
  ) {
    const logger = await getLogger();
    const crawler = new Crawler();

    logger.info(
      {
        chatbotId: params.chatbotId,
      },
      `Creating chatbot crawling job...`,
    );

    const chatbotsService = createChatbotsService(client);

    const chatbot = await chatbotsService.getChatbot(params.chatbotId);
    const sites = await crawler.getSitemapLinks(chatbot.url);
    const links = crawler.filterLinks(sites, params.filters);

    // verify if organization is over quota before creating job
    const canCreateJob = await client.rpc('can_index_documents', {
      target_account_id: chatbot.account_id,
      requested_documents: links.length,
    });

    // if organization is over quota, throw error
    if (!canCreateJob.data) {
      return Promise.reject(`Can't create job. Organization is over quota.`);
    }

    // if organization is not over quota, create job
    const totalJobs = Math.ceil(
      links.length / ChatbotTaskQueue.MAX_LINKS_PER_JOB,
    );

    const jobsGroups: Array<string[]> = [];

    for (let n = 0; n < totalJobs; n++) {
      const startIndex = n * ChatbotTaskQueue.MAX_LINKS_PER_JOB;

      const jobSites = links.slice(
        startIndex,
        startIndex + ChatbotTaskQueue.MAX_LINKS_PER_JOB,
      );

      jobsGroups.push(jobSites);
    }

    if (jobsGroups.length === 0) {
      logger.info(
        {
          chatbotId: params.chatbotId,
          accountId: chatbot.account_id,
        },
        `No links found. Skipping job creation.`,
      );

      throw new Error('No links found');
    }

    logger.info(
      {
        numberOfJobs: totalJobs,
        numberOfLinks: links.length,
        chatbotId: params.chatbotId,
        accountId: chatbot.account_id,
      },
      `Fetched SiteMap links. Inserting job...`,
    );

    const adminClient = getSupabaseServerActionClient<Database>({
      admin: true,
    });

    const jobsService = createJobsService(adminClient);

    const job = await jobsService
      .insertJob({
        chatbot_id: params.chatbotId,
        account_id: chatbot.account_id,
        tasks_count: links.length,
      })
      .select('id')
      .single();

    if (job.error) {
      logger.error(
        {
          chatbotId: params.chatbotId,
          error: job.error,
          accountId: chatbot.account_id,
        },
        `Error inserting job`,
      );

      throw job.error;
    }

    logger.info(
      {
        chatbotId: params.chatbotId,
        jobId: job.data.id,
      },
      `Successfully created job record for chatbot`,
    );

    logger.info(
      {
        chatbotId: params.chatbotId,
        jobId: job.data.id,
        numberOfTasks: jobsGroups.length,
      },
      `Creating tasks...`,
    );

    const { QStashTaskQueue } = await import('@makerkit/qstash');
    const url = process.env.QSTASH_URL;

    const queue = new QStashTaskQueue<{
      chatbotId: string;
      jobId: number;
      delay: number;
      links: string[];
    }>({
      url,
    });

    // for each job, we delay it by {ChatbotTaskQueue.DELAY_BETWEEN_JOBS_MS} ms
    // to be nice to the website we're crawling
    const requests = jobsGroups.map((jobSites, index) => {
      const delay = index * ChatbotTaskQueue.DELAY_BETWEEN_JOBS_MS;

      return () =>
        queue.create({
          body: {
            chatbotId: params.chatbotId,
            jobId: job.data.id,
            delay,
            links: jobSites,
          },
        });
    });

    // for each task, we delay it by {ChatbotTaskQueue.DELAY_BETWEEN_TASKS_S}
    const concurrentBatches = 2;

    // delay between each batch in seconds
    const delayBetweenTasks = ChatbotTaskQueue.DELAY_BETWEEN_TASKS_S;

    const results = await parallelizeBatch(
      requests,
      concurrentBatches,
      delayBetweenTasks,
    );

    const jobsStarted = results.filter((result) => result.messageId);

    logger.info(
      {
        chatbotId: params.chatbotId,
        jobId: job.data.id,
        numberOfJobs: results.length,
        numberOfJobsStarted: jobsStarted.length,
        url,
      },
      `Finalized job creation`,
    );

    return chatbot;
  }
}
