
## Correção da sessão Telegram

O erro ocorreu porque o cliente Supabase estava configurado com `persistSession: false`. A navegação interna preservava a sessão em alguns caminhos, mas a página protegida do Telegram não conseguia obter um access token confiável no momento da consulta ao status.

A correção usa persistência local somente para atravessar rotas internas e renovar o token. No boot do aplicativo, o `AuthProvider` executa `signOut({ scope: "local" })`, removendo a sessão anterior sem revogar a conta no Supabase; assim, uma nova abertura do site continua exigindo login. O commit `29136f1` passou TypeScript, build e 7 testes determinísticos, foi publicado como deployment `Ready` com alias `https://javis-qgzxzt5qv-nowgo.vercel.app` e a tela pública foi validada com o formulário de login visível.
