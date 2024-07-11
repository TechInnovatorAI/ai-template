CREATE OR REPLACE FUNCTION public.delete_task_and_reorder(IN task_id uuid)
RETURNS TABLE (affected_task_id uuid, new_position bigint)
set search_path = ''
AS $$
DECLARE
    task_position bigint;
    task_board_id uuid;
BEGIN
    -- Get the position and board_id of the task to be deleted
    SELECT position, board_id INTO task_position, task_board_id FROM public.tasks WHERE id = task_id;

    -- Delete the task
    DELETE FROM public.tasks WHERE id = task_id;

    -- Decrement the positions of all tasks that come after the deleted task in the same board
    UPDATE public.tasks SET position = position - 1 WHERE board_id = task_board_id AND position > task_position;

    -- Return IDs and new positions of all affected tasks
    RETURN QUERY SELECT id, position FROM public.tasks WHERE board_id = task_board_id AND position >= task_position;
END; $$
LANGUAGE plpgsql;

grant execute on function public.delete_task_and_reorder(uuid) to authenticated, service_role;

create or replace function public.select_product_id_by_account_id(target_account_id uuid)
returns varchar
set search_path = ''
as $$
declare
    account_product_id varchar;
begin
    select product_id from public.subscription_items
    into account_product_id
    join public.subscriptions
    on subscription_items.subscription_id = public.subscriptions.id
    where public.subscriptions.account_id = target_account_id
    limit 1;

    return account_product_id;
end; $$
language plpgsql;

grant execute on function public.select_product_id_by_account_id(uuid) to authenticated, service_role;

create or replace function public.can_create_task(target_account_id uuid)
returns bool
set search_path = ''
as $$
declare
    task_count bigint;
    account_product_id text;
    quota bigint;
begin
    select count(*) into task_count from public.tasks where account_id = target_account_id;

    select public.select_product_id_by_account_id(target_account_id) into account_product_id;

    /* If no subscription is found, then the user is on the free plan */
    if account_product_id is null then
        return task_count < 5;
    end if;

    select task_quota into quota from public.plans where product_id = account_product_id;

    return task_count < quota;
end; $$
language plpgsql;

grant execute on function public.can_create_task(uuid) to authenticated, service_role;

create or replace function public.can_create_board(target_account_id uuid)
returns bool
set search_path = ''
as $$
declare
    board_count int;
    account_product_id text;
    quota bigint;
begin
    select count(*) into board_count
    from public.boards
    where public.boards.account_id = target_account_id;

    select public.select_product_id_by_account_id(target_account_id) into account_product_id;

    /* If no subscription is found, then the user is on the free plan */
    if account_product_id is null then
      return board_count < 1;
    end if;

    select board_quota into quota from public.plans where product_id = account_product_id;

    return board_count < quota;
end; $$
language plpgsql;

grant execute on function public.can_create_board(uuid) to authenticated, service_role;

create or replace function public.can_create_board_by_slug(account_slug varchar)
returns bool
set search_path = ''
as $$
declare
    target_account_id uuid;
begin
    select id into target_account_id from public.accounts where slug = account_slug;

    return public.can_create_board(target_account_id);
end; $$
language plpgsql;

grant execute on function public.can_create_board_by_slug(varchar) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_can_action_board(IN board_id uuid)
returns bool
set search_path = ''
AS $$
DECLARE
    acc_id uuid;
BEGIN
    SELECT account_id INTO acc_id FROM public.boards WHERE id = board_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Board with ID % not found', board_id;
    END IF;

    RETURN public.has_role_on_account (acc_id);
END; $$
LANGUAGE plpgsql;

grant execute on function public.current_user_can_action_board(uuid) to authenticated, service_role;

-- Boards
create table public.boards (
  id uuid primary key not null default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name varchar(255) not null,
  description varchar(1000),
  created_at timestamptz not null default now()
);

-- Permissions
revoke all on public.boards from public, service_role;

grant select, delete, insert, update on public.boards to authenticated, service_role;

