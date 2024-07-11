import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;

const TASKS_TABLE = 'tasks';

export function getTasks(
  client: Client,
  boardId: string,
  params: {
    tags: string[];
  },
) {
  const useInner = params.tags.length > 0;

  let query = client
    .from(TASKS_TABLE)
    .select(
      `
      id,
      name,
      dueDate: due_date,
      boardId: board_id,
      assigneeId: assignee_id,
      columnId: column_id,
      createdAt: created_at,
      updatedAt: updated_at,
      position,
      accountId: account_id,
      tags ${useInner ? '!inner' : ''} (
        id,
        name,
        color
      )
    `,
    )
    .eq('board_id', boardId);

  if (useInner) {
    query = query.in('tags.name', params.tags);
  }

  return query;
}

export function getTaskById(client: Client, taskId: string) {
  return client
    .from(TASKS_TABLE)
    .select(
      `
      id,
      name,
      body,
      dueDate: due_date,
      boardId: board_id,
      assigneeId: assignee_id,
      columnId: column_id,
      createdAt: created_at,
      updatedAt: updated_at,
      accountId: account_id,
      position,
      tags (
        id,
        name,
        color
      )
    `,
    )
    .eq('id', taskId)
    .single();
}
