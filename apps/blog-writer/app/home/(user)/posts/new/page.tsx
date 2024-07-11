import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

import { BlogPostWizard } from './_components/blog-post-wizard';

function NewPostPage() {
  return (
    <>
      <PageHeader
        title={<Trans i18nKey="posts:newPostTabLabel" />}
        description={<Trans i18nKey="posts:newPostTabDescription" />}
      />

      <PageBody>
        <div className={'w-full max-w-3xl pb-24'}>
          <BlogPostWizard />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(NewPostPage);
