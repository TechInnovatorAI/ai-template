import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';
import { TaskTag } from '~/lib/kanban/tags/types';

type Client = SupabaseClient<Database>;

type TagId = number;

const TAGS_TABLE = 'tags';
const TASKS_TAGS_TABLE = 'tasks_tags';

export async function insertTags(
  client: Client,
  params: {
    boardId: string;
    tags: Array<Omit<TaskTag, 'id'>>;
  },
) {
  const payload = params.tags.map((tag) => {
    return {
      board_id: params.boardId,
      name: tag.name,
      color: tag.color ?? 'transparent',
    };
  });

  const { error, data: tags } = await client
    .from(TAGS_TABLE)
    .insert(payload)
    .select('id');

  if (error) throw error;

  return tags;
}

export async function assignTaskTags(
  client: Client,
  params: {
    taskId: string;
    added: TagId[];
    removed: TagId[];
  },
) {
  const inserts = params.added.map((tagId) => {
    return {
      task_id: params.taskId,
      tag_id: tagId,
    };
  });

  const table = client.from(TASKS_TAGS_TABLE);

  // remove tags from task if they are in the remove array
  if (params.removed.length) {
    await table
      .delete()
      .match({ task_id: params.taskId })
      .in('tag_id', params.removed);
  }

  // add tags to task if they are in the add array
  const { error } = await table.upsert(inserts, {
    onConflict: 'task_id,tag_id',
  });

  if (error) throw error;
}
