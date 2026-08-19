# Integração Manus + Grok no Xavier

## Estado atual

O Xavier usa `grok-4.3` como modelo conversacional principal no `server/jarvisProxy.ts`. O fluxo web e o webhook individual/legado do Telegram convergem para `generateJarvisReply`, portanto uma camada de roteamento no backend pode atender os dois canais sem duplicar a lógica de memória, quota e isolamento por `user_id`. O briefing social permanece em um caminho específico da xAI, usando `grok-4.20-0309-non-reasoning` com `x_search`.

## Diferença de função

O Grok é apropriado para respostas conversacionais síncronas, tool calling e baixa latência. A Manus API é uma API de agente: `task.create` cria tarefas assíncronas, que podem ser acompanhadas por polling ou webhooks; `task.sendMessage` continua uma tarefa existente. A documentação da Manus também oferece projeto, conectores, skills, anexos e saída estruturada.

## Arquiteturas possíveis

1. Roteamento por intenção: Grok atende conversa normal, memória, perguntas rápidas e tools do GDF; Manus/SUN recebe tarefas longas, pesquisa profunda, criação de documentos, automações e ações que exigem planejamento.
2. Fallback: Grok é tentado primeiro e Manus é acionada somente se o Grok estiver indisponível ou se a solicitação exceder critérios de complexidade. Deve haver limite de tempo e prevenção de duplicidade.
3. Dupla validação: ambos geram uma saída para a mesma solicitação e um orquestrador escolhe ou sintetiza. É tecnicamente possível, porém aumenta latência, custo e risco de respostas divergentes; não é recomendado para toda mensagem do Telegram.

## Recomendação

Implementar um `xavierOrchestrator` server-side, chamado antes de `generateJarvisReply`, com política explícita por canal e intenção. A memória compacta do Xavier deve continuar no Supabase; o texto enviado à Manus deve ser o mínimo necessário, sem tokens de terceiros e sem histórico bruto desnecessário. As chaves `XAI_API_KEY` e `MANUS_API_KEY` devem existir apenas nas variáveis de produção do Vercel. O Telegram e a web devem receber a mesma resposta normalizada, enquanto tarefas Manus de longa duração devem usar webhook e uma mensagem de status/resultado, não manter a requisição aberta.

## Referências

- Manus `task.create`: https://open.manus.ai/docs/v2/task.create
- Manus webhooks: https://open.manus.ai/docs/v2/webhooks-overview
- Manus API overview: https://manus.im/docs/integrations/manus-api
- xAI Chat/Responses API: https://docs.x.ai/developers/rest-api-reference/inference/chat
## Contrato confirmado na documentação Manus API v2 (19/08/2026)

- `POST https://api.manus.ai/v2/task.create` recebe `message.content` com partes `{ type: "text", text }`; aceita `project_id`, `locale`, `interactive_mode`, `hide_in_task_list`, `share_visibility`, `agent_profile`, `title` e `structured_output_schema`.
- A autenticação direta usa o header `x-manus-api-key` (não combinar com `Authorization`). A resposta inclui `task_id`, `task_title` e `task_url`.
- `POST /v2/task.sendMessage` recebe `task_id` e `message`; o atalho `agent-default-main_task` é válido somente como task_id, não como referência.
- Webhooks Manus notificam `task_created` e `task_stopped`. O payload de conclusão traz `task_detail.task_id`, `message`, `attachments`, `stop_reason` (`finish` ou `ask`) e, opcionalmente, `structured_output`.
- A assinatura do webhook usa `X-Webhook-Signature` e `X-Webhook-Timestamp`, RSA-SHA256. A mensagem assinada é `{timestamp}.{url}.{sha256_hex(body)}`; rejeitar timestamps com mais de 5 minutos e responder em até 10 segundos.

Fontes oficiais consultadas:
- https://open.manus.ai/docs/v2/task.create
- https://open.manus.ai/docs/v2/task.sendMessage
- https://open.manus.ai/docs/v2/webhooks-overview
- https://open.manus.ai/docs/v2/webhooks-security

A chave Manus não deve ser armazenada no repositório, no frontend ou no Supabase; deverá ser configurada como variável privada do Vercel (`MANUS_API_KEY`).

## Contrato oficial confirmado durante a implementação

A Manus API v2 cria tarefas com `POST /v2/task.create`, exigindo `message` no corpo e aceitando `locale`, `interactive_mode`, `title`, `project_id` e `agent_profile`. A resposta retorna `task_id` e `task_url`. A continuidade usa `POST /v2/task.sendMessage` com `task_id` e `message`.

O registro de webhook usa `POST /v2/webhook.create` com `{ "url": "https://..." }`. As notificações relevantes são `task_created` e `task_stopped`; no encerramento, `task_detail.message` traz a mensagem de resultado e `task_detail.stop_reason` é `finish` ou `ask`.

A verificação oficial usa `X-Webhook-Signature` e `X-Webhook-Timestamp`, rejeita timestamps com mais de cinco minutos e verifica RSA-SHA256 sobre `timestamp.url.sha256_hex(body)`, com a URL completa do callback. A chave pública é obtida por `GET /v2/webhook.publicKey` e deve ser armazenada em cache.

Referências oficiais: https://open.manus.ai/docs/v2/task.create, https://open.manus.ai/docs/v2/task.sendMessage, https://open.manus.ai/docs/v2/webhook.create, https://open.manus.ai/docs/v2/webhooks-overview e https://open.manus.ai/docs/v2/webhooks-security.

## Deployment do commit d83dc29

O commit `d83dc29` foi enviado para `Helioguilhermediassilva/Javis` e recebeu status `success` nos dois checks Vercel associados ao repositório:

- `Vercel – javis`: https://vercel.com/nowgo/javis/A7g8U2A7npWVziqfQqSbrMDPakTL
- `Vercel – javis-deploy`: https://vercel.com/nowgo-e7470b8c/javis-deploy/8YuMwgjr8Q8CAG5YQgbs8FPdhd7C

A listagem geral da equipe também mostrou um projeto `jarvis-now-go-ai` conectado a outro repositório (`Jarvis_NowGo_AI`), que não deve ser usado para esta entrega.

## Ativação em produção

A integração foi implementada de forma inerte quando `MANUS_API_KEY` não existe: o Xavier mantém o Grok como caminho padrão e não tenta chamadas externas Manus. Para ativar tarefas agentic em produção, configurar no projeto Vercel `javis` a variável privada `MANUS_API_KEY` em Production, Preview e Development conforme necessário. O valor deve ser inserido diretamente no painel Vercel e nunca no código, no GitHub, no Supabase ou no frontend.

Depois da variável estar ativa, registrar no painel/API da Manus o callback público `https://jarvisnowgo.com/api/manus/webhook`. O endpoint já valida `X-Webhook-Signature` e `X-Webhook-Timestamp`, rejeita timestamps antigos e atualiza a tarefa de modo idempotente. O webhook deve apontar para o projeto `javis`, não para o projeto Vercel `jarvis-now-go-ai` conectado ao repositório diferente `Jarvis_NowGo_AI`.

