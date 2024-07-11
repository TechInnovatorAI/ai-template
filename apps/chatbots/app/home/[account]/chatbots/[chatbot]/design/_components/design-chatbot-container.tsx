'use client';

import { useEffect, useState, useTransition } from 'react';

import { useFormState } from 'react-dom';

import dynamic from 'next/dynamic';

import { zodResolver } from '@hookform/resolvers/zod';
import { HexColorPicker } from 'react-colorful';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  ChatbotSettings,
  chatBotMessagesStore,
} from '@kit/chatbot-widget/chatbot';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { DesignChatbotSchema } from '~/home/[account]/chatbots/[chatbot]/_lib/schema/design-chatbot.schema';

import { saveChatbotSettingsAction } from '../../_lib/server/server-actions';

const ChatBot = dynamic(
  () =>
    import('@kit/chatbot-widget/chatbot').then((m) => {
      return {
        default: m.ChatBot,
      };
    }),
  {
    ssr: false,
  },
);

const LOCAL_STORAGE_KEY = 'design-chatbot-messages';

const positions: Array<'bottom-right' | 'bottom-left'> = [
  'bottom-right',
  'bottom-left',
];

export function DesignChatbotContainer(
  props: React.PropsWithChildren<{
    chatbotId: string;
    siteName: string;
    settings: ChatbotSettings;
  }>,
) {
  const { t } = useTranslation('chatbot');
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(DesignChatbotSchema),
    defaultValues: {
      title: props.settings.title || 'Acme AI Assistant',
      textColor: props.settings.branding.textColor || '#fff',
      primaryColor: props.settings.branding.primaryColor || '#0a0a0a',
      accentColor: props.settings.branding.accentColor || '#0a0a0a',
      position: props.settings.position || positions[0],
      chatbotId: props.chatbotId,
    },
    mode: 'onChange',
  });

  const title = form.watch('title');
  const textColor = form.watch('textColor');
  const primaryColor = form.watch('primaryColor');
  const accentColor = form.watch('accentColor');
  const position = form.watch('position');

  const settings = {
    title,
    position,
    branding: {
      textColor,
      primaryColor,
      accentColor,
    },
  };

  useLoadStaticMessages();

  const [formState, formAction] = useFormState(
    saveChatbotSettingsAction,
    undefined,
  );

  useEffect(() => {
    if (formState) {
      if (formState.success) {
        toast.success(t('saveSettingsSuccessToast'));
      } else {
        toast.error(t('saveSettingsErrorToast'));
      }
    }
  }, [formState, t]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          startTransition(() => {
            return formAction(data);
          });
        })}
      >
        <div className={'w-full lg:max-w-md'}>
          <div className={'flex flex-col space-y-4'}>
            <FormField
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>{t('chatbotName')}</FormLabel>

                    <FormControl>
                      <Input
                        required
                        placeholder={`Ex. Acme AI Assistant`}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
              name={'title'}
            />

            <FormField
              render={() => {
                return (
                  <FormItem>
                    <FormLabel>{t('chatbotPrimaryColor')}</FormLabel>

                    <FormControl>
                      <ColorPicker
                        color={primaryColor}
                        setColor={(color) =>
                          form.setValue('primaryColor', color)
                        }
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
              name={'primaryColor'}
            />

            <FormField
              render={() => {
                return (
                  <FormItem>
                    <FormLabel>{t('chatbotTextColor')}</FormLabel>

                    <FormControl>
                      <ColorPicker
                        color={textColor}
                        setColor={(color) => form.setValue('textColor', color)}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
              name={'primaryColor'}
            />

            <FormField
              render={() => {
                return (
                  <FormItem>
                    <FormLabel>{t('chatbotPosition')}</FormLabel>
                    <FormControl>
                      <Select
                        value={position}
                        onValueChange={(value) =>
                          form.setValue(
                            'position',
                            value as (typeof positions)[0],
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={'Position'} />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value={positions[0]!}>
                            {t('bottomRight')}
                          </SelectItem>

                          <SelectItem value={positions[1]!}>
                            {t('bottomLeft')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                );
              }}
              name={'position'}
            />

            <Button disabled={pending} type={'submit'}>
              {pending
                ? t('savingSettingsButtonLabel')
                : t('saveChangesButton')}
            </Button>
          </div>
        </div>
      </form>

      <ChatBot
        isOpen
        isDisabled
        settings={settings}
        chatbotId={props.chatbotId}
        conversationId={`design-${props.chatbotId}`}
        siteName={props.siteName}
        storageKey={LOCAL_STORAGE_KEY}
      />
    </Form>
  );
}

function ColorPicker(
  props: React.PropsWithChildren<{
    color: string;
    setColor: (color: string) => void;
  }>,
) {
  const [color, setColor] = useState(props.color);

  useEffect(() => {
    setColor(props.color);
  }, [props.color]);

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <div className={'flex items-center space-x-2'}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={'h-[40px] w-10 cursor-pointer rounded-lg border'}
              style={{
                backgroundColor: color,
              }}
            />

            <Input readOnly value={color} />
          </div>
        </PopoverTrigger>

        <PopoverContent>
          <HexColorPicker
            color={color}
            onChange={(color) => {
              setColor(color);
              props.setColor(color);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useLoadStaticMessages() {
  useEffect(() => {
    chatBotMessagesStore.saveMessages(
      [
        {
          content: 'Hello, how can I help you?',
          role: 'assistant',
          id: '1',
        },
        {
          content: `I'd like to know more about your product`,
          role: 'user',
          id: '2',
        },
        {
          id: '3',
          role: 'assistant',
          content: `Sure, I'll be happy to help you with that. May I know your name?`,
        },
        {
          id: '4',
          role: 'user',
          content: `John Doe`,
        },
      ],
      LOCAL_STORAGE_KEY,
    );
  }, []);
}
