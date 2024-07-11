import { use } from 'react';

import Link from 'next/link';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircle } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { DocumentsTable } from '~/home/(user)/documents/_components/documents-table';
import { Database } from '~/lib/database.types';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');

  return {
    title,
  };
};

function UserHomePage() {
  const workspace = use(loadUserWorkspace());
  const client = getSupabaseServerComponentClient<Database>();
  const accountId = workspace.user.id;

  return (
    <>
      <HomeLayoutPageHeader
        title={<Trans i18nKey={'documents:documentsTabLabel'} />}
        description={<Trans i18nKey={'documents:documentsTabDescription'} />}
      >
        <Button asChild>
          <Link href={'home/documents/new'}>
            <PlusCircle className="mr-2 h-5 w-5" />

            <span>
              <Trans i18nKey={'documents:addDocument'} />
            </span>
          </Link>
        </Button>
      </HomeLayoutPageHeader>

      <PageBody>
        <ServerDataLoader
          client={client}
          table={'documents'}
          select={['id', 'created_at', 'title']}
          camelCase
          where={{
            account_id: {
              eq: accountId,
            },
          }}
        >
          {({ data, page, pageCount, pageSize }) => {
            return (
              <DocumentsTable
                data={data}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
              />
            );
          }}
        </ServerDataLoader>
      </PageBody>
    </>
  );
}

export default withI18n(UserHomePage);
