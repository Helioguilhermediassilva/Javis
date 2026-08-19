alter table public.xavier_manus_tasks
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.xavier_manus_tasks.attachments is 'Arquivos gerados pela Manus, armazenados como metadados sanitizados com URL HTTPS; o áudio e outros arquivos de entrada não são persistidos.';
