import Image from 'next/image';

import { SupabaseClient } from '@supabase/supabase-js';

import { fetchDataFromSupabase } from '@makerkit/data-loader-supabase-core';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '~/home/(user)/_components/home-page-header';
import { Database } from '~/lib/database.types';
import { withI18n } from '~/lib/i18n/with-i18n';

interface Params {
  uuid: string;
}

async function AvatarsPage({ params }: { params: Params }) {
  const client = getSupabaseServerComponentClient<Database>();

  const [{ data, error }, images] = await Promise.all([
    fetchDataFromSupabase({
      client,
      camelCase: true,
      single: true,
      table: 'avatars_generations',
      where: {
        uuid: {
          eq: params.uuid,
        },
      },
      select: `
        id,
        uuid,
        name,
        status,
        prompt
      `,
    }),
    getImagesFromStorage(client, params.uuid),
  ]);

  if (error) {
    return (
      <div>
        <Alert variant={'destructive'}>
          <AlertTitle>Error loading generation</AlertTitle>
          <AlertDescription>
            Something went wrong loading the generation
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <HomeLayoutPageHeader
        title={data.name}
        description={`Below are the images generated from your model`}
      />

      <PageBody className={'h-screen'}>
        <div
          className={
            'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }
        >
          {images.map((image, index) => {
            return (
              <div key={image.name}>
                <Image
                  width={256}
                  height={256}
                  className={'h-full w-full object-contain'}
                  src={image.url}
                  alt={`Image ${index}`}
                />
              </div>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(AvatarsPage);

async function getImagesFromStorage(
  client: SupabaseClient<Database>,
  generationId: string,
) {
  const bucket = client.storage.from('avatars_generations');
  const path = `output/${generationId}`;
  const { data } = await bucket.list(path);

  return (data ?? []).map((file) => {
    return {
      name: file.name,
      url: bucket.getPublicUrl([path, file.name].join('/')).data.publicUrl,
    };
  });
}
