'use client';

import { useCallback, useEffect, useRef } from 'react';

import { fetchDataFromSupabase } from '@makerkit/data-loader-supabase-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat, Message } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { cn } from '@kit/ui/utils';

import { Database } from '~/lib/database.types';

import { useRevalidateAvailableTokens } from '../../_lib/hooks/use-fetch-remaining-tokens';
import { getConversationByReferenceId } from '../../_lib/server/server-actions';
import { ChatTextField } from './chat-text-field';
import { LoadingBubble } from './loading-bubble';
import { MessageContainer } from './message-container';

export function ChatContainer({
  conversation,
  onCreateConversation,
  documentId,
}: {
  conversation:
    | {
        id: string;
        name: string;
      }
    | undefined;

  onCreateConversation?: (conversation: { name: string; id: string }) => void;
  documentId: string;
}) {
  // fetch the list of messages for this conversation
  const { data: messages, isPending } = useConversationMessages(conversation);

  return (
    <>
      <ChatBodyContainer
        className={cn('transition-opacity', {
          ['pointer-events-none opacity-40']: isPending,
        })}
        conversationId={conversation?.id}
        documentId={documentId}
        messages={messages ?? []}
        onCreateConversation={onCreateConversation}
      />
    </>
  );
}

function ChatBodyContainer(props: {
  className?: string;
  conversationId: string | undefined;
  documentId: string;
  messages: Message[] | null;
  onCreateConversation?: (conversation: { name: string; id: string }) => void;
}) {
  // set a ref for the conversation id - or generate a new one if there is none
  const conversationIdRef = useRef(props.conversationId);

  const scrollingDiv = useRef<HTMLDivElement | null>();
  const scrollToBottom = useScrollToBottom(scrollingDiv.current);

  const queryClient = useQueryClient();
  const revalidateAvailableTokens = useRevalidateAvailableTokens();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: getApiEndpoint(props.documentId),
    streamMode: 'text',
    headers: {
      'x-conversation-id': conversationIdRef.current ?? '',
    },
    body: {
      create: !props.conversationId,
    },
    initialMessages: props.messages ?? undefined,
    onError: (error) => {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    },
    onFinish: (message) => {
      void (async () => {
        // scroll to the bottom when the message is sent
        scrollToBottom({ smooth: true });

        // we need to update the cache with the new message
        // so that we don't have to fetch it from the API the next time
        const updateCache = async () => {
          const cacheKey = getConversationIdStorageKey(
            conversationIdRef.current,
          );

          const userMessage = {
            id: nanoid(),
            content: input,
            createdAt: new Date(),
            role: 'user',
          };

          const nextCache = [...(messages ?? []), userMessage, message];

          await queryClient.setQueryData([cacheKey], nextCache);

          // revalidate the number of available tokens
          await revalidateAvailableTokens();
        };

        // if the conversation id is already set, we just update the cache
        if (props.conversationId) {
          return updateCache();
        }

        // if there is no conversation id, it means the user created a new conversation
        // in this case, we fetch the conversation from the API and update the UI
        try {
          if (!conversationIdRef.current) {
            conversationIdRef.current = createConversationReferenceId();
          }

          const data = await getConversationByReferenceId(
            conversationIdRef.current,
          );

          // once the conversation is created, we update the UI
          if (data) {
            conversationIdRef.current = data.reference_id;

            // update the cache
            await updateCache();

            // dispatch an event to the parent component
            // so that it can display the new conversation in the sidebar
            setTimeout(() => {
              if (props.onCreateConversation) {
                props.onCreateConversation({
                  id: data.reference_id,
                  name: data.name,
                });
              }
            }, 1000);
          }
        } catch {
          toast.error(
            'Something went wrong creating your conversation. Please try again.',
          );
        }
      })();
    },
  });

  useEffect(() => {
    // when the messages change, we need to update the state
    if (props.messages) {
      setMessages(props.messages);
      scrollToBottom({ smooth: true });
    }
  }, [props.messages]);

  useEffect(() => {
    // when the messages change, we need to update the state
    scrollToBottom({ smooth: true });
  }, [isLoading]);

  // when the conversation id changes, we need to update the ref
  useEffect(() => {
    if (props.conversationId) {
      conversationIdRef.current = props.conversationId;
    } else {
      conversationIdRef.current = createConversationReferenceId();
      setMessages([]);
    }
  }, [props.conversationId, setMessages]);

  return (
    <div
      className={cn(
        'm-auto flex h-full w-full flex-1 flex-col space-y-4 pt-4',
        props.className,
      )}
    >
      <div
        className={'order-1 flex-[1_1_0] overflow-y-auto px-4'}
        ref={(ref) => {
          scrollingDiv.current = ref;
        }}
      >
        <div className={'mx-auto h-full w-full'}>
          <ChatMessagesContainer messages={messages} loading={isLoading} />
        </div>
      </div>

      <div className={'order-2 justify-end'}>
        <ChatTextField
          loading={isLoading}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

function ChatMessagesContainer({
  messages,
  loading,
}: {
  messages: Message[];
  loading: boolean;
}) {
  if (!messages.length) {
    if (loading) {
      return <LoadingBubble />;
    }

    return <NoMessageEmptySpace />;
  }

  return (
    <div className={'m-auto flex flex-col space-y-2'}>
      {messages.map((message) => {
        return <ChatMessageItem key={message.id} message={message} />;
      })}

      <If condition={loading}>
        <LoadingBubble />
      </If>
    </div>
  );
}

function ChatMessageItem({
  message,
}: React.PropsWithChildren<{ message: Message }>) {
  return (
    <div className={cn(`flex h-fit w-full`)}>
      <div
        className={'m-auto flex w-full whitespace-pre-wrap break-words'}
        style={{
          wordBreak: 'break-word',
        }}
      >
        <MessageContainer message={message} />
      </div>
    </div>
  );
}

function NoMessageEmptySpace() {
  return (
    <div
      className={
        'm-auto flex h-full flex-1 flex-col items-center justify-center space-y-2.5'
      }
    >
      <div>
        <Heading level={3}>Hello, how can I help you?</Heading>
      </div>

      <span className={'text-gray-500 dark:text-gray-400'}>
        Ask me anything about this document - I&apos;ll do my best to help you.
      </span>
    </div>
  );
}

function useConversationMessages(
  conversation:
    | undefined
    | {
        id: string;
        name: string;
      },
) {
  const client = useSupabase<Database>();

  const queryFn = async () => {
    if (!conversation) {
      return null;
    }

    const { data, error } = await fetchDataFromSupabase({
      client,
      table: 'messages',
      camelCase: false,
      limit: 50,
      select: `
        id,
        text,
        sender,
        conversation_id !inner (
          reference_id
        )
      `,
      where: {
        'conversation_id.reference_id': {
          eq: conversation.id,
        },
      },
    });

    if (error) {
      throw error;
    }

    return (data ?? []).map((message) => {
      return {
        id: message.id.toString(),
        role: message.sender,
        content: message.text,
      };
    });
  };

  const queryKey = conversation?.id
    ? [getConversationIdStorageKey(conversation?.id)]
    : [];

  return useQuery({ queryFn, queryKey, refetchOnMount: false });
}

function getConversationIdStorageKey(conversationId: string | undefined) {
  return `conversation-${conversationId}`;
}

function useScrollToBottom(scrollingDiv: HTMLDivElement | null | undefined) {
  return useCallback(
    ({ smooth } = { smooth: false }) => {
      setTimeout(() => {
        if (scrollingDiv) {
          scrollingDiv?.scrollTo({
            behavior: smooth ? 'smooth' : 'auto',
            top: scrollingDiv.scrollHeight,
          });
        }
      }, 50);
    },
    [scrollingDiv],
  );
}

function getApiEndpoint(documentId: string) {
  return `/api/documents/${documentId}/conversation`;
}

function createConversationReferenceId() {
  return nanoid(12);
}
