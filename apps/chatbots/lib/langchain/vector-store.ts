import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';

import { Database } from '~/lib/database.types';

export function getVectorStore(client: SupabaseClient<Database>) {
  return SupabaseVectorStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client,
    tableName: 'documents_embeddings',
    queryName: 'match_documents',
  });
}
