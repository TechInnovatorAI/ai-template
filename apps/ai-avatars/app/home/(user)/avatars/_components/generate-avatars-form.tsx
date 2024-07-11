'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { useSupabaseQuery } from '@makerkit/data-loader-supabase-nextjs/client';
import { Portal } from '@radix-ui/react-portal';
import { useForm } from 'react-hook-form';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
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
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Spinner } from '@kit/ui/spinner';
import { Stepper } from '@kit/ui/stepper';
import { Textarea } from '@kit/ui/textarea';

import { generatePicturesAction } from '~/home/(user)/avatars/generate/_lib/server/server-actions';
import { Database } from '~/lib/database.types';
import { SdxlPromptPreset } from '~/lib/replicate/sdxl-prompts';

const CUSTOM = 'custom' as SdxlPromptPreset;

export function GenerateAvatarsForm(props: { accountId: string }) {
  const [{ step, ...state }, setState] = useState<{
    step: number;
    name: string;
    userPrompt: string;
    preset: SdxlPromptPreset;
    model: string;
    numberOfAvatars: number;
  }>({
    step: 0,
    name: '',
    userPrompt: '',
    preset: 'instagram' as SdxlPromptPreset,
    model: '',
    numberOfAvatars: 1,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Avatars</CardTitle>

        <CardDescription>
          Pick a model and generate your avatars
        </CardDescription>
      </CardHeader>

      <CardContent className={'space-y-12'}>
        <Stepper currentStep={step} steps={['Details', 'Finish']} />

        <If condition={step === 0}>
          <GenerationSettingsStep
            accountId={props.accountId}
            onSubmit={(data) => {
              setState(() => {
                return {
                  step: 1,
                  ...data,
                };
              });
            }}
          />
        </If>

        <If condition={step === 1}>
          <SubmitAvatarsGeneration
            data={state}
            onBack={() =>
              setState((state) => {
                return {
                  ...state,
                  step: 0,
                };
              })
            }
          />
        </If>
      </CardContent>
    </Card>
  );
}

function SubmitAvatarsGeneration({
  data,
  onBack,
}: {
  data: {
    name: string;
    userPrompt: string;
    preset: SdxlPromptPreset;
    model: string;
    numberOfAvatars: number;
  };

  onBack: () => void;
}) {
  const generating = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const upload = async () => {
      if (generating.current) {
        return;
      }

      generating.current = true;

      await generatePicturesAction(data).catch((error) => {
        setError(error);

        throw error;
      });
    };

    void upload();
  }, []);

  if (error) {
    return (
      <div className={'flex flex-col space-y-4'}>
        <Alert variant={'destructive'}>
          <AlertTitle>Generation failed</AlertTitle>

          <AlertDescription>
            Something went wrong, please try again later.
          </AlertDescription>
        </Alert>

        <div>
          <Button variant={'outline'} onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Portal>
      <LoadingOverlay fullPage>
        <div className={'flex flex-col space-y-4 text-center'}>
          <p>
            We are generating your pictures. This process may take a few
            minutes.
          </p>

          <p>You will be notified when your avatars are ready.</p>
        </div>
      </LoadingOverlay>
    </Portal>
  );
}

