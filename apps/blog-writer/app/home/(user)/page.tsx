import Link from 'next/link';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';
import { PlusCircleIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { PostsTable } from '~/home/(user)/posts/_components/posts-table';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

interface PostPageProps {
  searchParams: {
    page?: string;
  };
}

async function PostsPage({ searchParams }: PostPageProps) {
  const client = getSupabaseServerComponentClient<Database>();
  const page = Number(searchParams.page ?? '1');
  const { user } = await loadUserWorkspace();

  return (
    <>
      <PageHeader
        title={<Trans i18nKey="posts:postsTabLabel" />}
        description={<Trans i18nKey="posts:postsTabDescription" />}
      >
        <Button asChild>
          <Link href={'/home/posts/new'}>
            <PlusCircleIcon className="mr-2 h-5 w-5" />
            <span>
              <Trans i18nKey="posts:createPostButtonLabel" />
            </span>
          </Link>
        </Button>
      </PageHeader>

      <PageBody>
        <ServerDataLoader
          client={client}
          table={'posts'}
          select={['id', 'title']}
          page={page}
          where={{
            account_id: {
              eq: user.id,
            },
          }}
        >
          {({ data, pageSize, pageCount }) => {
            return (
              <PostsTable
                data={data}
                page={page}
                pageSize={pageSize}
                pageCount={pageCount}
              />
            );
          }}
        </ServerDataLoader>
      </PageBody>
    </>
  );
}

export default withI18n(PostsPage);
