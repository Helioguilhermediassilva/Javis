create table if not exists public.xavier_action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('web', 'telegram')),
  conversation_id uuid references public.xavier_conversations(id) on delete set null,
  telegram_connection_id uuid references public.xavier_telegram_connections(id) on delete set null,
  telegram_chat_id text,
  kind text not null check (kind in ('document', 'pdf', 'presentation', 'image', 'video', 'system', 'mcp', 'external')),
  title text not null check (char_length(title) between 1 and 160),
  request_text text not null check (char_length(request_text) between 1 and 12000),
  status text not null default 'pending_approval' check (status in ('pending_approval', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  approval_code text not null unique check (char_length(approval_code) between 4 and 80),
  metadata jsonb not null default '{}'::jsonb,
  result_text text check (result_text is null or char_length(result_text) between 1 and 12000),
  attachments jsonb not null default '[]'::jsonb,
  error_message text check (error_message is null or char_length(error_message) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz
);

create index if not exists xavier_action_requests_user_created_idx
  on public.xavier_action_requests (user_id, created_at desc);

create index if not exists xavier_action_requests_user_status_idx
  on public.xavier_action_requests (user_id, status, updated_at desc);

create index if not exists xavier_action_requests_telegram_delivery_idx
  on public.xavier_action_requests (telegram_chat_id, status, updated_at desc)
  where telegram_chat_id is not null;

alter table public.xavier_action_requests enable row level security;
revoke all on table public.xavier_action_requests from anon, authenticated;
grant all on table public.xavier_action_requests to service_role;

comment on table public.xavier_action_requests is 'Fila e aprovações explícitas de ações do Xavier, isoladas por usuário e canal; o backend é o único escritor.';
comment on column public.xavier_action_requests.approval_code is 'Código curto exibido ao usuário para aprovação ou cancelamento explícito da ação.';
comment on column public.xavier_action_requests.metadata is 'Metadados não sensíveis da tarefa, sem credenciais ou tokens.';
