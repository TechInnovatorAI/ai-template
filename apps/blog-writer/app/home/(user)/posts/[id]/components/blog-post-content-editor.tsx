'use client';

import { useLayoutEffect, useMemo, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  Subject,
  debounceTime,
  delay,
  distinctUntilChanged,
  mergeMap,
  tap,
} from 'rxjs';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { If } from '@kit/ui/if';
import { MarkdownRenderer } from '@kit/ui/markdown-renderer';
import { Trans } from '@kit/ui/trans';

import { Database } from '~/lib/database.types';

export function BlogPostContentEditor(props: { id: string; content: string }) {
  const updatePost = useUpdatePost(props.id);
  const save$ = useMemo(() => new Subject<string>(), []);

  const [pendingText, setPendingText] = useState<string>();

  const [wordCount, setWordCount] = useState<number>(
    props.content.split(' ').length,
  );

  useLayoutEffect(() => {
    const subscription = save$
      .pipe(
        distinctUntilChanged(),
        tap((content) => {
          setPendingText('posts:editingPost');
          setWordCount(content.split(' ').length);
        }),
        debounceTime(3000),
        tap(() => {
          setPendingText('posts:savingPost');
        }),
        mergeMap((content) => {
          return updatePost.mutateAsync(content ?? '');
        }),
        tap(() => {
          setPendingText(`posts:saveSuccess`);
        }),
        delay(2000),
        tap(() => {
          setPendingText('');
        }),
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [save$, updatePost]);

  return (
    <div className={'mx-auto flex max-w-3xl flex-1 flex-col space-y-4 pb-16'}>
      <div className={'flex items-center space-x-4'}>
        <Badge variant={'outline'}>{wordCount} words</Badge>

        <div>
          <If condition={pendingText}>
            <span
              className={
                'text-sm text-muted-foreground duration-200 animate-in fade-in'
              }
            >
              <Trans i18nKey={pendingText} />
            </span>
          </If>
        </div>
      </div>

      <div>
        <MarkdownRenderer>{props.content}</MarkdownRenderer>
      </div>
    </div>
  );
}

export default BlogPostContentEditor;

function useUpdatePost(id: string) {
  const client = useSupabase<Database>();
  const mutationKey = ['posts', id];

  const mutationFn = async (content: string) => {
    const { error } = await client
      .from('posts')
      .update({
        content,
      })
      .match({
        id,
      });

    if (error) {
      throw error;
    }
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}
