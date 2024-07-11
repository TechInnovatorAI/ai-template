import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { processKanbanColumnsState } from '~/lib/kanban/process-kanban-columns-state';
import { TaskTag } from '~/lib/kanban/tags/types';

import { KanbanColumn as Column, KanbanTask, NullableId } from './types';

type KanbanColumn = Column & {
  tasks: KanbanTask[];
};

interface KanbanState {
  columns: KanbanColumn[];
  mounted: boolean;

  addColumn: (column: KanbanColumn) => void;
  addTask: (task: KanbanTask) => void;

  updateTask: (task: Partial<KanbanTask> & { id: KanbanTask['id'] }) => void;
  updateTempTask: (
    task: Partial<KanbanTask> & { id: KanbanTask['id'] },
  ) => void;

  getTaskById: (taskId: string) => KanbanTask | undefined;
  updateTaskTags: (taskId: string, tags: TaskTag[]) => void;

  updateColumn: (
    column: Partial<KanbanColumn> & { id: KanbanColumn['id'] },
  ) => void;

  deleteTask: (id: string) => void;
  deleteColumn: (id: string) => void;

  moveTask: (
    taskId: string,
    columnId: NullableId,
    newIndex: number,
    callback: (
      operations: Array<{
        id: string;
        position: number;
        columnId: NullableId;
      }>,
    ) => void,
  ) => void;

  moveColumn: (
    columnId: string,
    nextColumnPosition: number,
    callback: (
      operations: Array<
        {
          id: string;
          nextColumnId: NullableId;
        } & Partial<KanbanColumn>
      >,
    ) => void,
  ) => void;

  getColumn: (columnId: NullableId) => KanbanColumn | undefined;
  getColumnTasks: (columnId: NullableId) => KanbanTask[];
  getTaskColumn: (taskId: string) => KanbanColumn | undefined;

  mount: (columns: Column[], tasks: KanbanTask[]) => void;
  unmount: () => void;
}

const TEMP_TASK_ID = '__temp__';

export const useKanbanStore = create<KanbanState>()(
  immer((set) => ({
    mounted: false,
    columns: [],
    mount(columns: Column[], tasks: KanbanTask[]) {
      const cols = processKanbanColumnsState(columns, tasks);

      return set({ columns: cols, mounted: true });
    },
    unmount() {
      return set({ columns: [], mounted: false });
    },
    addColumn(column: KanbanColumn) {
      const data = {
        ...column,
        tasks: [],
      };

      return set((state) => ({ columns: [...state.columns, data] }));
    },
    getColumn(columnId: NullableId) {
      return this.columns.find((column) => column.id === columnId);
    },
    getColumnTasks(columnId: NullableId) {
      return this.columns.find((column) => column.id === columnId)?.tasks ?? [];
    },
    getTaskColumn(taskId: string) {
      return this.columns.find((column) => {
        return column.tasks.some((task) => task.id === taskId);
      });
    },
    addTask(task: KanbanTask) {
      return set((state) => {
        const column = state.getColumn(task.columnId);

        if (!column) return;

        addTask(column, task);
      });
    },
    updateTask(task: Partial<KanbanTask> & { id: KanbanTask['id'] }) {
      return set((state) => {
        const column = state.getColumn(task.columnId);

        if (!column) return;

        column.tasks = column.tasks.map((t) =>
          t.id === task.id ? { ...t, ...task } : t,
        );
      });
    },
    updateTempTask(task: Partial<KanbanTask> & { id: KanbanTask['id'] }) {
      return set((state) => {
        const column = state.getColumn(task.columnId);

        if (!column) return;

        column.tasks = column.tasks.map((t) =>
          t.id === TEMP_TASK_ID ? { ...t, ...task } : t,
        );
      });
    },
    updateColumn(column: Partial<KanbanColumn> & { id: KanbanColumn['id'] }) {
      return set((state) => ({
        columns: state.columns.map((c) =>
          c.id === column.id ? { ...c, ...column } : c,
        ),
      }));
    },
    deleteTask(id) {
      return set((state) => {
        const column = state.getTaskColumn(id);

        if (!column) return;

        column.tasks = column.tasks.filter((t) => t.id !== id);
      });
    },
    deleteColumn(columnId) {
      return set((state) => ({
        columns: state.columns.filter((c) => c.id !== columnId),
      }));
    },
    getTaskById(taskId) {
      return this.columns
        .map((column) => column.tasks)
        .flat()
        .find((task) => task.id === taskId);
    },
    moveTask(taskId, columnId, newIndex, callback) {
      return set((state) => {
        const task = state.getTaskById(taskId);

        if (!task) {
          console.warn('Task not found. Moving task aborted.');
          return;
        }

        const columnTarget = state.getColumn(columnId);

        if (!columnTarget) {
          console.warn('Column not found. Moving task aborted.');
          return;
        }

        const changes = moveTask(
          [...state.columns],
          task.columnId,
          columnId,
          taskId,
          newIndex,
          newIndex > columnTarget.tasks.length,
        ).map((task) => {
          return {
            id: task.id,
            position: task.position,
            columnId: task.columnId,
          };
        });

        for (const change of changes) {
          const task = state.getTaskById(change.id);

          if (!task) {
            console.warn('Task not found. Moving task aborted.');
            return;
          }

          task.position = change.position;
          task.columnId = change.columnId;
        }

        callback(changes);
      });
    },
    moveColumn(columnId, nextColumnPosition, callback) {
      return set((state) => {
        const nextColumnId = state.columns[nextColumnPosition]?.id;

        if (!nextColumnId) {
          console.warn('Column not found. Moving column aborted.');
          return;
        }

        const columns = state.columns as Array<KanbanColumn & { id: string }>;
        const changes = moveCol(columns, columnId, nextColumnId);

        callback(changes);
      });
    },
    updateTaskTags(taskId, tags) {
      return set((state) => {
        const task = state.getTaskById(taskId);

        if (!task) {
          console.warn('Task not found. Updating task tags aborted.');
          return;
        }

        task.tags = tags;
      });
    },
  })),
);

