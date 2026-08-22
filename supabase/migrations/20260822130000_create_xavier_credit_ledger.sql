create table if not exists public.xavier_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  billing_cycle_start date not null,
  billing_cycle_end date not null,
  included_units integer not null default 0 check (included_units >= 0),
  included_remaining integer not null default 0 check (included_remaining >= 0),
  purchased_remaining integer not null default 0 check (purchased_remaining >= 0),
  low_balance_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xavier_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('grant', 'reserve', 'capture', 'release', 'adjustment')),
  units integer not null,
  included_units integer not null default 0,
  purchased_units integer not null default 0,
  idempotency_key text not null unique,
  action_id uuid references public.xavier_action_requests(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.xavier_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null unique references public.xavier_action_requests(id) on delete cascade,
  reserved_units integer not null check (reserved_units > 0),
  reserved_included_units integer not null default 0 check (reserved_included_units >= 0),
  reserved_purchased_units integer not null default 0 check (reserved_purchased_units >= 0),
  captured_units integer not null default 0 check (captured_units >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'captured', 'released')),
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  released_at timestamptz
);

create index if not exists xavier_credit_ledger_user_created_idx on public.xavier_credit_ledger (user_id, created_at desc);
create index if not exists xavier_credit_reservations_user_status_idx on public.xavier_credit_reservations (user_id, status, created_at desc);

alter table public.xavier_credit_wallets enable row level security;
alter table public.xavier_credit_ledger enable row level security;
alter table public.xavier_credit_reservations enable row level security;
revoke all on table public.xavier_credit_wallets, public.xavier_credit_ledger, public.xavier_credit_reservations from anon, authenticated;
grant all on table public.xavier_credit_wallets, public.xavier_credit_ledger, public.xavier_credit_reservations to service_role;

create or replace function public.xavier_credit_cycle_start()
returns date
language sql
stable
as $$ select date_trunc('month', now() at time zone 'utc')::date $$;

create or replace function public.xavier_credit_cycle_end()
returns date
language sql
stable
as $$ select (date_trunc('month', now() at time zone 'utc') + interval '1 month - 1 day')::date $$;

