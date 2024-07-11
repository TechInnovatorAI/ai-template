'use client';

import { useEffect, useState } from 'react';

import { useFormStatus } from 'react-dom';

import { usePathname } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { Dialog, DialogContent } from '@kit/ui/dialog';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { TagsFilterDropdown } from '~/home/[account]/boards/[board]/_components/tag-filters-dropdown';
import { useBoardContextStore } from '~/home/[account]/boards/[board]/board-context-store';
import { TaskTag } from '~/lib/kanban/tags/types';
import { getCanCreateTask } from '~/lib/kanban/tasks/mutations';
import { NullableId } from '~/lib/kanban/types';

type OnTaskCreateRequested = (task: {
  boardId: string;
  columnId: NullableId;
  name: string;
  body: string;
  assigneeId: string | null;
  tags: TaskTag[];
  dueDate: string | null;
}) => void;

type NewTaskModalProps = React.PropsWithChildren<{
  accountId: string;
  boardId: string;
  columnId: NullableId;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onTaskCreateRequested: OnTaskCreateRequested;
}>;

export function NewTaskDialog(props: NewTaskModalProps) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
      <DialogContent>
        <>
          <NewTaskFormContainer
            accountId={props.accountId}
            boardId={props.boardId}
            columnId={props.columnId}
            onTaskCreateRequested={props.onTaskCreateRequested}
          />
        </>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskFormContainer(
  props: React.PropsWithChildren<{
    accountId: string;
    boardId: string;
    columnId: NullableId;
    onTaskCreateRequested: OnTaskCreateRequested;
  }>,
) {
  const canCreateTask = useCanCreateTask(props.accountId);

  if (canCreateTask.error) {
    return <CannotCreateTaskAlert />;
  }

  if (canCreateTask.isLoading) {
    return <LoadingOverlay fullPage={false} />;
  }

  if (!canCreateTask.data) {
    return <CannotCreateTaskAlert />;
  }

  return (
    <NewTaskForm
      onTaskCreateRequested={props.onTaskCreateRequested}
      boardId={props.boardId}
      columnId={props.columnId}
    />
  );
}

function NewTaskForm(props: {
  boardId: string;
  columnId: NullableId;
  onTaskCreateRequested: OnTaskCreateRequested;
}) {
  const tags = useBoardContextStore((state) => state.tags);
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);
  const selectedTagsNames = selectedTags.map((tag) => tag.name);

  useEffect(() => {
    return () => {
      setSelectedTags([]);
    };
  }, []);

  return (
    <form
      action={(data) => {
        const name = data.get('name') as string;
        const body = (data.get('body') as string) || '';
        const assigneeId = (data.get('assignee') as string) || null;

        const task = {
          boardId: props.boardId,
          columnId: props.columnId,
          name,
          body,
          assigneeId,
          tags: selectedTags,
          dueDate: null,
        };

        props.onTaskCreateRequested(task);
      }}
    >
      <div className={'flex flex-col space-y-4'}>
        <div className={'flex flex-col space-y-4'}>
          <input
            autoComplete={'off'}
            className={
              'border-transparent bg-background text-xl font-medium outline-none'
            }
            placeholder={'Task title'}
            required
            type={'text'}
            name={'name'}
          />

          <textarea
            className={
              'min-h-48 resize-none border-transparent bg-background' +
              ' outline-none'
            }
            name={'body'}
            placeholder={'Add description...'}
          />
        </div>

        <div className={'flex items-center justify-between'}>
          <TagsFilterDropdown
            models={tags}
            selected={selectedTagsNames}
            onChange={setSelectedTags}
          />

          <div>
            <SubmitButton />
          </div>
        </div>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending}>Create Task</Button>;
}

function SelectMemberAssigneeDropdown() {
  const membersQuery = useOrganizationMembers();

  if (membersQuery.error ?? !membersQuery.data) {
    return null;
  }

  const members = membersQuery.data ?? [];

  return (
    <Select name={'assignee'}>
      <SelectTrigger asChild>
        <Button size={'sm'} variant={'outline'}>
          <SelectValue placeholder={'Assign to member'} />
          <ChevronDownIcon className={'ml-2.5 w-4'} />
        </Button>
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Assign to member</SelectLabel>

          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.displayName ?? member.email}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function useOrganizationMembers() {
  const pathName = usePathname();
  const endpoint = pathName + '/members';

  return useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint, {
        method: 'GET',
      });

      const json = await response.json();

      return json as Array<{
        id: string;
        displayName: string | null;
        photoURL: string | null;
        email: string | null;
      }>;
    },
  });
}

function CannotCreateTaskAlert() {
  return (
    <Alert variant={'warning'}>
      <AlertTitle>Cannot create task</AlertTitle>
      <AlertDescription>
        You do not have permission to create tasks in this board. Please upgrade
        your plan to create more tasks.
      </AlertDescription>
    </Alert>
  );
}

function useCanCreateTask(accountId: string) {
  const client = useSupabase();
  const queryKey = ['can-create-task', accountId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!accountId) {
        return { data: false };
      }

      const response = await getCanCreateTask(client, accountId);

      return response.data;
    },
  });
}
