'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Control, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';
import { Stepper } from '@kit/ui/stepper';
import { Trans } from '@kit/ui/trans';

import { Database } from '~/lib/database.types';

import {
  createChatbotCrawlingJobAction,
  getSitemapLinksAction,
} from '../_lib/server/server-actions';

const initialFormValues = {
  currentStep: 0,
  filters: {
    allow: [{ value: '' }],
    disallow: [{ value: '' }],
  },
};

export function CrawlWebsiteModal(
  props: React.PropsWithChildren<{
    url: string;
    chatbotId: string;
    accountId: string;
  }>,
) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>

      <AlertDialogContent className={'mb-4'}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey={'chatbot:crawlWebsiteTitle'} />
          </AlertDialogTitle>
        </AlertDialogHeader>

        <ModalForm
          accountId={props.accountId}
          url={props.url}
          chatbotId={props.chatbotId}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ModalForm(
  props: React.PropsWithChildren<{
    url: string;
    chatbotId: string;
    accountId: string;
  }>,
) {
  const form = useForm({
    defaultValues: initialFormValues,
    mode: 'onChange',
  });

  const { t } = useTranslation('chatbot');

  const steps = [
    'chatbot:websiteStepTitle',
    'chatbot:analyzeStepTitle',
    'chatbot:finishStepTitle',
  ];

  const crawlingJobMutation = useStartCrawlingJob();

  const currentStep = form.watch('currentStep');
  const filters = form.watch('filters');

  const getFilters = () => {
    const allow = filters.allow.map((filter) => filter.value);
    const disallow = filters.disallow.map((filter) => filter.value);

    return {
      allow,
      disallow,
    };
  };

  const isStep = (step: number) => currentStep === step;

  const setStep = (step: number) => {
    form.setValue('currentStep', step);
  };

  const onStartCrawling = () => {
    const promise = crawlingJobMutation.mutateAsync({
      chatbotId: props.chatbotId,
      filters: getFilters(),
    });

    toast.promise(promise, {
      success: t('crawlingStarted'),
      loading: t('crawlingStarting'),
      error: t('crawlingFailed'),
    });
  };

  return (
    <div className={'flex flex-col space-y-12'}>
      <Stepper steps={steps} currentStep={currentStep} />

      <If condition={isStep(0)}>
        <ConfirmWebsiteStep
          control={form.control}
          url={props.url}
          onNext={() => setStep(1)}
        />
      </If>

      <If condition={isStep(1)}>
        <AnalyzeWebsiteSitemapStep
          isCreatingJob={crawlingJobMutation.isPending}
          url={props.url}
          accountId={props.accountId}
          chatbotId={props.chatbotId}
          filters={getFilters()}
          onNext={onStartCrawling}
          onBack={() => setStep(0)}
        />
      </If>
    </div>
  );
}

function ConfirmWebsiteStep(
  props: React.PropsWithChildren<{
    url: string;
    control: Control<typeof initialFormValues>;
    onNext: () => unknown;
  }>,
) {
  return (
    <div className={'flex flex-col space-y-4 animate-in fade-in'}>
      <div className={'flex flex-col space-y-2'}>
        <p>
          <Trans i18nKey={'chatbot:confirmWebsiteStepDescription'} />
        </p>
      </div>

      <div>
        <Label>
          <span>
            <Trans i18nKey={'chatbot:chatbotWebsiteUrl'} />
          </span>
        </Label>

        <pre
          className={'mt-2 border bg-muted p-4 text-xs text-muted-foreground'}
        >
          <code>{props.url}</code>
        </pre>
      </div>

      <CrawlingFiltersForm control={props.control} />

      <div className={'flex justify-end space-x-2'}>
        <AlertDialogCancel>
          <Trans i18nKey={'common:cancel'} />
        </AlertDialogCancel>

        <Button type={'button'} onClick={props.onNext}>
          <Trans i18nKey={'chatbot:analyzeSubmitButton'} />
        </Button>
      </div>
    </div>
  );
}

function AnalyzeWebsiteSitemapStep(
  props: React.PropsWithChildren<{
    url: string;
    accountId: string;
    isCreatingJob: boolean;
    chatbotId: string;

    filters: {
      allow: string[];
      disallow: string[];
    };

    onBack: () => unknown;
    onNext: () => unknown;
  }>,
) {
  const { t } = useTranslation('chatbot');

  const { isLoading, data, error } = useSitemapLinks(
    props.chatbotId,
    props.url,
    props.filters,
  );

  const totalNumberOfPages = data?.numberOfPages ?? 0;
  const numberOfFilteredPages = data?.numberOfFilteredPages ?? 0;

  const canCreateCrawlingJobQuery = useCanCreateCrawlingJob(
    props.accountId,
    numberOfFilteredPages,
  );

  if (props.isCreatingJob) {
    return (
      <div
        className={
          'flex flex-col items-center justify-center space-y-4 text-sm animate-in fade-in'
        }
      >
        <Spinner />

        <p>
          <Trans i18nKey={'chatbot:creatingJobSpinnerLabel'} />
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={
          'flex flex-col items-center justify-center space-y-4 text-sm animate-in fade-in'
        }
      >
        <Spinner />

        <p>
          <Trans i18nKey={'chatbot:analyzeLoadingSpinnerLabel'} />
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={'flex flex-col space-y-4'}>
        <Alert variant={'destructive'}>
          <AlertTitle>
            <Trans i18nKey={'chatbot:websiteAnalysisErrorHeading'} />
          </AlertTitle>

          <AlertDescription>
            <Trans i18nKey={'chatbot:websiteAnalysisError'} />
          </AlertDescription>
        </Alert>

        <AlertDialogCancel>
          <Trans i18nKey={'common:cancel'} />
        </AlertDialogCancel>
      </div>
    );
  }

  return (
    <div className={'flex flex-col space-y-4 text-sm animate-in fade-in'}>
      <div className={'flex flex-col space-y-2'}>
        <p
          dangerouslySetInnerHTML={{
            __html: t(`websiteAnalysisResultHeading`, {
              url: props.url,
            }),
          }}
        />

        <p
          dangerouslySetInnerHTML={{
            __html: t(`websiteAnalysisResultDescription`, {
              totalNumberOfPages,
              numberOfFilteredPages,
            }),
          }}
        />
      </div>

      <div className={'flex justify-end space-x-2'}>
        <If
          condition={numberOfFilteredPages > 0}
          fallback={
            <>
              <Button
                variant={'outline'}
                type={'button'}
                onClick={props.onBack}
              >
                <Trans i18nKey={'common:goBack'} />
              </Button>
            </>
          }
        >
          <If
            condition={canCreateCrawlingJobQuery.data}
            fallback={
              <div className={'flex flex-col space-y-4'}>
                <WarnCannotCreateJobAlert />

                <Button
                  variant={'outline'}
                  type={'button'}
                  onClick={props.onBack}
                >
                  <Trans i18nKey={'common:goBack'} />
                </Button>
              </div>
            }
          >
            <Button variant={'outline'} type={'button'} onClick={props.onBack}>
              <Trans i18nKey={'common:goBack'} />
            </Button>

            <Button type={'button'} onClick={props.onNext}>
              <Trans i18nKey={'chatbot:startCrawlingButton'} />
            </Button>
          </If>
        </If>
      </div>
    </div>
  );
}

