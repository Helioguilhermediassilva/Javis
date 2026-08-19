# Obsidian como camada de contexto do Xavier

## Conclusão preliminar

A integração pode melhorar o contexto do Xavier, mas o Obsidian deve ser tratado como uma base de conhecimento editorial e controlada pelo usuário, não como substituto da memória operacional do Xavier no Supabase.

O Obsidian trabalha com arquivos locais Markdown e oferece busca textual nativa. O Obsidian Sync pode sincronizar cofres entre dispositivos com criptografia ponta a ponta; nesse modo, a própria Obsidian informa que não consegue ler as notas, mas a chave de criptografia deve ser preservada pelo usuário. O cofre local, por sua vez, não é criptografado automaticamente pelo Obsidian.

## Opções de integração

A opção mais segura é um conector local ou um pequeno agente na máquina do usuário, usando a extensão comunitária Local REST API. A extensão oferece REST API e servidor MCP local autenticado, com leitura, busca, criação e atualização de notas. Isso permite que o Xavier consulte somente pastas autorizadas, sem enviar o cofre inteiro ao Vercel.

Outra opção é sincronizar uma pasta selecionada do Obsidian com um índice privado no backend. Nesse desenho, apenas notas marcadas com uma convenção, como `xavier: true`, seriam indexadas. O conteúdo deve ser segmentado e resumido, com controle de exclusão e retenção; a memória econômica existente continuaria separada.

Não é recomendado expor diretamente a porta local do Obsidian à internet nem colocar a chave da Local REST API no frontend. Para acesso remoto seria necessário um agente local com conexão de saída segura, autenticação por usuário e allowlist de pastas; alternativamente, um conector MCP compatível com o ambiente do usuário.

## Modelo recomendado

1. Supabase continua armazenando sessão, memória operacional compacta, quota e isolamento por `user_id`.
2. Obsidian armazena conhecimento deliberado: procedimentos, projetos, decisões, documentos e notas permanentes.
3. O Xavier consulta o Obsidian somente quando a intenção exigir conhecimento pessoal/projeto ou quando o usuário pedir explicitamente.
4. O backend aplica escopo, sanitização, limite de tamanho e cita o caminho da nota na resposta.
5. Escrita no Obsidian exige confirmação explícita; leitura pode ser configurada como automática apenas nas pastas autorizadas.

## Referências

- Busca do Obsidian: https://obsidian.md/help/plugins/search
- Segurança do Obsidian Sync: https://obsidian.md/help/sync/security
- Obsidian Sync: https://obsidian.md/sync
- Local REST API com MCP: https://github.com/coddingtonbear/obsidian-local-rest-api
