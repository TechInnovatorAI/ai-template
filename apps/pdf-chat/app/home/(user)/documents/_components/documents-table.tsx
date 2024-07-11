'use client';

import { FormEventHandler } from 'react';

import Link from 'next/link';

import { ColumnDef } from '@tanstack/react-table';
import { EllipsisVertical } from 'lucide-react';
import { toast } from 'sonner';

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

import { deleteDocumentAction } from '../_lib/server/server-actions';

interface DocumentsTableProps {
  data: Array<{
    id: string;
    createdAt: string;
    title: string;
  }>;
  page: number;
  pageCount: number;
  pageSize: number;
}

export function DocumentsTable({
  data,
  page,
  pageSize,
  pageCount,
}: DocumentsTableProps) {
  return (
    <DataTable
      data={data}
      pageIndex={page - 1}
      pageCount={pageCount}
      pageSize={pageSize}
      columns={getColumns()}
    />
  );
}

function getColumns<
  T extends {
    id: string;
    createdAt: string;
    title: string;
  },
>(): Array<ColumnDef<T>> {
  return [
    {
      id: 'name',
      size: 20,
      header: () => <Trans i18nKey={'documents:name'} />,
      cell: ({ row }) => {
        const title = row.original.title;

        return (
          <Link
            className={'hover:underline'}
            href={`/home/documents/${row.original.id}`}
          >
            <span>{title}</span>
          </Link>
        );
      },
    },
    {
      id: 'createdAt',
      size: 20,
      header: () => <Trans i18nKey={'documents:createdAt'} />,
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        const day = date.toLocaleDateString();
        const time = date.toLocaleTimeString();

        return (
          <span>
            {day} at {time}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const doc = row.original;

        return (
          <div className={'flex justify-end'}>
            <DropdownMenu>
              <DropdownMenuTrigger className={'px-2'}>
                <EllipsisVertical className={'h-4'} />
              </DropdownMenuTrigger>

              <DropdownMenuContent collisionPadding={20}>
                <DropdownMenuItem>
                  <Link href={`documents/${doc.id}`}>Chat with Document</Link>
                </DropdownMenuItem>

                <DeleteDocumentModal documentId={doc.id}>
                  <DropdownMenuItem
                    className={'w-full'}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Delete Document
                  </DropdownMenuItem>
                </DeleteDocumentModal>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

function DeleteDocumentModal({
  documentId,
  children,
}: React.PropsWithChildren<{ documentId: string }>) {
  const onConfirm: FormEventHandler = (e) => {
    e.preventDefault();

    const promise = async () => {
      return deleteDocumentAction({ documentId });
    };

    return toast.promise(promise, {
      loading: 'Deleting document...',
      success: 'Document deleted',
      error: 'Failed to delete document',
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document</AlertDialogTitle>

          <AlertDialogDescription>
            Are you sure you want to delete this document? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={onConfirm}>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <Button variant={'destructive'}>Yes, Delete Document</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
