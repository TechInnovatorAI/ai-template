import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

export function createDocumentsService(client: SupabaseClient<Database>) {
  return new DocumentsService(client);
}

class DocumentsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getDocumentByHash(params: { hash: string; chatbotId: string }) {
    return this.client
      .from('documents')
      .select('*')
      .eq('hash', params.hash)
      .eq('chatbot_id', params.chatbotId)
      .single();
  }

  insertDocument(params: {
    title: string;
    content: string;
    hash: string;
    chatbotId: string;
  }) {
    return this.client
      .from('documents')
      .insert({
        title: params.title,
        chatbot_id: params.chatbotId,
        content: params.content,
        hash: params.hash,
      })
      .select('id')
      .single();
  }
}
