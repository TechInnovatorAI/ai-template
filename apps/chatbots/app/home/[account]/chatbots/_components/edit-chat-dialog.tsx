'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Trans } from '@kit/ui/trans';

import { UpdateChatbotSchema } from '~/home/[account]/chatbots/[chatbot]/_lib/schema/update-chatbot.schema';
import { updateChatbotAction } from '~/home/[account]/chatbots/[chatbot]/_lib/server/server-actions';
import { Database } from '~/lib/database.types';

export function EditChatDialog(
  props: React.PropsWithChildren<{
    chatbot: Database['public']['Tables']['chatbots']['Row'];
  }>,
) {
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(UpdateChatbotSchema),
    defaultValues: {
      id: props.chatbot.id,
      name: props.chatbot.name,
      url: props.chatbot.url,
      site_name: props.chatbot.site_name,
      description: props.chatbot.description ?? '',
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogContent>
        <DialogTitle>
          <Trans i18nKey={'chatbot:editChatbotTitle'} />
        </DialogTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              startTransition(async () => {
                await updateChatbotAction(values);
              });
            })}
          >
            <div className={'flex flex-col space-y-4'}>
              <div>
                <p className={'text-sm'}>
                  <Trans i18nKey={'chatbot:editChatbotSubheading'} />
                </p>
              </div>

              <FormField
                name={'name'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'chatbot:chatbotName'} />
                    </FormLabel>

                    <FormControl>
                      <Input {...field} required />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name={'url'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'chatbot:chatbotWebsiteUrl'} />
                    </FormLabel>

                    <FormControl>
                      <Input {...field} required type={'url'} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name={'site_name'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'chatbot:chatbotWebsiteName'} />
                    </FormLabel>

                    <FormControl>
                      <Input
                        {...field}
                        defaultValue={props.chatbot.site_name}
                        required
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name={'description'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'chatbot:chatbotDescription'} />
                    </FormLabel>

                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button disabled={pending}>
                <Trans i18nKey={'chatbot:editChatbotSubmitButton'} />
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
