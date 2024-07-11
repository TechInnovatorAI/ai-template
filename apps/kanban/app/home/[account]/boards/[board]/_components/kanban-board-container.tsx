'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useParams, useSearchParams } from 'next/navigation';

import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { KanbanBoard } from '~/home/[account]/boards/[board]/_components/kanban-board';
import { KanbanBoardFilters } from '~/home/[account]/boards/[board]/_components/kanban-board-filters';
import { TaskDialog } from '~/home/[account]/boards/[board]/_components/task-dialog';
import {
  createColumnAction,
  deleteColumnAction,
  deleteTaskAction,
  insertTaskAction,
  moveColumnAction,
  moveTaskAction,
  updateColumnAction,
} from '~/home/[account]/boards/[board]/_lib/server/server-actions';
import { useKanbanStore } from '~/lib/kanban/kanban-store';
import { processKanbanColumnsState } from '~/lib/kanban/process-kanban-columns-state';
import { KanbanColumn, KanbanTask, NullableId } from '~/lib/kanban/types';

import { useBoardContextStore } from '../board-context-store';
import {NewTaskDialog} from "~/home/[account]/boards/[board]/_components/new-task-dialog";

const TEMP_TASK_ID = '__temp__';

export function KanbanBoardContainer<
  TaskType extends KanbanTask,
  ColumnType extends KanbanColumn,
>({
  columns,
  tasks,
  filters,
  openTask,
  accountId,
}: {
  accountId: string;
  columns: ColumnType[];
  tasks: TaskType[];
  openTask: string | undefined;
  filters: {
    tags: Array<{ name: string; color: string; id: number }>;
  };
}) {
  const {
    mountKanbanStore,
    unmountKanbanStore,
    storeColumns,
    addTask,
    updateTempTask,
    getColumnTasks,
  } = useKanbanStore(
    useShallow((store) => {
      return {
        mountKanbanStore: store.mount,
        unmountKanbanStore: store.unmount,
        storeColumns: store.columns,
        addTask: store.addTask,
        updateTempTask: store.updateTempTask,
        getColumnTasks: store.getColumnTasks.bind(store),
      };
    }),
  );

  const { mountContextStore, unmountContextStore, tags, mounted } =
    useBoardContextStore(
      useShallow((state) => {
        return {
          mountContextStore: state.mount,
          unmountContextStore: state.unmount,
          tags: state.tags,
          mounted: state.mounted,
        };
      }),
    );

  const boardId = useParams().board as string;
  const selectedFilters = useSelectedFilters();

  const [createTaskColumn, setCreateTaskColumn] = useState<NullableId>();
  const [selectedTask, setSelectedTask] = useState<string>();
  const isCreatingTask = createTaskColumn !== undefined;

  useEffect(() => {
    // Mount the store with the columns and tasks
    mountKanbanStore(columns, tasks);

    return unmountKanbanStore;
  }, [columns, mountKanbanStore, tasks, unmountKanbanStore]);

  useEffect(() => {
    mountContextStore({
      tags: filters.tags,
    });

    return unmountContextStore;
  }, [mountContextStore, unmountContextStore, filters.tags]);

  useEffect(() => {
    if (openTask) {
      setSelectedTask(openTask);
    }
  }, [openTask]);

  const onColumnCreateRequested = useCreateColumnAction(boardId, accountId);
  const onColumnDeleteRequested = useDeleteColumnAction();
  const onTaskDeleteRequested = useDeleteTaskAction();
  const onColumnEditRequested = useEditColumnAction();
  const onTaskMoveRequested = useTaskMoveRequestedAction();
  const onColumnMoveRequested = useColumnMoveRequestedAction();

  const boardColumns = useMemo(() => {
    if (mounted) {
      return storeColumns;
    }

    return processKanbanColumnsState(columns, tasks);
  }, [columns, mounted, storeColumns, tasks]);

  return (
    <>
      <div className={'flex flex-1 flex-col space-y-4'}>
        <KanbanBoardFilters filters={selectedFilters} models={{ tags }} />

        <KanbanBoard
          columns={boardColumns}
          onColumnCreateRequested={onColumnCreateRequested}
          onTaskCreateRequested={setCreateTaskColumn}
          onTaskDeleteRequested={onTaskDeleteRequested}
          onColumnDeleteRequested={onColumnDeleteRequested}
          onColumnEditRequested={onColumnEditRequested}
          onTaskMoveRequested={onTaskMoveRequested}
          onColumnMoveRequested={onColumnMoveRequested}
          onTaskClick={(task) => setSelectedTask(task.id)}
        />

        <TaskDialog
          taskId={selectedTask as string}
          isOpen={!!selectedTask}
          setIsOpen={() => setSelectedTask(undefined)}
        />

        <NewTaskDialog
          accountId={accountId}
          boardId={boardId}
          columnId={createTaskColumn}
          onTaskCreateRequested={async (task) => {
            setCreateTaskColumn(undefined);

            const position = getColumnTasks(task.columnId).length;

            const taskWithPosition = {
              ...task,
              position,
            };

            addTask({
              ...taskWithPosition,
              // add a temporary id to the task
              // we will replace it with the real id once the server responds
              id: TEMP_TASK_ID,
            });

            const response = await insertTaskAction({
              ...taskWithPosition,
              accountId,
            });

            if (response) {
              updateTempTask(response);
            }
          }}
          isOpen={isCreatingTask}
          setIsOpen={() => setCreateTaskColumn(undefined)}
        />
      </div>
    </>
  );
}

