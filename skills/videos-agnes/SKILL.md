---
name: videos-agnes
description: Filme narrado com imagens e clipes Agnes, com retomada por cena.
---

# Filme Agnes

Crie um roteiro de 4 a 8 cenas coerentes com a história do usuário. Narração em
PT-BR; prompts de imagem e movimento em inglês. Mantenha as descrições dos
personagens consistentes entre cenas. Não prometa gratuidade nem voz clonada.

Escreva um JSON:

```json
{"scenes":[{"image_prompt":"An original cinematic scene...","narration":"A história narrada em português.","motion":"Slow camera movement..."}]}
```

```sh
BOT="$HOME/projetos/inemaccbot"
"$BOT/.venv-media/bin/python" "$BOT/scripts/agnes_story.py" --spec historia.json --output '<saida.mp4>'
```

O comando mantém IDs e artefatos para retomar cenas, gera voz Kokoro pf_dora e
monta o filme com FFmpeg. Requer AGNES_API_KEY no cofre. Não use rodar.py do
repositório original: ele contém caminhos da máquina antiga e envio a outro bot.
Nunca envie mensagens por conta própria; a entrega é responsabilidade do ccbot.
