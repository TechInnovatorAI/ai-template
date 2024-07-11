create extension vector with schema extensions;

-- public.jobs_status
create type public.jobs_status as ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);

-- public.sender
create type public.sender as ENUM (
  'user',
  'assistant'
);

-- public.message_type
create type public.message_type as ENUM (
  'ai',
  'db',
  'user'
);

-- Table: public.chatbots
create table if not exists public.chatbots (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  description varchar(1000),
  url text not null,
  site_name varchar(255) not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz default now() not null,
  settings jsonb default '{
    "title": "AI Assistant",
    "branding": {
      "textColor": "#fff",
      "primaryColor": "#0a0a0a",
      "accentColor": "#0a0a0a"
    },
    "position": "bottom-right"
  }' not null
);

grant select, insert, update, delete on public.chatbots to authenticated;

-- RLS
alter table public.chatbots enable row level security;

-- Indexes
create index ix_chatbots_account_id on public.chatbots (account_id);

-- Functions
-- public.has_role_on_chatbot
create or replace function public.has_role_on_chatbot(chatbot_id uuid)
returns bool
set search_path = ''
as $$
begin
    return exists (
        select 1 from public.chatbots where public.chatbots.id = chatbot_id and
         public.has_role_on_account(public.chatbots.account_id)
    );
end; $$
language plpgsql;

grant execute on function public.has_role_on_chatbot(uuid) to authenticated, service_role;

-- public.can_create_chatbot
create or replace function public.can_create_chatbot(target_account_id uuid)
returns bool
set search_path = ''
as $$
declare
    chatbot_count int;
    plan_variant_id text;
    quota bigint;
begin
    select count(*) from public.chatbots
    where public.chatbots.account_id = target_account_id into chatbot_count;

    select variant_id, max_chatbots
    from public.get_current_subscription_details(target_account_id)
    into plan_variant_id, quota;

    -- If no subscription is found, then the user is on the free plan
    -- and the quota is 1 chatbot
    if plan_variant_id is null then
        return chatbot_count < 1;
    end if;

    return chatbot_count < quota;
end; $$
language plpgsql;

grant execute on function public.can_create_chatbot(uuid) to authenticated, service_role;

-- SELECT(public.chatbots)
create policy read_chatbots
  on public.chatbots
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- INSERT(public.chatbots)
create policy insert_chatbots
  on public.chatbots
  for insert
  to authenticated
  with check (
    public.has_role_on_account(account_id) and
    public.can_create_chatbot(account_id)
);

-- UPDATE(public.chatbots)
create policy update_chatbots
  on public.chatbots
  for update
  to authenticated
  using (
    public.has_role_on_account(account_id)
  ) with check (
    public.has_role_on_account(account_id)
  );

-- DELETE(public.chatbots)
create policy delete_chatbots
  on public.chatbots
  for delete
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Table: public.documents_embeddings
create table if not exists public.documents_embeddings (
  id uuid primary key default gen_random_uuid(),
  embedding vector (1536),
  content text not null,
  metadata jsonb default '{}' not null,
  created_at timestamptz default now() not null
);

alter table public.documents_embeddings enable row level security;

-- Table public.documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  hash text not null,
  chatbot_id uuid not null references public.chatbots on delete cascade,
  created_at timestamptz default now() not null
);

grant select, update, delete on public.documents to authenticated;
grant insert, select, update, delete on public.documents to service_role;

-- Indexes
create index ix_documents_chatbot_id on public.documents (chatbot_id);

-- RLS
alter table public.documents enable row level security;

-- SELECT(public.documents)
create policy select_documents
  on public.documents
  for select
  to authenticated
  using (
    public.has_role_on_chatbot(chatbot_id)
  );

-- UPDATE(public.documents)
create policy update_documents
  on public.documents
  for update
  to authenticated
  using (
    public.has_role_on_chatbot(chatbot_id)
  ) with check (
    public.has_role_on_chatbot(chatbot_id)
  );

create policy delete_documents
  on public.documents
  for delete
  to authenticated
  using (
    public.has_role_on_chatbot(chatbot_id)
  );

-- Table public.conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  reference_id varchar(16) not null,
  chatbot_id uuid not null references public.chatbots on delete cascade,
  user_email varchar(255),
  created_at timestamptz default now() not null
);

grant select, insert, update, delete on public.conversations to authenticated, service_role;

-- RLS
alter table public.conversations enable row level security;

-- Table public.messages
create table if not exists public.messages (
  id bigint generated by default as identity primary key,
  conversation_id uuid not null references public.conversations on delete cascade,
  chatbot_id uuid not null references public.chatbots on delete cascade,
  text varchar(2000) not null,
  sender sender not null,
  type message_type not null,
  created_at timestamptz default now() not null
);

grant select, insert, update, delete on public.messages to authenticated, service_role;

-- Indexes
create index ix_messages_chatbot_id on public.messages (chatbot_id);
create index ix_messages_conversation_id on public.messages (conversation_id);

