import { NextRequest } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import { Database } from '~/lib/database.types';
import { validateReplicateWebhook } from '~/lib/replicate/validate-replicate-webhook';

interface TrainingWebhook {
  completed_at: string;
  created_at: string;
  error: unknown;
  id: string;
  input: {
    input_images: string;
  };
  logs: string;
  metrics: {
    predict_time: number;
  };
  output: {
    version: string;
    weights: string;
  };
  started_at: string;
  status: string;
  urls: {
    get: string;
    cancel: string;
  };
  model: string;
  version: string;
}

export async function POST(request: NextRequest) {
  // we need to validate the webhook request
  // to ensure it's coming from Replicate
  await validateReplicateWebhook(request);

  const logger = await getLogger();
  const logName = 'training_success_webhook';

  logger.info(
    {
      name: logName,
    },
    `Replicate training success webhook received`,
  );

  const queryParams = new URL(request.url).searchParams;
  const referenceId = queryParams.get('reference_id');

  if (!referenceId) {
    return new Response('Missing referenceId', { status: 400 });
  }

  const body = (await request.json()) as TrainingWebhook;

  logger.info(
    {
      name: logName,
      referenceId,
    },
    `Fetching generation...`,
  );

  const client = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const status = body.status;

  if (status === 'failed' || status === 'canceled') {
    logger.info(
      {
        name: logName,
        referenceId,
      },
      `Training failed`,
    );

    const { data } = await client
      .from('avatars_models')
      .update({
        status: 'failed',
      })
      .eq('reference_id', referenceId)
      .select('account_id')
      .single();

    if (data) {
      // we need to delete the model from the storage
      await deleteModelFromStorage(client, {
        accountId: data.account_id,
        referenceId,
      });
    }

    return new Response('Exiting webhook', { status: 200 });
  } else if (status === 'succeeded') {
    logger.info(
      {
        name: logName,
        referenceId,
      },
      `Training succeeded`,
    );

    const model = body.output?.version as `${string}/${string}`;

    const updateModelResponse = await client
      .from('avatars_models')
      .update({
        status: 'success',
        // we can now update the model with the version from Replicate
        model,
      })
      .eq('reference_id', referenceId)
      .select('uuid, name, account_id')
      .single();

    if (updateModelResponse.error) {
      logger.error(
        {
          name: logName,
          referenceId,
        },
        `Error updating model: ${updateModelResponse.error.message}`,
      );

      return new Response('Error updating model', { status: 500 });
    }

    if (updateModelResponse.data) {
      // we need to delete the model from the storage
      await deleteModelFromStorage(client, {
        accountId: updateModelResponse.data.account_id,
        referenceId,
      });
    }

    const data = updateModelResponse.data;

    // send a notification to the user
    // that the model is ready
    await notifyUserOfModelCreation({
      name: data.name,
      accountId: data.account_id,
      modelUid: data.uuid,
    });
  }

  return new Response('Success', { status: 200 });
}

async function notifyUserOfModelCreation(params: {
  accountId: string;
  name: string;
  modelUid: string;
}) {
  const logger = await getLogger();

  const client = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const onError = (error: unknown) => {
    logger.error(
      {
        name: `training_success_webhook`,
        error,
      },
      `Error creating notification`,
    );
  };

  try {
    const { error } = await client.from('notifications').insert({
      account_id: params.accountId,
      body: `Your model "${params.name}" is ready! Generate images now!`,
      link: `/home/models/${params.modelUid}`,
    });

    if (error) {
      onError(error);
    }
  } catch (e) {
    onError(e);
  }
}

async function deleteModelFromStorage(
  client: SupabaseClient<Database>,
  params: {
    accountId: string;
    referenceId: string;
  },
) {
  const logger = await getLogger();

  logger.info(
    {
      name: 'deleteModelFromStorage',
      referenceId: params.referenceId,
    },
    `Deleting model from storage...`,
  );

  const filePath = `/${params.accountId}/${params.referenceId}.zip`;

  const { error } = await client.storage
    .from('avatars_models')
    .remove([filePath]);

  if (error) {
    logger.error(
      {
        name: 'deleteModelFromStorage',
        referenceId: params.referenceId,
        error,
      },
      `Error deleting model from storage`,
    );

    return;
  }

  logger.info(
    {
      name: 'deleteModelFromStorage',
      referenceId: params.referenceId,
    },
    `Model deleted from storage`,
  );
}
