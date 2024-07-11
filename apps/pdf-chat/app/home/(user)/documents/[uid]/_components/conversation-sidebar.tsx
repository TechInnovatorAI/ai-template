'use client';

import { useEffect } from 'react';

import { ChatBubbleIcon } from '@radix-ui/react-icons';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

type Conversation = {
  id: string;
  name: string;
  new?: true;
};

export function ConversationsSidebar(props: {
  conversation: Conversation | undefined;
  setConversation: (conversation: Conversation | undefined) => void;
  conversations: Conversation[];
}) {
  // we want to update the URL query params when the conversationId changes
  // without triggering a page reload
  const setSearchParams = (conversationId: string | undefined) => {
    if (conversationId) {
      history.replaceState(null, '', `?conversation=${conversationId}`);
    } else {
      history.replaceState(null, '', '?');
    }
  };

  useEffect(() => {
    setSearchParams(props.conversation?.id);
  }, [props.conversation?.id]);

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <Button
        size={'sm'}
        variant={'outline'}
        onClick={() => {
          props.setConversation(undefined);
          setSearchParams(undefined);
        }}
      >
        <span>New Conversation</span>
      </Button>

      <ul className={'relative flex flex-col space-y-1'}>
        {props.conversations.map((conversation) => {
          const selected = conversation.id === props.conversation?.id;

          return (
            <li className={'w-full'} key={conversation.id}>
              <Button
                className={
                  'w-full justify-start text-left animate-in slide-in-from-top-4'
                }
                size={'sm'}
                role="link"
                variant={selected ? 'default' : 'ghost'}
                onClick={() => {
                  props.setConversation(conversation);
                  setSearchParams(conversation.id);
                }}
              >
                <ChatBubbleIcon className={'mr-2.5 h-4 w-4 min-w-4'} />

                <span className="truncate">{conversation.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
