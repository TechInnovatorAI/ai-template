import { use } from 'react';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { loadUserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import { GenerateAvatarsForm } from '~/home/(user)/avatars/_components/generate-avatars-form';
import { withI18n } from '~/lib/i18n/with-i18n';

function NewAvatarsGenerationPage() {
  const { user } = use(loadUserWorkspace());

  return (
    <>
      <HomeLayoutPageHeader
        title={'Generate your Avatars'}
        description={'Generate your avatars with the AI Avatars generator'}
      />

      <PageBody>
        <div className={'w-full max-w-5xl'}>
          <GenerateAvatarsForm accountId={user.id} />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(NewAvatarsGenerationPage);
