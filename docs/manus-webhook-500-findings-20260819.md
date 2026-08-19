# Diagnóstico do cadastro do webhook Manus — 19/08/2026

## Fontes oficiais

- https://open.manus.ai/docs/v2/webhook.create
- https://open.manus.ai/docs/v2/webhooks-overview
- https://open.manus.ai/docs/v2/webhooks-security

## Contrato relevante

A operação `POST /v2/webhook.create` recebe somente `{ "url": "<string>" }`, usa o header `x-manus-api-key` e exige uma URL HTTPS pública. A documentação informa que o endpoint precisa ser publicamente acessível e retornar status 2xx.

Durante a ativação, a Manus envia uma requisição de teste ao callback. O endpoint precisa aceitar `POST` com JSON e responder HTTP 200 em até 10 segundos.

As entregas reais incluem os eventos `task_created` e `task_stopped`. Cada entrega usa `X-Webhook-Signature` e `X-Webhook-Timestamp`; a assinatura RSA-SHA256 é calculada sobre `{timestamp}.{url}.{sha256_hex(body)}`. O timestamp deve estar dentro de cinco minutos.

## Hipótese técnica

O endpoint atual do Xavier rejeita qualquer POST de teste sem os headers de assinatura antes de responder 200. Se a Manus fizer uma validação inicial sem assinatura, esse comportamento pode impedir o cadastro; dependendo do painel, o erro pode aparecer como 500 durante o salvamento. A URL assinada também precisa coincidir exatamente com a URL registrada, incluindo eventual query string.

## Publicação da correção

O commit `ba72ae5` foi publicado na branch `main` e o projeto Vercel `javis` iniciou o deployment de produção `javis-ofpwf2tta-nowgo.vercel.app`. Durante a primeira verificação, o deployment estava em estado `Building`; a validação do POST será feita depois de o Vercel exibir `Ready`.

## Teste de produção

Após o deployment `ba72ae5` aparecer como `Ready`, foi enviado um POST JSON de verificação sem assinatura para `https://jarvisnowgo.com/api/manus/webhook`. A resposta foi `HTTP/2 200`, confirmando que a validação inicial da Manus pode alcançar o endpoint e receber o status exigido. Eventos reais continuam sujeitos à assinatura RSA-SHA256.

## Isolamento da causa

Os quatro probes públicos confirmaram o contrato do callback: corpo vazio, `{}` e `{"event_type":"test"}` retornam HTTP 200; um evento `task_stopped` sem assinatura retorna HTTP 401. Portanto, o endpoint aceita a verificação e continua protegendo eventos reais.

A chave `MANUS_API_KEY` não está disponível no ambiente local desta sessão, então não foi possível executar `webhook.create` ou `webhook.list` diretamente sem solicitar a credencial do usuário. A documentação oficial também expõe `webhook.list` para checar duplicidade antes de tentar criar outro registro: https://open.manus.ai/docs/v2/webhook.list.

## Verificação do Vercel

Na página de variáveis do projeto `javis`, a variável `MANUS_API_KEY` aparece criada e marcada para `Production` e `Preview` (adicionada há aproximadamente 15 minutos). O valor não foi aberto nem registrado. Como a API Manus retornou `unauthenticated / invalid api key` no teste do usuário, a presença da variável não confirma que o conteúdo seja uma chave Manus válida; é necessário substituir o valor por uma API key recém-criada no painel da Manus e fazer novo redeploy.
