import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { loadChatbot } from '~/home/[account]/chatbots/_lib/server/load-chatbot';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

import { CrawlWebsiteModal } from '../_components/crawl-website-modal';
import { JobsTable } from './_components/jobs-table';

interface ChatbotTrainingPageParams {
  params: {
    account: string;
    chatbot: string;
  };

  searchParams: {
    page?: string;
  };
}

export const metadata = {
  title: 'Training',
};

async function ChatbotTrainingPage({
  params,
  searchParams,
}: ChatbotTrainingPageParams) {
  const client = getSupabaseServerComponentClient<Database>();
  const page = searchParams.page ? +searchParams.page : 1;
  const chatbot = await loadChatbot(params.chatbot);

  return (
    <PageBody className={'space-y-4'}>
      <div className={'flex items-end justify-between space-x-4'}>
        <div className={'flex flex-col space-y-2'}>
          <Heading level={4}>
            <Trans i18nKey={'chatbot:trainingTab'} />
          </Heading>

          <p className={'text-sm text-muted-foreground'}>
            <Trans i18nKey={'chatbot:trainingTabSubheading'} />
          </p>
        </div>

        <div>
          <TrainingButton
            accountId={chatbot.account_id}
            chatbotId={chatbot.id}
            url={chatbot.url}
          />
        </div>
      </div>

      <ServerDataLoader
        client={client}
        table={'jobs'}
        camelCase
        page={page}
        where={{
          chatbot_id: {
            eq: chatbot.id,
          },
        }}
      >
        {({ data, count, pageSize }) => {
          if (!count) {
            return (
              <EmptyState
                accountId={chatbot.account_id}
                chatbotId={chatbot.id}
                url={chatbot.url}
              />
            );
          }

          return (
            <JobsTable
              jobs={data}
              page={page}
              perPage={pageSize}
              count={count}
            />
          );
        }}
      </ServerDataLoader>
    </PageBody>
  );
}

export default withI18n(ChatbotTrainingPage);

function TrainingButton(props: {
  chatbotId: string;
  url: string;
  accountId: string;
}) {
  return (
    <div className={'flex'}>
      <CrawlWebsiteModal {...props}>
        <Button size={'sm'} variant={'outline'}>
          <PlusCircleIcon className={'mr-2 h-4 w-4'} />

          <span>
            <Trans i18nKey={'chatbot:trainChatbotButton'} />
          </span>
        </Button>
      </CrawlWebsiteModal>
    </div>
  );
}

function EmptyState(props: {
  chatbotId: string;
  url: string;
  accountId: string;
}) {
  return (
    <>
      <div
        className={
          'flex flex-1 flex-col items-center justify-center space-y-8 py-16'
        }
      >
        <div className={'flex flex-col items-center justify-center space-y-2'}>
          <Heading level={3}>
            <Trans i18nKey={'chatbot:noJobsFound'} />
          </Heading>

          <div>
            <Trans i18nKey={'chatbot:noJobsFoundDescription'} />
          </div>
        </div>

        <div>
          <CrawlWebsiteModal {...props}>
            <Button size={'lg'}>
              <Trans i18nKey={'chatbot:importDocumentsButton'} />
            </Button>
          </CrawlWebsiteModal>
        </div>
      </div>
    </>
  );
}
