# Evidência do bundle público da sessão

Em 19/08/2026, `https://jarvisnowgo.com/` e o alias `https://javis-qgzxzt5qv-nowgo.vercel.app/` retornaram HTTP 200, o mesmo ETag `80767b593e9adf13d1a2e03ca906ec7b` e o mesmo bundle `/assets/index-_FzQHh1f.js`. O bundle contém a implementação compilada do Supabase Auth com `persistSession: true` em suas estruturas internas. Isso confirma que o domínio oficial está servindo o mesmo artefato do deployment 29136f1; o erro não é simplesmente causado por uma versão antiga do domínio.

Fontes verificadas: https://jarvisnowgo.com/ e https://javis-qgzxzt5qv-nowgo.vercel.app/.

## Deployment da correção de validação

Em 19/08/2026, o commit `dfc7b74` — `fix(auth): validate Xavier sessions with public Supabase key` — foi identificado no projeto Vercel `javis` como deployment Production em compilação, com alias `https://javis-7tth7nxf7-nowgo.vercel.app`. A validação pública do alias deve ocorrer após o estado Ready.

Fonte: https://vercel.com/nowgo/javis/deployments

## Referência oficial usada na correção

A documentação do Supabase recomenda enviar `apikey: publishable key` e `Authorization: Bearer <JWT>` ao endpoint `/auth/v1/user` para validar tokens quando aplicável; o cliente deve usar `getSession()` para obter o token e `getUser()`/validação server-side para confirmar a identidade. Fontes: https://supabase.com/docs/guides/auth/jwts e https://supabase.com/docs/guides/auth/server-side/creating-a-client

A chave pública do projeto não foi incluída neste registro.

## Confirmação final de publicação e ambiente

O deployment `dfc7b74` atingiu **Ready** em Production com alias `https://javis-7tth7nxf7-nowgo.vercel.app`. O alias carregou a tela de acesso do Xavier corretamente.

No projeto Vercel `javis`, a variável `VITE_SUPABASE_PUBLISHABLE_KEY` está configurada para Production e Preview. O backend agora prioriza `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY` para o cabeçalho `apikey`, mantendo `SUPABASE_SERVICE_ROLE_KEY` como fallback administrativo legado. O valor da variável não foi registrado.
