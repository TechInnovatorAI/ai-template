import { useTransition } from 'react';

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { deleteDocumentAction } from '~/home/[account]/chatbots/[chatbot]/_lib/server/server-actions';

export function DeleteDocumentModal({
  documentId,
  onBeforeDelete,
  children,
}: React.PropsWithChildren<{
  documentId: string;
  onBeforeDelete?: () => void;
}>) {
  const [pending, startTransition] = useTransition();
  const { t } = useTranslation('chatbot');

  const deleteAction = (data: FormData) => {
    startTransition(() => {
      if (onBeforeDelete) {
        onBeforeDelete();
      }

      const promise = deleteDocumentAction(data);

      toast.promise(promise, {
        success: t('deleteDocumentSuccessToast'),
        error: t('deleteDocumentErrorToast'),
        loading: t('deleteDocumentLoadingToast'),
      });
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDocument')}</AlertDialogTitle>

          <AlertDialogDescription>
            {t('deleteDocumentDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className={'flex flex-col space-y-6'}>
          <form>
            <input type="hidden" name={'documentId'} value={documentId} />

            <div className={'flex justify-end space-x-2'}>
              <AlertDialogCancel>
                <Trans i18nKey={'common:cancel'} />
              </AlertDialogCancel>

              <Button
                disabled={pending}
                formAction={deleteAction}
                variant={'destructive'}
              >
                {t('confirmDeleteDocumentButton')}
              </Button>
            </div>
          </form>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
