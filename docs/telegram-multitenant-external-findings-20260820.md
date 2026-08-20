# Achados externos — Telegram multiusuário

Data da consulta: 2026-08-20.

Fontes oficiais consultadas:

- https://core.telegram.org/bots/api
- https://core.telegram.org/bots/features
- https://core.telegram.org/bots/webhooks

Achados relevantes:

1. O Bot API do Telegram suporta webhooks por `setWebhook`, entregando updates via POST para uma URL HTTPS.
2. O Telegram suporta deep linking para bots. Em chats privados, links no formato `https://t.me/<bot_username>?start=<parametro>` fazem o bot receber `/start <parametro>`.
3. O parâmetro de deep link pode transportar até 64 caracteres e aceita caracteres alfanuméricos, underscore e hífen; a documentação recomenda base64url para valores codificados.
4. A documentação descreve explicitamente o uso de deep linking para passar um token de autenticação e conectar a conta Telegram do usuário a uma conta em outra plataforma.
5. Webhooks exigem HTTPS/TLS e devem aceitar POSTs do Telegram; a integração atual já utiliza um endpoint serverless HTTPS.
6. O Bot API permite configurar comandos e escopos, mas o backend deve validar a autorização independentemente dos comandos exibidos ao usuário.

Decisão técnica: usar um código de vinculação de uso único e com expiração curta no fluxo web, gerar um deep link para o bot oficial, consumir o parâmetro somente no `/start`, persistir o vínculo entre `telegram_user_id`/`telegram_chat_id` e `user_id`, e processar todas as mensagens seguintes com o usuário interno resolvido antes de carregar memória, quota ou CRM.
