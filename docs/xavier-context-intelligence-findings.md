

## Fontes oficiais consultadas em 2026-08-19

### Instagram / Meta
A documentação oficial de Insights informa que a API atende contas profissionais (Business ou Creator), exige login/permissões específicas e, para contas que não são próprias ou gerenciadas pelo aplicativo, Advanced Access. As métricas de insights são obtidas por endpoints da conta profissional ou da mídia. A API não serve para consultar mídia de contas pessoais. Fonte: https://developers.facebook.com/documentation/instagram-platform/insights

### YouTube
A YouTube Data API v3 oferece recursos de vídeos, canais, busca, comentários e threads de comentários. As consultas exigem API key ou OAuth 2.0; operações privadas ou de alteração exigem token OAuth. Fontes: https://developers.google.com/youtube/v3/docs e https://developers.google.com/youtube/v3/docs/comments

### TikTok
O TikTok disponibiliza Display API para dados de contas conectadas e Research Tools para dados públicos de contas e conteúdo, mas o acesso Research é limitado a pesquisadores elegíveis, organizações e finalidades de pesquisa aprovadas. A própria documentação inclui o Brasil entre regiões elegíveis em condições específicas, principalmente pesquisa acadêmica, independente ou de interesse público não comercial. Fontes: https://developers.tiktok.com/doc/research-api-get-started e https://developers.tiktok.com/products/research-api/

### Consequência arquitetural
Não se deve prometer acesso irrestrito a todo conteúdo, comentários e insights dessas plataformas. A arquitetura deve combinar fontes autorizadas por usuário/organização, dados públicos permitidos, busca em tempo real via Grok quando disponível e conectores MCP/Manus somente para tarefas que tenham acesso legítimo. Cada conexão precisa ser vinculada ao user_id, com tokens cifrados, escopos mínimos, retenção configurável e trilha de fontes.


### Google
A Custom Search JSON API permite recuperar resultados web e de imagem por meio de um Programmable Search Engine e requer API key. O Google também documenta uma Trends API em alpha para dados programáticos de interesse de busca, com acesso e disponibilidade sujeitos ao estágio do produto. Para contexto por cidade/região, a Places API fornece busca e detalhes de locais e dados geográficos. Fontes: https://developers.google.com/custom-search/v1/overview, https://developers.google.com/search/apis/trends e https://developers.google.com/maps/documentation/places/web-service/overview

### Registro da análise inicial sobre o Google
Durante a análise inicial foram consideradas busca web, tendências e Places como possibilidades técnicas. Essa alternativa foi rejeitada para o backend do Javis: nenhum desses conectores será implementado diretamente no Xavier. Quando a solicitação exigir dados do Google ou contexto por cidade/região, a tarefa será encaminhada à Manus/SUN, que deverá aplicar autorização, limites, fontes e escopos apropriados.

## Decisão arquitetural — fontes externas via Manus/SUN

A arquitetura do Xavier não terá integrações diretas com YouTube, Google, Instagram ou TikTok no backend do Javis. Essas fontes serão pesquisadas pela camada Manus/SUN, quando a tarefa exigir pesquisa externa e quando a Manus tiver acesso legítimo às fontes.

O Grok permanece responsável pela conversa imediata e pelas ferramentas já existentes, como o `x_search` usado no briefing social do Distrito Federal. A Manus/SUN será responsável por pesquisas longas, comparações entre cidades e regiões, análise de vídeos/comentários quando disponível, síntese de evidências e geração de documentos.

O Telegram e a web continuam sendo canais do Xavier, não conectores de dados. Cada solicitação Manus deve carregar apenas o `user_id`, o canal, a conversa e o contexto mínimo necessário. Sessão, memória econômica, quota e isolamento continuam no Supabase; tokens de fontes externas não serão armazenados no frontend nem no histórico bruto.

As referências de Instagram, YouTube, Google e TikTok acima permanecem como registro de limitações e permissões oficiais, não como integrações planejadas para o Javis. A Manus deve respeitar autenticação, robots/políticas, direitos de acesso e limites das fontes ao realizar a pesquisa.

## Escopo direto do Javis

- Grok/xAI para respostas conversacionais rápidas e ferramentas já configuradas.
- Manus/SUN para pesquisa externa, tarefas agentic, comparação regional, relatórios e PDFs.
- Telegram e web como canais de entrada e entrega.
- Supabase para sessão, memória econômica, tarefas e isolamento por `user_id`.
- ElevenLabs para transcrição de áudio recebido e voz do Xavier quando o canal suportar saída de áudio.

Nenhum conector direto de YouTube, Google, Instagram ou TikTok deve ser adicionado sem uma decisão posterior explícita.

