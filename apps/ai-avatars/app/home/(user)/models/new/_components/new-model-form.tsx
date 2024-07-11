'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Image from 'next/image';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudUpload,
  X,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { createNewModel } from '../_lib/server/server-actions';

const MAX_IMAGES = 16;
const MIN_IMAGES = 8;

export function NewModelForm(props: { accountId: string }) {
  const [{ step, name, captionPrefix }, setState] = useState({
    step: 0,
    name: '',
    captionPrefix: '',
  });

  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className={'mt-8 flex w-full max-w-5xl flex-col space-y-16'}>
      <Stepper currentStep={step} steps={['Details', 'Images', 'Finish']} />

      <If condition={step === 0}>
        <ModelDetailsStep
          name={name}
          captionPrefix={captionPrefix}
          onSubmit={({ name, captionPrefix }) => {
            setState(() => {
              return { step: 1, name, captionPrefix };
            });
          }}
        />
      </If>

      <If condition={step === 1}>
        <UploadImagesStep
          files={files}
          setFiles={setFiles}
          onBack={() => setState((state) => ({ ...state, step: 0 }))}
          onSubmit={() => {
            setState((state) => {
              return {
                ...state,
                step: 2,
              };
            });
          }}
        />
      </If>

      <If condition={step === 2}>
        <SubmitModelStep
          accountId={props.accountId}
          name={name}
          captionPrefix={captionPrefix}
          files={files}
          onBack={() =>
            setState((state) => {
              return {
                ...state,
                step: 1,
              };
            })
          }
        />
      </If>
    </div>
  );
}

function SubmitModelStep({
  name,
  accountId,
  captionPrefix,
  files,
  onBack,
}: {
  name: string;
  accountId: string;
  captionPrefix: string;
  files: File[];
  onBack: () => void;
}) {
  const generating = useRef(false);
  const [error, setError] = useState<string>();
  const referenceId = useMemo(() => nanoid(32), []);

  const uploadImages = useUploadImages();

  useEffect(() => {
    const upload = () => {
      if (generating.current) {
        return;
      }

      generating.current = true;

      const promise = uploadImages({ files, referenceId, accountId })
        .then(() => {
          return createNewModel({
            referenceId,
            name,
            captionPrefix,
          });
        })
        .catch((error) => {
          setError(error);

          throw error;
        });

      toast.promise(promise, {
        loading: 'Uploading images...',
        success: 'Images uploaded successfully!',
        error: 'Sorry, we encountered an error. Please try again.',
      });
    };

    void upload();
  }, []);

  if (error) {
    return (
      <div className={'flex flex-col space-y-4'}>
        <Alert variant={'destructive'}>
          <AlertTitle>The model could not be generated</AlertTitle>
          <AlertDescription>
            Something went wrong while generating your model. Please try later
            again.
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
    <LoadingOverlay fullPage>
      <div className={'flex flex-col space-y-4 text-center'}>
        <p>
          Your model is being generated. This process will take a few minutes.
        </p>

        <p>You will be notified when your avatars are ready.</p>
      </div>
    </LoadingOverlay>
  );
}

function UploadImageForm({ onUpload }: { onUpload: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      },
      maxFiles: MAX_IMAGES,
      onDropAccepted: onUpload,
    });

  return (
    <div
      {...getRootProps({ className: 'dropzone' })}
      className={cn(
        'hover:bg-secondary-50 flex h-60 w-60 flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-8 transition-colors hover:border-primary',
        {
          'bg-green/10 border-green-500': isDragAccept,
          'border-destructive bg-destructive/10': isDragReject,
        },
      )}
    >
      <input {...getInputProps()} />

      <div
        className={
          'flex h-full flex-1 flex-col justify-center space-y-4 text-sm'
        }
      >
        <div className={'flex flex-col items-center space-y-2 text-center'}>
          <CloudUpload className={'w-8'} />

          <p>Drag and drop your image here</p>
        </div>

        <div className={'flex flex-col items-center space-y-2'}>
          <Button size={'sm'}>Pick an Image</Button>
        </div>
      </div>
    </div>
  );
}

function useUploadImages() {
  const supabase = useSupabase();

  return useCallback(
    async ({
      files,
      referenceId,
      accountId,
    }: {
      files: File[];
      referenceId: string;
      accountId: string;
    }) => {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const images = zip.folder('images');

      if (!images) {
        throw new Error('Failed to create ZIP file');
      }

      if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
        throw new Error(
          `You must upload between ${MIN_IMAGES} and ${MAX_IMAGES} images`,
        );
      }

      for (const file of files) {
        const webp = await convertImageToWebp(file);

        images.file(file.name, webp);
      }

      const blob = await images.generateAsync({ type: 'blob' });

      const { error } = await supabase.storage
        .from('avatars_models')
        .upload(`${accountId}/${referenceId}.zip`, blob);

      if (error) {
        throw error;
      }
    },
    [supabase],
  );
}

