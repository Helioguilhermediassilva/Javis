create table if not exists public.xavier_manus_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('web', 'telegram')),
  conversation_id uuid references public.xavier_conversations(id) on delete set null,
  telegram_connection_id uuid references public.xavier_telegram_connections(id) on delete set null,
  telegram_chat_id text,
  manus_task_id text not null unique,
  task_url text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'stopped')),
  request_text text not null check (char_length(request_text) between 1 and 12000),
  result_text text check (result_text is null or char_length(result_text) between 1 and 12000),
  error_message text check (error_message is null or char_length(error_message) between 1 and 2000),
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  delivered_at timestamptz
);

create index if not exists xavier_manus_tasks_user_created_idx
  on public.xavier_manus_tasks (user_id, created_at desc);

create index if not exists xavier_manus_tasks_user_status_idx
  on public.xavier_manus_tasks (user_id, status, updated_at desc);

create index if not exists xavier_manus_tasks_telegram_delivery_idx
  on public.xavier_manus_tasks (telegram_connection_id, telegram_chat_id, status, updated_at desc)
  where telegram_connection_id is not null and telegram_chat_id is not null;

alter table public.xavier_manus_tasks enable row level security;
revoke all on table public.xavier_manus_tasks from anon, authenticated;
grant all on table public.xavier_manus_tasks to service_role;

comment on table public.xavier_manus_tasks is 'Tarefas Manus assíncronas do Xavier, isoladas por usuário e canal; o backend é o único escritor.';
comment on column public.xavier_manus_tasks.manus_task_id is 'Identificador da tarefa na Manus API v2.';
comment on column public.xavier_manus_tasks.delivered_at is 'Momento em que o resultado foi entregue ao canal de origem.';
