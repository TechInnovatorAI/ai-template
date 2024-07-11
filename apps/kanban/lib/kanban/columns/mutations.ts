import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;
const BOARDS_COLUMNS_TABLE = 'boards_columns';

export async function insertBoardColumn(
  client: Client,
  column: {
    boardId: string;
    accountId: string;
  },
) {
  const response = await client
    .from(BOARDS_COLUMNS_TABLE)
    .insert({
      board_id: column.boardId,
      account_id: column.accountId,
      next_column_id: null,
      name: `Unnamed Column`,
    })
    .select(`id`)
    .single();

  if (response.error) {
    throw response.error;
  }

  const nextColumnId = response.data.id;

  // update the next_column_id of the previous column
  // to the id of the newly inserted column
  // if the previous column exists
  const previousColumnId = await updateNextColumnId(client, {
    boardId: column.boardId,
    nextColumnId,
  });

  return {
    operations: [
      {
        type: 'insert',
        data: {
          id: nextColumnId,
          nextColumnId: null,
          tasks: [],
        },
      },
      {
        type: 'update',
        data: {
          id: previousColumnId,
          nextColumnId,
        },
      },
    ],
  };
}

export async function updateBoardColumnNextColumnId(
  client: Client,
  params: {
    columnId: string;
    nextColumnId: string;
  },
) {
  const { error, data } = await client
    .from(BOARDS_COLUMNS_TABLE)
    .update({ next_column_id: params.nextColumnId })
    .eq('next_column_id', params.columnId);

  if (error) throw error;

  return data;
}

export async function deleteColumnById(client: Client, columnId: string) {
  return client.from(BOARDS_COLUMNS_TABLE).delete().eq('id', columnId);
}

async function updateNextColumnId(
  client: Client,
  params: {
    boardId: string;
    nextColumnId: string;
  },
) {
  const { error, data } = await client
    .from(BOARDS_COLUMNS_TABLE)
    .update({ next_column_id: params.nextColumnId })
    .eq('board_id', params.boardId)
    .is('next_column_id', null)
    .neq('id', params.nextColumnId)
    .select('id')
    .maybeSingle();

  if (error) throw error;

  return data ? data.id : null;
}
