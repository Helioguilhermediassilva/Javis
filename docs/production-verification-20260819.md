# Verificação de produção — 19/08/2026

A página `https://vercel.com/nowgo/javis/settings/environment-variables` foi aberta no projeto correto `javis` da equipe NOWGO.

A lista visível mostra `XAI_API_KEY`, `ELEVENLABS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_CHAT_IDS`, `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `XAVIER_ENCRYPTION_KEY`, com escopo Production and Preview conforme exibido na página.

`MANUS_API_KEY` não aparece na lista visível do projeto `javis`. Nenhum valor de variável foi aberto ou registrado. A conclusão operacional é que a integração Manus não está confirmada em Production neste momento; deve ser adicionada pelo usuário no painel Vercel e aplicada a uma nova implantação, caso ainda não exista em outro ambiente.

A listagem MCP da equipe retornou apenas o projeto `jarvis-now-go-ai`, portanto não foi usada para alterar ou verificar o projeto `javis`; a página específica do projeto `javis` foi tratada como a fonte de verificação.
