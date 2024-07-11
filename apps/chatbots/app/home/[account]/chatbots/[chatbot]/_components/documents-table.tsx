'use client';

import { useMemo } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { EllipsisVerticalIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { DataTable } from '@kit/ui/enhanced-data-table';

import { Database } from '~/lib/database.types';

import { DeleteDocumentModal } from '../_components/delete-document-modal';

type DocumentItem = Database['public']['Tables']['documents']['Row'];

interface DocumentTableProps {
  count: number;
  pageSize: number;
  pageCount: number;
  page: number;
  data: DocumentItem[];
}

export function DocumentsTable(props: DocumentTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const columns = useGetColumns();

  return (
    <DataTable
      pageIndex={props.page - 1}
      pageSize={props.pageSize}
      pageCount={props.pageCount}
      data={props.data}
      columns={columns}
      onPaginationChange={(state) => {
        router.push(`${pathname}?page=${state.pageIndex + 1}`);
      }}
    />
  );
}

function useGetColumns() {
  const { t } = useTranslation('chatbot');

  return useMemo(() => getColumns(t), [t]);
}

function getColumns(t: (key: string) => string): ColumnDef<DocumentItem>[] {
  return [
    {
      id: 'title',
      header: t('documentTitle'),
      cell: ({ row }) => {
        const doc = row.original;

        return (
          <Link
            className={'hover:underline'}
            href={`documents?document=${doc.id}`}
          >
            {doc.title}
          </Link>
        );
      },
    },
    {
      id: 'createdAt',
      header: t('createdAt'),
      cell: ({ row }) => {
        const value = row.original.created_at;

        return new Date(value).toLocaleString();
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
              <DropdownMenuTrigger>
                <EllipsisVerticalIcon className={'h-4'} />
              </DropdownMenuTrigger>

              <DropdownMenuContent collisionPadding={{ right: 50 }}>
                <DropdownMenuItem asChild>
                  <Link href={`/home/documents?document=${doc.id}`}>
                    {t('viewDocument')}
                  </Link>
                </DropdownMenuItem>

                <DeleteDocumentModal documentId={doc.id}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    {t('deleteDocument')}
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
