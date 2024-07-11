import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;

export function getBoards(client: Client, slug: string) {
  return client
    .from('boards')
    .select(
      `
      name,
      id,
      account_id !inner (slug)
    `,
      {
        count: 'exact',
      },
    )
    .eq('account_id.slug', slug);
}

export async function getCanCreateBoard(client: Client, slug: string) {
  const { error, data } = await client.rpc('can_create_board_by_slug', {
    account_slug: slug,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export function getBoardById(client: Client, boardId: string) {
  return client
    .from('boards')
    .select(
      `
      id,
      name,
      description,
      accountId: account_id,
      columns: boards_columns (
        id,
        name,
        boardId: board_id,
        nextColumnId: next_column_id
      )
    `,
    )
    .eq('id', boardId)
    .single();
}
