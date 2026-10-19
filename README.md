# inemaccbot

Bot Telegram para pedir transcrições, dublagens, vídeos e fluxos promocionais. Usa fila SQLite persistente, notificações de conclusão, aprovação de roteiros e retomada após reinício.

O motor original foi recuperado de `inematds/inemaccbot` (versão e commit em `upstream-source.json`). Os projetos de mídia têm revisões fixadas em `config/media-sources.json`. A adaptação desta VPS usa CPU e Codex autenticado.

## Comandos

- `/ping`, `/ajuda`, `/skills`, `/diagnostico`: conexão, catálogo e dependências.
- `/jobs`, `/fila`, `/status <id>`, `/cancelar <id>`, `/refazer <id>`: trabalhos do chat.
- `transcrever: <link ou arquivo>`: Whisper local, resultado em texto.
- `dublar: <link ou arquivo>`: transcrição, tradução pelo Codex e voz PT-BR, em MP4.
- `explicativo: <assunto> | vertical`, `curso: <assunto>`, `demo: <URL e objetivo>`: roteiro, narração e montagem CPU. Demo usa capturas reais do site público.
- `reel: <arquivo>`, `reelpromo: <arquivo>`, `reelinematds: <arquivo>`: vídeo vertical com headline, resumo e CTA.
- `imagem: <descrição>`, `historia: <roteiro>`: geração pela conta Agnes configurada pelo proprietário.
- Envie uma foto com legenda `animar: | segundos=15 | ratio=9:16` para transformar a arte em vídeo Agnes, inclusive acima dos 12 segundos de um clipe.
- `/promoclub <assunto>`, `/promoavatar <assunto>`, `/promoavatar3 <assunto>`: textos por público, aprovação e integração de avatares. `/aprovar A#1`, `/pausar A#1`, `/retomar A#1`, `/dados A#1` controlam o fluxo.

A voz CPU é Kokoro `pf_dora`, sem clonagem Bella/Rachel. A montagem CPU usa cartões e enquadramento vertical; os projetos originais ficam disponíveis para consulta. A publicação automática no YouTube exige um publicador separado: `livesN` é a pasta local de entrega.

A integração Agnes adapta o motor real de [inematds/videos-agnes](https://github.com/inematds/videos-agnes), fixado em `config/agnes-source.json`: âncoras e vistas derivadas de personagens, duas imagens por cena, revisão de dicção antes da voz, keyframes Agnes 2.5 Flash, narração e montagem. `historia: <conto> | ratio=9:16` seleciona o formato. A voz continua local por CPU; as imagens e os movimentos vêm da Agnes.

As tarefas guardam os identificadores antes de consultar a fila. Falhas transitórias de fila têm retry; tarefas aceitas retomam pelo ID, sem criar outro clipe. Roteiros alterados exigem nova saída para preservar resultados anteriores. A montagem só acontece com todas as cenas completas. Há uma folha de contato em `<saida>.work/contato.jpg`. A versão Flash é usada explicitamente, sem troca automática para modelos pagos; preços e disponibilidade dependem da conta Agnes.

## Instalação Linux

```bash
npm ci
npm run build
python3 scripts/install-media.py
python3 scripts/configure.py
```

O instalador cria um ambiente Python em `~/.local/share/inemaccbot/media-venv`, ligado a `.venv-media`, e baixa o Whisper base para `~/.cache/inemaccbot/whisper`. Requer FFmpeg, fonte DejaVu e os arquivos Kokoro em `~/.cache/hyperframes/tts/{models,voices}`. Não substitui credenciais existentes nem atualiza dependências com alterações locais.

No `.env`, use `MOTOR_PADRAO=codex`, `CODEX_BIN=/usr/local/bin/codex`, `CLAUDE_BIN=/usr/bin/claude`, `INEMACCBOT_CPU_MEDIA=1`, além do token, IDs permitidos e caminhos do banco/estado. O Codex precisa estar autenticado. `INEMACCBOT_WRITE_DIRS` declara diretórios extras de escrita separados por `:`; o motor mantém sandbox de escrita no workspace.

Para Agnes e HeyGen, configure as chaves no terminal privado da VPS:

```bash
python3 scripts/configure-providers.py
```

O arquivo `~/projetos/wifi/.env` fica com modo 600 e fora do Git. Agnes requer conta e disponibilidade do modelo. HeyGen requer chave, créditos e identificadores de avatar/voz da própria conta; os identificadores herdados dos projetos devem ser conferidos antes de gerar. A aprovação do roteiro permanece antes da geração. Não envie chaves pelo Telegram ou chat.

Configure também `HEYGEN_AVATAR_ID` e `HEYGEN_VOICE_ID` no mesmo assistente: a adaptação usa esses valores da sua conta. No Windows, `scripts/configure-providers-windows.ps1` oferece campos privados com botão Colar e envia os valores à VPS somente por stdin do SSH.

## Verificação e atualização

```bash
npm test -- --maxWorkers=2
node --test scripts/test-migration.mjs
python3 -m unittest discover -s scripts -p 'test_*.py' -v
.venv-media/bin/python scripts/smoke-media.py
node scripts/smoke-engine.mjs
npm run doctor
```

A amostra real testa narração, transcrição, MP4 com áudio e reel 720x1280, sem APIs pagas. Resultados em `state/smoke-media`.

A atualização do banco legado usa `scripts/migrate-legacy.mjs`: lê a origem sem escrita e cria um banco separado, preservando IDs e histórico. `scripts/deploy-media.py --revision <SHA validado>` verifica fila vazia e clone limpo, salva banco/configuração/commit em `/root/backups`, atualiza e recupera a versão anterior se falhar. O banco legado continua preservado.

```bash
XDG_RUNTIME_DIR=/run/user/0 systemctl --user status inemaccbot --no-pager
```

Credenciais, bancos, logs, ambientes Python e artefatos ficam fora do Git. O bot responde somente aos IDs permitidos e restringe os comandos de jobs e fluxos ao chat proprietário.
