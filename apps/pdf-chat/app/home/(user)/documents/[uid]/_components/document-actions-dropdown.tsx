'use client';

import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { EllipsisVertical } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import {
  clearConversationAction,
  deleteConversationAction,
} from '~/home/(user)/documents/_lib/server/server-actions';

export function DocumentActionsDropdown(props: { conversationId: string }) {
  const clearMessagesCache = useClearMessagesCache();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={'icon'} variant={'ghost'}>
          <EllipsisVertical className={'h-4'} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent collisionPadding={10}>
        <DropdownMenuItem asChild>
          <button
            onClick={async () => {
              await clearConversationAction(props.conversationId);
              await clearMessagesCache(props.conversationId);
            }}
          >
            Clear conversation
          </button>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <button
            onClick={async () => {
              await deleteConversationAction(props.conversationId);
              await clearMessagesCache(props.conversationId);
            }}
          >
            Delete conversation
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useClearMessagesCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string) => {
      const conversationCacheKey = `conversation-${conversationId}`;

      return queryClient.setQueryData([conversationCacheKey], []);
    },
    [queryClient],
  );
}
