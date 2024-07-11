// minimal types for the kanban _components to work correctly
import { Task } from '~/lib/kanban/tasks/types';

export type NullableId = string | null | undefined;

export interface KanbanColumn {
  id: NullableId;
  name: string;
  nextColumnId: NullableId;
}

export interface KanbanTask {
  id: Task['id'];
  name: Task['name'];
  columnId: Task['columnId'];
  position: Task['position'];
  tags: Task['tags'];
  dueDate?: Task['dueDate'];
}
