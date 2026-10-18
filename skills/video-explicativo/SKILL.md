---
name: video-explicativo
description: Vídeo explicativo narrado PT-BR na VPS CPU do inemaccbot.
---

# Explicativo CPU

Produza um roteiro factual, claro e em PT-BR, com gancho, explicação, exemplo e
fecho. Use de 4 a 8 cenas, salvo pedido explícito de outra duração. A CTA
INEMA.CLUB é acrescentada pelo renderizador. Não invente fontes, números ou fatos.

Escreva `spec.json` com:

```json
{"scenes":[{"title":"Um título curto","bullets":["Ideia central","Exemplo concreto"],"narration":"Narração natural em português brasileiro."}]}
```

Narração: Kokoro pf_dora; cards dark premium âmbar com movimento de câmera,
720p horizontal ou 720x1280 vertical. O modo CPU é uma alternativa local aos
templates HyperFrames, sem geração de imagens por GPU ou voz clonada.

```sh
BOT="$HOME/projetos/inemaccbot"
"$BOT/.venv-media/bin/python" "$BOT/scripts/media_cpu.py" render --spec spec.json --output '<saida.mp4>'
# Adicione --vertical se o usuário pediu 9:16.
```

Faça roteiro e áudio nesta sessão. Se o contrato do job pedir RENDER:, inicie
somente o comando final em setsid/nohup, grave o PID de dentro do shell e crie
`<saida>.err` em caso de falha. O bot acompanha o arquivo. Nunca instale ferramentas.
