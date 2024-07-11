'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { SupabaseClient } from '@supabase/supabase-js';

import { nanoid } from 'nanoid';
import Replicate from 'replicate';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import appConfig from '~/config/app.config';
import { Database } from '~/lib/database.types';
import { getSdxlPromptByPresetId } from '~/lib/replicate/sdxl-prompts';

const CreateGenerationSchema = z.object({
  name: z.string().min(1),
  userPrompt: z.string().optional(),
  preset: z.enum(['instagram', 'disney', 'anime', 'custom']),
  model: z.string().uuid(),
  numberOfAvatars: z.number().int().min(1).max(8),
});

const predictionEndpoint =
  process.env.REPLICATE_PREDICTION_WEBHOOK_PATH ??
  '/api/replicate/prediction/webhook';

const webhookDomain = process.env.WEBHOOK_DOMAIN ?? appConfig.url;

// SDXL settings
const replicateImageWidth = process.env.REPLICATE_IMAGE_WIDTH ?? '1024';
const replicateImageHeight = process.env.REPLICATE_IMAGE_HEIGHT ?? '1024';
const promptStrength = process.env.REPLICATE_PROMPT_STRENGTH ?? '0.8';
const loraScale = process.env.REPLICATE_LORA_SCALE ?? '0.6';
const guidanceScale = process.env.REPLICATE_GUIDANCE_SCALE ?? '7.5';
const highNoiseFrac = process.env.REPLICATE_HIGH_NOISE_FRAC ?? '0.8';
const numInferenceSteps = process.env.REPLICATE_NUM_INFERENCE_STEPS ?? '60';
const applyWatermark = process.env.REPLICATE_APPLY_WATERMARK ?? 'true';

const creditsPerAvatar = process.env.CREDITS_PER_AVATAR
  ? Number(process.env.CREDITS_PER_AVATAR)
  : 1;

export const generatePicturesAction = enhanceAction(
  async (params, user) => {
    const logger = await getLogger();
    const logName = `generatePictures`;
    const client = getSupabaseServerActionClient<Database>();

    const replicate = new Replicate();

    logger.info(
      {
        name: logName,
      },
      `Creating generation...`,
    );

    const accountId = user.id;
    const creditsCost = creditsPerAvatar * params.numberOfAvatars;

    // quick check to see if the user has enough credits
    const canGenerateAvatarResponse = await client.rpc('can_generate', {
      credits_cost: creditsCost,
    });

    if (canGenerateAvatarResponse.error ?? !canGenerateAvatarResponse.data) {
      throw new Error('Not enough credits');
    }

    logger.info(
      {
        accountId,
        name: logName,
      },
      `Creating generation record...`,
    );

    const captionPrefixId = nanoid(16);
    const defaultCaptionPrefix = `Close up pictures of user ${captionPrefixId}`;
    const { preset, userPrompt } = params;

    const { prompt, negative } = userPrompt
      ? {
          prompt: userPrompt,
          negative: '',
        }
      : getSdxlPromptByPresetId(defaultCaptionPrefix, preset);

    const model = await getModelByUuid(client, params.model);

    // insert generation record into the DB
    const insertAvatarResponse = await client
      .from('avatars_generations')
      .insert({
        prompt,
        name: params.name,
        account_id: accountId,
        model_id: model.id,
      })
      .select('id, uuid')
      .single();

    if (insertAvatarResponse.error) {
      logger.error(
        {
          name: logName,
          accountId,
        },
        `Error creating generation: ${insertAvatarResponse.error.message}`,
      );

      throw new Error(`Error creating generation`);
    }

    const avatar = insertAvatarResponse.data;
    const generationId = avatar.id;
    const generationUuid = avatar.uuid;

    logger.info(
      {
        name: logName,
        generationId,
      },
      `Generation was successfully added to the DB`,
    );

    try {
      const adminClient = getSupabaseServerActionClient<Database>({
        admin: true,
      });

      // this function will both check if the organization
      // has enough credits and reduce them
      const { error } = await adminClient.rpc('reduce_credits', {
        target_account_id: accountId,
        credits_cost: creditsCost,
      });

      // if there is an error, we should log it and reject the promise
      if (error) {
        logger.error(
          {
            accountId,
            creditsCost,
            error,
          },
          `Error reducing credits for the account`,
        );

        return Promise.reject(`Error reducing credits for the organization`);
      }

      logger.info(
        {
          creditsCost,
        },
        `Credits were successfully reduced for the organization`,
      );

      // we can now call the Replicate API to start the generation
      const webhook = getWebhookDestination(generationUuid);
      const modelVersion = getModelVersionFromModel(model);

      logger.info(
        {
          name: logName,
          generationUuid,
          modelVersion,
        },
        `Calling Replicate API to start the generation...`,
      );

      const [modelName, version] = modelVersion.split(':');

      if (!modelName) {
        throw new Error('Model name is missing');
      }

      await replicate.predictions.create({
        model: modelName,
        version,
        input: {
          prompt,
          width: Number(replicateImageWidth),
          height: Number(replicateImageHeight),
          refine: 'no_refiner',
          scheduler: 'K_EULER',
          lora_scale: Number(loraScale),
          num_outputs: params.numberOfAvatars,
          guidance_scale: Number(guidanceScale),
          apply_watermark: applyWatermark === 'true',
          high_noise_frac: Number(highNoiseFrac),
          negative_prompt: negative || undefined,
          prompt_strength: Number(promptStrength),
          num_inference_steps: Number(numInferenceSteps),
        },
        webhook,
        webhook_events_filter: ['completed'],
      });

      logger.info(
        {
          name: logName,
        },
        `Replicate prediction was successfully called! Redirecting to dashboard.`,
      );
    } catch (error) {
      logger.error(
        {
          name: logName,
          generationUuid,
          error,
        },
        `Error calling Replicate. Updating generation status to failed...`,
      );

      // update generation status to failed

      await client
        .from('avatars_generations')
        .update({
          status: 'failed',
        })
        .eq('uuid', generationUuid);

      logger.info(
        {
          name: logName,
          generationUuid,
        },
        `Generation status was updated to failed`,
      );

      throw new Error(`Error requesting model training`);
    }

    // revalidate the avatars list page
    revalidatePath('/home/avatars', 'page');

    // redirect back to the dashboard
    return redirect('/home/avatars');
  },
  {
    schema: CreateGenerationSchema,
  },
);

/**
 * Returns the webhook destination URL for a given generation ID.
 *
 * @param {string} generationUid - The generation ID.
 */
function getWebhookDestination(generationUid: string) {
  return (
    new URL(predictionEndpoint, webhookDomain).href +
    `?generation_id=${generationUid}`
  );
}

/**
 * Retrieves a model from the 'avatars_models' table based on its UUID.
 */
async function getModelByUuid(client: SupabaseClient<Database>, uuid: string) {
  const { error, data } = await client
    .from('avatars_models')
    .select('model, id')
    .eq('uuid', uuid)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function getModelVersionFromModel(data: { model: string }) {
  return data.model as `${string}/${string}:${string}`;
}
