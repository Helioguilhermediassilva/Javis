# Correção do fluxo de autenticação — Xavier

Em 19/08/2026, o commit `1ef7248` (`fix(auth): require login on every site opening`) atingiu `Ready` em `Production` no projeto Vercel `javis`.

Alias do deployment: `https://javis-fck4gckh9-nowgo.vercel.app`.

Alterações publicadas:

- sessão Supabase sem persistência local entre novas aberturas;
- callback de confirmação de e-mail sem abertura automática do cockpit;
- limpeza de parâmetros de autenticação da URL;
- chamada da tela de acesso atualizada para “Inteligência Soberana”.

Validações locais: TypeScript sem erros, build Vite concluído e 15 testes determinísticos aprovados (wake-word, stream, webhook e memória). A suíte completa apresentou somente falhas externas nos testes de CKAN/xAI, sem relação com esta alteração.

Validação pública concluída em `https://jarvisnowgo.com/`: a página inicial exibiu a tela `XAVIER / ACCESS NODE`, o formulário `Acessar o cockpit` e o texto `Inteligência Soberana com memória sob seu controle.` sem inserir credenciais.