function CrawlingFiltersForm(
  props: React.PropsWithChildren<{
    control: Control<typeof initialFormValues>;
  }>,
) {
  const allowList = useFieldArray({
    control: props.control,
    name: 'filters.allow',
  });

  const disallowList = useFieldArray({
    control: props.control,
    name: 'filters.disallow',
  });

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex flex-col space-y-4'}>
        <div className={'flex flex-col space-y-2'}>
          <Heading level={5}>
            <Trans i18nKey={'chatbot:allowUrlsLabel'} />
          </Heading>

          <span className={'text-sm'}>
            <Trans i18nKey={'chatbot:allowUrlsDescription'} />
          </span>
        </div>

        <div className={'flex flex-col space-y-1'}>
          {allowList.fields.map((field, index) => {
            return (
              <div key={field.id} className={'flex items-center space-x-2'}>
                <Input
                  {...props.control.register(`filters.allow.${index}.value`)}
                  required
                  type={'text'}
                  className={'flex-1'}
                  placeholder={'Ex. /blog'}
                />

                <If condition={index > 0}>
                  <Button
                    size={'icon'}
                    variant={'outline'}
                    type={'button'}
                    onClick={() => allowList.remove(index)}
                  >
                    <X className={'h-4 w-4'} />
                  </Button>
                </If>
              </div>
            );
          })}

          <div>
            <Button
              type={'button'}
              onClick={() => allowList.append({ value: '' })}
              size={'sm'}
              variant={'ghost'}
            >
              <span>
                <Trans i18nKey={'chatbot:addInclusionPattern'} />
              </span>
            </Button>
          </div>
        </div>
      </div>

      <div className={'flex flex-col space-y-4'}>
        <div className={'flex flex-col space-y-2'}>
          <Heading level={5}>
            <Trans i18nKey={'chatbot:disallowUrlsLabel'} />
          </Heading>

          <span className={'text-sm'}>
            <Trans i18nKey={'chatbot:disallowUrlsDescription'} />
          </span>
        </div>

        <div className={'flex flex-col space-y-1.5'}>
          {disallowList.fields.map((field, index) => {
            return (
              <div key={field.id} className={'flex items-center space-x-2'}>
                <Input
                  {...props.control.register(`filters.disallow.${index}.value`)}
                  required
                  type={'text'}
                  className={'flex-1'}
                  placeholder={'Ex. /docs'}
                />

                <If condition={index > 0}>
                  <Button
                    size={'icon'}
                    variant={'outline'}
                    type={'button'}
                    onClick={() => disallowList.remove(index)}
                  >
                    <X className={'h-4 w-4'} />
                  </Button>
                </If>
              </div>
            );
          })}

          <div>
            <Button
              type={'button'}
              onClick={() => disallowList.append({ value: '' })}
              size={'sm'}
              variant={'ghost'}
            >
              <span>
                <Trans i18nKey={'chatbot:addExclusionPattern'} />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WarnCannotCreateJobAlert() {
  return (
    <Alert variant={'warning'}>
      <AlertTitle>
        <Trans i18nKey={'chatbot:createJobUpgradePlanHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'chatbot:upgradePlanDescription'} />
      </AlertDescription>
    </Alert>
  );
}

function useCanCreateCrawlingJob(
  accountId: string,
  requestedDocuments: number,
) {
  const supabase = useSupabase<Database>();
  const queryKey = ['can-create-crawling-job', requestedDocuments, accountId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_index_documents', {
        requested_documents: requestedDocuments,
        target_account_id: accountId,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
}

function useStartCrawlingJob() {
  type Params = {
    chatbotId: string;

    filters: {
      allow: string[];
      disallow: string[];
    };
  };

  const mutationKey = ['start-crawling-job'];

  const mutationFn = (params: Params) => {
    return createChatbotCrawlingJobAction(params);
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}

function useSitemapLinks(
  chatbotId: string,
  url: string,
  filters: {
    allow: string[];
    disallow: string[];
  },
) {
  const queryKey = ['sitemap-links', chatbotId, url, JSON.stringify(filters)];

  return useQuery({
    queryKey,
    queryFn: () => getSitemapLinksAction({ chatbotId, filters }),
  });
}