create or replace function public.xavier_sync_credit_wallet(
  p_user_id uuid,
  p_included_units integer,
  p_idempotency_key text
)
returns table (included_remaining integer, purchased_remaining integer, cycle_start date, cycle_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := public.xavier_credit_cycle_start();
  v_end date := public.xavier_credit_cycle_end();
  v_existing public.xavier_credit_wallets;
  v_included integer := greatest(0, least(coalesce(p_included_units, 0), 100000000));
begin
  select * into v_existing from public.xavier_credit_wallets where user_id = p_user_id for update;
  if not found then
    insert into public.xavier_credit_wallets(user_id, billing_cycle_start, billing_cycle_end, included_units, included_remaining, purchased_remaining)
    values (p_user_id, v_start, v_end, v_included, v_included, 0);
    insert into public.xavier_credit_ledger(user_id, event_type, units, included_units, purchased_units, idempotency_key, metadata)
    values (p_user_id, 'grant', v_included, v_included, 0, p_idempotency_key, jsonb_build_object('reason', 'initial_cycle_grant'))
    on conflict (idempotency_key) do nothing;
  elsif v_existing.billing_cycle_start <> v_start then
    update public.xavier_credit_wallets
       set billing_cycle_start = v_start,
           billing_cycle_end = v_end,
           included_units = v_included,
           included_remaining = v_included,
           low_balance_notified_at = null,
           updated_at = now()
     where user_id = p_user_id;
    insert into public.xavier_credit_ledger(user_id, event_type, units, included_units, purchased_units, idempotency_key, metadata)
    values (p_user_id, 'grant', v_included, v_included, 0, p_idempotency_key, jsonb_build_object('reason', 'monthly_cycle_grant'))
    on conflict (idempotency_key) do nothing;
  end if;
  return query select w.included_remaining, w.purchased_remaining, w.billing_cycle_start, w.billing_cycle_end from public.xavier_credit_wallets w where w.user_id = p_user_id;
end;
$$;

create or replace function public.xavier_reserve_credits(
  p_user_id uuid,
  p_action_id uuid,
  p_units integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (ok boolean, reason text, reservation_id uuid, available_units integer, reserved_units integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.xavier_credit_wallets;
  v_required integer := greatest(1, least(coalesce(p_units, 0), 100000000));
  v_available integer;
  v_from_included integer;
  v_from_purchased integer;
  v_reservation public.xavier_credit_reservations;
begin
  select * into v_wallet from public.xavier_credit_wallets where user_id = p_user_id for update;
  if not found then
    return query select false, 'wallet_not_initialized', null::uuid, 0, 0;
    return;
  end if;
  select * into v_reservation from public.xavier_credit_reservations where action_id = p_action_id for update;
  if found then
    return query select true, 'already_reserved', v_reservation.id, v_wallet.included_remaining + v_wallet.purchased_remaining, v_reservation.reserved_units;
    return;
  end if;
  v_available := v_wallet.included_remaining + v_wallet.purchased_remaining;
  if v_available < v_required then
    return query select false, 'insufficient_credits', null::uuid, v_available, v_required;
    return;
  end if;
  v_from_included := least(v_wallet.included_remaining, v_required);
  v_from_purchased := v_required - v_from_included;
  update public.xavier_credit_wallets
     set included_remaining = included_remaining - v_from_included,
         purchased_remaining = purchased_remaining - v_from_purchased,
         updated_at = now()
   where user_id = p_user_id;
  insert into public.xavier_credit_reservations(user_id, action_id, reserved_units, reserved_included_units, reserved_purchased_units)
  values (p_user_id, p_action_id, v_required, v_from_included, v_from_purchased)
  returning * into v_reservation;
  insert into public.xavier_credit_ledger(user_id, event_type, units, included_units, purchased_units, idempotency_key, action_id, metadata)
  values (p_user_id, 'reserve', -v_required, -v_from_included, -v_from_purchased, p_idempotency_key, p_action_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
  return query select true, 'reserved', v_reservation.id, v_available - v_required, v_required;
end;
$$;

create or replace function public.xavier_release_credits(p_reservation_id uuid, p_idempotency_key text, p_metadata jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.xavier_credit_reservations;
begin
  select * into v_res from public.xavier_credit_reservations where id = p_reservation_id for update;
  if not found or v_res.status <> 'reserved' then return true; end if;
  update public.xavier_credit_wallets set included_remaining = included_remaining + v_res.reserved_included_units, purchased_remaining = purchased_remaining + v_res.reserved_purchased_units, updated_at = now() where user_id = v_res.user_id;
  update public.xavier_credit_reservations set status = 'released', released_at = now() where id = p_reservation_id;
  insert into public.xavier_credit_ledger(user_id, event_type, units, included_units, purchased_units, idempotency_key, action_id, metadata)
  values (v_res.user_id, 'release', v_res.reserved_units, v_res.reserved_included_units, v_res.reserved_purchased_units, p_idempotency_key, v_res.action_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
  return true;
end;
$$;

create or replace function public.xavier_capture_credits(p_reservation_id uuid, p_actual_units integer, p_idempotency_key text, p_metadata jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.xavier_credit_reservations; v_actual integer := greatest(1, least(coalesce(p_actual_units, 0), 100000000)); v_release integer;
begin
  select * into v_res from public.xavier_credit_reservations where id = p_reservation_id for update;
  if not found or v_res.status <> 'reserved' then return true; end if;
  if v_actual > v_res.reserved_units then return false; end if;
  v_release := v_res.reserved_units - v_actual;
  if v_release > 0 then
    update public.xavier_credit_wallets set included_remaining = included_remaining + least(v_res.reserved_included_units, v_release), purchased_remaining = purchased_remaining + greatest(0, v_release - least(v_res.reserved_included_units, v_release)), updated_at = now() where user_id = v_res.user_id;
  end if;
  update public.xavier_credit_reservations set status = 'captured', captured_units = v_actual, captured_at = now() where id = p_reservation_id;
  insert into public.xavier_credit_ledger(user_id, event_type, units, included_units, purchased_units, idempotency_key, action_id, metadata)
  values (v_res.user_id, 'capture', 0, 0, 0, p_idempotency_key, v_res.action_id, jsonb_build_object('actual_units', v_actual) || coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
  return true;
end;
$$;

create or replace function public.xavier_credit_balance(p_user_id uuid)
returns table (included_remaining integer, purchased_remaining integer, total_remaining integer, low_balance boolean, cycle_start date, cycle_end date)
language sql
stable
security definer
set search_path = public
as $$
  select w.included_remaining, w.purchased_remaining, w.included_remaining + w.purchased_remaining,
         (w.included_remaining + w.purchased_remaining) <= greatest(100, floor(w.included_units * 0.2)::integer),
         w.billing_cycle_start, w.billing_cycle_end
    from public.xavier_credit_wallets w where w.user_id = p_user_id;
$$;

revoke all on function public.xavier_sync_credit_wallet(uuid, integer, text), public.xavier_reserve_credits(uuid, uuid, integer, text, jsonb), public.xavier_release_credits(uuid, text, jsonb), public.xavier_capture_credits(uuid, integer, text, jsonb), public.xavier_credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.xavier_sync_credit_wallet(uuid, integer, text), public.xavier_reserve_credits(uuid, uuid, integer, text, jsonb), public.xavier_release_credits(uuid, text, jsonb), public.xavier_capture_credits(uuid, integer, text, jsonb), public.xavier_credit_balance(uuid) to service_role;

comment on table public.xavier_credit_ledger is 'Ledger imutável de unidades internas do Xavier; não representa cobrança Stripe.';
comment on table public.xavier_credit_reservations is 'Reservas idempotentes vinculadas a ações do Xavier, liberadas em falha e capturadas em sucesso.';
