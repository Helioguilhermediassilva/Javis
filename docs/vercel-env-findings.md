# Configuração Vercel — projeto javis

Em 19/08/2026, o painel de Environment Variables do projeto `javis` confirmou as variáveis legadas em Production e Preview: `TELEGRAM_ALLOWED_CHAT_IDS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `ELEVENLABS_API_KEY` e `XAI_API_KEY`.

Foi preparado um novo salvamento, também em Production e Preview, com três variáveis para a fase multiusuário: `XAVIER_ENCRYPTION_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Os valores não são registrados neste arquivo.

O formulário da Vercel marcou as variáveis `VITE_*` como públicas por causa do prefixo, comportamento esperado para o cliente Supabase; a chave administrativa continua somente no backend.
