import Link from 'next/link';

import { ChevronRightIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { getBoardById } from '~/lib/kanban/boards/queries';
import { getTags } from '~/lib/kanban/tags/queries';
import { getTasks } from '~/lib/kanban/tasks/queries';

import { KanbanBoardContainer } from './_components/kanban-board-container';

type BoardUUID = string;

interface BoardPageProps {
  params: {
    account: string;
    board: BoardUUID;
  };

  searchParams: {
    tags?: string;
    task?: string;
  };
}

async function BoardPage({ params, searchParams }: BoardPageProps) {
  const tags = searchParams.tags?.split(',').filter(Boolean) ?? [];

  const data = await fetchBoardData(params.board, {
    tags,
  });

  return (
    <div className={'flex flex-col flex-1 overflow-y-hidden'}>
      <Header data={data} />

      <PageBody>
        <KanbanBoardContainer
          accountId={data.board.accountId}
          filters={{
            tags: data.tags,
          }}
          columns={data.board.columns}
          tasks={data.tasks}
          openTask={searchParams.task}
        />
      </PageBody>
    </div>
  );
}

export default BoardPage;

async function fetchBoardData(
  boardUid: string,
  params: {
    tags: string[];
  },
) {
  const client = getSupabaseServerComponentClient();

  const board = getBoardById(client, boardUid);
  const tasks = getTasks(client, boardUid, params);
  const tags = getTags(client, boardUid);

  const results = await Promise.all([board, tasks, tags]);

  const [boardResponse, tasksResponse, tagsResponse] = results;

  if (!boardResponse.data || boardResponse.error) {
    throw new Error(boardResponse.error?.message ?? 'Board not found');
  }

  if (tasksResponse.error) {
    throw new Error(tasksResponse.error.message);
  }

  return {
    board: boardResponse.data,
    tasks: tasksResponse.data,
    tags: tagsResponse.data ?? [],
  };
}

function Header({
  data,
}: {
  data: {
    board: {
      name: string;
      description?: string | null;
    };
  };
}) {
  return (
    <PageHeader
      description={data.board.description}
      title={
        <div className={'flex items-center space-x-2'}>
          <Link className={'hover:underline'} href={'../boards'}>
            Boards
          </Link>
          <ChevronRightIcon className={'w-4'} />
          <span>{data.board.name}</span>
        </div>
      }
    />
  );
}
