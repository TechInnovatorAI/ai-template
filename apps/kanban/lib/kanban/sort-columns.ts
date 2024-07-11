import { KanbanColumn } from '~/lib/kanban/types';

/**
 * Sorts the columns by their nextColumnId
 * @param columns
 */
function sortColumns(columns: KanbanColumn[]): KanbanColumn[] {
  // Create a set of all nextColumnIds
  const nextColumnIds = new Set(columns.map((column) => column.nextColumnId));

  // Find the first column (the one whose id is not in nextColumnIds)
  let currentColumn = columns.find((column) => !nextColumnIds.has(column.id));

  const sortedColumns: KanbanColumn[] = [];

  while (currentColumn) {
    sortedColumns.push(currentColumn);

    currentColumn = columns.find(
      (column) => column.id === (currentColumn as KanbanColumn).nextColumnId,
    );
  }

  return sortedColumns;
}

export default sortColumns;
