import Link from 'next/link';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { AvatarsGenerationsTable } from '~/home/(user)/avatars/_components/avatars-table';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

export const metadata = {
  title: 'Avatars',
};

interface SearchParams {
  page: number;
}

async function AvatarsGenerationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const client = getSupabaseServerComponentClient<Database>();
  const data = await loadUserWorkspace();

  const accountId = data.user.id;
  const page = searchParams.page ? Number(searchParams.page) : 1;

  return (
    <>
      <HomeLayoutPageHeader
        title={'Avatars'}
        description={`Manage and view your generated avatars`}
      >
        <Button asChild>
          <Link href={`avatars/generate`}>
            <PlusCircleIcon className={'mr-2 w-4'} />

            <span>Generate new Avatars</span>
          </Link>
        </Button>
      </HomeLayoutPageHeader>

      <PageBody>
        <ServerDataLoader
          client={client}
          table={'avatars_generations'}
          camelCase
          page={page}
          where={{
            account_id: {
              eq: accountId,
            },
          }}
        >
          {(props) => <AvatarsGenerationsTable {...props} />}
        </ServerDataLoader>
      </PageBody>
    </>
  );
}

export default withI18n(AvatarsGenerationsPage);
