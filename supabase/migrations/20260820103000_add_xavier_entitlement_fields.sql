alter table public.xavier_profiles
  add column if not exists plan text not null default 'individual',
  add column if not exists billing_status text not null default 'inactive',
  add column if not exists entitlement_override jsonb not null default '{}'::jsonb;

alter table public.xavier_profiles
  drop constraint if exists xavier_profiles_plan_check;

alter table public.xavier_profiles
  add constraint xavier_profiles_plan_check
  check (plan in ('individual', 'pro', 'business'));

alter table public.xavier_profiles
  drop constraint if exists xavier_profiles_billing_status_check;

alter table public.xavier_profiles
  add constraint xavier_profiles_billing_status_check
  check (billing_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled'));

comment on column public.xavier_profiles.plan is 'Plano operacional atual; cobrança e sincronização comercial permanecem fora do Javis nesta etapa.';
comment on column public.xavier_profiles.billing_status is 'Estado de entitlement sincronizado por integração comercial futura; não representa checkout local.';
comment on column public.xavier_profiles.entitlement_override is 'Overrides operacionais controlados pelo backend, sem dados de pagamento ou conteúdo de conversa.';

create index if not exists xavier_profiles_plan_idx on public.xavier_profiles(plan);
create index if not exists xavier_profiles_billing_status_idx on public.xavier_profiles(billing_status);

revoke all on public.xavier_profiles from anon;
revoke all on public.xavier_profiles from authenticated;

notify pgrst, 'reload schema';

-- Rollback manual:
-- alter table public.xavier_profiles drop column if exists entitlement_override;
-- alter table public.xavier_profiles drop column if exists billing_status;
-- alter table public.xavier_profiles drop column if exists plan;

DO $$
BEGIN
  RAISE NOTICE 'Xavier entitlement fields applied. Billing remains external to Javis.';
END $$;
