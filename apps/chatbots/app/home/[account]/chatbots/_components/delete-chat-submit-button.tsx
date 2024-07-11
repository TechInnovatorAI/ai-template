'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

export function DeleteChatSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} variant={'destructive'}>
      <Trans i18nKey={'chatbot:confirmDeleteChatbotButton'} />
    </Button>
  );
}
