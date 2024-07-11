create type generation_status as enum (
    'pending',
    'success',
    'failed'
);

-- avatars models
create table avatars_models (
  id serial primary key,
  uuid uuid not null default gen_random_uuid() unique,
  account_id uuid not null references public.accounts(id) on delete cascade,
  model text not null unique,
  reference_id text not null unique,
  name text not null,
  status generation_status not null default 'pending',
  created_at timestamp not null default now()
);

-- indexes
create index ix_avatars_models_account_id on avatars_models (account_id);

-- rls
alter table avatars_models enable row level security;

create policy select_avatars_models
    on public.avatars_models
    for select
    to authenticated
    using (
      account_id = (select auth.uid ())
    );

create policy insert_avatars_models
    on public.avatars_models
    for insert
    to authenticated
    with check (
        account_id = (select auth.uid ())
    );

-- avatars generations
create table avatars_generations (
  id serial primary key,
  uuid uuid not null default gen_random_uuid() unique,
  account_id uuid not null references public.accounts(id) on delete cascade,
  model_id integer not null references public.avatars_models(id) on delete cascade,
  prompt text not null,
  name text not null,
  status generation_status not null default 'pending',
  created_at timestamp not null default now()
);

-- indexes
create index ix_avatars_generations_account_id on avatars_generations (account_id);
create index ix_avatars_generations_model_id on avatars_generations (model_id);

-- rls
alter table avatars_generations enable row level security;

create policy select_avatars_generations
    on public.avatars_generations
    for select
    to authenticated
    using (
        account_id = (select auth.uid ())
    );

create policy insert_avatars_generations
    on public.avatars_generations
    for insert
    to authenticated
    with check (
        account_id = (select auth.uid ())
    );

-- organization credits
create table account_credits (
  id serial primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  credits integer not null default 20,
  created_at timestamp not null default now()
);

-- indexes
create index ix_account_credits_account_id on account_credits (account_id);

-- rls
alter table account_credits enable row level security;

create policy read_account_credits
    on public.account_credits
    for select
    to authenticated
    using (
        account_id = (select auth.uid ())
    );

-- insert usage row for accounts on creation
create function public.handle_new_account_credits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.account_credits (account_id)
  values (new.id);
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_account_created_add_credits
  after insert on public.accounts
  for each row execute procedure public.handle_new_account_credits();

-- plans
create table if not exists public.plans (
  id serial primary key,
  name text not null unique,
  credits integer not null
);

revoke all on public.plans from public, service_role;

grant select on public.plans to authenticated, service_role;

alter table public.plans enable row level security;

create policy select_plans
    on public.plans
    for select
    to authenticated
    using (
        true
    );

insert into storage.buckets (id, name, PUBLIC)
  values ('avatars_models', 'avatars_models', false);

insert into storage.buckets (id, name, PUBLIC)
  values ('avatars_generations', 'avatars_generations', true);

create or replace function public.is_user_avatar(generation_id uuid) returns boolean
language plpgsql
set search_path = ''
as $$
begin
    return exists (
        select 1
        from public.avatars_generations ag
        where ag.uuid = generation_id and ag.account_id = (select auth.uid())
    );
end;
$$;

grant execute on function public.is_user_avatar to authenticated;

create policy insert_avatars_models
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'avatars_models' and (
        public.is_user_avatar((storage.foldername(name))[2]::uuid)
    ));

create policy read_storage_generations_bucket
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'avatars_generations' and (
        public.is_user_avatar((storage.foldername(name))[2]::uuid)
    ));

create or replace function public.reduce_credits(target_account_id uuid, credits_cost integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_credits integer;
begin
  select credits from public.account_credits
  where account_id = target_account_id
  into current_credits
  for update;

  if current_credits - credits_cost < 0 then
    RAISE EXCEPTION 'Insufficient credits';
  end if;

  update public.account_credits
  set credits = current_credits - credits_cost
  where account_id = target_account_id;
end;
$$;

grant execute on function public.reduce_credits to service_role;

create or replace function public.can_generate(credits_cost integer)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  return (select credits >= credits_cost from public.account_credits where account_id = auth.uid());
end;
$$;

grant execute on function public.can_generate to authenticated;