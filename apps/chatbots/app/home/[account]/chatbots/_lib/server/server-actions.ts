'use server';

import { revalidatePath } from 'next/cache';

import { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import { Database } from '~/lib/database.types';

import { createChatbotsService } from '../../_lib/server/chatbots-service';

export const deleteChatbotAction = enhanceAction(async (data: FormData) => {
  const client = getSupabaseServerActionClient<Database>();
  const logger = await getLogger();

  const chatbotId = z.string().uuid().parse(data.get('chatbotId'));

  logger.info(
    {
      chatbotId,
    },
    `Deleting chatbot...`,
  );

  const results = await deleteChatbot(client, chatbotId);

  if (results[0].error) {
    logger.error(
      {
        chatbotId,
        error: results[0].error,
      },
      `Failed to delete chatbot.`,
    );

    throw new Error(`Failed to delete chatbot.`);
  }

  logger.info(
    {
      chatbotId,
    },
    `Chatbot deleted successfully.`,
  );

  if (results[1].error) {
    logger.error(
      {
        chatbotId,
        error: results[1].error,
      },
      `Failed to delete documents.`,
    );
  }

  revalidatePath(`/home/[account]`, `page`);
  revalidatePath(`/home/[account]/chatbots/[chatbot]`, `layout`);

  return {
    success: true,
  };
}, {});

async function deleteChatbot(
  client: SupabaseClient<Database>,
  chatbotId: string,
) {
  const service = createChatbotsService(client);
  const deleteChatbotPromise = service.deleteChatbot(chatbotId);

  const deleteDocumentsPromise = client
    .from('documents')
    .delete()
    .eq('metadata -> chatbot_id:uuid', `"${chatbotId}"`);

  return Promise.all([deleteChatbotPromise, deleteDocumentsPromise]);
}
