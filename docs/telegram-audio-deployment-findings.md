# Suporte de áudio do Telegram — deployment

Em 19/08/2026, o projeto Vercel `javis` confirmou o deployment de produção do commit `4f1c0c0` (`feat(telegram): transcribe incoming audio with ElevenLabs`) a partir de `Helioguilhermediassilva/Javis`, branch `main`.

O deployment foi exibido como `Ready` e está associado ao domínio público `https://jarvisnowgo.com`. O fluxo publicado baixa voice notes/áudios pela Bot API do Telegram e envia o arquivo em memória ao ElevenLabs Speech to Text (`scribe_v2`); o texto transcrito segue para o mesmo pipeline de resposta do Xavier.