function GenerationSettingsStep({
  onSubmit,
  accountId,
}: {
  accountId: string;

  onSubmit: ({
    name,
    preset,
    userPrompt,
    model,
    numberOfAvatars,
  }: {
    name: string;
    userPrompt: string;
    preset: SdxlPromptPreset;
    model: string;
    numberOfAvatars: number;
  }) => void;
}) {
  const form = useForm<{
    name: string;
    userPrompt: string;
    preset: SdxlPromptPreset;
    model: string;
    numberOfAvatars: number;
  }>({
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      userPrompt: '',
      preset: 'instagram',
      model: undefined,
      numberOfAvatars: 1,
    },
    resolver: (data) => {
      if (!data.model) {
        return {
          values: data,
          errors: {
            model: 'Model is required',
          },
        };
      }

      return {
        values: {
          ...data,
          numberOfAvatars: Number(data.numberOfAvatars),
        },
        errors: {},
      };
    },
  });

  const preset = form.watch('preset');
  const useCustomPrompt = preset === CUSTOM;

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4'}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>

              <FormControl>
                <Input
                  required
                  minLength={3}
                  maxLength={50}
                  placeholder={'Ex. Astronaut Avatars'}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
          name={'name'}
        />

        <FormField
          render={() => {
            return (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <ModelsSelect
                    accountId={accountId}
                    value={form.getValues('model')}
                    onValueChange={(value) => {
                      form.setValue('model', value);
                    }}
                  />
                </FormControl>
              </FormItem>
            );
          }}
          name={'model'}
        />

        <If condition={useCustomPrompt}>
          <FormField
            render={() => {
              return (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      required
                      minLength={3}
                      maxLength={250}
                      {...form.register('userPrompt')}
                    />
                  </FormControl>
                  <FormDescription>
                    Use your own prompt to generate the avatars. This requires
                    some knowledge of prompting.
                  </FormDescription>
                </FormItem>
              );
            }}
            name={'model'}
          />

          <div className={'mt-4'}>
            <Button
              size={'sm'}
              variant={'ghost'}
              onClick={() => {
                form.setValue('userPrompt', '');
                form.setValue('preset', 'instagram');
              }}
            >
              Use preset instead
            </Button>
          </div>
        </If>

        <If condition={!useCustomPrompt}>
          <FormField
            render={() => {
              return (
                <FormItem>
                  <FormLabel>Preset</FormLabel>
                  <FormControl>
                    <Select
                      value={preset}
                      onValueChange={(value) => {
                        form.setValue('preset', value as SdxlPromptPreset);

                        if (value === CUSTOM) {
                          form.setValue('userPrompt', '');
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Presets</SelectLabel>

                          <SelectItem value={'instagram'}>Instagram</SelectItem>
                          <SelectItem value={'disney'}>Disney</SelectItem>
                          <SelectItem value={'anime'}>Anime</SelectItem>
                        </SelectGroup>

                        <SelectGroup>
                          <SelectLabel>Use your own prompt</SelectLabel>
                          <SelectItem value={CUSTOM}>Custom</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Use your own prompt to generate the avatars. This requires
                    some knowledge of prompting.
                  </FormDescription>
                </FormItem>
              );
            }}
            name={'preset'}
          />
        </If>

        <FormField
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Number of avatars</FormLabel>

                <FormControl>
                  <Input type={'number'} {...field} />
                </FormControl>
              </FormItem>
            );
          }}
          name={'numberOfAvatars'}
        />

        <div>
          <Button>Next</Button>
        </div>
      </form>
    </Form>
  );
}

function ModelsSelect({
  accountId,
  value,
  onValueChange,
}: {
  accountId: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { data, isLoading } = useFetchModels({
    accountId,
  });

  if (isLoading) {
    return (
      <div className={'flex items-center space-x-4'}>
        <Spinner />

        <span>Loading models...</span>
      </div>
    );
  }

  const noModels = data.length === 0;

  if (noModels) {
    return (
      <Alert variant={'warning'}>
        <AlertTitle>No models created</AlertTitle>

        <AlertDescription>
          <Link className={'underline'} href={'../models/new'}>
            Train a model before you can generate avatars
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Models</SelectLabel>

          {data.map((model) => {
            return (
              <SelectItem key={model.id} value={model.uuid}>
                {model.name}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function useFetchModels(props: { accountId: string }) {
  const client = useSupabase<Database>();

  return useSupabaseQuery({
    client,
    camelCase: true,
    table: 'avatars_models',
    where: {
      account_id: {
        eq: props.accountId,
      },
      status: {
        eq: 'success',
      },
    },
  });
}
