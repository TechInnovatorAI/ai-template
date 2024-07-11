import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Trans } from '@kit/ui/trans';

import { DeleteChatSubmitButton } from '~/home/[account]/chatbots/_components/delete-chat-submit-button';
import { deleteChatbotAction } from '~/home/[account]/chatbots/_lib/server/server-actions';

export function DeleteChatbotModal(
  props: React.PropsWithChildren<{
    chatbotId: string;
  }>,
) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey={'chatbot:deleteChatbotButton'} />
          </AlertDialogTitle>
        </AlertDialogHeader>

        <form action={deleteChatbotAction}>
          <input type="hidden" name={'chatbotId'} value={props.chatbotId} />

          <div className={'flex flex-col space-y-4 text-sm'}>
            <div className={'flex flex-col space-y-2'}>
              <div>
                <Trans i18nKey={'chatbot:deleteChatbotDescription'} />
              </div>

              <div>
                <Trans i18nKey={'common:modalConfirmationQuestion'} />
              </div>
            </div>

            <div className={'flex justify-end space-x-2'}>
              <AlertDialogCancel>
                <Trans i18nKey={'common:cancel'} />
              </AlertDialogCancel>

              <DeleteChatSubmitButton />
            </div>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
