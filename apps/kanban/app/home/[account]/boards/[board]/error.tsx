'use client';

import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';

export function BoardErrorPage() {
  return (
    <>
      <PageHeader title={'Something went wrong'} description={''} />

      <PageBody className={'space-y-4'}>
        <Alert variant={'destructive'}>
          <AlertTitle>Board not loaded</AlertTitle>

          <AlertDescription>
            Something went wrong while loading this board. Please try again
            later.
          </AlertDescription>
        </Alert>

        <div>
          <Button asChild variant={'ghost'}>
            <Link href={'../'}>Back to Boards</Link>
          </Button>
        </div>
      </PageBody>
    </>
  );
}

export default BoardErrorPage;
