import { NextRequest } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import { Database } from '~/lib/database.types';
import { validateReplicateWebhook } from '~/lib/replicate/validate-replicate-webhook';

interface Generation {
  id: string;
  version: string;
  created_at: string;
  started_at: string;
  completed_at: null | string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: {
    text: string;
  };
  output: null | string | string[];
}

const logName = 'prediction_webhook';

export async function POST(request: NextRequest) {
  // we need to validate the webhook request
  // to ensure it's coming from Replicate
  await validateReplicateWebhook(request);

  const logger = await getLogger();

  const queryParams = new URL(request.url).searchParams;
  const generationId = queryParams.get('generation_id');

  if (!generationId) {
    return new Response('Missing generationId', { status: 400 });
  }

  const body = (await request.json()) as Generation;
  const status = body.status;

  logger.info(
    {
      name: logName,
      generationId,
      status,
    },
    `Replicate prediction webhook received`,
  );

  const client = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const response = await client
    .from('avatars_generations')
    .select('status')
    .eq('uuid', generationId)
    .single();

  if (response.error) {
    logger.error(
      {
        name: logName,
        generationId,
        error: response.error,
      },
      `Error fetching generation`,
    );

    return new Response('Error fetching generation', { status: 500 });
  }

  // if the generation has already been processed, we can exit early
  if (response.data.status === 'success' || response.data.status === 'failed') {
    logger.info(
      {
        name: logName,
        generationId,
      },
      `Generation already processed. Exiting...`,
    );

    return new Response('Generation already processed', { status: 200 });
  }

  // we need to update the status of the generation
  // in the database
  const predictionDidSucceed = status === 'succeeded';

  const { error, data } = await client
    .from('avatars_generations')
    .update({
      status: predictionDidSucceed ? 'success' : 'failed',
    })
    .eq('uuid', generationId)
    .select('account_id, name')
    .single();

  if (error) {
    logger.error(
      {
        name: logName,
        generationId,
        error,
      },
      `Error updating generation status`,
    );

    return new Response('Error updating generation status', { status: 500 });
  }

  if (!body.output) {
    logger.info(
      {
        name: logName,
        generationId,
      },
      `No output found from webhook. Exiting...`,
    );

    return new Response('No output found', { status: 200 });
  }

  // store input images
  await storeOutputImages({
    generationId,
    body,
    client,
  });

  // notify user
  await notifyUserOfGenerationComplete({
    userId: data.account_id,
    name: data.name,
    generationId,
  });

  logger.info(
    {
      name: logName,
      generationId,
    },
    `User notified of generation completion. Returning response.`,
  );

  return new Response('OK', { status: 200 });
}

async function storeOutputImages({
  generationId,
  body,
  client,
}: {
  generationId: string;
  body: Generation;
  client: SupabaseClient<Database>;
}) {
  const logger = await getLogger();

  const outputs =
    body.output === null
      ? []
      : Array.isArray(body.output)
        ? body.output
        : [body.output];

  logger.info(
    {
      name: logName,
      generationId,
    },
    `Output found. Fetching ${outputs.length} images...`,
  );

  const requests = outputs.map(async (output) => {
    const response = await fetch(output);
    const outputImage = await response.arrayBuffer();

    logger.info(
      {
        name: logName,
        generationId,
      },
      `Storing output image...`,
    );

    // get the image name from the URL
    const imageName = output.split('/').pop();

    const uploadImageResponse = await client.storage
      .from('avatars_generations')
      .upload(`output/${generationId}/${imageName}`, outputImage);

    if (uploadImageResponse.error) {
      console.error(uploadImageResponse.error);

      logger.error(
        {
          name: logName,
          generationId,
        },
        `Error uploading output image`,
      );
    }

    logger.info(
      {
        name: logName,
        generationId,
      },
      `Output image successfully stored! `,
    );
  });

  try {
    await Promise.all(requests);
  } catch (e) {
    logger.error(
      {
        name: logName,
        generationId,
        error: e,
      },
      `Error storing output images`,
    );
  }
}

async function notifyUserOfGenerationComplete(params: {
  userId: string;
  name: string;
  generationId: string;
}) {
  const logger = await getLogger();

  const client = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const onError = (error: unknown) => {
    logger.error(
      {
        name: `prediction_webhook`,
        error,
      },
      `Error creating notification`,
    );
  };

  try {
    const { error } = await client.from('notifications').insert({
      account_id: params.userId,
      body: `Your generation "${params.name}" is ready! View it now.`,
      link: `/home/avatars/${params.generationId}`,
    });

    if (error) {
      onError(error);
    }
  } catch (e) {
    onError(e);
  }
}
