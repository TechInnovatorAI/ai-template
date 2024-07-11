import { use } from 'react';

import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { NewModelForm } from '~/home/(user)/models/new/_components/new-model-form';
import { withI18n } from '~/lib/i18n/with-i18n';

function CreateModelPage() {
  const { user } = use(loadUserWorkspace());

  return (
    <>
      <HomeLayoutPageHeader
        title={'Create Model'}
        description={`Models are trained with your pictures. Let's create your model!`}
      />

      <PageBody>
        <NewModelForm accountId={user.id} />
      </PageBody>
    </>
  );
}

export default withI18n(CreateModelPage);
