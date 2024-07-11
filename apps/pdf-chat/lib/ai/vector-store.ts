import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

import { getEmbeddingsModel } from '~/lib/ai/embeddings-model';
import { Database } from '~/lib/database.types';

export async function getVectorStore(client: SupabaseClient<Database>) {
  const embeddings = getEmbeddingsModel();

  return SupabaseVectorStore.fromExistingIndex(embeddings, {
    client,
    tableName: 'documents_embeddings',
    queryName: 'match_documents',
  });
}