function ModelDetailsStep({
  onSubmit,
  name,
  captionPrefix,
}: {
  name: string;
  captionPrefix: string;

  onSubmit: ({
    name,
    captionPrefix,
  }: {
    name: string;
    captionPrefix: string;
  }) => void;
}) {
  const form = useForm({
    defaultValues: {
      name,
      captionPrefix,
    },
  });

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4'}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          name={'name'}
          render={(props) => {
            return (
              <FormItem>
                <FormLabel>Name your model</FormLabel>

                <FormControl>
                  <Input
                    required
                    minLength={3}
                    maxLength={50}
                    placeholder={`Ex. Summer pictures or Harry's model`}
                    {...props.field}
                  />
                </FormControl>
                <FormDescription>
                  Describe your model to help you identify it later to generate
                  avatars
                </FormDescription>
              </FormItem>
            );
          }}
        />

        <FormField
          name={'captionPrefix'}
          render={(props) => {
            return (
              <FormItem>
                <FormLabel>Caption prefix (optional)</FormLabel>

                <FormControl>
                  <Input {...props.field} />
                </FormControl>

                <FormDescription>
                  How do you want to caption your avatars? Optional, we will use
                  the prefix &quot;headshot profile picture&quot;
                </FormDescription>
              </FormItem>
            );
          }}
        />

        <div>
          <Button>Next</Button>
        </div>
      </form>
    </Form>
  );
}

function UploadImagesStep({
  files,
  setFiles,
  onSubmit,
  onBack,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className={'flex flex-col space-y-8 pb-16'}>
      <div className={'flex flex-col space-y-2 text-sm'}>
        <p>
          Upload your images to generate avatar pictures. Please add at least{' '}
          <span>{MIN_IMAGES}</span> images (up to <span>{MAX_IMAGES}</span>).
        </p>

        <p>
          <b>Important</b>: make sure to{' '}
          <b>crop your images to the face only</b>, and to use a variety of
          sides, angles, and expressions for the best results. The training is
          essential to ensure the best quality of the generated avatars.
        </p>
      </div>

      <div
        className={
          'md:grid-cols:2 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4'
        }
      >
        {files.map((file, index) => {
          return (
            <div
              key={file.name}
              className={'relative h-60 w-60 animate-in fade-in'}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size={'icon'}
                      variant={'ghost'}
                      className={'absolute right-2 top-2 z-10 bg-white'}
                      onClick={() => {
                        setFiles((files) => {
                          const newFiles = [...files];
                          newFiles.splice(index, 1);
                          return newFiles;
                        });
                      }}
                    >
                      <X className={'w-5'} />
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>Remove Image</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Image
                alt={`Image ${index}`}
                fill
                src={URL.createObjectURL(file)}
                className={'rounded-md object-cover'}
              />
            </div>
          );
        })}

        <If condition={files.length < MAX_IMAGES}>
          <UploadImageForm
            onUpload={(uploadedFiles) => {
              setFiles((files) => {
                const newFiles = uploadedFiles.filter((file) => {
                  return !files.find((item) => item.size === file.size);
                });

                const allFiles = [...files, ...newFiles];

                if (allFiles.length > MAX_IMAGES) {
                  toast.error(`You can only upload up to ${MAX_IMAGES} images`);

                  return files;
                }

                return allFiles;
              });
            }}
          />
        </If>
      </div>

      <div className={'flex justify-end space-x-4'}>
        <Button variant={'ghost'} onClick={onBack}>
          <ChevronLeftIcon className={'mr-2 w-4'} />
          <span>Back</span>
        </Button>

        <Button
          onClick={onSubmit}
          disabled={files.length < MIN_IMAGES || files.length > MAX_IMAGES}
        >
          <span>Generate Model</span>

          <ChevronRightIcon className={'ml-2 w-4'} />
        </Button>
      </div>
    </div>
  );
}

async function convertImageToWebp(file: File) {
  const { arrayBufferToWebP } = await import('webp-converter-browser');
  const buffer = await file.arrayBuffer();

  // Convert the image to WebP and reduce the quality to 50%
  // this will reduce the file size and speed up the upload
  return arrayBufferToWebP(buffer, {
    quality: 0.5,
  });
}
