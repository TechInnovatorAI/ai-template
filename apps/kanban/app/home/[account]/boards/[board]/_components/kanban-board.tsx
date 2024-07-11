'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableProvidedDragHandleProps,
  Droppable,
  DroppableProvided,
  OnDragEndResponder,
  OnDragStartResponder,
} from '@hello-pangea/dnd';
import { EllipsisVerticalIcon, PlusCircleIcon } from 'lucide-react';
import { Subject, debounceTime } from 'rxjs';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { cn } from '@kit/ui/utils';

import { TaskTag } from '~/lib/kanban/tags/types';
import {
  KanbanColumn as KanbanColumnType,
  KanbanTask as KanbanTaskType,
  NullableId,
} from '~/lib/kanban/types';

const UNASSIGNED_COLUMN_ID = 'unassigned';

enum ColumnType {
  TASK = 'TASK',
  COLUMN = 'COLUMN',
}

interface KanbanBoardProps {
  // inputs
  columns: ColumnWithTasks[];

  // event handlers
  onTaskClick: (task: KanbanTaskType) => void;
  onTaskCreateRequested?: (columnId: NullableId) => void;

  onTaskDeleteRequested?: (id: string) => void;
  onTaskOpenRequested?: (task: KanbanTaskType) => void;

  onTaskMoveRequested?: (
    taskId: string,
    columnId: NullableId,
    targetElementIndex: number,
  ) => void;

  onColumnCreateRequested?: () => void;
  onColumnDeleteRequested?: (id: string) => void;
  onColumnEditRequested?: (params: { id: string; name: string }) => void;

  onColumnMoveRequested?: (
    sourceColumnId: string,
    nextColumnIndex: number,
  ) => void;
}

type ColumnWithTasks = KanbanColumnType & {
  tasks: KanbanTaskType[];
};

const KanbanEventsContext = createKanbanEventsContext();

