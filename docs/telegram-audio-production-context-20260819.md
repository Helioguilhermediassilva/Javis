# Contexto de produção — diagnóstico de áudio Telegram

Fonte externa consultada em 19/08/2026: https://vercel.com/nowgo/javis/48tXfEUCTseXX8DufDeukxSTVsw6

O deployment de produção do projeto Vercel `javis` está Ready, no branch `main`, associado ao commit `ca74e39` (`feat: add telegram crm capture and robust artifacts`). O domínio principal exibido é https://jarvisnowgo.com e o deployment atual é https://javis-7vwj2rpxh-nowgo.vercel.app.

O painel disponibiliza a área de logs em https://vercel.com/nowgo/javis/48tXfEUCTseXX8DufDeukxSTVsw6/logs e o atalho geral de runtime em https://vercel.com/nowgo/javis/logs.

A consulta de logs pela integração externa do Vercel retornou 403 para o projeto `javis`; por isso, a investigação continuará pelo painel autenticado, sem alterar qualquer outro projeto.

A tela autenticada de logs do Vercel abriu corretamente para `javis`. O intervalo padrão está em “Last 30 minutes”, com contador visível de 3 erros, 0 warnings e 0 fatals. A tabela ainda estava carregando e mostrava uma entrada de horário 23:06:50, portanto o filtro/atualização precisa ser aplicado antes de interpretar os erros.

Na tela de logs de produção, no intervalo de 30 minutos, apareceram três erros em `POST /api/telegram/webhook`, todos com status HTTP 200 no webhook mas erro assíncrono interno: `Supabase storage bucket 400: {"statusCode":"409","error":"Duplicate","message":"The resource already exists","code":"BucketAlreadyExists"}` nos updateIds 165921919, 165921920 e 165921921, entre 23:03:13 e 23:04:10. Isso indica que uma tentativa de criar o bucket `xavier-files` está sendo tratada como falha quando o bucket já existe; é uma hipótese forte para explicar a ausência de resposta a comandos de áudio que entram no ramo de artefatos.
