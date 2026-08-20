create unique index if not exists xavier_conversations_official_identity_idx
  on public.xavier_conversations (user_id, telegram_chat_id)
  where channel = 'telegram'
    and telegram_connection_id is null
    and telegram_chat_id is not null;

comment on index public.xavier_conversations_official_identity_idx is
  'Uma conversa persistente por usuário e chat do bot oficial Xavier; conversas legadas continuam identificadas por telegram_connection_id.';

revoke all on table public.xavier_conversations from anon, authenticated;
grant all on table public.xavier_conversations to service_role;

revoke all on table public.xavier_messages from anon, authenticated;
grant all on table public.xavier_messages to service_role;

revoke all on table public.xavier_memory_summaries from anon, authenticated;
grant all on table public.xavier_memory_summaries to service_role;

create index if not exists xavier_conversations_official_user_idx
  on public.xavier_conversations (user_id, telegram_chat_id, last_message_at desc)
  where channel = 'telegram' and telegram_connection_id is null;

create index if not exists xavier_messages_official_user_idx
  on public.xavier_messages (user_id, conversation_id, created_at desc)
  where channel = 'telegram';

create index if not exists xavier_memory_summaries_official_user_idx
  on public.xavier_memory_summaries (user_id, conversation_id, updated_at desc)
  where conversation_id is not null;

