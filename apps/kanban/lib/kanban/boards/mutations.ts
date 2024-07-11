import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;
type Tables = Database['public']['Tables'];
type Boards = Tables['boards'];

export function insertBoard(
  client: Client,
  board: {
    name: string;
    description?: string;
    accountId: string;
  },
) {
  return client.from('boards').insert({
    name: board.name,
    description: board.description,
    account_id: board.accountId,
  });
}

export function deleteBoard(client: Client, boardId: number) {
  return client.from('boards').delete().eq('id', boardId);
}

export function updateBoard(
  client: Client,
  taskId: number,
  task: Boards['Update'],
) {
  return client.from('boards').update(task).eq('id', taskId);
}
