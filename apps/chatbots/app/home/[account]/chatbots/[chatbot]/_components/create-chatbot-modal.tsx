'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { ErrorBoundary } from '@kit/monitoring/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Trans } from '@kit/ui/trans';

import { CreateChatbotFormSchema } from '../_lib/schema/create-chatbot.schema';
import { createChatbotAction } from '../_lib/server/server-actions';

export function CreateChatbotModal(
  props: React.PropsWithChildren<{
    canCreateChatbot: boolean;
    accountId: string;
  }>,
) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans i18nKey={'chatbot:createChatbotModalHeading'} />
          </DialogTitle>
        </DialogHeader>

        <If
          condition={props.canCreateChatbot}
          fallback={<CannotCreateChatbotAlert />}
        >
          <ErrorBoundary fallback={<ChatbotErrorAlert />}>
            <CreateChatbotForm accountId={props.accountId} />
          </ErrorBoundary>
        </If>
      </DialogContent>
    </Dialog>
  );
}

function CreateChatbotForm({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(CreateChatbotFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      siteName: '',
      url: 'https://',
      description: '',
      accountId: accountId,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          startTransition(() => createChatbotAction(values));
        })}
      >
        <div className={'flex flex-col space-y-4'}>
          <div>
            <p className={'text-sm text-gray-500'}>
              <Trans i18nKey={'chatbot:createChatbotModalSubheading'} />
            </p>
          </div>

          <FormField
            name={'name'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'chatbot:chatbotName'} />
                  </FormLabel>

                  <FormControl>
                    <Input
                      required
                      placeholder={'Ex. Home Page Chatbot'}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />

          <FormField
            name={'siteName'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'chatbot:chatbotWebsiteName'} />
                  </FormLabel>

                  <FormControl>
                    <Input {...field} required placeholder={'Ex. Supabase'} />
                  </FormControl>

                  <FormDescription>
                    <Trans i18nKey={'chatbot:chatbotWebsiteNameHint'} />
                  </FormDescription>
                </FormItem>
              );
            }}
          />

          <FormField
            name={'url'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'chatbot:chatbotWebsiteUrl'} />
                  </FormLabel>

                  <FormControl>
                    <Input
                      placeholder={'https://...'}
                      type={'url'}
                      defaultValue={'https://'}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />

          <FormField
            name={'description'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'chatbot:chatbotDescription'} />
                  </FormLabel>

                  <FormControl>
                    <Textarea {...field} placeholder={'Description...'} />
                  </FormControl>
                </FormItem>
              );
            }}
          />

          <Button disabled={pending}>
            <Trans i18nKey={'chatbot:createChatbotSubmitButton'} />
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ChatbotErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>
        <Trans i18nKey={'chatbot:createChatbotAlertError'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'chatbot:createChatbotAlertErrorDescription'} />
      </AlertDescription>
    </Alert>
  );
}

function CannotCreateChatbotAlert() {
  return (
    <Alert variant={'warning'}>
      <AlertTitle>
        <Trans i18nKey={'chatbot:cannotCreateChatbot'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'chatbot:cannotCreateChatbotDescription'} />
      </AlertDescription>
    </Alert>
  );
}
