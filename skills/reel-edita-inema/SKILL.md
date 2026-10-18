---
name: reel-edita-inema
description: Reel empilhado INEMA na VPS CPU, preservando a fala do vídeo.
---

# Reel INEMA CPU

Veja os metadados e transcreva a fala com a skill inemavox antes de escolher o
título. Use uma headline fiel ao conteúdo e um resumo curto no painel de base.
O runtime preserva o bruto e a fala, monta o avatar no meio e inclui CTA na base.
Este modo usa texto e composição local; não afirma gerar imagens por IA.

```sh
BOT="$HOME/projetos/inemaccbot"
"$BOT/.venv-media/bin/python" "$BOT/scripts/media_cpu.py" reel '<video.mp4>' --output '<saida.mp4>' --title '<headline>' --caption '<resumo>'
```

Os arquivos originais e os templates premium estão em
`~/projetos/promoavatar3/.claude/skills/reel-edita-inema/`. A opção premium pode
exigir serviços e chaves adicionais. No bot, use o modo CPU configurado.
Se o contrato pedir render destacado, grave PID e marcador de erro como indicado
no prompt do job. Não instale nada nem altere o vídeo original.
