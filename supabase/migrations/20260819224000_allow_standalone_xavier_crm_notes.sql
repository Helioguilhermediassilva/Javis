alter table public.xavier_crm_notes
  drop constraint if exists xavier_crm_notes_parent_check;

comment on table public.xavier_crm_notes is 'Anotações do CRM do Xavier, isoladas por user_id, vinculadas opcionalmente a contato ou demanda.';
