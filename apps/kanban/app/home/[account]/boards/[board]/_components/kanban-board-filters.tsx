'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { TaskTag } from '~/lib/kanban/tags/types';

import { TagsFilterDropdown } from './tag-filters-dropdown';

interface Filters {
  tags?: string[];
  assignees?: string[];
}

interface KanbanBoardFiltersProps {
  models: {
    tags?: TaskTag[];
    assignees?: string[];
  };
  filters: Filters;
}

export function KanbanBoardFilters(props: KanbanBoardFiltersProps) {
  return (
    <div>
      <TagsFilterDropdownContainer
        selected={props.filters.tags ?? []}
        models={props.models.tags ?? []}
      />
    </div>
  );
}

function TagsFilterDropdownContainer(
  props: React.PropsWithChildren<{
    models: TaskTag[];
    selected: string[];
    onChange?: (value: string[]) => void;
  }>,
) {
  const router = useRouter();

  const dispatchTagsChanged = useCallback(
    (tags: TaskTag[]) => {
      const url = new URL(window.location.href);
      const pathname = url.pathname;
      const names = tags.map((tag) => tag.name).join(',');
      const query = url.searchParams;

      if (names.length) {
        query.set('tags', names);
      } else {
        query.delete('tags');
      }

      const searchParams = query.size > 0 ? '?' + query.toString() : '';
      const path = [pathname, searchParams].join('');

      router.push(path);
    },
    [router],
  );

  return (
    <TagsFilterDropdown
      onChange={dispatchTagsChanged}
      models={props.models}
      selected={props.selected}
    />
  );
}