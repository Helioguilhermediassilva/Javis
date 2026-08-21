# Xavier — Inteligência Soberana

> Plataforma de inteligência operacional da NowGo AI para transformar conversas, dados e sinais do ambiente em decisões mais claras, rápidas e contextualizadas.

**Produto:** Xavier

**Posicionamento:** Inteligência Soberana

**Organização:** [NowGo AI](https://www.nowgoai.com/)

**Repositório canônico:** [Helioguilhermediassilva/Javis](https://github.com/Helioguilhermediassilva/Javis)

**Aplicação:** [jarvisnowgo.com](https://jarvisnowgo.com/)

---

## Sobre o Xavier

O Xavier é uma das aplicações da **stack de inteligência da NowGo AI**. Ele atua como uma camada operacional para pessoas, empresas, governos e equipes que precisam conversar com seus dados, organizar demandas, consultar informações, registrar contexto e transformar solicitações em ações.

A experiência combina uma interface de cockpit, conversação por texto e voz, memória controlada, geração de documentos, integração com Telegram e um CRM invisível acionado por linguagem natural. A identidade do produto é **Xavier — Inteligência Soberana**.

O projeto foi estruturado para crescer de forma incremental, preservando a experiência validada e evitando acoplamentos prematuros com decisões comerciais que pertencem ao ecossistema NowGo AI.

---

## Capacidades do produto

| Capacidade | Descrição |
|---|---|
| Conversação | Respostas imediatas e execução de tarefas profundas dentro do mesmo contexto de usuário. |
| Voz | Interação por fala e resposta com a voz clonada autorizada do Hélio Guilherme. |
| Memória | Continuidade de contexto com retenção configurável e controle de crescimento. |
| Dados e pesquisa | Consulta a fontes oficiais e pesquisa contextual para apoiar decisões. |
| Artefatos | Criação e entrega de PDF, PPTX, DOCX, XLSX e imagens vetoriais SVG quando solicitados. |
| Telegram | Conversa com o Xavier fora do cockpit, incluindo texto, áudio e arquivos. |
| CRM invisível | Registro de contatos, demandas, prazos, prioridades e anotações sem exigir uma tela adicional. |
| Privacidade | Separação de contas, memória, arquivos e registros por usuário. |
| Observabilidade | Medição sanitizada de uso, latência, falhas e consumo operacional, sem armazenar conteúdo privado. |

---

## O Xavier dentro da stack NowGo AI

O Javis não é um produto isolado. Ele é o núcleo operacional de uma arquitetura maior da NowGo AI, organizada em camadas de produto:

| Camada NowGo | Papel no Xavier |
|---|---|
| Identidade | Entrada segura, conta individual, sessão e vínculo com os serviços NowGo. |
| Inteligência | Interpretação conversacional, raciocínio, pesquisa e execução de tarefas. |
| Memória | Contexto persistente, histórico recente, resumos e preferências. |
| Canais | Cockpit web, Telegram, voz e entrega de arquivos. |
| Operação | Quotas, registros de uso, tratamento de falhas e acompanhamento de qualidade. |
| Dados | Fontes oficiais, contexto territorial, sinais sociais e registros do usuário. |
| Comercial | Futuramente centralizado no ecossistema NowGo AI, fora do núcleo Javis. |

Essa organização permite que o Xavier evolua sem transformar a aplicação em um conjunto de integrações comerciais acopladas ou difíceis de manter.

---

## Identidade e privacidade

Cada usuário possui seu próprio espaço operacional. Conversas, memória, arquivos, contatos, demandas e anotações são associados à conta correta e não devem ser compartilhados entre usuários.

O sistema aplica uma abordagem **fail-closed** para autenticação: uma falha de configuração não deve transformar uma credencial administrativa em mecanismo de acesso público. Informações privadas de provedores, credenciais, tokens, áudio bruto e conteúdo interno não devem ser expostos à interface ou aos registros operacionais.

Os tokens de integrações são tratados exclusivamente no lado server-side. Arquivos são entregues por links temporários e o armazenamento segue políticas de retenção e exclusão compatíveis com o produto.

---

## Memória soberana

A memória do Xavier foi desenhada para ser útil sem crescer de maneira descontrolada. O produto utiliza histórico recente, resumos compactos e políticas de retenção configuráveis. O usuário pode controlar a continuidade de memória e solicitar a exclusão dos registros previstos pela política da aplicação.

A memória é separada por usuário e por contexto operacional. O objetivo é preservar aquilo que melhora a continuidade da relação com o Xavier sem transformar cada conversa em um arquivo indiscriminado de dados.

---

## CRM invisível

O CRM atual não possui uma tela própria no cockpit. Ele funciona como uma capacidade natural do Xavier no Telegram. O usuário pode pedir que o assistente registre, consulte, atualize ou remova informações de forma conversacional.

Exemplos:

```text
Adicione o contato João Silva, da NowGo, joao@empresa.com.
```

```text
Registre uma demanda para preparar a proposta comercial até sexta-feira, com prioridade alta.
```

```text
Anote que o cliente prefere receber a apresentação na próxima semana.
```

```text
Liste minhas demandas pendentes.
```

O Xavier deve pedir esclarecimentos quando houver ambiguidade antes de alterar ou excluir um registro. A mesma capacidade poderá evoluir para comandos de voz e rotinas de acompanhamento no futuro.

---

## Telegram e canais de atendimento

O Xavier pode ser utilizado pelo Telegram para texto, áudio, documentos e comandos de CRM. O processamento é associado ao usuário conectado e mantém o indicador de atividade enquanto o assistente trabalha.

O canal oficial multiusuário utiliza a identidade pública do Xavier e vincula cada chat a uma conta por um código temporário de uso único, apresentado também como QR Code e deep link no cockpit. Memória, arquivos, CRM e limites de uso continuam isolados por `user_id`; o webhook sem `connection_id` atende o bot oficial, enquanto conexões individuais legadas permanecem compatíveis durante a transição.

Para ativar o canal oficial no ambiente de produção, configure `TELEGRAM_OFFICIAL_BOT_TOKEN` com o token do bot oficial dedicado e `TELEGRAM_OFFICIAL_WEBHOOK_SECRET` no projeto autorizado. Mantenha `TELEGRAM_BOT_TOKEN` reservado para compatibilidade com o fluxo legado e não substitua seu valor ao configurar o novo bot. O serviço aceita temporariamente `TELEGRAM_WEBHOOK_SECRET` como fallback do segredo oficial, mas a configuração separada é recomendada. Registre o webhook do bot oficial em `https://jarvisnowgo.com/api/telegram/webhook`, sem query string de conexão. Cada código vincula um único `telegram_chat_id` ao `user_id` da sessão; memória, arquivos, CRM e limites permanecem persistidos e isolados por usuário.

### Claude, voz e ações externas

O executor conversacional utiliza `claude-fable-5` como modelo padrão por meio de `ANTHROPIC_MODEL`, com `claude-opus-5` como fallback opcional somente quando a API rejeitar o identificador principal. O valor pode ser substituído por um identificador autorizado pela chave Anthropic do ambiente, sem alterar o histórico ou a memória de nenhuma conta.

Mensagens de voz do Telegram são transcritas antes de chegar ao mesmo contexto Claude da sessão. Quando `ELEVENLABS_API_KEY` está configurada, respostas a mensagens de voz também podem ser entregues como áudio pela voz Xavier; o comportamento pode ser desativado com `TELEGRAM_VOICE_REPLY_ENABLED=false`. A resposta textual continua sendo enviada mesmo que a síntese de voz falhe.

Solicitações que possam conectar MCP, chamar sistemas externos, publicar, enviar, excluir, agendar ou gerar custos não são executadas silenciosamente. O Xavier cria uma solicitação privada na fila de ações e pede um código de aprovação explícita. O usuário pode responder `aprovar XAV-XXXXXXXX` ou `cancelar XAV-XXXXXXXX`; o código só é válido dentro da conta correspondente. PDF, PPTX, DOCX, XLSX e SVG podem ser materializados localmente e enviados como arquivos reais. Code Execution da Claude pode ser habilitado com `XAVIER_CLAUDE_CODE_EXECUTION=true` para aproveitar arquivos gerados pelo modelo. Vídeo, imagem raster e integrações externas dependem de um provedor especializado autorizado e configurado; o Xavier não simula um MP4 nem declara que uma imagem externa foi gerada quando isso não ocorreu.

---

## Decisões comerciais

O Javis não implementa cobrança diretamente nesta etapa. Checkout, planos, assinatura, portal do cliente e reconciliação serão centralizados no site e no ecossistema [NowGo AI](https://www.nowgoai.com/), mantendo o núcleo operacional independente das decisões comerciais.

O botão de criação de conta do Xavier encaminha o usuário ao ambiente comercial NowGo AI, mantendo o login do Xavier disponível para usuários já habilitados. O retorno com identidade compartilhada, permissões e continuidade de sessão deverá seguir um contrato seguro entre os ambientes antes de ser considerado concluído.

O cadastro local permanece como fallback operacional controlado, enquanto o ecossistema NowGo AI consolida a experiência central de identidade e relacionamento com o cliente.

---

## Estado do produto

| Área | Estado |
|---|---|
| Cockpit Xavier | Operacional |
| Login e autenticação individual | Operacional; cadastro comercial encaminhado ao NowGo AI |
| Memória por usuário | Operacional |
| Voz e interação por áudio | Operacional |
| Telegram individual | Operacional |
| PDF, PPTX, DOCX, XLSX e SVG | Operacional; arquivos binários reais com links temporários |
| CRM invisível | Operacional |
| Observabilidade econômica | Fundação aplicada |
| Bot Telegram oficial multiusuário | Operacional; vínculo por código único e QR Code |
| Claude Fable no web e Telegram | Integrado com fallback configurável e Code Execution opcional |
| Voz de entrada e resposta no Telegram | Integrada; retorno vocal opcional por variável de ambiente |
| Aprovação de ações externas | Integrada; fila persistente e isolada por usuário |
| Idiomas PT, EN e ES | Operacional no login e cockpit |
| Fundação de entitlements por plano | Aplicada sem cobrança local |
| Billing centralizado no NowGo AI | Planejado, fora do Javis nesta etapa |
| Organizações, equipes e RBAC | Evolução posterior |

---

## Organização do projeto

A estrutura do repositório separa a experiência do usuário, os serviços da aplicação, as funções de integração, as migrações de dados e os registros operacionais. Os nomes internos podem evoluir, mas os princípios são estáveis:

```text
.
├── api/                   # Entradas de serviços da aplicação
├── client/                # Experiência do cockpit Xavier
├── server/                # Regras de negócio e integrações protegidas
├── supabase/migrations/   # Evolução versionada dos dados
├── docs/                  # Registros técnicos e operacionais
├── shared/                # Contratos compartilhados
└── README.md              # Visão do produto e orientação do repositório
```

A implementação detalhada deve permanecer restrita ao código, às documentações internas necessárias e às equipes autorizadas. O README deve explicar o produto e seus princípios sem funcionar como inventário de infraestrutura ou de credenciais.

---

## Desenvolvimento autorizado

Este repositório deve ser alterado somente dentro do projeto oficial `Helioguilhermediassilva/Javis` e das configurações explicitamente autorizadas para o Xavier.

Antes de publicar uma alteração, a equipe deve validar:

```bash
pnpm check
pnpm test
pnpm build
```

Também devem ser revisados o diff, os arquivos não rastreados, as migrações, os logs sanitizados e o vínculo do deployment correto. Nenhum segredo, token, arquivo de ambiente ou credencial administrativa deve ser versionado.

---

## Princípios de evolução

O desenvolvimento do Xavier segue cinco princípios:

1. **Preservar a experiência aprovada.** Melhorias comerciais não devem gerar redesign desnecessário.
2. **Isolar dados por usuário.** Toda memória, operação e capacidade deve respeitar a identidade correta.
3. **Falhar com segurança.** A interface recebe mensagens úteis; detalhes internos ficam restritos à observabilidade.
4. **Medir antes de cobrar.** Uso, latência, custo e falhas precisam ser conhecidos antes de aplicar limites comerciais.
5. **Separar produto e billing.** O núcleo Javis entrega inteligência; o ecossistema NowGo AI conduz cadastro, planos e cobrança.

---

## Roadmap NowGo AI

### Próxima etapa

A próxima etapa deve validar a ativação self-service em produção sem alterar a identidade visual: onboarding orientado por conta, métricas de ativação, testes de carga do canal oficial e contrato de identidade compartilhada com o ecossistema NowGo AI.

### Etapa comercial

Depois da definição do contrato com o site NowGo AI, o ecossistema poderá ativar planos, cobrança, gestão de assinatura e sincronização de permissões. O Javis deverá consumir somente o estado de acesso necessário para executar as capacidades autorizadas.

### Etapa empresarial

A evolução empresarial poderá incluir organizações, equipes, papéis, governança, trilhas de auditoria, identidade corporativa, ambientes dedicados e políticas específicas para empresas e governos.

---

## Referências

- [NowGo AI](https://www.nowgoai.com/) — ecossistema comercial e institucional.
- [Aplicação pública do Xavier](https://jarvisnowgo.com/) — ambiente público do produto.
- [Repositório canônico do Javis](https://github.com/Helioguilhermediassilva/Javis) — código autorizado do Xavier.
