---
name: video-demonstrativo
description: Demonstração narrada com capturas reais de um site público.
---

# Demo real na VPS

Capture primeiro, narre depois. Nunca desenhe uma tela fictícia de um app real.

```sh
BOT="$HOME/projetos/inemaccbot"
node "$BOT/scripts/capture-demo.mjs" '<URL pública>' "$PWD/screens"
```

O arquivo `screens/screens.json` contém as telas reais. Leia as capturas e a
página, escreva captions e narração de cada passo usando somente o que foi
verificado. Cada cena do spec admite `image` com caminho absoluto da captura,
`title`, `bullets` e `narration`. Não simule cliques que não aconteceram. Para um
walkthrough interativo, use Playwright com ações seguras e capture cada estado.

Renderize conforme `~/.claude/skills/video-explicativo/SKILL.md`. Login privado
exige uma sessão própria: não tente contornar autenticação nem usar credenciais
encontradas no servidor. Use o contrato RENDER:/RESULT: pedido pelo job.
