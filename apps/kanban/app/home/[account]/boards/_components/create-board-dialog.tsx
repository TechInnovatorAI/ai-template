'use client';

import { useForm } from 'react-hook-form';

import { ErrorBoundary } from '@kit/monitoring/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';

import { createBoardAction } from '~/home/[account]/boards/_lib/server/server-actions';

export function CreateBoardDialog(
  props: React.PropsWithChildren<{
    canCreateBoard: boolean;
    accountSlug: string;
  }>,
) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Board</DialogTitle>
        </DialogHeader>

        <If
          condition={props.canCreateBoard}
          fallback={<CannotCreateBoardAlert />}
        >
          <ErrorBoundary fallback={<BoardErrorAlert />}>
            <CreateBoardForm accountSlug={props.accountSlug} />
          </ErrorBoundary>
        </If>
      </DialogContent>
    </Dialog>
  );
}

function CreateBoardForm(props: { accountSlug: string }) {
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      accountSlug: props.accountSlug,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          return createBoardAction(data);
        })}
      >
        <div className={'flex flex-col space-y-4'}>
          <div>
            <p className={'text-sm text-gray-500'}>
              Get started by creating a board. Boards are used to organize your
              tasks into categories. For example, you can create a board for
              your marketing tasks, and another for your development tasks.
            </p>
          </div>

          <FormField
            render={({ field }) => (
              <FormItem>
                <FormLabel>Board Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={'Ex. Marketing Tasks'} />
                </FormControl>
              </FormItem>
            )}
            name={'name'}
          />

          <FormField
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>

                <FormControl>
                  <Textarea {...field} placeholder={'Description...'} />
                </FormControl>
              </FormItem>
            )}
            name={'description'}
          />

          <Button className={'w-full'}>Create Board</Button>
        </div>
      </form>
    </Form>
  );
}

function BoardErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>Failed to create board</AlertTitle>

      <AlertDescription>
        Sorry, we were unable to create your board. Please try again later.
      </AlertDescription>
    </Alert>
  );
}

function CannotCreateBoardAlert() {
  return (
    <Alert variant={'warning'}>
      <AlertTitle>Cannot create board</AlertTitle>

      <AlertDescription>
        You need to update your subscription to create more boards.
      </AlertDescription>
    </Alert>
  );
}
