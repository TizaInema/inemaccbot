---
name: imagens-agnes
description: Imagens Agnes via cliente instalado e chave de API própria.
---

# Imagem Agnes

Prepare uma descrição clara em inglês a partir do pedido, preservando conteúdo
e intenção. Não prometa custo zero. O uso depende da conta/chave do usuário.

```sh
BOT="$HOME/projetos/inemaccbot"
"$BOT/.venv-media/bin/python" "$BOT/scripts/agnes_image.py" '<prompt>' --output '<saida.png>' --ratio 16:9 --size 1K
```

A chave é lida do cofre `~/projetos/wifi/.env`, nunca deve aparecer no prompt,
saída, argumento ou log. Se faltar a chave, declare ERRO: configure AGNES_API_KEY.
Só declare RESULT: quando a imagem tiver sido validada e salva.