-- RLS
alter table public.messages enable row level security;

create table if not exists public.account_usage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  documents_quota int not null default 5,
  messages_quota int not null default 100
);

grant select, update on public.account_usage to authenticated;
grant insert, update, delete on public.account_usage to service_role;

-- insert usage row for accounts on creation
create function public.handle_new_account_usage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.account_usage (account_id)
  values (new.id);
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_account_created_set_usage
  after insert on public.accounts
  for each row
  when (new.is_personal_account = false)
  execute procedure public.handle_new_account_usage();

-- RLS
alter table public.account_usage enable row level security;

-- SELECT(public.account_usage)
create policy select_account_usage
  on public.account_usage
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Table public.jobs
create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  chatbot_id uuid not null references public.chatbots on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  status jobs_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  tasks_count int not null default 0,
  tasks_completed_count int not null default 0,
  tasks_succeeded_count int not null default 0,

  unique (account_id, id)
);

grant select on public.jobs to authenticated;
grant insert, update, delete on public.jobs to service_role;

-- RLS
alter table public.jobs enable row level security;

-- SELECT(public.jobs)
create policy select_jobs
  on public.jobs
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Table public.plans
create table if not exists public.plans (
  name text not null,
  variant_id varchar(255) not null,
  max_documents bigint not null,
  max_messages bigint not null,
  max_chatbots bigint not null,

  primary key (variant_id)
);

-- RLS
alter table public.plans enable row level security;

-- SELECT(public.plans)
create policy select_plans
  on public.plans
  for select
  to authenticated
  using (
    true
  );

-- Functions
create or replace function public.match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents_embeddings.embedding <=> query_embedding) as similarity
  from documents_embeddings
  where metadata @> filter
  order by documents_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

create index on public.documents_embeddings using hnsw (embedding vector_cosine_ops);

grant execute on function public.match_documents(vector, int, jsonb) to authenticated, service_role;

create or replace function public.get_current_subscription_details(target_account_id uuid)
returns table (
    period_starts_at timestamptz,
    period_ends_at timestamptz,
    variant_id varchar(255),
    interval_count int,
    max_documents bigint,
    max_messages bigint,
    max_chatbots bigint
) as $$
begin
    return query select
    subscription.period_starts_at,
    subscription.period_ends_at,
    item.variant_id,
    item.interval_count,
    plan.max_documents,
    plan.max_messages,
    plan.max_chatbots
    from public.subscriptions as subscription
    join public.subscription_items as item on subscription.id = item.subscription_id
    join public.plans as plan on item.variant_id = plan.variant_id
    where subscription.account_id = target_account_id
    and subscription.active = true
    group by subscription.period_starts_at, subscription.period_ends_at, item.interval_count, item.variant_id, plan.max_documents, plan.max_messages, plan.max_chatbots;
end;
$$ language plpgsql;

grant execute on function public.get_current_subscription_details(uuid) to authenticated, service_role;

create or replace function public.can_index_documents(target_account_id uuid, requested_documents bigint)
returns bool
set search_path = ''
as $$
declare
    remaining_documents bigint;
begin
    return exists (
        select 1 from public.account_usage
        where public.account_usage.account_id = target_account_id
        and public.account_usage.documents_quota >= requested_documents
    );
end; $$
language plpgsql;

grant execute on function public.can_index_documents(uuid, bigint) to authenticated, service_role;

create or replace function public.can_respond_to_message(target_chatbot_id uuid)
returns bool
set search_path = ''
as $$
declare
    period_start timestamptz;
    period_end timestamptz;
    variant_id varchar(255);
    subscription_interval int;
    messages_sent bigint;
    max_messages_quota bigint;
    target_account_id uuid;
begin
    -- select the account_id of the chatbot
    select account_id into target_account_id
    from public.chatbots
    where public.chatbots.id = target_chatbot_id;

    -- select the number of messages sent in the current period
    select messages_quota from public.account_usage
    where public.account_usage.account_id = target_account_id into messages_sent;

    return messages_sent > 0;
end; $$
language plpgsql;

grant execute on function public.can_respond_to_message(uuid) to authenticated, service_role;

create or replace function public.reduce_messages_quota(target_chatbot_id uuid)
returns void
set search_path = ''
as $$
begin
    update public.account_usage
    set messages_quota = messages_quota - 1
    from public.chatbots
    where public.account_usage.account_id = public.chatbots.account_id;
end; $$
language plpgsql;

grant execute on function public.reduce_messages_quota(uuid) to service_role;

create or replace function public.reduce_documents_quota(target_account_id uuid, docs_count int)
returns void
set search_path = ''
as $$
begin
    update public.account_usage
    set documents_quota = documents_quota - docs_count
    where public.account_usage.account_id = target_account_id;
end; $$
language plpgsql;

grant execute on function public.reduce_documents_quota(uuid, int) to service_role;