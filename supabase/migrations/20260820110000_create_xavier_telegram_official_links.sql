create table if not exists public.xavier_telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  locale text not null default 'pt' check (locale in ('pt', 'en', 'es')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists xavier_telegram_link_codes_user_idx
  on public.xavier_telegram_link_codes(user_id, created_at desc);
create index if not exists xavier_telegram_link_codes_active_idx
  on public.xavier_telegram_link_codes(code_hash, expires_at)
  where consumed_at is null;

create table if not exists public.xavier_telegram_official_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  telegram_chat_id text not null unique,
  telegram_user_id text,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  locale text not null default 'pt' check (locale in ('pt', 'en', 'es')),
  status text not null default 'active' check (status in ('active', 'unlinked')),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unlinked_at timestamptz
);

create index if not exists xavier_telegram_official_links_chat_idx
  on public.xavier_telegram_official_links(telegram_chat_id, status);
create index if not exists xavier_telegram_official_links_status_idx
  on public.xavier_telegram_official_links(status, last_seen_at desc);

alter table public.xavier_telegram_link_codes enable row level security;
alter table public.xavier_telegram_official_links enable row level security;

 drop policy if exists "xavier_telegram_link_codes_owner" on public.xavier_telegram_link_codes;
create policy "xavier_telegram_link_codes_owner"
  on public.xavier_telegram_link_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

 drop policy if exists "xavier_telegram_official_links_owner" on public.xavier_telegram_official_links;
create policy "xavier_telegram_official_links_owner"
  on public.xavier_telegram_official_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.xavier_telegram_link_codes to authenticated;
grant select, insert, update, delete on public.xavier_telegram_official_links to authenticated;
grant all on public.xavier_telegram_link_codes to service_role;
grant all on public.xavier_telegram_official_links to service_role;

comment on table public.xavier_telegram_link_codes is 'Códigos de uso único e curta duração para vincular o bot oficial Xavier a uma conta.';
comment on table public.xavier_telegram_official_links is 'Vínculo isolado entre uma conta Xavier e um chat privado do bot oficial Telegram.';
comment on column public.xavier_telegram_official_links.telegram_chat_id is 'Identificador técnico do chat Telegram; nunca deve ser exibido como credencial.';
