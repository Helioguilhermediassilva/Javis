

## Decisão final para o Telegram

A partir da migração final, o bot Telegram do Xavier usa exclusivamente a API Claude no backend Vercel. Não há fallback para Grok nem handoff para Manus/SUN nesse webhook. A memória continua sendo carregada por `user_id` na conexão individual e, no fluxo legado, por `chat_id` isolado.

Pedidos de PDF e apresentação são identificados antes da resposta conversacional. O Claude redige o conteúdo e o backend gera o arquivo localmente: PDF com PDFKit e apresentações editáveis em PPTX. Ambos são armazenados no bucket privado `xavier-files` e enviados ao Telegram por URL assinada. O cockpit web mantém seu fluxo existente, mas não é utilizado como dependência para o bot Telegram.