-- RLS
alter table public.boards enable row level security;

create policy select_boards on public.boards
  for select
  to authenticated
    using (public.has_role_on_account (account_id));

create policy delete_boards on public.boards
  for delete
  to authenticated
    using (public.has_role_on_account (account_id));

create policy insert_boards on public.boards
  for insert
  to authenticated
  with check (
    public.has_role_on_account (account_id) and
    public.can_create_board (account_id)
  );

-- Indexes
create index ix_boards_account_id on public.boards (account_id);

-- Board Columns
create table public.boards_columns (
  id uuid primary key not null default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  next_column_id uuid references public.boards_columns on delete set null,
  name varchar(255) not null,
  created_at timestamptz not null default now()
);

revoke all on public.boards_columns from public, service_role;

grant select, delete, insert, update on public.boards_columns to authenticated, service_role;

-- RLS
alter table public.boards_columns enable row level security;

create policy all_boards_columns on public.boards_columns
  for all
  to authenticated
    using (public.has_role_on_account (account_id));

-- Indexes
create index ix_boards_columns_account_id on public.boards_columns (account_id);

-- Tasks
create table public.tasks (
  id uuid primary key not null default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  board_id uuid references public.boards on delete set null,
  column_id uuid references public.boards_columns on delete cascade,
  name varchar(255) not null,
  body varchar(2000),
  assignee_id uuid references public.accounts on delete set null,
  position bigint not null default 0,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permissions
revoke all on public.tasks from public, service_role;

-- RLS
alter table public.tasks enable row level security;

create policy select_tasks on public.tasks
  for select
    to authenticated
      using (public.has_role_on_account (account_id));

create policy update_tasks on public.tasks
  for update
    to authenticated
      using (public.has_role_on_account (account_id))
        with check (public.current_user_can_action_board (board_id));

create policy delete_tasks on public.tasks
    for delete
        using (public.has_role_on_account (account_id));

create policy insert_tasks
on public.tasks
    for insert
        with check (
            public.has_role_on_account (account_id) and
            public.can_create_task (account_id)
        );

-- Indexes
create index ix_tasks_account_id on public.tasks (account_id);

-- Tags
create table public.tags (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards on delete cascade,
  name varchar(255) not null,
  color varchar(255) not null,
  created_at timestamptz not null default now(),

  unique (board_id, name)
);

-- Permissions
revoke all on public.tags from public, service_role;

grant select, delete, insert, update on public.tags to authenticated, service_role;

-- RLS
alter table public.tags enable row level security;

create policy all_tags on public.tags
    for all
        using (public.current_user_can_action_board (board_id));

-- Indexes
create index ix_tags_board_id on public.tags (board_id);

-- Tasks Tags
create table public.tasks_tags (
  task_id uuid not null references public.tasks on delete cascade,
  tag_id bigint not null references public.tags on delete cascade,
  primary key (task_id, tag_id)
);

-- Permissions
revoke all on public.tasks_tags from public, service_role;

grant select, delete, insert, update on public.tasks_tags to authenticated, service_role;

-- RLS
alter table public.tasks_tags enable row level security;

create policy all_tasks_tags on public.tasks_tags
    for all
        using (task_id in (
        select
            id
        from
            tasks
        where
            account_id in (
            select
                account_id
            from
                public.accounts_memberships
            where
                user_id = auth.uid ())));

-- Indexes
create index ix_tasks_tags_task_id on public.tasks_tags (task_id);
create index ix_tasks_tags_tag_id on public.tasks_tags (tag_id);

-- Plans
create table public.plans (
  name varchar(255) not null,
  product_id varchar(255) not null,
  task_quota int not null,
  board_quota int not null,
  primary key (product_id)
);

revoke all on public.plans from public, service_role;

grant select on public.plans to authenticated, service_role;

-- RLS
alter table public.plans enable row level security;

create policy select_plans
    on public.plans
    for select
    to authenticated
    using (true);
