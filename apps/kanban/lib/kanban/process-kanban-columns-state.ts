import sortColumns from '~/lib/kanban/sort-columns';
import { KanbanColumn, KanbanTask, NullableId } from '~/lib/kanban/types';

const UNASSIGNED_COLUMN_ID = null;
const UNASSIGNED_COLUMN_NAME = 'Unassigned';

export function processKanbanColumnsState(
  columns: KanbanColumn[],
  tasks: KanbanTask[],
) {
  const unassignedColumn = {
    id: UNASSIGNED_COLUMN_ID,
    name: UNASSIGNED_COLUMN_NAME,
    nextColumnId: null,
    tasks: [],
  };

  const orderedColumns = [unassignedColumn, ...sortColumns(columns)];

  const taskMap: Map<NullableId, KanbanTask[]> = new Map();

  tasks.sort((a, b) => {
    if (a.id === null) return -1;
    if (b.id === null) return 1;

    return a.position - b.position;
  });

  tasks.forEach((task) => {
    if (!taskMap.has(task.columnId)) {
      taskMap.set(task.columnId, []);
    }

    taskMap.get(task.columnId)?.push(task);
  });

  return orderedColumns.map((column) => {
    return {
      ...column,
      tasks: taskMap.get(column.id) || [],
    };
  });
}
