import Link from 'next/link';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { ModelsTable } from '~/home/(user)/models/_components/models-table';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

interface SearchParams {
  page: number;
}

async function ModelsPage({ searchParams }: { searchParams: SearchParams }) {
  const client = getSupabaseServerComponentClient<Database>();
  const data = await loadUserWorkspace();

  const page = searchParams.page ? Number(searchParams.page) : 1;
  const userId = data.user.id;

  return (
    <>
      <HomeLayoutPageHeader
        title={'Models'}
        description={`Models are trained with your pictures. Manage them from here`}
      >
        <Button asChild>
          <Link href={`/home/models/new`}>
            <PlusCircleIcon className={'mr-2 w-4'} />

            <span>Train a Model from your pictures</span>
          </Link>
        </Button>
      </HomeLayoutPageHeader>

      <PageBody>
        <ServerDataLoader
          client={client}
          table={'avatars_models'}
          page={page}
          camelCase
          where={{
            account_id: {
              eq: userId,
            },
          }}
        >
          {(props) => <ModelsTable {...props} />}
        </ServerDataLoader>
      </PageBody>
    </>
  );
}

export default withI18n(ModelsPage);
