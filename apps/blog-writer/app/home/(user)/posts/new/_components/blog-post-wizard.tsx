'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
} from 'react';

import { useMutation } from '@tanstack/react-query';
import { PlusCircleIcon, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
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
import { Stepper } from '@kit/ui/stepper';
import { Textarea } from '@kit/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { Trans } from '@kit/ui/trans';

import { generatePostAction } from '../../_lib/server/server-actions';

enum BlogPostCreatorStep {
  Details = 0,
  Outline = 1,
  BulletPoints = 2,
  Finish = 3,
}

type OutlineData = {
  outline: Array<{
    heading: string;
    sections: Array<{
      value: string;
      bulletPoints: Array<{
        value: string;
      }>;
    }>;
  }>;
};

const FormContext = createContext<{
  step: BlogPostCreatorStep;
  setStep: (
    step: BlogPostCreatorStep | ((step: BlogPostCreatorStep) => number),
  ) => void;
}>({
  step: BlogPostCreatorStep.Details,
  setStep: (
    _: BlogPostCreatorStep | ((step: BlogPostCreatorStep) => number),
  ) => {
    return;
  },
});

export function BlogPostWizard() {
  const [step, setStep] = useState(BlogPostCreatorStep.Details);

  const Title = () => {
    switch (step) {
      case BlogPostCreatorStep.Details:
        return <Trans i18nKey={'posts:detailsStepLabel'} />;

      case BlogPostCreatorStep.BulletPoints:
        return <Trans i18nKey={'posts:bulletPointsStepLabel'} />;

      case BlogPostCreatorStep.Outline:
        return <Trans i18nKey={'posts:outlineStepLabel'} />;

      case BlogPostCreatorStep.Finish:
        return;
    }
  };

  return (
    <FormContext.Provider value={{ step, setStep }}>
      <div className={'flex flex-col space-y-16'}>
        <BlogPostWizardSteps />

        <Card>
          <CardHeader>
            <CardTitle>
              <Title />
            </CardTitle>
          </CardHeader>

          <CardContent>
            <BlogPostWizardFormContainer />
          </CardContent>
        </Card>
      </div>
    </FormContext.Provider>
  );
}

function BlogPostWizardFormContainer() {
  const { step, setStep } = useFormContext();
  const [, startTransition] = useTransition();
  const { t } = useTranslation('posts');

  const detailsForm = useForm<{
    title: string;
    instructions?: string;
  }>({
    defaultValues: {
      title: '',
      instructions: undefined,
    },
  });

  const outlineForm = useForm<OutlineData>({
    defaultValues: {
      outline: [],
    },
  });

  const onCreatePostRequested = useCallback(() => {
    startTransition(async () => {
      try {
        await generatePostAction({
          title: detailsForm.getValues('title'),
          outline: outlineForm.getValues('outline'),
        });
      } catch (e) {
        toast.error(t(`posts:postCreationFailed`));
        setStep(BlogPostCreatorStep.BulletPoints);
      }
    });
  }, [detailsForm, outlineForm, setStep, t]);

  const title = detailsForm.getValues('title');

  switch (step) {
    case BlogPostCreatorStep.Details:
      return (
        <BlogPostWizardDetailsForm
          form={detailsForm}
          onOutlineFetched={(data) => {
            outlineForm.setValue('outline', data);
            setStep((currentStep) => currentStep + 1);
          }}
        />
      );

    case BlogPostCreatorStep.Outline:
      return (
        <BlogPostWizardOutlineForm
          title={title}
          form={outlineForm}
          onSubmit={(data) => {
            outlineForm.setValue('outline', data.outline);
            setStep((currentStep) => currentStep + 1);
          }}
        />
      );

    case BlogPostCreatorStep.BulletPoints:
      return (
        <BlogPostWizardOutlineForm
          title={title}
          form={outlineForm}
          displayBulletPoints
          onSubmit={(data) => {
            outlineForm.setValue('outline', data.outline);
            setStep((currentStep) => currentStep + 1);
            onCreatePostRequested();
          }}
        />
      );

    case BlogPostCreatorStep.Finish:
      return <BlogPostWizardFinishForm />;

    default:
      return null;
  }
}

function BlogPostWizardDetailsForm({
  form,
  onOutlineFetched,
}: {
  form: ReturnType<
    typeof useForm<{
      title: string;
      instructions?: string;
    }>
  >;
  onOutlineFetched: (outline: OutlineData['outline']) => void;
}) {
  const fetchOutline = useFetchOutlineFromTopic();

  if (fetchOutline.isPending) {
    return (
      <LoadingOverlay fullPage={false}>
        <Trans i18nKey={'posts:generatingOutline'} />
      </LoadingOverlay>
    );
  }

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4'}
        onSubmit={form.handleSubmit(async (values) => {
          const data = await fetchOutline.mutateAsync({
            title: values.title,
            instructions: values.instructions ?? undefined,
          });

          if (!data) {
            return;
          }

          onOutlineFetched(data);
        })}
      >
        <div className={'flex flex-col space-y-4'}>
          <FormField
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'posts:titleInputLabel'} />
                  </FormLabel>

                  <FormControl>
                    <Input required {...field} />
                  </FormControl>
                </FormItem>
              );
            }}
            name={'title'}
          />

          <FormField
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'posts:instructionsInputLabel'} /> (
                    <Trans i18nKey={'posts:optional'} />)
                  </FormLabel>

                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>

                  <FormDescription>
                    <Trans i18nKey={'posts:instructionsInputHint'} />
                  </FormDescription>
                </FormItem>
              );
            }}
            name={'instructions'}
          />

          <div>
            <NextStepButton />
          </div>
        </div>
      </form>
    </Form>
  );
}

