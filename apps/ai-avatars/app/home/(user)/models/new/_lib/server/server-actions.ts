'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import Replicate from 'replicate';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import appConfig from '~/config/app.config';
import { Database } from '~/lib/database.types';

const CreateModelSchema = z.object({
  name: z.string().min(1),
  referenceId: z.string(),
  captionPrefix: z.string().optional(),
});

const replicateUsername = process.env.REPLICATE_USERNAME;

const replicateParentModelOwner =
  process.env.REPLICATE_PARENT_MODEL_OWNER ?? 'stability-ai';

const replicateParentModelName =
  process.env.REPLICATE_PARENT_MODEL_NAME ?? 'sdxl';

const replicateParentModelVersion = process.env
  .REPLICATE_PARENT_MODEL_VERSION as string;

const replicateDestinationModelName = process.env
  .REPLICATE_DESTINATION_MODEL_NAME as string;

const trainingEndpoint =
  process.env.REPLICATE_TRAINING_WEBHOOK_PATH ??
  '/api/replicate/training/webhook';

const webhookDomain = process.env.WEBHOOK_DOMAIN ?? appConfig.url;
const storageProxy = process.env.STORAGE_PROXY_URL;
const defaultCaptionPrefix =
  process.env.CAPTION_PREFIX ?? 'headshot profile picture';

const creditsCost = process.env.CREDITS_PER_MODEL
  ? Number(process.env.CREDITS_PER_MODEL)
  : 10;

export const createNewModel = enhanceAction(
  async ({ referenceId, name: modelName, captionPrefix }, user) => {
    const client = getSupabaseServerActionClient<Database>();
    const logger = await getLogger();

    const name = `createNewModel`;
    const accountId = user.id;

    // quick check to see if the user has enough credits
    const canGenerateAvatarResponse = await client.rpc('can_generate', {
      credits_cost: creditsCost,
    });

    if (canGenerateAvatarResponse.error ?? !canGenerateAvatarResponse.data) {
      throw new Error('Not enough credits');
    }

    logger.info(
      {
        name,
      },
      `Generating public URL for the zip file...`,
    );

    // get the public URL for the zip file from the storage
    const zipUrl = await getZipFileUrl({
      accountId,
      referenceId,
    });

    logger.info(
      {
        name,
        zipUrl,
      },
      `Public URL for the zip file was successfully generated`,
    );

    const insertModelResponse = await client.from('avatars_models').insert({
      name: modelName,
      reference_id: referenceId,
      account_id: accountId,
      model: referenceId, // the model will be updated
    });

    if (insertModelResponse.error) {
      logger.error(
        {
          name,
          referenceId,
          accountId,
        },
        `Error creating model: ${insertModelResponse.error.message}`,
      );

      throw new Error(`Error creating model`);
    }

    logger.info(
      {
        name,
        referenceId,
      },
      `Calling Replicate API to start the generation...`,
    );

    try {
      logger.info(
        {
          name,
          referenceId,
          accountId,
        },
        `Reducing credits for the account...`,
      );

      const adminClient = getSupabaseServerActionClient<Database>({
        admin: true,
      });

      // this function will both check if the organization
      // has enough credits and reduce them
      const { error } = await adminClient.rpc('reduce_credits', {
        target_account_id: accountId,
        credits_cost: creditsCost,
      });

      if (error) {
        logger.error(
          {
            name,
            referenceId,
            accountId,
            creditsCost,
            error,
          },
          `Error reducing credits for the account`,
        );

        return Promise.reject(`Error reducing credits for the account`);
      }

      logger.info(
        {
          name,
          referenceId,
          accountId,
          creditsCost,
        },
        `Credits were successfully reduced for the account`,
      );

      // call the Replicate API to start the generation
      await runReplicateTraining({
        referenceId,
        captionPrefix,
        zipUrl,
      });

      logger.info(
        {
          name,
          referenceId,
        },
        `Replicate API was called successfully`,
      );
    } catch (error) {
      console.error(error);

      logger.error(
        {
          name,
          referenceId,
          error,
        },
        `Error while calling Replicate API. Updating model status to failed...`,
      );

      // set the model status to failed

      await client
        .from('avatars_models')
        .update({
          status: 'failed',
        })
        .eq('reference_id', referenceId);

      logger.error(
        {
          name,
          referenceId,
        },
        `Updated model status to failed`,
      );

      throw new Error(`Error requesting model training`);
    }

    // revalidate the models list page
    revalidatePath('/home', 'page');

    // redirect back to the dashboard
    return redirect('/home');
  },
  {
    schema: CreateModelSchema,
  },
);

/**
 * @name getZipFileUrl
 * @description This function returns the signed URL for the ZIP file from the storage.
 * When in development, we replace the domain with the webhook domain.
 * @param params
 */
async function getZipFileUrl(params: {
  accountId: string;
  referenceId: string;
}) {
  const logger = await getLogger();
  const { accountId, referenceId } = params;
  const filePath = `/${accountId}/${referenceId}.zip`;
  const expiresInOneHourMs = 60 * 60 * 1000;

  const adminClient = getSupabaseServerActionClient({
    admin: true,
  });

  const { data, error } = await adminClient.storage
    .from('avatars_models')
    .createSignedUrl(filePath, expiresInOneHourMs);

  if (error) {
    throw error;
  }

  const signedUrl = data.signedUrl;
  const url = new URL(signedUrl);

  // if the URL is already HTTPS, we return it as is
  // this is the production case
  if (url.protocol === 'https:') {
    logger.info(
      {
        referenceId,
        signedUrl,
      },
      `Signed URL for the ZIP file`,
    );

    return url.href;
  }

  // if the URL is not HTTPS, we replace the domain with the storage proxy
  // this is useful for local development
  // we append the query parameters to the URL since they contain the signature
  const path = url.pathname + url.search;
  const localUrl = new URL(path, storageProxy).href;

  logger.info(
    {
      referenceId,
      signedUrl,
      localUrl,
    },
    `Signed (local) URL for the ZIP file`,
  );

  return localUrl;
}

/**
 * Runs the replicate training with the provided parameters.
 *
 * @param {Object} params - The parameters for the training.
 * @param {string} params.prompt - The prompt for the training.
 * @param {string} params.zipUrl - The URL to the ZIP file containing the training data.
 * @param {string} params.referenceId - The reference ID for the training.
 *
 */
function runReplicateTraining(params: {
  zipUrl: string;
  referenceId: string;
  captionPrefix?: string;
}) {
  const replicate = new Replicate();
  const referenceId = params.referenceId;

  const webhook = getWebhookDestination(referenceId);

  const destination =
    `${replicateUsername}/${replicateDestinationModelName}` as const;

  return replicate.trainings.create(
    replicateParentModelOwner,
    replicateParentModelName,
    replicateParentModelVersion,
    {
      destination,
      input: {
        input_images: params.zipUrl,
        use_face_detection_instead: true,
        caption_prefix: params.captionPrefix ?? defaultCaptionPrefix,
      },
      webhook,
      webhook_events_filter: ['completed'],
    },
  );
}

/**
 * @name getWebhookDestination
 * @description This function returns the webhook destination URL.
 * We append the referenceId as a query parameter to the URL so we can
 * identify the generation when the webhook is called.
 * @param referenceId
 */
function getWebhookDestination(referenceId: string) {
  return (
    new URL(trainingEndpoint, webhookDomain).href +
    `?reference_id=${referenceId}`
  );
}
