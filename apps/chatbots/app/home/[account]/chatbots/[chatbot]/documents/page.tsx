import { notFound } from 'next/navigation';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { CrawlWebsiteModal } from '~/home/[account]/chatbots/[chatbot]/_components/crawl-website-modal';
import { DocumentsTable } from '~/home/[account]/chatbots/[chatbot]/_components/documents-table';
import { DocumentDialog } from '~/home/[account]/chatbots/[chatbot]/documents/_components/document-dialog';
import { loadChatbot } from '~/home/[account]/chatbots/_lib/server/load-chatbot';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

interface ChatbotPageParams {
  params: {
    account: string;
    chatbot: string;
  };

  searchParams: {
    page?: string;
    query?: string;
  };
}

export const metadata = {
  title: 'Documents',
};

async function ChatbotPage({ params, searchParams }: ChatbotPageParams) {
  const client = getSupabaseServerComponentClient<Database>();
  const chatbotId = params.chatbot;
  const page = searchParams.page ? +searchParams.page : 1;

  const [{ account }, chatbot] = await Promise.all([
    loadTeamWorkspace(params.account),
    loadChatbot(chatbotId),
  ]);

  if (!chatbot) {
    return notFound();
  }

  return (
    <PageBody className={'space-y-4'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading level={4}>
          <Trans i18nKey={'chatbot:documentsTab'} />
        </Heading>

        <p className={'text-sm text-muted-foreground'}>
          <Trans i18nKey={'chatbot:documentsTabSubheading'} />
        </p>
      </div>

      <ServerDataLoader
        client={client}
        page={page}
        table={'documents'}
        where={{
          chatbot_id: {
            eq: chatbotId,
          },
        }}
      >
        {(props) => {
          if (props.count === 0) {
            return (
              <EmptyState
                accountId={account.id}
                id={chatbot.id}
                url={chatbot.url}
              />
            );
          }

          return <DocumentsTable {...props} />;
        }}
      </ServerDataLoader>

      <DocumentDialog />
    </PageBody>
  );
}

export default withI18n(ChatbotPage);

function EmptyState(props: { id: string; url: string; accountId: string }) {
  return (
    <div
      className={
        'flex flex-1 flex-col items-center justify-center space-y-8 py-16'
      }
    >
      <div className={'flex flex-col items-center space-y-2'}>
        <Heading level={3}>No documents found</Heading>

        <p>Get started by crawling your website to train your chatbot</p>
      </div>

      <CrawlWebsiteModal
        accountId={props.accountId}
        chatbotId={props.id}
        url={props.url}
      >
        <Button size={'lg'} className={'text-center text-sm'}>
          Train Chatbot with Website
        </Button>
      </CrawlWebsiteModal>
    </div>
  );
}
