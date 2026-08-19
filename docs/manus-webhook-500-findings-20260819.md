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
