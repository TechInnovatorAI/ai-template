import { useEffect, useState } from 'react';

import { ChevronDownIcon, PlusCircleIcon } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';

import { TaskTag } from '~/lib/kanban/tags/types';

import { CreateTagDialog } from './create-tag-dialog';

/**
 * Renders a dropdown menu for filtering tags.
 *
 * @param {React.PropsWithChildren} props - The component props.
 * @param {TaskTag[]} props.models - The list of tags to display in the dropdown.
 * @param {string[]} props.selected - The list of selected tags.
 * @param {(value: string[]) => void} props.onChange - The callback function to be called when the selected tags change.
 **/
export function TagsFilterDropdown(
  props: React.PropsWithChildren<{
    models: TaskTag[];
    selected: string[];
    onChange: (value: TaskTag[]) => void;
  }>,
) {
  const [models, setModels] = useState<TaskTag[]>(props.models);
  const selectedTags = props.selected.length;

  const label =
    selectedTags === 1 ? props.selected[0] : `${selectedTags} Tags selected`;

  const getTagsModelsByName = (names: string[]) => {
    return names
      .map((name) => models.find((tag) => tag.name === name))
      .filter(Boolean) as TaskTag[];
  };

  useEffect(() => {
    setModels(props.models);
  }, [props.models]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={'outline'}>
          <span>{selectedTags ? label : `No tag selected`}</span>
          <ChevronDownIcon className={'ml-2 w-4'} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>Tags</DropdownMenuLabel>

        <If condition={!props.models.length}>
          <DropdownMenuItem unselectable={'on'}>No tags found</DropdownMenuItem>
        </If>

        {models.map((tag) => {
          const isSelected = props.selected.includes(tag.name);

          return (
            <DropdownMenuItem key={tag.name} className={'h-8 w-full'}>
              <DropdownMenuCheckboxItem
                className={'w-full'}
                onCheckedChange={(checked) => {
                  let selected: string[];

                  if (checked) {
                    selected = [...props.selected, tag.name];
                  } else {
                    selected = props.selected.filter(
                      (item) => item !== tag.name,
                    );
                  }

                  const tags = getTagsModelsByName(selected);

                  props.onChange(tags);
                }}
                checked={isSelected}
              >
                <span className={'flex items-center space-x-2'}>
                  <span
                    className={'block h-4 w-4 rounded'}
                    style={{ backgroundColor: tag.color }}
                  />

                  <span>{tag.name}</span>
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <CreateTagDialog
          onCreated={(tag) => {
            setModels([...models, tag]);
          }}
        >
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <PlusCircleIcon className={'mr-2 w-4'} />
            <span>Create Tag</span>
          </DropdownMenuItem>
        </CreateTagDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