function BlogPostWizardOutlineForm({
  form,
  title,
  displayBulletPoints = false,
  onSubmit,
}: {
  title: string;
  form: ReturnType<typeof useForm<OutlineData>>;
  onSubmit: (data: OutlineData) => void;
  displayBulletPoints?: boolean;
}) {
  const fetchBulletPoints = useFetchBulletPointsFromOutline();

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'outline',
  });

  const { t } = useTranslation('posts');

  function BulletPointsRenderer({
    index,
    subHeadingIndex,
  }: {
    index: number;
    subHeadingIndex: number;
  }) {
    const bulletPointsFieldArray = useFieldArray({
      control: form.control,
      name: `outline.${index}.sections.${subHeadingIndex}.bulletPoints`,
    });

    return bulletPointsFieldArray.fields.map((field, bulletPointIndex) => {
      const control = form.register(
        `outline.${index}.sections.${subHeadingIndex}.bulletPoints.${bulletPointIndex}.value`,
        {
          required: true,
        },
      );

      return (
        <div className={'pl-4'} key={field.id}>
          <div className={'flex flex-col space-y-1.5'}>
            <div className="group relative flex justify-between space-x-2">
              <span className={'text-sm'}>•</span>

              <textarea
                {...control}
                required
                placeholder={t('bulletPointPlaceholder')}
                className={
                  'h-9 w-full resize-none rounded-md bg-transparent px-2 py-2 text-sm outline-none invalid:ring-red-500 hover:bg-muted focus:ring-2 focus:ring-primary'
                }
              />

              <div className={'hidden group-hover:block'}>
                <ItemActions
                  onAdd={() =>
                    bulletPointsFieldArray.insert(
                      bulletPointIndex + 1,
                      { value: '' },
                      {
                        shouldFocus: true,
                      },
                    )
                  }
                  onRemove={() =>
                    bulletPointsFieldArray.remove(bulletPointIndex)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      );
    });
  }

  function SubHeadingRenderer({ index }: { index: number }) {
    const headingFieldArray = useFieldArray({
      control: form.control,
      name: `outline.${index}.sections`,
    });

    return headingFieldArray.fields.map((field, headingIndex) => {
      const control = form.register(
        `outline.${index}.sections.${headingIndex}.value`,
        {
          required: true,
        },
      );

      return (
        <div className={'py-1 pl-4'} key={field.id}>
          <div className={'flex flex-col space-y-2.5'}>
            <div
              className={
                'group relative flex items-center justify-between space-x-2'
              }
            >
              <span className={'font-medium'}>{headingIndex + 1}.</span>

              <input
                {...control}
                required
                placeholder={t('subHeadingPlaceholder')}
                className={
                  'h-9 w-full rounded-md bg-transparent px-2 py-1 text-base outline-none invalid:ring-red-500 hover:bg-muted focus:ring-2 focus:ring-primary'
                }
              />

              <div className={'hidden group-hover:block'}>
                <ItemActions
                  onAdd={() =>
                    headingFieldArray.insert(
                      headingIndex + 1,
                      { value: '', bulletPoints: [] },
                      {
                        shouldFocus: true,
                      },
                    )
                  }
                  onRemove={() => headingFieldArray.remove(headingIndex)}
                />
              </div>
            </div>

            <If condition={displayBulletPoints}>
              <BulletPointsRenderer
                subHeadingIndex={headingIndex}
                index={index}
              />

              <div>
                <Button
                  size={'sm'}
                  variant={'link'}
                  onClick={() => {
                    headingFieldArray.update(headingIndex, {
                      ...field,
                      bulletPoints: [
                        ...(field.bulletPoints || []),
                        {
                          value: '',
                        },
                      ],
                    });
                  }}
                >
                  <PlusCircleIcon className={'mr-2 w-4'} />

                  <span>
                    <Trans i18nKey={'posts:addBulletPointButtonLabel'} />
                  </span>
                </Button>
              </div>
            </If>
          </div>
        </div>
      );
    });
  }

  if (fetchBulletPoints.isPending) {
    return (
      <LoadingOverlay fullPage={false}>
        <Trans i18nKey={'posts:generatingBulletPoints'} />
      </LoadingOverlay>
    );
  }

  return (
    <form
      className={'flex flex-col space-y-4'}
      onSubmit={form.handleSubmit(async ({ outline }) => {
        if (!displayBulletPoints) {
          const data = await fetchBulletPoints.mutateAsync({
            outline,
            title,
          });

          if (!data) {
            return;
          }

          return onSubmit({ outline: data });
        }

        onSubmit({ outline });
      })}
    >
      <div className={'flex flex-col space-y-8'}>
        <div className={'flex flex-col space-y-4'}>
          <SectionPlaceholder>
            <Trans i18nKey={'posts:outlineIntroductionPlaceholder'} />
          </SectionPlaceholder>

          {fieldArray.fields.map((field, index) => {
            const control = form.register(`outline.${index}.heading`, {
              required: true,
            });

            return (
              <div key={field.id} className={'flex flex-col space-y-1'}>
                <div
                  className={
                    'group flex w-full items-center justify-between space-x-2'
                  }
                >
                  <span className={'text-xl font-medium'}>{index + 1}.</span>

                  <input
                    {...control}
                    required
                    placeholder={t('addHeadingButtonLabel')}
                    className={
                      'h-9 w-full rounded-md bg-transparent px-2 py-1 text-lg font-semibold outline-none invalid:ring-red-500 hover:bg-muted focus:ring-2 focus:ring-primary'
                    }
                  />

                  <div className={'hidden group-hover:block'}>
                    <ItemActions
                      onAdd={() => {
                        fieldArray.insert(
                          index + 1,
                          { heading: '', sections: [] },
                          {
                            shouldFocus: true,
                          },
                        );
                      }}
                      onRemove={() => fieldArray.remove(index)}
                    />
                  </div>
                </div>

                <div className={'flex flex-col divide-y'}>
                  <SubHeadingRenderer index={index} />

                  <div className={'flex space-x-2.5'}>
                    <Button
                      size={'sm'}
                      variant={'link'}
                      onClick={() => {
                        fieldArray.update(index, {
                          ...field,
                          sections: [
                            ...field.sections,
                            {
                              value: '',
                              bulletPoints: [],
                            },
                          ],
                        });
                      }}
                    >
                      <PlusCircleIcon className={'mr-2 w-4'} />

                      <span>
                        <Trans i18nKey={'posts:addSubHeadingButtonLabel'} />
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <SectionPlaceholder>
            <Trans i18nKey={'posts:outlineConclusionPlaceholder'} />
          </SectionPlaceholder>
        </div>

        <div className={'flex space-x-2'}>
          <PreviousStepButton />
          <NextStepButton />
        </div>
      </div>
    </form>
  );
}

function ItemActions(props: { onRemove: () => void; onAdd: () => void }) {
  return (
    <div className={'flex items-center space-x-0.5'}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size={'icon'} variant={'ghost'} onClick={props.onRemove}>
              <X className={'w-4'} />
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <Trans i18nKey={'posts:removeSectionButtonLabel'} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size={'icon'} variant={'ghost'} onClick={props.onAdd}>
              <PlusCircleIcon className={'w-4'} />
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <Trans i18nKey={'posts:addSectionButtonLabel'} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function BlogPostWizardFinishForm() {
  return (
    <div className={'flex flex-col space-y-4'}>
      <CreatingPostLoadingOverlay />
    </div>
  );
}

function useFormContext() {
  return useContext(FormContext);
}

function NextStepButton(props: React.PropsWithChildren) {
  return (
    <Button>
      {props.children ?? <Trans i18nKey={'posts:nextStepButtonLabel'} />}
    </Button>
  );
}

function PreviousStepButton(props: React.PropsWithChildren) {
  const { setStep } = useFormContext();

  return (
    <Button
      variant={'outline'}
      type={'button'}
      onClick={() => {
        setStep((step) => step - 1);
      }}
    >
      {props.children ?? <Trans i18nKey={'posts:backStepButtonLabel'} />}
    </Button>
  );
}

function CreatingPostLoadingOverlay() {
  return (
    <LoadingOverlay fullPage={false}>
      <Trans i18nKey={'posts:generatingPost'} />
    </LoadingOverlay>
  );
}

function BlogPostWizardSteps() {
  const { step } = useFormContext();

  const steps = [
    'posts:detailsStepLabel',
    'posts:outlineStepLabel',
    'posts:bulletPointsStepLabel',
    'posts:finishStepLabel',
  ];

  return <Stepper currentStep={step} steps={steps} />;
}

function SectionPlaceholder(props: React.PropsWithChildren) {
  return (
    <div className={'border border-dashed bg-muted p-4 text-center text-sm'}>
      {props.children}
    </div>
  );
}

function useFetchOutlineFromTopic() {
  type Params = {
    instructions?: string;
    title: string;
  };

  const mutationKey = ['posts/outline'];

  const mutationFn = async (body: Params) => {
    const response = await fetch(`/api/posts/outline`, {
      body: JSON.stringify(body),
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch outline.`);
    }

    return response.json();
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}

function useFetchBulletPointsFromOutline() {
  const mutationKey = ['posts/bullet-points'];

  type Body = OutlineData & { title: string };

  const mutationFn = async (body: Body) => {
    const response = await fetch(`/api/posts/bullet-points`, {
      body: JSON.stringify(body),
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bullet points.`);
    }

    return await response.json();
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}
