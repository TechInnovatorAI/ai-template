import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;

const BOARDS_COLUMNS_TABLE = 'boards_columns';

export async function getBoardColumn(client: Client, columnId: string) {
  return client
    .from(BOARDS_COLUMNS_TABLE)
    .select(
      `
      id,
      name,
      nextColumnId: next_column_id
      `,
    )
    .eq('id', columnId)
    .single();
}
