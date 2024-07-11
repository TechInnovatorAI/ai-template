import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;

export async function getTags(client: Client, boardId: string) {
  return client
    .from('tags')
    .select(
      `
        id,
        name,
        color,
        boardId: board_id
      `,
    )
    .eq('board_id', boardId);
}
