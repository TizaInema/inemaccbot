---
name: inemavox
description: Transcrição e dublagem para o inemaccbot em VPS CPU.
---

# inemavox na VPS

Use o runtime já instalado. Não instale pacotes nem baixe modelos durante jobs.
Transcrição usa Whisper base int8 local; narração usa Kokoro pf_dora PT-BR.
Não há GPU nem referências Bella/Rachel nesta VPS. Não afirme que clonou a voz.

```sh
BOT="$HOME/projetos/inemaccbot"
"$BOT/.venv-media/bin/python" "$BOT/scripts/media_cpu.py" transcribe '<link ou arquivo>' --output '<saida.txt>'
"$BOT/.venv-media/bin/python" "$BOT/scripts/media_cpu.py" dub '<link ou arquivo>' --output '<saida.mp4>'
"$BOT/.venv-media/bin/python" "$BOT/scripts/media_cpu.py" tts --text-file '<texto.txt>' --output '<audio.wav>'
```

A dublagem traduz os segmentos com o Codex autenticado, sintetiza a voz local e
preserva os tempos do vídeo. Não exige outra API paga. Use exatamente a saída
pedida pelo job e declare RESULT: apenas após verificar o arquivo com ffprobe.
