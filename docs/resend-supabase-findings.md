# Resend + Supabase Auth — referências oficiais

## Resend SMTP com Supabase
Fonte: https://resend.com/docs/send-with-supabase-smtp

O Supabase Auth pode enviar mensagens por SMTP personalizado do Resend. Credenciais SMTP documentadas: host `smtp.resend.com`, porta `465`, usuário `resend` e senha igual à API key do Resend. É necessário ter uma API key do Resend e um domínio verificado. No Supabase: Authentication → Email em Notifications → SMTP Settings; configurar remetente e nome e depois as credenciais SMTP.

## SMTP personalizado do Supabase
Fonte: https://supabase.com/docs/guides/auth/auth-smtp

O SMTP padrão do Supabase é destinado a testes e possui restrições; para produção é recomendado SMTP personalizado. O Supabase aceita serviços SMTP como Resend. A documentação também orienta separar e-mails transacionais de marketing, manter remetente consistente e configurar DKIM, SPF e DMARC no domínio de envio.

## Templates de e-mail
Fonte: https://supabase.com/docs/guides/auth/auth-email-templates

Templates de autenticação são editáveis no painel do projeto. O template de confirmação pode usar `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`, `{{ .Data }}` e `{{ .Email }}`. O assunto e o HTML podem ser personalizados.

## URLs de redirecionamento
Fonte: https://supabase.com/docs/guides/auth/redirect-urls

O Site URL define o retorno padrão quando nenhum redirect é enviado. A allow list deve conter os redirects permitidos. Para confirmação de e-mail e outros fluxos, o template pode usar `{{ .RedirectTo }}` quando a aplicação fornece `redirectTo`. Em produção, é recomendável usar a URL oficial exata, por exemplo `https://jarvisnowgo.com/` e a rota de confirmação escolhida, sem depender de wildcard amplo.

## Decisão para o Xavier

A integração mais simples e econômica é manter o envio de confirmação no Supabase Auth e configurar o Resend como SMTP personalizado. O código do Xavier deve fornecer o `redirectTo` para uma página amigável, e o template do Supabase deve usar `{{ .ConfirmationURL }}` ou a construção autorizada com `{{ .RedirectTo }}`/`{{ .TokenHash }}` conforme o fluxo implementado. A API key do Resend é segredo operacional e não deve ser exposta no frontend ou nesta conversa.

## Restrições de configuração

O conector Resend existente no ambiente está desabilitado e não é editável. A configuração deve ser feita no projeto Supabase `Cockpit_NowGo` e, se necessário, com uma credencial fornecida pelo usuário ou inserida diretamente por ele no painel, sem alterar domínios não autorizados.
