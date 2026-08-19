# Migração Manus para Claude — descobertas técnicas

## Fontes oficiais

- https://platform.claude.com/docs/en/get-api-key
- https://platform.claude.com/docs/en/manage-claude/authentication
- https://platform.claude.com/docs/en/build-with-claude/working-with-messages
- https://platform.claude.com/docs/en/about-claude/models/overview

## Contrato de autenticação

A Anthropic informa que as API keys são criadas no Claude Console em Settings → API keys, aparecem integralmente apenas uma vez e usam o prefixo `sk-ant-`. Em chamadas HTTP diretas, a chave deve ser enviada no header `x-api-key`; os SDKs oficiais podem lê-la de `ANTHROPIC_API_KEY`. A chave deve permanecer somente no backend e ser armazenada no Vercel como variável de ambiente.

## Messages API

A API direta usa `POST https://api.anthropic.com/v1/messages`, com os headers `x-api-key`, `anthropic-version: 2023-06-01` e `content-type: application/json`. O payload usa `model`, `max_tokens`, `system` opcional e `messages`. A Messages API é stateless: o backend do Xavier deve enviar o histórico econômico por usuário em cada chamada, respeitando os limites já aplicados em `xavierMemory`.

## Modelo inicial

A documentação atual apresenta `claude-sonnet-5` como combinação de velocidade e capacidade adequada para produção e `claude-opus-5` para tarefas agentic e empresariais de maior complexidade. O adaptador deve permitir o controle por variável `ANTHROPIC_MODEL`, usando Sonnet como padrão. O código não deve enviar `temperature`, `top_p` ou `top_k` para modelos Claude 4.7 ou posteriores quando esses parâmetros não forem suportados.

## Decisão arquitetural para o Xavier

Grok permanece como cérebro conversacional imediato. Claude substitui a camada de execução profunda da Manus por uma chamada direta síncrona no backend, sem webhook Manus. O roteamento conserva comandos explícitos e detecção de pedidos de pesquisa, relatório, documento e PDF. A geração de PDF continua usando PDFKit + Supabase Storage no backend; Claude redige o conteúdo e o Xavier cria/envia o arquivo.

## Confirmação adicional da documentação

A documentação oficial consultada em 19/08/2026 lista `claude-fable-5`, `claude-opus-5`, `claude-sonnet-5` e `claude-haiku-4-5` como IDs de API. Para o Xavier, o padrão escolhido será `claude-sonnet-5`, configurável por `ANTHROPIC_MODEL`, com possibilidade de usar `claude-opus-5` para solicitações de maior complexidade.

A chamada direta deve usar `POST https://api.anthropic.com/v1/messages`, o header `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, `max_tokens`, `messages` e o campo top-level `system`; não deve inserir uma mensagem com role `system` dentro de `messages` como primeira entrada. A Messages API aceita conteúdo de texto e imagens em blocos Anthropic e é stateless.

Fonte adicional: https://platform.claude.com/docs/en/api/messages

## Pesquisa web via Claude

A documentação oficial da Anthropic confirma que a Messages API pode usar uma server tool executada pela própria Anthropic, sem webhook ou código de busca no backend do Xavier. Para pesquisa web básica, a ferramenta é enviada no payload como `{ "type": "web_search_20250305", "name": "web_search", "max_uses": 5 }`. Também existem `web_search_20260209` com filtragem dinâmica e `web_search_20260318` com controle de inclusão da resposta; versões posteriores dependem do suporte do modelo. A ferramenta determina quando pesquisar, retorna conteúdo atual e inclui citações. A disponibilidade pode ser desabilitada no Claude Console e, nesse caso, a API retorna erro 400.

Fonte: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
Fonte: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview


## Publicação da migração Claude

O commit `d83b224` (`feat: replace Manus executor with Claude`) foi publicado na branch `main` do repositório `Helioguilhermediassilva/Javis`. O projeto Vercel `javis` exibiu o deployment de Production `javis-hgxwmamrv-nowgo.vercel.app` como `Ready` em 19/08/2026. O valor de `ANTHROPIC_API_KEY` não foi visualizado nem registrado.

Deployment: https://vercel.com/nowgo/javis/4g39iZc3GJAqMUpX1hRKxf7DTtG1
URL temporária: https://javis-hgxwmamrv-nowgo.vercel.app
Repositório: https://github.com/Helioguilhermediassilva/Javis/commit/d83b2245c72becbb45235f9818321fcb05b657f2
