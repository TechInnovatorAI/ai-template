import dynamic from 'next/dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchDataFromSupabase } from '@makerkit/data-loader-supabase-core';
import { ArrowLeftIcon } from 'lucide-react';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const BlogPostContentEditor = dynamic(
  () => import('./components/blog-post-content-editor'),
  {
    ssr: false,
  },
);

interface PostPageProps {
  params: {
    organization: string;
    id: string;
  };
}

async function PostPage({ params }: PostPageProps) {
  const client = getSupabaseServerComponentClient<Database>();
  const user = await requireUserInServerComponent();

  const post = await fetchDataFromSupabase({
    client,
    table: 'posts',
    select: ['id', 'title', 'content'],
    single: true,
    where: {
      id: {
        eq: params.id,
      },
      account_id: {
        eq: user.id,
      },
    },
  });

  if (!post) {
    return notFound();
  }

  return (
    <div className={'flex h-screen flex-1 flex-col'}>
      <PageHeader title={post.data.title}>
        <Button asChild size={'sm'} variant={'ghost'}>
          <Link href={'/home'}>
            <ArrowLeftIcon className="mr-2 w-4" />
            <span>
              <Trans i18nKey="posts:backButtonLabel" />
            </span>
          </Link>
        </Button>
      </PageHeader>

      <PageBody>
        <BlogPostContentEditor content={post.data.content} id={post.data.id} />
      </PageBody>
    </div>
  );
}

export default withI18n(PostPage);
