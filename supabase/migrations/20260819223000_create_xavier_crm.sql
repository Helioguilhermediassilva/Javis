create table if not exists public.xavier_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 80),
  company text check (company is null or char_length(company) <= 200),
  tags text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.xavier_crm_demands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  description text check (description is null or char_length(description) <= 20000),
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint xavier_crm_demands_contact_same_user_fkey
    foreign key (user_id, contact_id)
    references public.xavier_crm_contacts (user_id, id)
    on delete restrict
);

create table if not exists public.xavier_crm_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid,
  demand_id uuid,
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  created_at timestamptz not null default now(),
  constraint xavier_crm_notes_contact_same_user_fkey
    foreign key (user_id, contact_id)
    references public.xavier_crm_contacts (user_id, id)
    on delete restrict,
  constraint xavier_crm_notes_demand_same_user_fkey
    foreign key (user_id, demand_id)
    references public.xavier_crm_demands (user_id, id)
    on delete restrict,
  constraint xavier_crm_notes_parent_check
    check (contact_id is not null or demand_id is not null)
);

create index if not exists xavier_crm_contacts_user_updated_idx
  on public.xavier_crm_contacts (user_id, updated_at desc);

create index if not exists xavier_crm_contacts_user_company_idx
  on public.xavier_crm_contacts (user_id, company);

create index if not exists xavier_crm_demands_user_status_idx
  on public.xavier_crm_demands (user_id, status, updated_at desc);

create index if not exists xavier_crm_demands_user_priority_idx
  on public.xavier_crm_demands (user_id, priority, due_date);

create index if not exists xavier_crm_demands_user_contact_idx
  on public.xavier_crm_demands (user_id, contact_id, updated_at desc);

create index if not exists xavier_crm_notes_user_created_idx
  on public.xavier_crm_notes (user_id, created_at desc);

create index if not exists xavier_crm_notes_user_contact_idx
  on public.xavier_crm_notes (user_id, contact_id, created_at desc);

create index if not exists xavier_crm_notes_user_demand_idx
  on public.xavier_crm_notes (user_id, demand_id, created_at desc);

alter table public.xavier_crm_contacts enable row level security;
alter table public.xavier_crm_demands enable row level security;
alter table public.xavier_crm_notes enable row level security;

revoke all on table public.xavier_crm_contacts from anon;
revoke all on table public.xavier_crm_demands from anon;
revoke all on table public.xavier_crm_notes from anon;

grant select, insert, update, delete on table public.xavier_crm_contacts to authenticated;
grant select, insert, update, delete on table public.xavier_crm_demands to authenticated;
grant select, insert, update, delete on table public.xavier_crm_notes to authenticated;
grant all on table public.xavier_crm_contacts to service_role;
grant all on table public.xavier_crm_demands to service_role;
grant all on table public.xavier_crm_notes to service_role;

drop policy if exists xavier_crm_contacts_select on public.xavier_crm_contacts;
create policy xavier_crm_contacts_select on public.xavier_crm_contacts
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists xavier_crm_contacts_insert on public.xavier_crm_contacts;
create policy xavier_crm_contacts_insert on public.xavier_crm_contacts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists xavier_crm_contacts_update on public.xavier_crm_contacts;
create policy xavier_crm_contacts_update on public.xavier_crm_contacts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists xavier_crm_contacts_delete on public.xavier_crm_contacts;
create policy xavier_crm_contacts_delete on public.xavier_crm_contacts
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists xavier_crm_demands_select on public.xavier_crm_demands;
create policy xavier_crm_demands_select on public.xavier_crm_demands
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists xavier_crm_demands_insert on public.xavier_crm_demands;
create policy xavier_crm_demands_insert on public.xavier_crm_demands
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists xavier_crm_demands_update on public.xavier_crm_demands;
create policy xavier_crm_demands_update on public.xavier_crm_demands
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists xavier_crm_demands_delete on public.xavier_crm_demands;
create policy xavier_crm_demands_delete on public.xavier_crm_demands
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists xavier_crm_notes_select on public.xavier_crm_notes;
create policy xavier_crm_notes_select on public.xavier_crm_notes
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists xavier_crm_notes_insert on public.xavier_crm_notes;
create policy xavier_crm_notes_insert on public.xavier_crm_notes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists xavier_crm_notes_update on public.xavier_crm_notes;
create policy xavier_crm_notes_update on public.xavier_crm_notes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists xavier_crm_notes_delete on public.xavier_crm_notes;
create policy xavier_crm_notes_delete on public.xavier_crm_notes
  for delete to authenticated using (auth.uid() = user_id);

comment on table public.xavier_crm_contacts is 'Contatos do CRM do Xavier, isolados por user_id.';
comment on table public.xavier_crm_demands is 'Demandas do CRM do Xavier, isoladas por user_id e vinculadas opcionalmente a contatos.';
comment on table public.xavier_crm_notes is 'Anotações do CRM do Xavier, isoladas por user_id e vinculadas a contato ou demanda.';
