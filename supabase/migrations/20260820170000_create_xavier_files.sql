create table if not exists public.xavier_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.xavier_conversations(id) on delete cascade,
  parent_file_id uuid references public.xavier_files(id) on delete set null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  category text not null check (category in ('text', 'pdf', 'image', 'document', 'presentation', 'spreadsheet', 'archive', 'unknown')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xavier_files_user_conversation_created_idx
  on public.xavier_files (user_id, conversation_id, created_at desc);

create index if not exists xavier_files_user_ready_created_idx
  on public.xavier_files (user_id, status, created_at desc);

alter table public.xavier_files enable row level security;

revoke all on table public.xavier_files from anon, authenticated;
grant all on table public.xavier_files to service_role;

drop policy if exists xavier_files_select_own on public.xavier_files;
create policy xavier_files_select_own
  on public.xavier_files for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists xavier_files_insert_own on public.xavier_files;
create policy xavier_files_insert_own
  on public.xavier_files for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists xavier_files_update_own on public.xavier_files;
create policy xavier_files_update_own
  on public.xavier_files for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists xavier_files_delete_own on public.xavier_files;
create policy xavier_files_delete_own
  on public.xavier_files for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.xavier_files is 'Arquivos privados do Xavier por usuário e conversa, com versões geradas por comandos de edição.';
comment on column public.xavier_files.storage_path is 'Caminho privado no bucket xavier-files; nunca exposto sem URL assinada.';
comment on column public.xavier_files.parent_file_id is 'Arquivo anterior que originou esta versão editada.';
