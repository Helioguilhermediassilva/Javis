# Xavier — hardening P0 comercial

Data: 2026-08-20

## Escopo

Este bloco fortalece o core sem alterar a experiência visual aprovada, sem implementar billing e sem introduzir uma nova dependência externa.

## Alterações

- A autenticação server-side deixou de aceitar `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` como fallback para validar sessões públicas. Sem uma chave pública/anon configurada, o endpoint falha fechado.
- O parser JSON do chat passou a limitar o corpo a 12 MiB para reduzir abuso acidental e consumo inesperado por anexos.
- Foi criado `server/xavierObservability.ts` para request IDs, logs estruturados mínimos e sanitização de erros.
- Erros de providers, rede, storage, Claude, Grok e ElevenLabs não são mais repassados com detalhes técnicos ao usuário.
- O chat JSON, o stream SSE e o TTS passaram a emitir `X-Request-Id`/`request_id` quando há falha, permitindo correlação no suporte.
- Foi adicionada cobertura determinística para request IDs e sanitização de mensagens.

## Fora deste bloco

Billing Stripe, checkout, preços e webhooks de pagamento permanecem fora do Javis. A integração comercial futura deve partir do site `nowgoai.com`, com um contrato explícito de autenticação/retorno antes de alterar o botão de cadastro no Xavier.

## Validação

- `pnpm check`: aprovado.
- `pnpm exec vitest run server/xavierObservability.test.ts server/jarvisChatStream.test.ts`: 7 testes aprovados.