export function KanbanBoard(props: KanbanBoardProps) {
  const { columns, ...events } = props;

  const scrolls$ = useMemo(
    () => new Subject<React.UIEvent<HTMLDivElement>>(),
    [],
  );

  useEffect(() => {
    const subscription = scrolls$.pipe(debounceTime(50)).subscribe((e) => {
      const el = e.target as HTMLElement;

      addClassOnScroll(el);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [scrolls$]);

  useLayoutEffect(() => {
    const el = document.querySelector('.pb-container') as HTMLElement;

    if (el) {
      addClassOnScroll(el);
    }
  }, []);

  return (
    <KanbanEventsContext.Provider value={events}>
      <div
        className={
          'pb-container flex flex-1 overflow-x-auto overflow-y-hidden border border-transparent'
        }
        onScroll={(e) => scrolls$.next(e)}
      >
        <KanbanColumns columns={columns} />

        <div className={'ml-4 flex h-full flex-col items-center'}>
          <AddColumnButton />
        </div>
      </div>
    </KanbanEventsContext.Provider>
  );
}

export function KanbanColumns({
  columns,
}: React.PropsWithChildren<{
  columns: ColumnWithTasks[];
}>) {
  const { onColumnMoveRequested, onTaskMoveRequested } =
    useContext(KanbanEventsContext);

  const [isDropDisabled, setIsDropDisabled] = useState(false);

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, draggableId } = result;

    const getColumnId = (droppableId: NullableId | string) => {
      if (!droppableId || droppableId === UNASSIGNED_COLUMN_ID) {
        return null;
      }

      return droppableId;
    };

    switch (result.type) {
      case ColumnType.COLUMN: {
        if (!destination) {
          return;
        }

        const destinationColumn = columns[destination.index];
        const sourceColumn = draggableId;

        if (destination.index === 0) {
          return;
        }

        if (sourceColumn === destinationColumn?.id) {
          return;
        }

        callEvent(onColumnMoveRequested, sourceColumn, destination.index);

        break;
      }

      case ColumnType.TASK: {
        if (!destination) {
          return;
        }

        const destinationColumn = getColumnId(destination.droppableId);
        const taskId = draggableId;
        const newIndex = destination.index;

        callEvent(onTaskMoveRequested, taskId, destinationColumn, newIndex);
      }
    }
  };

  const onDragStart: OnDragStartResponder = (task) => {
    setIsDropDisabled(task.draggableId === UNASSIGNED_COLUMN_ID);
  };

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Droppable
        isDropDisabled={isDropDisabled}
        droppableId="columns"
        type={ColumnType.COLUMN}
        direction="horizontal"
      >
        {(provided: DroppableProvided, snapshot) => (
          <>
            <div
              className={cn(
                `fixed left-0 top-0 h-screen w-screen transition-all animate-in fade-in`,
                {
                  'block backdrop-blur-sm': snapshot.isDraggingOver,
                  hidden: !snapshot.isDraggingOver,
                },
              )}
            />

            <div
              className={cn(
                'z-10 flex space-x-4 px-1 py-1 transition-transform',
                {},
              )}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {columns.map((column, index) => {
                if (!column.id) {
                  return (
                    <KanbanColumn key={UNASSIGNED_COLUMN_ID} column={column} />
                  );
                }

                return (
                  <Draggable
                    key={column.id}
                    draggableId={column.id}
                    index={index}
                  >
                    {(draggable: DraggableProvided) => {
                      return (
                        <div
                          ref={draggable.innerRef}
                          {...draggable.draggableProps}
                        >
                          <KanbanColumn
                            column={column}
                            dragHandleProps={draggable.dragHandleProps}
                          />
                        </div>
                      );
                    }}
                  </Draggable>
                );
              })}
            </div>
          </>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function KanbanColumn({
  column,
  dragHandleProps,
}: {
  column: ColumnWithTasks;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}) {
  const { onColumnDeleteRequested } = useContext(KanbanEventsContext);
  const droppableId = column.id ?? UNASSIGNED_COLUMN_ID;

  return (
    <div className={cn('h-full w-full lg:min-w-[360px] lg:max-w-[360px]')}>
      <div className={'flex h-full flex-col space-y-2.5'}>
        <div className={'flex justify-between'}>
          <div className={'flex items-center space-x-2.5'}>
            <If condition={dragHandleProps}>
              <DragIcon {...dragHandleProps} />
            </If>

            <If
              condition={column.id}
              fallback={<span className={'font-semibold'}>{column.name}</span>}
            >
              {(id) => <EditableColumnName columnId={id} name={column.name} />}
            </If>
          </div>

          <If condition={column.id}>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <EllipsisVerticalIcon className={'h-5'} />
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    callEvent(onColumnDeleteRequested, column.id as string)
                  }
                >
                  <span className={'text-destructive'}>Delete Column</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </If>
        </div>

        <Droppable droppableId={droppableId} type={ColumnType.TASK}>
          {(provided: DroppableProvided, snapshot) => {
            return (
              <div
                className={cn(
                  `relative h-full rounded-lg border shadow-sm transition-all duration-300`,
                  {
                    ['bg-muted']: snapshot.isDraggingOver,
                    ['bg-background']: !snapshot.isDraggingOver,
                  },
                )}
              >
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={
                    'absolute flex h-full w-full flex-col space-y-2 overflow-y-auto p-2'
                  }
                >
                  {column.tasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                    >
                      {(draggable) => {
                        return (
                          <div
                            ref={draggable.innerRef}
                            {...draggable.draggableProps}
                            {...draggable.dragHandleProps}
                          >
                            <KanbanTask key={task.id} task={task} />
                          </div>
                        );
                      }}
                    </Draggable>
                  ))}

                  <div className={'flex justify-center p-0'}>
                    <AddTaskButton columnId={column.id} />
                  </div>

                  {provided.placeholder}
                </div>
              </div>
            );
          }}
        </Droppable>
      </div>
    </div>
  );
}

function TaskTagsContainer(props: { tags: TaskTag[] }) {
  return (
    <div className={'flex space-x-2'}>
      {props.tags.map((tag) => {
        return (
          <span key={tag.name} className={'flex items-center space-x-1'}>
            <span
              style={{
                backgroundColor: tag.color,
              }}
              className={'h-3 w-3 rounded'}
            />

            <span className={'text-xs font-medium'}>{tag.name}</span>
          </span>
        );
      })}
    </div>
  );
}

function KanbanTask({ task }: { task: KanbanTaskType }) {
  const { onTaskDeleteRequested, onTaskClick } =
    useContext(KanbanEventsContext);

  return (
    <div
      role={'link'}
      aria-label={'Open task'}
      onClick={() => callEvent(onTaskClick, task)}
      className={`group flex cursor-pointer flex-col space-y-2 rounded-lg border bg-background p-4 shadow-sm transition-all hover:shadow-lg dark:border dark:hover:shadow-primary/5`}
    >
      <div className={'flex items-center justify-between'}>
        <span className={'text-sm font-medium'}>{task.name}</span>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <EllipsisVerticalIcon className={'h-5'} />
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                callEvent(onTaskDeleteRequested, task.id);
              }}
            >
              <span className={'text-destructive'}>Delete Task</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <TaskTagsContainer tags={task.tags} />
      </div>
    </div>
  );
}

