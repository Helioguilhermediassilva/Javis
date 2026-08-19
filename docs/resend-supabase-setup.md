# Configuração do e-mail de confirmação do Xavier

## Objetivo

O cadastro do Xavier continua sendo processado pelo Supabase Auth. O Resend será usado somente como SMTP transacional, evitando colocar a API key no frontend, no repositório ou nas variáveis do Vercel.

## 1. Configurar o SMTP do Resend no Supabase

Abra o projeto **Cockpit_NowGo** no painel do Supabase e acesse **Authentication → Email → SMTP Settings**. Ative o SMTP personalizado e preencha os campos desta tabela:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API key do Resend, inserida diretamente neste campo |
| Sender email | `xavier@nowgoai.com` |
| Sender name | `Xavier · Inteligência Soberana` |

A API key deve ser uma credencial do Resend autorizada para o domínio já verificado `nowgoai.com`. Não altere nem tente adicionar domínios não autorizados.

## 2. Autorizar a página de confirmação

Em **Authentication → URL Configuration → Redirect URLs**, adicione exatamente:

```text
https://jarvisnowgo.com/email-confirmed
```

Mantenha também o **Site URL** oficial do projeto. A URL exata é necessária porque o frontend fornece esse destino ao criar a conta.

## 3. Aplicar o template

Em **Authentication → Email Templates → Confirm signup**, defina o assunto:

```text
Xavier — Confirme seu acesso
```

Cole o conteúdo do arquivo `docs/supabase-confirm-signup-template.html` no campo HTML. O link usa `{{ .ConfirmationURL }}`, que é gerado pelo Supabase para o fluxo atual e redireciona para `/email-confirmed` depois da confirmação.

## 4. Comportamento esperado

Depois da publicação, o fluxo será:

1. O usuário cria a conta em `https://jarvisnowgo.com/`.
2. O Supabase Auth solicita o e-mail pelo SMTP do Resend.
3. O usuário clica em **Confirmar meu e-mail**.
4. O Supabase valida o token e redireciona para `https://jarvisnowgo.com/email-confirmed`.
5. A página informa que a identidade Xavier está ativa e oferece o botão **Ir para o login**.
6. O usuário acessa o cockpit com as credenciais recém-confirmadas.

A chave do Resend permanece somente no painel do Supabase. Nenhum segredo é necessário no código do Xavier ou no Vercel.
