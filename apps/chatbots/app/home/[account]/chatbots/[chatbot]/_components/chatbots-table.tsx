'use client';

import { useMemo } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@kit/ui/enhanced-data-table';

import { ChatbotItemDropdown } from '~/home/[account]/chatbots/_components/chatbot-item-dropdown';
import { Database } from '~/lib/database.types';

export function ChatbotsTable(
  props: React.PropsWithChildren<{
    data: Database['public']['Tables']['chatbots']['Row'][];
    page: number;
    pageSize: number;
    pageCount: number;
  }>,
) {
  const columns = useGetColumns();

  return <DataTable {...props} columns={columns} />;
}

function useGetColumns() {
  const { t } = useTranslation('chatbot');
  const account = useParams().account as string;

  return useMemo(() => getColumns(account, t), [t, account]);
}

function getColumns(
  account: string,
  t: (key: string) => string,
): ColumnDef<{
  id: string;
  name: string;
  created_at: string;
}>[] {
  return [
    {
      id: 'name',
      header: t('name'),
      cell: ({ row }) => {
        return (
          <Link href={`/home/${account}/chatbots/${row.original.id}/documents`}>
            {row.original.name}
          </Link>
        );
      },
    },
    {
      id: 'createdAt',
      header: t('createdAt'),
      cell: ({ row }) => row.original.created_at,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        return (
          <div className={'flex justify-end px-4'}>
            <ChatbotItemDropdown chatbotId={row.original.id} />
          </div>
        );
      },
    },
  ];
}
