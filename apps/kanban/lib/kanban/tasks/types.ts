import { TaskTag } from '~/lib/kanban/tags/types';
import { NullableId } from '~/lib/kanban/types';

export interface Task {
  id: string;
  name: string;
  columnId: NullableId;
  position: number;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  accountId: string;
  boardId: string;
  tags: TaskTag[];
  body: string;
}
