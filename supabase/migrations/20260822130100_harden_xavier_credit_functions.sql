alter function public.xavier_credit_cycle_start() set search_path = public;
alter function public.xavier_credit_cycle_end() set search_path = public;

comment on function public.xavier_credit_cycle_start() is 'Retorna o início do ciclo mensal UTC do ledger de créditos do Xavier.';
comment on function public.xavier_credit_cycle_end() is 'Retorna o fim do ciclo mensal UTC do ledger de créditos do Xavier.';

revoke all on function public.xavier_credit_cycle_start(), public.xavier_credit_cycle_end() from public, anon, authenticated;
grant execute on function public.xavier_credit_cycle_start(), public.xavier_credit_cycle_end() to service_role;

comment on table public.xavier_credit_wallets is 'Carteira interna do Xavier por usuário e ciclo; não representa cobrança Stripe.';

alter table public.xavier_credit_wallets force row level security;
alter table public.xavier_credit_ledger force row level security;
alter table public.xavier_credit_reservations force row level security;

revoke all on table public.xavier_credit_wallets, public.xavier_credit_ledger, public.xavier_credit_reservations from anon, authenticated;
grant all on table public.xavier_credit_wallets, public.xavier_credit_ledger, public.xavier_credit_reservations to service_role;

comment on table public.xavier_credit_ledger is 'Ledger imutável de unidades internas do Xavier; não representa cobrança Stripe.';
comment on table public.xavier_credit_reservations is 'Reservas idempotentes vinculadas a ações do Xavier, liberadas em falha e capturadas em sucesso.';
