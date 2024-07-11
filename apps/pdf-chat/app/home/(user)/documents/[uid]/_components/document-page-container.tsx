'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@kit/ui/badge';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';

import { useFetchAvailableTokens } from '../../_lib/hooks/use-fetch-remaining-tokens';
import { ChatContainer } from './chat-container';
import { ConversationsSidebar } from './conversation-sidebar';
import { DocumentActionsDropdown } from './document-actions-dropdown';

interface Conversation {
  id: string;
  name: string;
}

export function DocumentPageContainer(
  props: React.PropsWithChildren<{
    doc: {
      id: string;
      name: string;
    };

    conversation: Conversation | undefined;
    conversations: Conversation[];
  }>,
) {
  const [conversation, setConversation] = useState(props.conversation);
  const [conversations, setConversations] = useState(props.conversations);

  // when creating a new conversation, we need to add it to the list
  const onCreateConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => [{ ...conversation, new: true }, ...prev]);
    setConversation(conversation);
  }, []);

  const credits = useFetchAvailableTokens();

  // we need to update the conversation and conversations when the props change
  useEffect(() => {
    setConversations(props.conversations);

    const isSelectedConversationExisting = props.conversations.some(
      (conversation) => {
        return conversation.id === props.conversation?.id;
      },
    );

    if (!isSelectedConversationExisting) {
      setConversation(undefined);
    }
  }, [props.conversation, props.conversations]);

  return (
    <>
      <div className={'flex h-full w-2/12 max-w-72 flex-1 flex-col p-4'}>
        <ConversationsSidebar
          conversations={conversations}
          conversation={conversation}
          setConversation={setConversation}
        />
      </div>

      <div className={'flex w-9/12 flex-1 flex-col divide-y'}>
        <div className="flex items-center justify-between p-4">
          <div className={'items-enter flex space-x-4'}>
            <Heading level={3}>{props.doc.name}</Heading>

            <If condition={credits.isSuccess}>
              <Badge variant={'outline'}>
                {credits.data} credits remaining
              </Badge>
            </If>
          </div>

          <If condition={conversation}>
            {({ id }) => <DocumentActionsDropdown conversationId={id} />}
          </If>
        </div>

        <ChatContainer
          documentId={props.doc.id}
          conversation={conversation}
          onCreateConversation={onCreateConversation}
        />
      </div>
    </>
  );
}
