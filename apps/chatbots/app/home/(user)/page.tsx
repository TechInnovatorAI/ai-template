import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { HomeAccountsList } from './_components/home-accounts-list';
import { HomeLayoutPageHeader } from './_components/home-page-header';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:yourAccounts');

  return {
    title,
  };
};

function UserHomePage() {
  return (
    <>
      <HomeLayoutPageHeader
        title={<Trans i18nKey={'common:yourAccounts'} />}
        description={`Select the account you want to view or manage.`}
      />

      <PageBody>
        <HomeAccountsList />
      </PageBody>
    </>
  );
}

export default withI18n(UserHomePage);
