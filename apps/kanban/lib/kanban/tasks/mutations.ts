import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;
type Tables = Database['public']['Tables'];
type Tasks = Tables['tasks'];

export type UpdateTaskPayload = Tasks['Update'];

export function insertTask(client: Client, task: Tasks['Insert']) {
  return client.from('tasks').insert(task);
}

export function getCanCreateTask(client: Client, accountId: string) {
  return client.rpc('can_create_task', { target_account_id: accountId });
}

export function updateTask(
  client: Client,
  taskId: string,
  payload: Tasks['Update'],
) {
  return client.from('tasks').update(payload).match({ id: taskId });
}
