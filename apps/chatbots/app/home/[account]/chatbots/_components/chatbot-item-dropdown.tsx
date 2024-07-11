'use client';

import { EllipsisVerticalIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Trans } from '@kit/ui/trans';

import { DeleteChatbotModal } from '../_components/delete-chatbot-modal';

export function ChatbotItemDropdown(
  props: React.PropsWithChildren<{ chatbotId: string }>,
) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger onClick={(event) => event.stopPropagation()}>
        <EllipsisVerticalIcon className={'w-4'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DeleteChatbotModal chatbotId={props.chatbotId}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Trans i18nKey={'chatbot:deleteChatbotButton'} />
          </DropdownMenuItem>
        </DeleteChatbotModal>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