export default KanbanBoardContainer;

function useCreateColumnAction(boardId: string, accountId: string) {
  const { addColumn, updateColumn } = useKanbanStore(
    useShallow((state) => {
      return {
        addColumn: state.addColumn,
        updateColumn: state.updateColumn,
      };
    }),
  );

  return useCallback(async () => {
    const { operations } = await createColumnAction({ boardId, accountId });

    operations.forEach((operation) => {
      switch (operation.type) {
        case 'insert':
          addColumn({ ...operation.data, tasks: [], name: `Unnamed Column` });
          break;

        case 'update':
          updateColumn(operation.data);
          break;
      }
    });
  }, [addColumn, boardId, updateColumn]);
}

function useDeleteTaskAction() {
  const { deleteTask, updateTask } = useKanbanStore(
    useShallow((state) => {
      return {
        deleteTask: state.deleteTask,
        updateTask: state.updateTask,
      };
    }),
  );

  return useCallback(
    (taskId: string) => {
      notify(
        async () => {
          const operations = await deleteTaskAction({ taskId });

          operations.updates.forEach((task) => {
            updateTask(task);
          });

          operations.deletes.forEach((task) => {
            deleteTask(task.id);
          });
        },
        'Task deleted',
        'Deleting task...',
      );
    },
    [deleteTask, updateTask],
  );
}

function useDeleteColumnAction() {
  const { deleteColumn, updateColumn } = useKanbanStore(
    useShallow((state) => {
      return {
        deleteColumn: state.deleteColumn,
        updateColumn: state.updateColumn,
      };
    }),
  );

  return useCallback(
    (columnId: string) => {
      notify(
        async () => {
          const operations = await deleteColumnAction({ columnId });

          operations.forEach((operation) => {
            switch (operation.type) {
              case 'delete':
                deleteColumn(operation.data.id);
                break;

              case 'update':
                updateColumn(operation.data);
                break;
            }
          });
        },
        'Column deleted',
        'Deleting column...',
      );
    },
    [deleteColumn, updateColumn],
  );
}

function useEditColumnAction() {
  const updateColumn = useKanbanStore((state) => state.updateColumn);

  return useCallback(
    (params: { id: string; name: string }) => {
      notify(
        async () => {
          const operations = await updateColumnAction({ ...params });

          operations.forEach((operation) => {
            switch (operation.type) {
              case 'update':
                updateColumn(operation.data);
                break;
            }
          });
        },
        'Column updated',
        'Updating column...',
      );
    },
    [updateColumn],
  );
}

function useTaskMoveRequestedAction() {
  const moveTask = useKanbanStore((state) => state.moveTask);

  return useCallback(
    (taskId: string, columnId: NullableId, newIndex: number) => {
      moveTask(taskId, columnId, newIndex, async (operations) => {
        await moveTaskAction({ operations });
      });
    },
    [moveTask],
  );
}

function useColumnMoveRequestedAction() {
  const moveColumn = useKanbanStore((state) => state.moveColumn);

  return useCallback(
    (columnId: string, newPosition: number) => {
      moveColumn(columnId, newPosition, async (operations) => {
        await moveColumnAction({ operations });
      });
    },
    [moveColumn],
  );
}

function useSelectedFilters() {
  const params = useSearchParams();
  const tags = params.get('tags')?.split(',').filter(Boolean) || [];
  const assignees = params.get('assignees')?.split(',').filter(Boolean) || [];

  return {
    tags,
    assignees,
  };
}

function notify(
  promise: () => Promise<unknown>,
  success: string,
  loading: string,
) {
  return toast.promise(promise(), {
    loading,
    success,
    error: 'An error occurred while saving your changes',
    duration: 2000,
    position: 'bottom-right',
  });
}
