# Diagnóstico do erro 500 no status Telegram

Em 19 de agosto de 2026, o log runtime do projeto Vercel `javis` mostrou que `GET /api/telegram/status` retornava HTTP 500 porque o runtime ESM da Vercel não encontrou o import sem extensão:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/supabaseAdmin' imported from /var/task/server/xavierTelegram.js`

A causa não é a chave Supabase nem a sessão do usuário. O helper novo `server/supabaseAdmin.ts` foi importado sem o sufixo `.js`; o bundle serverless publicado como ESM exige o caminho compatível com o runtime. A correção deve ajustar esse import e revisar os imports locais relacionados nos módulos server-side que dependem dele, sem incluir segredos.

## Publicação da correção

A correção foi commitada no repositório como `0fe2059` e apareceu na lista de deployments Production do projeto Vercel `javis`, com alias `javis-3n4x2n97f-nowgo.vercel.app`. O build ainda precisa ser validado publicamente antes do teste do endpoint.

## Configuração Vercel

A página de variáveis do projeto `javis` mostra `SUPABASE_SERVICE_ROLE_KEY` em Production e Preview. O formulário de edição permanece aberto, com o valor mascarado; nenhum valor secreto foi lido ou registrado. É necessário concluir o salvamento antes do redeploy.

## Redeploy

A variável `SUPABASE_SERVICE_ROLE_KEY` foi atualizada no Vercel e a interface confirmou: “Updated Environment Variable successfully. A new deployment is needed for changes to take effect.” O modal de redeploy está aberto para Production, usando o deployment atual `javis-3n4x2n97f-nowgo.vercel.app` do branch `main`; domínios atribuídos incluem `javis-six.vercel.app` e `jarvisnowgo.com`. Nenhum segredo foi exibido ou registrado.
