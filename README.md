# XAVIER — Assistente Operacional do Distrito Federal

> **Just A Rather Very Intelligent System.** Uma interface conversacional, com voz clonada e HUD em estética *heads-up display*, que fala português brasileiro, lê dados abertos do Distrito Federal em tempo real e escuta o que está sendo dito sobre a cidade no X (antigo Twitter).

**Autoria e desenvolvimento:** [NowGo AI](https://nowgo.ai)
**Licença:** Proprietário — todos os direitos reservados à NowGo AI.

---

## Visão geral

O XAVIER é um cockpit conversacional pensado para tomadores de decisão do Distrito Federal — em particular o Palácio do Buriti, secretarias e gabinetes parlamentares — que precisam de respostas rápidas, fundamentadas em dados oficiais, sobre o que está acontecendo na cidade. O usuário fala (ou digita) em português brasileiro, o sistema entende a intenção, consulta as bases conectadas, agrega o que está sendo dito nas redes sobre o tema e responde em voz natural enquanto a interface ainda está renderizando o texto.

Quatro elementos estruturais sustentam o produto:

1. **Voz clonada de alta fidelidade**,reproduzida via *streaming* de áudio MP3 e cacheada em IndexedDB para frases curtas frequentes (latência percebida próxima de zero em respostas como “Sim, senhor.”).
2. **Reconhecimento de fala contínuo** com modo opcional de *wake-word* (“Ei XAVIER”), construído sobre a Web Speech API do navegador e tolerante a variações de transcrição (“jarves”, “jarvez”, “hey jarvis”).
3. **Pipeline duplo de dados**: um lado consulta o portal oficial **dados.df.gov.br** (CKAN); outro lado consulta o **X em tempo real** através do **Grok da xAI** com a ferramenta server-side `x_search`. O servidor decide qual lado acionar — ou ambos em paralelo — conforme o tipo de pergunta.
4. **HUD em vermelho/âmbar/ciano** inspirado em interfaces de cockpit, com painel central de diálogo, painel lateral de *Briefing Social DF* e relógio de Brasília.

A pessoa que utiliza o sistema escolhe na inicialização como deseja ser tratada — **Senhor** ou **Senhora** — e essa preferência viaja em todas as chamadas ao modelo, garantindo concordância de gênero coerente em todas as respostas.

---

## Arquitetura

A aplicação é um *single-page* React 19 servido como estático, com funções *serverless* expostas em `/api/*`. Tudo compila no Vercel sem servidor dedicado.

| Camada | Tecnologia | Função |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind 4 + shadcn/ui | HUD, painéis, captura de microfone, *streaming* de áudio |
| Backend serverless | TypeScript em `api/*.ts` (Vercel Functions, Node 20) | Proxy para CKAN, Grok e ElevenLabs; orquestração de *tool calling* |
| LLM (chat principal) | Grok da xAI — `grok-4.3` via Chat Completions API | Diálogo, *tool calling*, tratamento de gênero |
| LLM (sentimento social) | Grok da xAI — `grok-4.20-0309-non-reasoning` via Responses API | Briefing do X em tempo real com tool nativa `x_search` |
| Voz (síntese) | ElevenLabs — voz clonada *Hélio Guilherme* (`F1W6zKJWyDQD3yKJc4A6`) | TTS MP3 *streaming* + cache IndexedDB |
| Voz (reconhecimento) | Web Speech API nativa do Chrome/Edge | STT contínuo, sem dependência de SDK externo |
| Dados oficiais | CKAN do portal `dados.df.gov.br` | Datasets do GDF (saúde, segurança, educação, transporte, transparência) |
| Sentimento social | API `live_search` do Grok (tool `x_search`) | Reclamações e elogios do X sobre Brasília, últimos 3 dias |

O fluxo de uma pergunta como *“Faça um briefing de saúde no DF”*:

1. O navegador captura a fala, transcreve via Web Speech API e envia o texto ao endpoint **`/api/jarvis/chat/stream`**.
2. Antes de invocar o modelo, o servidor roda `detectBriefingIntent`. Se o pedido casa um padrão de *briefing* + um dos cinco tópicos suportados, o servidor dispara em paralelo (`Promise.all`) as duas *tools* — `buscar_dados_df` (CKAN) e `sentimento_social_df` (Grok) — e injeta os resultados como uma segunda mensagem `system` antes de chamar o LLM. Isso elimina rodadas extras de *tool calling* e corta a latência aproximadamente pela metade.
3. O modelo responde já com tudo em mãos. A resposta é retransmitida em SSE como uma sequência de `delta`, `tool_start`, `tool_end` e `done` para o frontend, que atualiza o log incrementalmente — primeiro *byte* visível em torno de **400 ms**.
4. Quando o modelo finaliza, o frontend pede o áudio em `/api/jarvis/tts`. Frases curtas previamente vistas tocam direto do IndexedDB; frases novas tocam via `MediaSource` com latência mínima.

---

## Bases de dados conectadas

### CKAN — `dados.df.gov.br`

O **portal oficial de dados abertos do Distrito Federal** é a única fonte estatística reconhecida pelo JARVIS para questões factuais sobre o GDF. Cinco grupos do CKAN estão pré-mapeados como tópicos de primeira classe na heurística de intenção e na *tool* `buscar_dados_df`:

| Tópico | Grupo CKAN | Cobertura típica |
|---|---|---|
| Saúde | `saude` | Atendimentos da SES-DF, leitos, vigilância epidemiológica |
| Segurança | `seguranca` | Boletins da PCDF, ocorrências da PMDF, dados do CIODF |
| Educação | `educacao` | Matrículas, IDEB regional, infraestrutura escolar |
| Transporte | `transporte` | DFTrans, BRT/Metrô, frota, estatísticas de mobilidade |
| Transparência | `transparencia` | Execução orçamentária, contratos, servidores |

A *tool* `buscar_dados_df` consulta o endpoint `package_search` do CKAN, devolvendo metadados, descrição, periodicidade e *recursos* (links de download em CSV, JSON, XLSX). O JARVIS retorna ao usuário uma síntese verbal e indica explicitamente os datasets que sustentam a afirmação, evitando alucinações: nada é dito como “fato oficial” sem rastreabilidade.

### X (antigo Twitter) — via Grok

O JARVIS não fala com o X diretamente; **toda inteligência social vem do Grok**. A ferramenta `x_search` é uma capacidade *server-side* nativa da Responses API da xAI: o modelo recebe permissão para consultar postagens do X dentro de uma janela temporal e devolve, na própria resposta, um resumo já analisado pelo Grok. O JARVIS configura essa janela para **os últimos 3 dias** (`from_date` dinâmico) — três dias é suficiente para captar o pulso do momento sem deixar o modelo trabalhar com material velho.

A *tool* `sentimento_social_df` separa o que o Grok devolve em três blocos estruturados — **reclamações**, **elogios** e **mentions emergentes** — e cacheia o resultado por chave normalizada (sem acentos, sem *stopwords* portuguesas, tópico ordenado). Isso significa que “saúde no DF”, “Saúde no Distrito Federal” e “saude DF” caem todos no mesmo *bucket* de cache, com TTL de poucos minutos.

---

## Modelo de IA — Grok da xAI

O JARVIS opera com **dois modelos do Grok** em paralelo, cada um otimizado para o seu papel:

| Papel | Modelo | Endpoint | Por quê |
|---|---|---|---|
| Chat principal e *tool calling* | `grok-4.3` | `POST https://api.x.ai/v1/chat/completions` | Modelo *flagship* atual da xAI (após a retirada de `grok-3`/`grok-4` em maio de 2026). Suporta `tool_choice: auto` e *streaming* SSE, essenciais para a orquestração das tools customizadas `buscar_dados_df` e `sentimento_social_df`. |
| Sentimento social | `grok-4.20-0309-non-reasoning` | `POST https://api.x.ai/v1/responses` | Combina a tool nativa `x_search` da Responses API com modo *non-reasoning*. Responde em 3 a 5 s — contra 17 a 22 s do modo *reasoning* — sem perda perceptível de qualidade para um briefing operacional. |

Parâmetros comuns:

| Parâmetro | Valor |
|---|---|
| *Tools* nativas | `x_search` (X em tempo real, `from_date` últimos 3 dias) |
| *Tools* customizadas | `buscar_dados_df` (CKAN do GDF), `sentimento_social_df` (sentimento agregado do X) |
| Janela de contexto | até 256k tokens |
| Idioma de resposta | Português brasileiro (forçado no *system prompt*) |
| Tratamento | Senhor / Senhora (escolhido pelo usuário, injetado como segunda *system message*) |

A mesma chave `XAI_API_KEY` autentica **os dois usos** — não há necessidade de cadastrar credenciais separadas. A chave fica como variável de ambiente apenas no servidor; nunca é exposta ao cliente.

---

## Voz 

A voz do XAVIER foi clonada a partir do timbre de **Hélio Guilherme** com a ferramenta de *Voice Cloning* da ElevenLabs e reside no ID `F1W6zKJWyDQD3yKJc4A6`. O servidor faz proxy entre o frontend e o endpoint `text-to-speech/{voiceId}/stream`, devolvendo um *stream* de MP3 que o frontend toca via `MediaSource` para reduzir o *time-to-first-byte* sonoro.

A chave da ElevenLabs fica como `ELEVENLABS_API_KEY`. O *cache de áudio TTS* (módulo `client/src/lib/ttsAudioCache.ts`) persiste localmente até 60 frases curtas (até 80 caracteres cada), indexadas por SHA-256 do texto normalizado + voice ID. Em uso real isso elimina completamente a latência de frases recorrentes do mordomo (“Sim, senhor.”, “Compreendido.”, “Imediatamente.”, “Pois não, senhora.”).

---

## Linha do tempo do desenvolvimento

| Marco | Entrega |
|---|---|
| **Versão 0.1** | Esqueleto React + HUD em ciano, captura de microfone, integração inicial com Grok via *Chat Completions* |
| **Versão 0.2** | Voz clonada na ElevenLabs e integrada via *streaming* MP3 + `MediaSource` |
| **Versão 0.3** | *Tool calling* customizado: `buscar_dados_df` ligada ao CKAN do GDF; primeiros painéis laterais com datasets reais |
| **Versão 0.4** | *Tool* `sentimento_social_df` com `x_search` da xAI; painel **Briefing Social DF** mostrando reclamações e elogios reais |
| **Versão 0.5 (otimização do Grok)** | Migração de `grok-4.3` (*reasoning*) para `grok-4.20-0309-non-reasoning`; `from_date` dinâmico nos últimos 3 dias; latência de briefing combinado caiu de 22-32 s para ~14 s |
| **Versão 0.6 (cache e SSE)** | Cache compartilhado de sentimento entre painel direto e *tool* do JARVIS, com chave normalizada (acentos, *stopwords*, ordem); endpoint `/api/jarvis/chat/stream` com SSE entregando *deltas* em ~400 ms |
| **Versão 0.7 (cache de áudio TTS)** | IndexedDB com LRU de 60 entradas para frases curtas; áudio repetido toca sem TTFB |
| **Versão 0.8 (wake-word + tratamento)** | Modo opcional “Ei JARVIS” para ativação por voz; preferência de tratamento Senhor/Senhora persistida em `localStorage` e propagada ao LLM |
| **Versão 1.0** | Pré-busca paralela de *tools* para *briefings* combinados (1 rodada única em vez de 2); briefing combinado a frio em ~11 s; suíte de testes Vitest cobrindo `wakeWord`, `briefingIntent`, `ttsAudioCache`, `jarvisChatStream`, integração com CKAN, ElevenLabs e xAI |
| **Versão 1.0.1 (deploy Vercel)** | Sanitização completa do código (autoria NowGo AI, sem referências a outros projetos), opção *Neutro* removida do *SetupOverlay* (apenas Senhor/Senhora), 7 funções serverless em `api/`, `vercel.json` configurado, README em pt-BR. Unificação da credencial: `XAI_API_KEY` passou a cobrir tanto o chat principal (modelo `grok-4.3`) quanto o sentimento social, eliminando a necessidade de variáveis duplicadas no Vercel. |

Linhas de comentário, *system prompt* e branding inteiros foram revisados para refletir a autoria **NowGo AI** — a versão pública do código não contém referências a outros nomes de projeto.

---

## Estrutura de pastas

```
.
├── api/                      # Funções serverless do Vercel
│   ├── jarvis/
│   │   ├── chat.ts           # POST /api/jarvis/chat       (resposta única)
│   │   ├── chat/stream.ts    # POST /api/jarvis/chat/stream (SSE)
│   │   └── tts.ts            # POST /api/jarvis/tts        (proxy ElevenLabs)
│   ├── df/
│   │   ├── topics.ts         # GET  /api/df/topics
│   │   ├── search.ts         # GET  /api/df/search
│   │   └── dataset.ts        # GET  /api/df/dataset
│   ├── grok/
│   │   └── sentiment.ts      # POST /api/grok/sentiment
│   └── telegram/
│       └── webhook.ts        # POST /api/telegram/webhook
├── client/                   # Aplicação React (Vite)
│   ├── index.html
│   └── src/
│       ├── components/       # SetupOverlay, painéis, HUD shell
│       ├── hooks/            # useElevenLabsTTS, useSpeechRecognition
│       ├── lib/              # jarvisLLM, ttsAudioCache, wakeWord
│       └── pages/Home.tsx    # Cockpit principal
├── server/                   # Handlers Node compartilhados (importados pelas funções)
│   ├── jarvisProxy.ts        # /api/jarvis/* — chat, stream, tts, system prompt
│   ├── grokProxy.ts          # /api/grok/sentiment + cache compartilhado
│   ├── dfDataProxy.ts        # /api/df/*    — CKAN do GDF
│   ├── dfSources.ts          # Constantes dos grupos CKAN suportados
│   ├── telegramHistory.ts    # Histórico Telegram no Supabase Cockpit_NowGo
│   └── *.test.ts             # Suíte Vitest (unitária e de integração)
├── shared/                   # Tipos compartilhados client/server
├── vercel.json               # Build, rewrites SPA, framework=null
├── vite.config.ts            # Build do frontend + proxy /api em dev
├── vitest.config.ts          # Ambientes node/happy-dom por glob
├── supabase/migrations/       # Migrações do histórico privado do Xavier
├── package.json
```

---

## Variáveis de ambiente

Todas confidenciais — devem ser cadastradas no painel do Vercel (em *Project Settings → Environment Variables*) e nunca *commitadas*.

| Nome | Onde é usada | Obrigatória? |
|---|---|---|
| `XAI_API_KEY` | Servidor — chamadas ao Grok, **tanto no chat principal (`grok-4.3` via Chat Completions) quanto no sentimento social (`grok-4.20-0309-non-reasoning` via Responses + `x_search`)** | **Sim** |
| `ELEVENLABS_API_KEY` | Servidor — *streaming* TTS da voz clonada | **Sim** |
| `LLM_API_URL` | Servidor — base URL alternativa para um *gateway* de LLM próprio. Quando ausente, o JARVIS chama `https://api.x.ai` diretamente | Não |
| `LLM_API_KEY` | Servidor — chave do *gateway* citado acima. Quando ausente, o JARVIS reaproveita automaticamente `XAI_API_KEY` | Não |
| `TELEGRAM_BOT_TOKEN` | Servidor — bot compartilhado legado, mantido para compatibilidade | Opcional |
| `TELEGRAM_WEBHOOK_SECRET` | Servidor — segredo do webhook legado | Opcional |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Webhook legado — lista opcional de `chat_id` autorizados | Não |
| `SUPABASE_URL` | Backend — URL do projeto `Cockpit_NowGo` | **Sim** para contas/memória |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend — chave privada para tabelas Xavier; nunca exposta ao cliente | **Sim** para contas/memória |
| `VITE_SUPABASE_URL` | Frontend — URL pública usada pelo Supabase Auth | **Sim** para login |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend — chave pública do Supabase Auth; não é chave administrativa | **Sim** para login |
| `XAVIER_ENCRYPTION_KEY` | Backend — segredo privado para cifrar tokens Telegram por conta | **Sim** para Telegram individual |
| `XAVIER_TELEGRAM_WEBHOOK_BASE_URL` | Backend — base pública do webhook individual | Não; usa `jarvisnowgo.com` |

> Em produção, a interface web exige `XAI_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O Telegram individual também exige `XAVIER_ENCRYPTION_KEY`. O par `LLM_API_URL` / `LLM_API_KEY` só é útil para quem quiser intermediar o tráfego do Grok por um *gateway* corporativo ou cache externo.

---

## Integração com Telegram

A conexão principal agora é feita pelo navegador em **`/telegram-connect`**, depois que o usuário entra em sua conta. O usuário cria ou escolhe um bot no [@BotFather](https://t.me/BotFather), cola o token na tela e o backend valida o bot com `getMe`, cifra o token usando `XAVIER_ENCRYPTION_KEY`, registra automaticamente um webhook exclusivo e nunca devolve o token ao frontend.

Cada conexão usa uma URL do formato `POST /api/telegram/webhook?connection_id=...` e valida o cabeçalho `X-Telegram-Bot-Api-Secret-Token` com um hash armazenado no Supabase. O bot individual carrega até 20 mensagens recentes da conversa daquele usuário, aplica o limite mensal da conta, envia a solicitação ao mesmo `generateJarvisReply` do chat web e grava o turno na tabela unificada `xavier_messages`. A rota `/api/telegram/status` mostra o estado do webhook e `/api/telegram/disconnect` remove a conexão pelo painel.

O endpoint sem `connection_id` continua aceitando o bot legado configurado por `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` e `TELEGRAM_ALLOWED_CHAT_IDS`. Novas contas devem usar o fluxo autenticado por usuário; não é necessário executar `setWebhook` manualmente.

A memória econômica utiliza o projeto `Cockpit_NowGo`: `xavier_profiles` controla memória, retenção e limite mensal; `xavier_conversations` separa os canais; `xavier_messages` guarda somente texto e metadados mínimos; `xavier_memory_summaries` fica reservado para resumos posteriores; e `xavier_usage_monthly` impede consumo inesperado. Não há embeddings nem armazenamento de áudio bruto na primeira fase.

---

## Como rodar localmente

Pré-requisitos: Node 20+, pnpm 10+.

```bash
pnpm install
cp .env.example .env.local      # preencher XAI_API_KEY e ELEVENLABS_API_KEY
pnpm dev                        # http://localhost:5173
```

Em desenvolvimento, o `vite.config.ts` faz *proxy* das rotas `/api/*` para handlers in-process — não é necessário rodar um servidor Express separado. O hot-reload funciona normalmente para frontend e *handlers*.

Para rodar a suíte de testes:

```bash
pnpm test         # unitários + integração (CKAN, xAI, ElevenLabs)
pnpm check        # tsc --noEmit (apenas types)
pnpm build        # build de produção em ./dist
```

---

## Como publicar no Vercel

1. **Importe o repositório** em <https://vercel.com/new> escolhendo `Helioguilhermediassilva/Javis`.
2. Em *Build & Development Settings*, deixe que o Vercel detecte o `vercel.json` automaticamente. O `buildCommand` é `pnpm build`, o `outputDirectory` é `dist`, e a *Framework Preset* deve ficar como **Other**.
3. Em *Environment Variables*, cadastre `XAI_API_KEY` e `ELEVENLABS_API_KEY` (escolha *Production* e *Preview*). Para ativar o Telegram, cadastre também `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em **Production**.
4. Clique em **Deploy**. O Vercel publicará o frontend como estático e cada arquivo dentro de `api/` como uma função *serverless* Node 20.
5. Registre o webhook conforme a seção **Integração com Telegram** e faça uma mensagem de teste no bot.
6. Para domínio próprio (ex.: `jarvis.nowgo.ai`), use o painel *Domains* do projeto. O Vercel cuida do certificado TLS automaticamente.

> **Limites importantes do plano gratuito:** funções *serverless* têm execução máxima de 60 s no plano Hobby. As rotas pesadas (`/api/jarvis/chat`, `/api/jarvis/chat/stream`, `/api/jarvis/tts`, `/api/grok/sentiment`) já estão configuradas com `maxDuration: 60`, suficiente para *briefings* combinados em condições normais. Em produção sob carga, recomendamos o plano Pro ou um *gateway* dedicado.

---

## Notas finais

Este projeto foi concebido, prototipado e codificado pela **NowGo AI**. A personalidade do assistente — incluindo o nome J.A.R.V.I.S., o tom mordomístico e a estética HUD — é uma referência cultural ao universo *Homem de Ferro*; nenhum direito autoral é reivindicado sobre essa inspiração. Todo o código de aplicação, prompts, integrações e *bindings* com APIs públicas é de autoria da NowGo AI.

Para questões comerciais, parcerias com governos e secretarias, ou licenciamento, contate a equipe da NowGo AI.


## Contas, Telegram individual e memória econômica

A versão multiusuário usa o projeto Supabase `Cockpit_NowGo` como fonte de verdade para autenticação, conversas, mensagens, resumos compactos, limites de uso e conexões Telegram. Cada registro é associado ao `user_id` da sessão autenticada; tokens de bots Telegram são cifrados no backend com `XAVIER_ENCRYPTION_KEY` e nunca retornam ao navegador.

O histórico web e Telegram compartilham o contexto da conta, mas permanecem identificados por canal e conversa. O Xavier carrega os últimos turnos e, a cada marco de vinte mensagens, cria um resumo determinístico limitado a 6.000 caracteres sem fazer uma segunda chamada ao modelo. A limpeza de mensagens brutas ocorre de acordo com `retention_days`, com limite mínimo de sete dias. Não há banco vetorial nem armazenamento de áudio bruto nesta fase.

O usuário controla a memória pela rota `/memory`, acessível pelo botão **MEMÓRIA** do cockpit. Nessa tela é possível ativar ou desativar a memória persistente, configurar retenção e limite mensal, consultar os resumos compactados e apagar todos os dados operacionais da conta. A conta de autenticação permanece disponível após a exclusão para permitir um novo começo.

Rotas autenticadas principais:

| Rota | Função |
|---|---|
| `/` | Cockpit web do Xavier |
| `/telegram-connect` | Conexão e desconexão do bot Telegram individual pelo navegador |
| `/memory` | Preferências, resumos, retenção e exclusão da memória |
| `/api/xavier/profile` | Leitura e atualização das preferências da conta |
| `/api/xavier/memory` | Consulta de resumos e exclusão dos dados operacionais |

A política econômica recomendada é não armazenar áudio ou vídeo bruto, limitar mensagens por mês e usar resumos somente quando necessário. Busca semântica/embeddings poderá ser adicionada posteriormente, mas não faz parte do armazenamento inicial.


## Conexão Telegram individual — fluxo híbrido

Cada usuário autenticado pode conectar o próprio bot Telegram em `/telegram-connect`. Na primeira conexão, o token fornecido pelo `@BotFather` é enviado ao backend, validado com `getMe`, cifrado com AES-256-GCM e usado para registrar um webhook exclusivo da conta. O token nunca é devolvido ao navegador.

Depois da validação, o backend configura o nome exibido do bot como **Xavier**, a descrição como **Xavier — Inteligência Soberana** e os comandos básicos `/start`, `/help` e `/settings`. O identificador `@...` continua sendo o username emitido pelo Telegram.

O painel exibe um QR Code que contém somente o link público `https://t.me/<bot_username>`, além dos botões **Abrir no Telegram** e **Copiar link**. O QR Code não contém token, segredo de webhook ou credencial de usuário.

A Bot API e os links profundos utilizados estão documentados nas referências oficiais [1] [2] [3].

[1]: https://core.telegram.org/bots/api "Telegram Bot API"
[2]: https://core.telegram.org/bots/features "Telegram Bot Features"
[3]: https://core.telegram.org/api/links "Telegram Deep Links"
