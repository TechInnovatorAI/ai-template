'use client';

import { useState } from 'react';

import { useFormStatus } from 'react-dom';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';

import { insertNewTagAction } from '~/home/[account]/boards/[board]/_lib/server/server-actions';

import { useBoardContextStore } from '../board-context-store';

const ColorPicker = dynamic(
  async () => {
    const { HexColorPicker } = await import('react-colorful');

    return HexColorPicker;
  },
  {
    loading: () => <Spinner />,
  },
);

export function CreateTagDialog(
  props: React.PropsWithChildren<{
    onCreated: (tag: { name: string; color: string; id: number }) => void;
  }>,
) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tag</DialogTitle>
        </DialogHeader>

        <CreateTagForm
          onCreated={(data) => {
            props.onCreated(data);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function CreateTagForm(
  props: React.PropsWithChildren<{
    onCreated: (tag: { name: string; color: string; id: number }) => void;
  }>,
) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [color, setColor] = useState('');
  const boardId = useParams().board as string;
  const addTag = useBoardContextStore((state) => state.addTag);

  return (
    <form
      action={async (data) => {
        const tag = data.get('name') as string;

        const tags = await insertNewTagAction({
          boardId,
          color,
          name: tag,
        });

        const tagModel = {
          id: tags[0]!.id,
          name: tag,
          color,
        };

        props.onCreated(tagModel);
        addTag(tagModel);
      }}
    >
      <div className={'flex flex-col space-y-4'}>
        <Label className={'flex flex-col space-y-2'}>
          <span>Tag</span>

          <Input
            name={'name'}
            required
            type={'text'}
            placeholder={'Ex. Bug, Feature, etc.'}
          />
        </Label>

        <Label className={'flex flex-col space-y-2'}>
          <span>Pick a color</span>
          <div className={'relative flex space-x-4'}>
            <button
              type={'button'}
              className={
                'flex h-10 w-10 items-center justify-center rounded-xl border'
              }
              onClick={() => setShowColorPicker(true)}
            >
              <span
                style={{ backgroundColor: color }}
                className={'block h-8 w-8 rounded-lg border'}
              />
            </button>

            <If condition={showColorPicker}>
              <ColorPicker
                className={'absolute left-0 top-0'}
                style={{ width: 120, height: 120 }}
                onChange={setColor}
                color={color}
              />
            </If>
          </div>
        </Label>

        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending}>Create Label</Button>;
}
