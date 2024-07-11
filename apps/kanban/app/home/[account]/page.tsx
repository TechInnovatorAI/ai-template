import Link from 'next/link';

import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { CardButton, CardButtonHeader } from '@kit/ui/card-button';
import { Heading } from '@kit/ui/heading';
import { PageBody, PageHeader } from '@kit/ui/page';

import { CreateBoardDialog } from '~/home/[account]/boards/_components/create-board-dialog';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getBoards, getCanCreateBoard } from '~/lib/kanban/boards/queries';

export const metadata = {
  title: 'Boards',
};

interface BoardsPageProps {
  params: {
    account: string;
  };
}

async function BoardsPage({ params }: BoardsPageProps) {
  const [boards, canCreateBoard] = await loadBoardData(params.account);

  return (
    <>
      <PageHeader title={`Boards`} description={`Manage your Boards`}>
        <CreateBoardDialog
          accountSlug={params.account}
          canCreateBoard={canCreateBoard}
        >
          <Button>
            <PlusCircleIcon className={'mr-2 w-4'} />

            <span>New Board</span>
          </Button>
        </CreateBoardDialog>
      </PageHeader>

      <PageBody>
        <BoardsList data={boards} accountSlug={params.account} />
      </PageBody>
    </>
  );
}

function BoardsList(
  props: React.PropsWithChildren<{
    data: Awaited<ReturnType<typeof getBoards>>;
    accountSlug: string;
  }>,
) {
  const { error, data } = props.data;

  if (error) {
    return (
      <Alert variant={'destructive'}>
        <AlertDescription>
          Sorry, we encountered an error while fetching your boards
        </AlertDescription>
      </Alert>
    );
  }

  if (!data.length) {
    return <EmptyState accountSlug={props.accountSlug} />;
  }

  return (
    <div className={'grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-8'}>
      {data.map((item) => {
        return (
          <CardButton key={item.id} asChild>
            <Link href={`${props.accountSlug}/boards/` + item.id.toString()}>
              <CardButtonHeader>
                <p>{item.name}</p>
              </CardButtonHeader>
            </Link>
          </CardButton>
        );
      })}
    </div>
  );
}

export default withI18n(BoardsPage);

function EmptyState(props: { accountSlug: string }) {
  return (
    <div className={'flex h-full w-full flex-col items-center justify-center'}>
      <div
        className={
          'flex flex-col items-center justify-center space-y-8 lg:p-24'
        }
      >
        <div className={'flex flex-col space-y-2'}>
          <Heading level={3}>Let&apos;s create your first Board</Heading>
        </div>

        <CreateBoardDialog accountSlug={props.accountSlug} canCreateBoard={true}>
          <Button className={'w-full'} size={'lg'}>
            <PlusCircleIcon className={'mr-4 h-6'} />
            <span>Create your first Board</span>
          </Button>
        </CreateBoardDialog>
      </div>
    </div>
  );
}

async function loadBoardData(slug: string) {
  const client = getSupabaseServerActionClient();
  const canCreateBoard = getCanCreateBoard(client, slug);
  const boards = getBoards(client, slug);

  return Promise.all([boards, canCreateBoard]);
}
