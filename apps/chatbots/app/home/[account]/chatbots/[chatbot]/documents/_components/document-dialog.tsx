'use client';

import { useEffect, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { If } from '@kit/ui/if';
import { MarkdownRenderer } from '@kit/ui/markdown-renderer';
import { Spinner } from '@kit/ui/spinner';
import { Trans } from '@kit/ui/trans';

import { Database } from '~/lib/database.types';

export function DocumentDialog() {
  const params = useSearchParams();
  const value = params.get('document');

  const [docId, setDocId] = useState(value);
  const router = useRouter();
  const pathName = usePathname();

  useEffect(() => {
    setDocId(value);
  }, [value]);

  if (!docId) {
    return null;
  }

  return (
    <Dialog
      open={!!value}
      onOpenChange={(open) => {
        if (!open) {
          setDocId(null);
          // remove the query param from the url when the dialog is closed
          router.replace(pathName);
        }
      }}
    >
      <DialogContent>
        <DocumentContent
          documentId={docId}
          onBeforeDelete={() => setDocId(null)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DocumentContent(props: {
  documentId: string;
  onBeforeDelete?: () => void;
}) {
  const { data, isLoading, error } = useFetchDocument(props.documentId);

  if (error) {
    return (
      <Alert variant={'warning'}>
        <AlertTitle>
          <Trans i18nKey={'chatbot:documentNotFound'} />
        </AlertTitle>

        <AlertDescription>
          <Trans i18nKey={'chatbot:documentNotFoundDescription'} />
        </AlertDescription>
      </Alert>
    );
  }

  console.log(data);

  return (
    <>
      <If condition={isLoading}>
        <div className={'flex items-center space-x-4'}>
          <Spinner />

          <span>
            <Trans i18nKey={'chatbot:loadingDocument'} />
          </span>
        </div>
      </If>

      <If condition={data}>
        {(doc) => (
          <div className={'flex w-full flex-col space-y-4 divide-y'}>
            <div className={'flex w-full items-center justify-between'}>
              <DialogHeader>
                <DialogTitle>{doc.title}</DialogTitle>
              </DialogHeader>
            </div>

            <div className={'max-h-[50vh] overflow-auto'}>
              <MarkdownRenderer>{doc.content}</MarkdownRenderer>
            </div>
          </div>
        )}
      </If>
    </>
  );
}

function useFetchDocument(documentId: string) {
  const client = useSupabase<Database>();
  const queryKey = ['documents', documentId];

  const queryFn = async () => {
    const { data, error } = await client
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  };

  return useQuery({
    queryKey,
    queryFn,
  });
}
