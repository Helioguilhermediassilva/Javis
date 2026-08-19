# Fluxo híbrido Telegram — referências técnicas

## Documentação oficial consultada

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Bot Features / Deep Linking: https://core.telegram.org/bots/features
- Telegram Deep Links: https://core.telegram.org/api/links

## Decisões de implementação

O Bot API usa requisições HTTPS no formato `https://api.telegram.org/bot<token>/METHOD_NAME`; o token deve permanecer no backend. O método `getMe` retorna a identidade do bot, incluindo `id`, `is_bot`, `first_name` e `username`, permitindo construir um link público `https://t.me/<username>` sem enviar o token ao navegador.

Os métodos de perfil `setMyName`, `setMyDescription` e `setMyShortDescription` podem ser usados pelo backend para configurar automaticamente o nome exibido e as descrições do bot após validar o token. O nome de usuário `@...` continua sendo o identificador usado no link e deve ser tratado como o valor retornado pelo Telegram.

O Telegram documenta links profundos `https://t.me/<bot_username>` e parâmetros opcionais `?start=<payload>`. O QR Code deve codificar somente esse link público ou um pairing URL de uso único; nunca o token do bot.

## Fontes

[1]: https://core.telegram.org/bots/api "Telegram Bot API"
[2]: https://core.telegram.org/bots/features "Telegram Bot Features"
[3]: https://core.telegram.org/api/links "Telegram Deep Links"
