import { SupabaseClient } from '@supabase/supabase-js';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { ChatbotsTable } from '~/home/[account]/chatbots/[chatbot]/_components/chatbots-table';
import { CreateChatbotModal } from '~/home/[account]/chatbots/[chatbot]/_components/create-chatbot-modal';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

export const metadata = {
  title: 'Chatbots',
};

interface ChatbotsPageProps {
  params: {
    account: string;
  };

  searchParams: {
    page?: string;
  };
}

async function ChatbotsPage({ params, searchParams }: ChatbotsPageProps) {
  const client = getSupabaseServerComponentClient<Database>();

  const page = searchParams.page ? +searchParams.page : 1;

  const { canCreateChatbot, accountId } = await loadData(
    client,
    params.account,
  );

  return (
    <>
      <PageHeader
        title={<Trans i18nKey={'chatbot:chatbotsTabLabel'} />}
        description={<Trans i18nKey={'chatbot:chatbotsTabDescription'} />}
      >
        <CreateChatbotModal
          accountId={accountId}
          canCreateChatbot={canCreateChatbot}
        >
          <Button>
            <PlusCircleIcon className={'mr-2 w-4'} />

            <span>Add Chatbot</span>
          </Button>
        </CreateChatbotModal>
      </PageHeader>

      <PageBody>
        <ServerDataLoader
          client={client}
          table={'chatbots'}
          page={page}
          where={{
            account_id: {
              eq: accountId,
            },
          }}
        >
          {(props) => {
            if (!props.data.length && canCreateChatbot) {
              return <EmptyState accountId={accountId} />;
            }

            return <ChatbotsTable {...props} />;
          }}
        </ServerDataLoader>
      </PageBody>
    </>
  );
}

export default withI18n(ChatbotsPage);

function EmptyState({ accountId }: { accountId: string }) {
  return (
    <div className={'flex h-full w-full flex-col items-center justify-center'}>
      <div
        className={
          'flex flex-col items-center justify-center space-y-8 lg:p-24'
        }
      >
        <div className={'flex flex-col space-y-2'}>
          <Heading>
            <Trans i18nKey={'chatbot:chatbotsEmptyStateHeading'} />
          </Heading>

          <Heading level={3} className={'font-medium text-muted-foreground'}>
            <Trans i18nKey={'chatbot:chatbotsEmptyStateSubheading'} />
          </Heading>
        </div>

        <CreateChatbotModal accountId={accountId} canCreateChatbot={true}>
          <Button size={'lg'}>
            <PlusCircleIcon className={'mr-4 h-6'} />

            <span>
              <Trans i18nKey={'chatbot:chatbotsEmptyStateButton'} />
            </span>
          </Button>
        </CreateChatbotModal>
      </div>
    </div>
  );
}

async function loadData(client: SupabaseClient<Database>, slug: string) {
  const { account } = await loadTeamWorkspace(slug);

  const canCreateChatbot = await client
    .rpc('can_create_chatbot', {
      target_account_id: account.id,
    })
    .then((response) => {
      if (response.error) {
        console.error(response.error);

        return false;
      }

      return response.data;
    });

  return { canCreateChatbot, accountId: account.id };
}
