import { use } from 'react';

import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadUserWorkspace } from '../../_lib/server/load-user-workspace';
import { UploadDocumentForm } from '../_components/upload-document-form';

function NewDocumentPage() {
  const data = use(loadUserWorkspace());

  return (
    <>
      <PageHeader
        title={<Trans i18nKey={'documents:addDocument'} />}
        description={<Trans i18nKey={'documents:addDocumentDescription'} />}
      />

      <PageBody>
        <UploadDocumentForm accountId={data.user.id} />
      </PageBody>
    </>
  );
}

export default withI18n(NewDocumentPage);
