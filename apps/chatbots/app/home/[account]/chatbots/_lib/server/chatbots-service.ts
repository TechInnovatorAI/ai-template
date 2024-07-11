import { SupabaseClient } from '@supabase/supabase-js';

import { ChatbotSettings } from '@kit/chatbot-widget/chatbot';

import { Database, Json } from '~/lib/database.types';

type ChatbotTable = Database['public']['Tables']['chatbots'];

export function createChatbotsService(client: SupabaseClient<Database>) {
  return new ChatbotsService(client);
}

class ChatbotsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getChatbot(chatbotId: string) {
    const { data, error } = await this.client
      .from('chatbots')
      .select('*')
      .eq('id', chatbotId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async insertChatbot(chatbot: ChatbotTable['Insert']) {
    const { error, data } = await this.client
      .from('chatbots')
      .insert(chatbot)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateChatbot(chatbot: ChatbotTable['Update']) {
    return this.client
      .from('chatbots')
      .update(chatbot)
      .match({ id: chatbot.id });
  }

  async deleteChatbot(chatbotId: string) {
    return this.client.from('chatbots').delete().match({ id: chatbotId });
  }

  async getChatbotSettings(chatbotId: string) {
    const { data, error } = await this.client
      .from('chatbots')
      .select('settings, siteName: site_name')
      .eq('id', chatbotId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateChatbotSettings(chatbotId: string, settings: ChatbotSettings) {
    return this.client
      .from('chatbots')
      .update({ settings: settings as unknown as Json })
      .match({ id: chatbotId });
  }

  async deleteDocument(documentId: number) {
    return this.client.from('documents').delete().match({ id: documentId });
  }
}
