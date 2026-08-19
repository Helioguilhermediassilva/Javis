# Diagnóstico do erro 500 no status Telegram

Em 19 de agosto de 2026, o log runtime do projeto Vercel `javis` mostrou que `GET /api/telegram/status` retornava HTTP 500 porque o runtime ESM da Vercel não encontrou o import sem extensão:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/supabaseAdmin' imported from /var/task/server/xavierTelegram.js`

A causa não é a chave Supabase nem a sessão do usuário. O helper novo `server/supabaseAdmin.ts` foi importado sem o sufixo `.js`; o bundle serverless publicado como ESM exige o caminho compatível com o runtime. A correção deve ajustar esse import e revisar os imports locais relacionados nos módulos server-side que dependem dele, sem incluir segredos.
