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

## Diagnóstico do erro de envio

Após a configuração, o Supabase Auth registrou uma tentativa de `/signup` com `status 500`, `error_code unexpected_failure` e erro SMTP `535 "Invalid username"`. O evento ocorreu antes de `mail.send`, portanto a falha está na autenticação SMTP com o Resend, não no template HTML nem no redirect da aplicação.

A documentação oficial atual do Resend confirma: host `smtp.resend.com`, portas 465/2465 para SMTPS ou 25/587/2587 para STARTTLS, usuário literal `resend` e senha igual à API key do Resend. A documentação específica para Supabase repete esses quatro valores e exige domínio verificado. Fontes: https://resend.com/docs/send-with-supabase-smtp e https://resend.com/docs/send-with-smtp.

A configuração deve ser revisada no Supabase para remover espaços, aspas ou crases nos campos, garantir que o campo Username contenha exatamente `resend`, e colar novamente uma API key ativa no campo Password. A chave não deve ser registrada neste arquivo.

## Segundo diagnóstico após a correção do username

A tentativa seguinte já não retornou `535 Invalid username`. O Supabase Auth agora registra `gomail: could not send email 1: 550 "The nowgo.com.br domain is not verified. Please, add and verify your domain on https://resend.com/domains"`. Isso confirma que a autenticação SMTP avançou, mas o remetente persistido ainda usa `@nowgo.com.br`, domínio que não está autorizado no Resend. O remetente precisa ser alterado para um endereço em `@nowgoai.com`, domínio autorizado para este projeto, e salvo novamente.

## Verificação do domínio nowgo.com.br

O painel do Resend mostra `nowgo.com.br` como `Pending`, criado há poucos minutos. Os registros DNS de DKIM (`TXT resend._domainkey`) e de envio (`MX send` e `TXT send`) ainda aparecem como `Pending`. O próprio painel informa que a verificação pode levar algumas horas, dependendo do provedor DNS. Enquanto o domínio estiver pendente, o Resend continuará rejeitando `xavier@nowgo.com.br`.

## Verificação DNS pública

A consulta DNS pública retornou `NXDOMAIN` para `resend._domainkey.nowgo.com.br` e para `send.nowgo.com.br` no momento da verificação. Portanto, os registros exibidos pelo Resend ainda não estão publicados no DNS autoritativo; é necessário revisar o provedor DNS e aguardar a propagação. O domínio permanece pendente até que pelo menos os registros exigidos pelo Resend sejam encontrados.
