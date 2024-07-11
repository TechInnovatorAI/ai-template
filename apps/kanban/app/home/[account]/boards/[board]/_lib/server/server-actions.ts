'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { createNotificationsApi } from '@kit/notifications/api';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import {
  deleteColumnById,
  insertBoardColumn,
  updateBoardColumnNextColumnId,
} from '~/lib/kanban/columns/mutations';
import { getBoardColumn } from '~/lib/kanban/columns/queries';
import { assignTaskTags, insertTags } from '~/lib/kanban/tags/mutations';
import { insertTask } from '~/lib/kanban/tasks/mutations';

export const insertTaskAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerActionClient();
    const task = getInsertTaskBodySchema().parse(data);

    const payload = {
      board_id: task.boardId,
      account_id: data.accountId,
      name: task.name,
      body: task.body ?? '',
      assignee_id: task.assigneeId,
      position: task.position,
    };

    const insertPayload = task.columnId
      ? { ...payload, column_id: task.columnId }
      : payload;

    const { data: latestPosition } = await client
      .from('tasks')
      .select('position')
      .eq('board_id', task.boardId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    // we need to increment the position of the task being inserted
    // if there are no tasks in the board then the position will be 0
    // since we cannot trust the position sent by the client
    if (latestPosition) {
      insertPayload.position = latestPosition.position + 1;
    }

    const response = await insertTask(client, insertPayload)
      .select(
        `
        id,
        boardId: board_id,
        name,
        body,
        assigneeId: assignee_id,
        columnId: column_id,
        createdAt: created_at,
        updatedAt: updated_at,
        position
      `,
      )
      .single();

    if (response.error) throw response.error;

    const tags = task.tags ?? [];

    // if the task is inserted with tags then we need to assign them
    // and assign the tags to the task using the join table task_tags
    if (tags.length) {
      await assignTaskTags(client, {
        taskId: response.data.id,
        added: tags.map((tag) => tag.id),
        removed: [],
      });
    }

    // we attach the tasks to the object so it gets updated in the store
    // and the UI gets updated
    Object.assign(response.data, {
      tags,
    });

    // if the task is assigned to a user then we need to send a notification
    // to the user that the task was assigned to (unless the user is the one
    // who assigned the task)
    const assigneeId = response.data.assigneeId;

    if (assigneeId) {
      // if the user is the one who assigned the task then we don't send
      // a notification
      if (assigneeId === user.id) {
        return;
      }

      const adminClient = getSupabaseServerActionClient({
        admin: true,
      });

      const notificationsService = createNotificationsApi(adminClient);

      const account = await client
        .from('accounts')
        .select('slug')
        .eq('id', data.accountId)
        .single();

      await notificationsService.createNotification({
        account_id: assigneeId,
        link: `/home/${account.data?.slug}/boards/${response.data.boardId}/?task=${response.data.id}`,
        body: `You have been assigned to the task: ${response.data.name}`,
      });
    }

    // revalidate the board page so the UI gets updated when the user
    // navigates back to the board
    revalidateBoardPage();

    // send task to client so it can be updated
    return response.data;
  },
  {
    schema: getInsertTaskBodySchema(),
  },
);

export const deleteTaskAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();

    const { data, error } = await client.rpc('delete_task_and_reorder', {
      task_id: params.taskId,
    });

    if (error) {
      throw error;
    }

    const updates = data.map((item) => {
      return {
        id: item.affected_task_id,
        position: item.new_position,
      };
    });

    const deletes = [
      {
        id: params.taskId,
      },
    ];

    revalidateBoardPage();

    return { updates, deletes };
  },
  {
    schema: z.object({
      taskId: z.string().uuid(),
    }),
  },
);

export const createColumnAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();
    const column = await insertBoardColumn(client, params);

    revalidateBoardPage();

    return column;
  },
  {
    schema: z.object({
      boardId: z.string().uuid(),
      accountId: z.string().uuid(),
    }),
  },
);

export const deleteColumnAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();
    const operations = [];
    const columnResponse = await getBoardColumn(client, params.columnId);

    if (columnResponse.error) {
      throw columnResponse.error;
    }

    const nextColumnId = columnResponse.data.nextColumnId;

    // if the column being deleted is not the last column in the board
    // then we need to update the next_column_id of the previous column
    // with the next_column_id of the column being deleted
    if (nextColumnId) {
      await updateBoardColumnNextColumnId(client, {
        columnId: params.columnId,
        nextColumnId,
      });

      operations.push({
        type: 'update',
        data: {
          id: columnResponse.data.id,
          nextColumnId,
        },
      });
    }

    await deleteColumnById(client, params.columnId);

    operations.push({
      type: 'delete',
      data: {
        id: params.columnId,
      },
    });

    revalidateBoardPage();

    return operations;
  },
  {
    schema: z.object({
      columnId: z.string().uuid(),
    }),
  },
);

export const updateColumnAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();

    const result = await client
      .from('boards_columns')
      .update({ name: params.name })
      .eq('id', params.id);

    if (result.error) throw result.error;

    revalidateBoardPage();

    return [
      {
        type: 'update',
        data: {
          id: params.id,
          name: params.name,
        },
      },
    ];
  },
  {
    schema: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255),
    }),
  },
);

export const moveTaskAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();

    const requests = params.operations.map((operation) => {
      return client
        .from('tasks')
        .update({
          position: operation.position,
          column_id: operation.columnId,
        })
        .match({ id: operation.id });
    });

    await Promise.all(requests);

    revalidateBoardPage();
  },
  {
    schema: z.object({
      operations: z.array(
        z.object({
          id: z.string().uuid(),
          position: z.number().min(0),
          columnId: z.string().uuid().nullish(),
        }),
      ),
    }),
  },
);

export const moveColumnAction = enhanceAction(
  async (params) => {
    const client = getSupabaseServerActionClient();

    const requests = params.operations.map((operation) => {
      return client
        .from('boards_columns')
        .update({
          next_column_id: operation.nextColumnId,
        })
        .match({ id: operation.id });
    });

    await Promise.all(requests);

    revalidateBoardPage();
  },
  {
    schema: z.object({
      operations: z.array(
        z.object({
          id: z.string().uuid(),
          nextColumnId: z.string().uuid().nullish(),
        }),
      ),
    }),
  },
);

export const insertNewTagAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerActionClient();

    const tags = await insertTags(client, {
      boardId: data.boardId,
      tags: [
        {
          name: data.name,
          color: data.color ?? 'transparent',
        },
      ],
    });

    revalidateBoardPage();

    return tags;
  },
  {
    schema: z.object({
      boardId: z.string().uuid(),
      name: z.string().min(1).max(255),
      color: z.string().nullish().default('transparent'),
    }),
  },
);

function getInsertTaskBodySchema() {
  return z.object({
    boardId: z.string().uuid(),
    name: z.string().min(1).max(255),
    body: z.string().optional(),
    assigneeId: z.string().uuid().nullish(),
    columnId: z.string().uuid().nullish(),
    accountId: z.string().uuid(),
    position: z.number().min(0),
    tags: z
      .array(
        z.object({
          name: z.string().min(1).max(255),
          id: z.number(),
          color: z.string().nullish().default('transparent'),
        }),
      )
      .optional(),
  });
}

function revalidateBoardPage() {
  revalidatePath(`/home/[account]/boards/[board]`, 'page');
}
