import dynamic from 'next/dynamic';

import { ChatbotSettings } from '@kit/chatbot-widget/chatbot';
import { Heading } from '@kit/ui/heading';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { loadChatbot } from '~/home/[account]/chatbots/_lib/server/load-chatbot';
import { withI18n } from '~/lib/i18n/with-i18n';

const ChatBot = dynamic(
  () =>
    import('@kit/chatbot-widget/chatbot').then((m) => {
      return {
        default: m.ChatBot,
      };
    }),
  {
    ssr: false,
  },
);

interface ChatbotPlaygroundPageParams {
  params: {
    organization: string;
    chatbot: string;
  };
}

const LOCAL_STORAGE_KEY = 'chatbot-playground';

export const metadata = {
  title: 'Playground',
};

async function ChatbotPlaygroundPage({ params }: ChatbotPlaygroundPageParams) {
  const chatbot = await loadChatbot(params.chatbot);
  const settings = chatbot.settings as unknown as ChatbotSettings;

  return (
    <>
      <PageBody className={'space-y-2'}>
        <Heading level={4}>
          <Trans i18nKey={'chatbot:playgroundTab'} />
        </Heading>

        <p className={'text-sm text-muted-foreground'}>
          <Trans i18nKey={'chatbot:playgroundTabSubheading'} />
        </p>
      </PageBody>

      <ChatBot
        isOpen
        chatbotId={chatbot.id}
        siteName={chatbot.site_name}
        settings={settings}
        storageKey={LOCAL_STORAGE_KEY}
      />
    </>
  );
}

export default withI18n(ChatbotPlaygroundPage);
