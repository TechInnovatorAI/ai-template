'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { EllipsisVerticalIcon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Trans } from '@kit/ui/trans';

import { deletePostAction } from '~/home/(user)/posts/_lib/server/server-actions';

export function PostsTable({
  data,
  page,
  pageSize,
  pageCount,
}: {
  data: Array<{
    id: string;
    title: string;
  }>;

  page: number;
  pageSize: number;
  pageCount: number;
}) {
  return (
    <DataTable
      data={data}
      pageIndex={page - 1}
      pageSize={pageSize}
      pageCount={pageCount}
      columns={[
        {
          id: 'title',
          header: 'Title',
          cell: ({ row }) => {
            return (
              <Link href={`/home/posts/${row.original.id}`}>
                {row.original.title}
              </Link>
            );
          },
        },
        {
          id: 'actions',
          header: '',
          size: 50,
          cell: ({ row }) => {
            return (
              <div className={'flex justify-end px-4'}>
                <PostsActionsDropdown id={row.original.id} />
              </div>
            );
          },
        },
      ]}
    />
  );
}

function PostsActionsDropdown({ id }: { id: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={'icon'} variant={'ghost'}>
          <EllipsisVerticalIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent collisionPadding={50}>
        <DropdownMenuItem>
          <Link href={`/home/posts/${id}`}>
            <Trans i18nKey="posts:viewPostButtonLabel" />
          </Link>
        </DropdownMenuItem>

        <DeletePostModal id={id}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Trans i18nKey="posts:deletePostButtonLabel" />
          </DropdownMenuItem>
        </DeletePostModal>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeletePostModal(
  props: React.PropsWithChildren<{
    id: string;
  }>,
) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey="posts:deletePostButtonLabel" />
          </AlertDialogTitle>

          <AlertDialogDescription>
            <Trans i18nKey="common:modalConfirmationQuestion" />
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans i18nKey="common:cancel" />
          </AlertDialogCancel>

          <Button
            disabled={isPending}
            variant={'destructive'}
            onClick={() => {
              startTransition(async () => {
                await deletePostAction({
                  postId: props.id,
                });
              });
            }}
          >
            <Trans i18nKey="posts:confirmDeleteButtonLabel" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
