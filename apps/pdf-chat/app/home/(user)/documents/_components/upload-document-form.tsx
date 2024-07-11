'use client';

import { useCallback, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Cloud } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { usePersonalAccountData } from '@kit/accounts/hooks/use-personal-account-data';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Stepper } from '@kit/ui/stepper';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { addDocumentAction } from '../_lib/server/server-actions';

export function UploadDocumentForm(props: { accountId: string }) {
  const [files, setFiles] = useState<File[]>([]);

  const { getRootProps, getInputProps, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        'application/pdf': ['.pdf'],
      },
      maxFiles: 1,
      onDropAccepted: (files) => {
        setFiles(files);
      },
    });

  if (files.length) {
    return (
      <div
        className={
          's-full my-24 flex flex-col items-center justify-between space-y-8'
        }
      >
        <AcceptedFilesConfirmation
          acceptedFiles={files}
          accountId={props.accountId}
          onClear={() => setFiles([])}
        />
      </div>
    );
  }

  return (
    <div
      className={
        'my-24 flex w-full flex-col items-center justify-between space-y-8'
      }
    >
      <div className={'flex flex-col items-center'}>
        <Heading level={3}>
          <Trans i18nKey={'documents:uploadDocument'} />
        </Heading>

        <Heading level={6} className={'!text-lg'}>
          <Trans i18nKey={'documents:uploadDocumentDescription'} />
        </Heading>
      </div>

      <div
        {...getRootProps({ className: 'dropzone' })}
        className={cn(
          'w-full max-w-2xl cursor-pointer rounded-lg border border-dashed p-16 transition-colors hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-500/10',
          {
            'border-green-500 bg-green-50 dark:bg-green-500/10': isDragAccept,
            'border-red-500 bg-red-50 dark:bg-red-500/10': isDragReject,
          },
        )}
      >
        <input {...getInputProps()} />

        <div className={'flex flex-col items-center space-y-4'}>
          <div className={'flex flex-col items-center space-y-4'}>
            <Cloud className={'w-24'} />

            <Heading level={5}>Drag and drop your document here</Heading>
          </div>

          <div>
            <Heading level={5}>or</Heading>
          </div>

          <div>
            <Button>Upload Document from Computer</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcceptedFilesConfirmation(props: {
  acceptedFiles: File[];
  accountId: string;
  onClear: () => void;
}) {
  const file = props.acceptedFiles[0];
  const steps = ['documents:details', 'documents:title', 'documents:confirm'];
  const [currentStep, setCurrentStep] = useState(0);

  const useUploadDocumentToStorageMutation = useUploadDocumentToStorage({
    accountId: props.accountId,
  });

  const onUpload = useCallback(
    async (title: string) => {
      if (!title) {
        return;
      }

      setCurrentStep(2);

      try {
        const path = await useUploadDocumentToStorageMutation.mutateAsync(file);

        await addDocumentAction({
          title,
          path,
        });

        toast.success(`Document uploaded successfully!`);
      } catch (e) {
        toast.error(`Sorry, we encountered an error. Please try again.`);
        setCurrentStep(1);
      }
    },
    [file, useUploadDocumentToStorageMutation],
  );

  return (
    <div className={'w-full max-w-3xl'}>
      <div className={'flex flex-col space-y-8 rounded-md border p-12'}>
        <Stepper steps={steps} currentStep={currentStep} />

        <If condition={currentStep === 0}>
          <DocumentDetailsStep
            file={file as File}
            onNext={() => setCurrentStep(1)}
            onCancel={props.onClear}
          />
        </If>

        <If condition={currentStep === 1}>
          <DocumentTitleStep onNext={onUpload} onCancel={props.onClear} />
        </If>

        <If condition={currentStep === 2}>
          <div className={'py-16'}>
            <LoadingOverlay fullPage={false}>
              We&apos;re uploading your document. This may take a few minutes.
            </LoadingOverlay>
          </div>
        </If>
      </div>
    </div>
  );
}

function DocumentDetailsStep({
  file,
  onNext,
  onCancel,
}: {
  file: File;
  onNext: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className={'flex flex-col'}>
        <Heading level={4}>Confirm Document Details</Heading>

        <Heading level={6} className={'!text-base'}>
          This document can be uploaded! Please confirm the details below.
        </Heading>
      </div>

      <div className={'flex flex-col space-y-1'}>
        <p>
          <b>File</b>: {file.name}
        </p>
        <p>
          <b>Size</b>: {Math.round(file.size / 1024)} KB
        </p>
        <p>
          <b>Type</b>: PDF
        </p>
      </div>

      <div className={'flex justify-end space-x-4'}>
        <Button variant={'ghost'} onClick={onCancel}>
          Go Back
        </Button>

        <Button onClick={onNext}>Next</Button>
      </div>
    </>
  );
}

function DocumentTitleStep(props: {
  onNext: (title: string) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      title: '',
    },
  });

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4'}
        onSubmit={form.handleSubmit((values) => {
          props.onNext(values.title);
        })}
      >
        <div className={'flex flex-col'}>
          <Heading level={4}>Document Title</Heading>

          <Heading level={6} className={'!text-base'}>
            Please enter a title for your document.
          </Heading>
        </div>

        <div>
          <FormField
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Title</FormLabel>

                <FormControl>
                  <Input
                    required
                    type={'text'}
                    className={'w-full'}
                    placeholder={'Document Title'}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
            name={'title'}
          />
        </div>

        <div className={'flex justify-end space-x-4'}>
          <Button type={'button'} variant={'ghost'} onClick={props.onCancel}>
            Go Back
          </Button>

          <Button>Next</Button>
        </div>
      </form>
    </Form>
  );
}

function useUploadDocumentToStorage(props: { accountId: string }) {
  const supabase = useSupabase();
  const documentName = nanoid(24);
  const account = usePersonalAccountData(props.accountId);

  const accountId = account.data?.id;

  return useMutation({
    mutationKey: ['upload-document'],
    mutationFn: async (file: File | undefined) => {
      if (!file) {
        throw new Error('File is not defined');
      }

      if (!account) {
        throw new Error('Account is not defined');
      }

      const fileExtension = file.name.split('.').pop();
      const fileName = `${accountId}/${documentName}.${fileExtension}`;

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      return data.path;
    },
  });
}
