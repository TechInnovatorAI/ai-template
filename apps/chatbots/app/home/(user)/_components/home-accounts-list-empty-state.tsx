'use client';

import { Heading } from '@kit/ui/heading';

import { HomeAddAccountButton } from './home-add-account-button';

export function HomeAccountsListEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-24">
      <div className="flex flex-col items-center space-y-1">
        <Heading level={2}>You don&apos;t have any teams yet.</Heading>

        <Heading
          className="font-sans font-medium text-muted-foreground"
          level={4}
        >
          Create a team to get started.
        </Heading>
      </div>

      <HomeAddAccountButton />
    </div>
  );
}
