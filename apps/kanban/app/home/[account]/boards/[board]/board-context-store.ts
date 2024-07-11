import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { TaskTag } from '~/lib/kanban/tags/types';

interface KanbanBoardContextProps {
  mounted: boolean;

  tags: Array<{
    name: string;
    color: string;
    id: number;
  }>;

  setTags: (tags: TaskTag[]) => void;
  addTag: (tag: TaskTag) => void;

  mount: (params: { tags: KanbanBoardContextProps['tags'] }) => void;

  unmount: () => void;
}

export const useBoardContextStore = create<KanbanBoardContextProps>()(
  immer((set) => ({
    mounted: false,
    tags: [],
    setTags: (tags) => set(() => ({ tags })),
    addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
    mount: (params) =>
      set(() => ({
        tags: params.tags,
        mounted: true,
      })),
    unmount: () => set(() => ({ tags: [], mounted: false })),
  })),
);
