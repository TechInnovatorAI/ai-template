'use client';

import { ClipboardIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

export function CopyToClipboardButton(
  props: React.PropsWithChildren<{
    text: string;
  }>,
) {
  const { t } = useTranslation('chatbot');

  const onCopy = async () => {
    await navigator.clipboard.writeText(props.text);

    toast.success(t('copyToClipboardSuccessToast'));
  };

  return (
    <Button variant={'outline'} onClick={onCopy}>
      <ClipboardIcon className={'mr-2 w-4'} />

      <span>{t('copyToClipboardButton')}</span>
    </Button>
  );
}