function moveTask(
  columns: KanbanColumn[],
  fromColumnId: NullableId,
  toColumnId: NullableId,
  fromTaskId: string,
  toTaskIndex: number,
  isLastInColumn?: boolean,
) {
  const fromColumn = columns.find((column) => column.id === fromColumnId);
  const toColumn = columns.find((column) => column.id === toColumnId);

  if (fromColumn && toColumn) {
    const fromTaskIndex = fromColumn.tasks.findIndex(
      (task) => task.id === fromTaskId,
    );

    if (fromTaskIndex !== -1 && toTaskIndex !== -1) {
      const affectedTasks = new Set<KanbanTask>();
      const targetColumn = fromColumnId === toColumnId ? fromColumn : toColumn;

      if (fromColumnId === toColumnId) {
        // Reorder tasks within the same column
        const [fromTask] = fromColumn.tasks.splice(fromTaskIndex, 1);

        if (fromTask) {
          if (isLastInColumn) {
            fromColumn.tasks.push(fromTask);
          } else {
            fromColumn.tasks.splice(toTaskIndex, 0, fromTask);
          }
        }
      } else {
        // Move task between different columns
        const [fromTask] = fromColumn.tasks.splice(fromTaskIndex, 1);

        if (fromTask) {
          fromTask.columnId = toColumnId;

          if (isLastInColumn) {
            targetColumn.tasks.push(fromTask);
          } else {
            targetColumn.tasks.splice(toTaskIndex, 0, fromTask);
          }
        }
      }

      // Update nextTaskId for tasks in the fromColumn and toColumn
      [fromColumn, toColumn].forEach((column) => {
        column.tasks.forEach((task, index) => {
          const oldPosition = task.position;

          task.position = index;

          if (oldPosition !== task.position || task.id === fromTaskId) {
            affectedTasks.add(task);
          }
        });
      });

      return Array.from(affectedTasks);
    }
  }

  return [];
}

function addTask(column: KanbanColumn, task: KanbanTask) {
  column.tasks.push(task);

  // return affected tasks
  return [task];
}

function moveCol(
  columns: Array<KanbanColumn & { id: string }>,
  sourceColumn: string,
  targetColumn: string,
) {
  const map = new Map();

  for (const column of columns) {
    map.set(column.id, column.nextColumnId);
  }

  const index1 = columns.findIndex((col) => col.id === sourceColumn);
  const index2 = columns.findIndex((col) => col.id === targetColumn);

  if (index1 !== -1 && index2 !== -1) {
    // Swap columns in the array by index
    const temp = columns[index1];

    columns[index1] = columns[index2]!;
    columns[index2] = temp!;

    // Identify affected columns
    return columns
      .map((col, index) => {
        const isLast = index === columns.length - 1;
        const nextIndex = index + 1;
        const nextColumnId = isLast ? null : columns[nextIndex]?.id;

        col.nextColumnId = nextColumnId;

        return {
          id: col.id as string,
          nextColumnId,
        };
      })
      .filter((col) => col.id)
      .filter((col) => {
        // filter the columns that have changed
        const previousNextColumnId = map.get(col.id);

        return col.nextColumnId !== previousNextColumnId;
      });
  }

  return [];
}
