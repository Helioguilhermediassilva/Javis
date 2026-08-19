# Diagnóstico de áudio Telegram — 2026-08-19

A causa estrutural identificada é o limite de execução do webhook Telegram: a função está configurada com `maxDuration: 60`, enquanto o caminho de áudio podia consumir até 15s no `getFile`, 30s no download, 60s na transcrição ElevenLabs e até 110s na chamada Claude. Esse encadeamento podia exceder a janela antes do envio da resposta.

A documentação oficial do Vercel registra que `waitUntil()` permite enfileirar uma tarefa assíncrona durante o ciclo de vida da requisição, sendo aplicável a Vercel Functions Node.js. Fonte: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package

A correção em andamento reduz os limites de rede do áudio para 8s (`getFile`), 15s (download) e 25s (ElevenLabs), adiciona timeout configurável ao cliente Claude e usará `waitUntil` para responder imediatamente ao Telegram antes de concluir a transcrição e a resposta.
