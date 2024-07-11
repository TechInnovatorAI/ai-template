import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { v4 as uuid } from 'uuid';
import { hydrateRoot } from 'react-dom/client';

import { ChatBot } from './chatbot';
import { ChatbotSettings } from './chatbot';

const SDK_NAME = process.env.CHATBOT_SDK_NAME;
const SETTINGS_ENDPOINT = process.env.WIDGET_SETTINGS_ENDPOINT;
const WIDGET_CSS_URL = process.env.WIDGET_CSS_URL;

const ChatbotWidgetContext = createContext<{
  conversationId: string;
  setConversationId: (conversationId: string) => void;
}>({
  conversationId: '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setConversationId: () => {},
});

// initialize the widget
initializeWidget();

function initializeWidget() {
  if (document.readyState !== 'loading') {
    void onReady();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      void onReady();
    });
  }
}

/**
 * Initializes the Chatbot by fetching settings, creating necessary elements,
 * injecting styles, and hydrating the root component.
 **/
async function onReady() {
  try {
    const { settings, siteName, conversationId } = await fetchChatbotSettings();
    const id = getChatbotId();

    const element = document.createElement('div');
    const shadow = element.attachShadow({ mode: 'open' });
    const shadowRoot = document.createElement('div');

    shadowRoot.id = 'makerkit-chatbot-container';

    const component = (
      <ChatbotWidgetContextProvider conversationId={conversationId}>
        <ChatbotRenderer
          chatbotId={id}
          siteName={siteName}
          settings={settings}
        />
      </ChatbotWidgetContextProvider>
    );

    shadow.appendChild(shadowRoot);
    injectStyle(shadowRoot);
    hydrateRoot(shadowRoot, component);

    document.body.appendChild(element);
  } catch (error) {
    console.warn(`Could not initialize Chatbot`);
    console.warn(error);
  }
}

function ChatbotRenderer(props: {
  chatbotId: string;
  siteName: string;
  settings: ChatbotSettings;
}) {
  const [mounted, setMounted] = useState(false);
  const { conversationId } = useContext(ChatbotWidgetContext);
  const storageKey = getStorageKey(props.chatbotId, conversationId);
  const clearConversation = useClearConversation();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ChatBot
        {...props}
        conversationId={conversationId}
        storageKey={storageKey}
        onClear={clearConversation}
      />
    </Suspense>
  );
}

async function fetchChatbotSettings() {
  const chatbotId = getChatbotId();

  if (!SETTINGS_ENDPOINT) {
    throw new Error('Missing WIDGET_SETTINGS_ENDPOINT environment variable');
  }

  if (!chatbotId) {
    throw new Error('Missing data-chatbot-id attribute');
  }

  const conversationIdStorageKey = getConversationIdStorageKey();
  const conversationId = localStorage.getItem(conversationIdStorageKey);

  const url = `${SETTINGS_ENDPOINT}?id=${chatbotId}`;

  const response = await fetch(url, {
    headers: {
      ['x-conversation-id']: conversationId ?? '',
    },
  });

  const payload = (await response.json()) as unknown as {
    settings: ChatbotSettings;
    siteName: string;
    conversationId: string;
  };

  // if this is the first time we're loading the chatbot, store the conversation id
  if (!conversationId) {
    localStorage.setItem(conversationIdStorageKey, payload.conversationId);
  }

  return payload;
}

function getChatbotId() {
  const script = getCurrentScript();

  if (!script) {
    throw new Error('Script not found');
  }

  const chatbotId = script.getAttribute('data-chatbot');

  if (!chatbotId) {
    throw new Error('Missing data-chatbot-id attribute');
  }

  return chatbotId;
}

function getCurrentScript() {
  const currentScript = document.currentScript;

  if (!SDK_NAME) {
    throw new Error('Missing CHATBOT_SDK_NAME environment variable');
  }

  if (currentScript?.getAttribute('src')?.includes(SDK_NAME)) {
    return currentScript as HTMLScriptElement;
  }

  return Array.from(document.scripts).find((item) => {
    return item.src.includes(SDK_NAME);
  });
}

function injectStyle(shadowRoot: HTMLElement) {
  const link = document.createElement('link');
  const href = WIDGET_CSS_URL;

  if (!href) {
    throw new Error('Missing WIDGET_CSS_URL environment variable');
  }

  link.rel = 'stylesheet';
  link.href = href;

  shadowRoot.appendChild(link);
}

function ChatbotWidgetContextProvider(
  props: React.PropsWithChildren<{
    conversationId: string;
  }>,
) {
  const [conversationId, setConversationId] = useState(props.conversationId);

  return (
    <ChatbotWidgetContext.Provider
      value={{
        conversationId,
        setConversationId,
      }}
    >
      {props.children}
    </ChatbotWidgetContext.Provider>
  );
}

function getStorageKey(id: string, conversationId: string) {
  return `chatbot-${id}-${conversationId}`;
}

function useClearConversation() {
  const { setConversationId } = useContext(ChatbotWidgetContext);

  return useCallback(() => {
    const key = getConversationIdStorageKey();
    localStorage.removeItem(key);

    const conversationId = generateNewConversationId();
    localStorage.setItem(key, conversationId);

    setConversationId(conversationId);
  }, []);
}

function generateNewConversationId() {
  return uuid();
}

function getConversationIdStorageKey() {
  const chatbotId = getChatbotId();

  return `chatbot-${chatbotId}-conversation-id`;
}
