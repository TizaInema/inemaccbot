# inemaccbot

Bot pessoal de produção de conteúdo pelo Telegram, com tarefas persistidas em
SQLite e execução por Codex ou Claude Code. Requer Node.js 22.18 ou superior.

## Estado da recuperação

A branch `recovery/local-patches` preserva os 33 arquivos recuperados. O commit
inicial contém um manifesto de origem e hashes. O restante do runtime foi
reconstruído: configuração, banco, filas, worker, Telegram, catálogo e prompts.
Não é uma restauração integral do motor original.

O núcleo suporta comandos, pedidos em linguagem natural, filas, recuperação de
leases, cancelamento e entrega de arquivos. As dez skills do catálogo dependem
das respectivas ferramentas e credenciais instaladas no servidor. O diagnóstico
mostra a presença dos SKILL.md e executores; isso não garante que cada integração
tenha todas as suas dependências configuradas.

Os fluxos promocionais (`promoclub`, `promoavatar`, `promoavatar3`) permanecem
indisponíveis: os contratos e projetos originais não foram recuperados. O bot
recusa esses pedidos explicitamente. O diagnóstico HTTP arbitrário está desativado.

## Desenvolvimento

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run doctor
```

Os testes não chamam serviços reais nem precisam de tokens. Os testes que usam
process groups e binários Linux rodam na VPS e no GitHub Actions; são pulados no Windows.

## Instalação na VPS

Pasta esperada pelo serviço: `/root/projetos/inemaccbot`.

```sh
cd /root/projetos/inemaccbot
npm ci --ignore-scripts
npm run build
npm test
install -m 644 deploy/inemaccbot.service /root/.config/systemd/user/inemaccbot.service
XDG_RUNTIME_DIR=/run/user/0 systemctl --user daemon-reload
python3 scripts/configure.py
```

O configurador pede o token de forma oculta, valida-o com `getMe`, pede os IDs
dos chats autorizados e cria `.env` com permissão 600. Depois ativa o serviço.
Um `.env` existente nunca é sobrescrito. Para configuração manual, copie
`.env.example` para `.env`, preencha no servidor e proteja com `chmod 600 .env`.
Nunca envie tokens pelo Git. Apenas chats explicitamente autorizados são aceitos.

Codex precisa estar autenticado (`codex login status`). Claude é opcional e
requer autenticação própria. Codex usa sandbox `workspace-write`; cada tarefa
trabalha na pasta de artefatos de sua skill. Integrações que dependem de escrever
em outras pastas precisam ser adaptadas antes de serem usadas.

```sh
XDG_RUNTIME_DIR=/run/user/0 systemctl --user status inemaccbot --no-pager
XDG_RUNTIME_DIR=/run/user/0 journalctl --user -u inemaccbot -n 50 --no-pager
```

Após configurar, envie `/ping` pelo Telegram; a resposta esperada é `pong`.
Use `/skills`, `/jobs`, `/fila`, `/status <id>`, `/cancelar <id>` e `/refazer <id>`.
Exemplo: `explicativo: O que é RAG | vertical` (requer a skill e o render configurados).
Anexos podem ser usados em legendas substituindo `{{anexo}}` pelo caminho baixado.

## Dados e backups

`.env`, bancos SQLite, logs, `state/`, resultados e credenciais estão no
`.gitignore`. Faça backups dos dados separadamente, com o serviço parado ou por
backup consistente do SQLite. O Git guarda o código, não as credenciais e o
histórico de tarefas do bot antigo, que não foram recuperados.
