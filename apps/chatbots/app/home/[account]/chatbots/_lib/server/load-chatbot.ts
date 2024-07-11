import { cache } from 'react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';

import { createChatbotsService } from '~/home/[account]/chatbots/_lib/server/chatbots-service';
import { Database } from '~/lib/database.types';

/**
 * @name loadChatbot
 * @description Loads a chatbot from the database
 */
export const loadChatbot = cache((chatbotId: string) => {
  const client = getSupabaseServerComponentClient<Database>();
  const service = createChatbotsService(client);

  return service.getChatbot(chatbotId);
});