function AddTaskButton(props: { columnId: KanbanColumnType['id'] }) {
  const { onTaskCreateRequested } = useContext(KanbanEventsContext);

  return (
    <Button
      variant={'ghost'}
      className={'my-2 w-full'}
      onClick={() => {
        callEvent(onTaskCreateRequested, props.columnId);
      }}
    >
      <PlusCircleIcon className={'mr-2 w-4'} />
      <span>New Task</span>
    </Button>
  );
}

function AddColumnButton() {
  const { onColumnCreateRequested } = useContext(KanbanEventsContext);

  return (
    <div className={'h-full w-full lg:w-[400px]'}>
      <div
        className={'flex h-full flex-col items-center justify-center space-y-4'}
      >
        <Button
          className={'h-full w-full'}
          variant={'ghost'}
          onClick={() => {
            callEvent(onColumnCreateRequested);
          }}
        >
          <span className={'flex flex-col items-center space-y-2'}>
            <PlusCircleIcon className={'w-5'} />
            <span>Add Column</span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function EditableColumnName(
  props: React.PropsWithChildren<{
    columnId: string;
    name: string;
  }>,
) {
  const ref = useRef<HTMLSpanElement>(null);
  const { onColumnEditRequested } = useContext(KanbanEventsContext);

  return (
    <span
      suppressContentEditableWarning
      ref={ref}
      className={
        'min-w-[20px] border border-transparent font-semibold outline-none transition-colors hover:bg-muted focus:border-border'
      }
      contentEditable
      onBlur={(e) => {
        const text = e.currentTarget.innerText?.trim();

        // if the text is empty, revert to the previous name
        if (!text) {
          e.currentTarget.innerText = props.name;
          return;
        }

        // if the text is the same, do nothing
        if (text === props.name?.trim()) {
          return;
        }

        callEvent(onColumnEditRequested, {
          id: props.columnId,
          name: text,
        });
      }}
    >
      {props.name}
    </span>
  );
}

function createKanbanEventsContext() {
  return createContext<{
    onTaskClick?: (task: KanbanTaskType) => void;
    onTaskMove?: (
      task: KanbanTaskType,
      columnId: KanbanColumnType['id'],
    ) => void;
    onTaskCreateRequested?: (columnId: NullableId) => void;

    onTaskDeleteRequested?: (id: string) => void;
    onTaskOpenRequested?: (task: KanbanTaskType) => void;

    onTaskMoveRequested?: (
      taskId: string,
      columnId: NullableId,
      newIndex: number,
    ) => void;

    onColumnCreateRequested?: () => void;
    onColumnDeleteRequested?: (id: string) => void;
    onColumnEditRequested?: (column: { id: string; name: string }) => void;
    onColumnMoveRequested?: (column: string, nextColumnIndex: number) => void;
  }>({});
}

/**
 * Call the given function with the provided arguments, if it exists.
 *
 * @param {Function} fn - The function to be called.
 * @param {...any} args - The arguments to be passed to the function.
 */
function callEvent<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
  ...args: Parameters<T>
) {
  if (fn) {
    fn(...args);
  }
}

function DragIcon(props: React.HTMLAttributes<HTMLDivElement>) {
  const Dot = () => (
    <div
      className={
        'h-[3px] w-[3px] rounded-full bg-gray-700 hover:bg-gray-900' +
        ' dark:bg-gray-300 dark:hover:bg-gray-100'
      }
    />
  );

  return (
    <div
      {...props}
      className={
        'flex cursor-grab flex-col flex-wrap space-y-0.5 hover:bg-gray-100' +
        ' p-1 dark:hover:bg-gray-800'
      }
    >
      <div className={'flex space-x-0.5'}>
        <Dot />
        <Dot />
      </div>
      <div className={'flex space-x-0.5'}>
        <Dot />
        <Dot />
      </div>
      <div className={'flex space-x-0.5'}>
        <Dot />
        <Dot />
      </div>
    </div>
  );
}

function addClassOnScroll(el: HTMLElement) {
  if (el.scrollLeft > 0) {
    el.classList.add('border-l-border');
  } else {
    el.classList.remove('border-l-border');
  }

  if (el.scrollLeft + el.clientWidth < el.scrollWidth) {
    el.classList.add('border-r-border');
  } else {
    el.classList.remove('border-r-border');
  }
}
