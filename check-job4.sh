#!/usr/bin/env bash
set -euo pipefail
cd /root/projetos/inemaccbot

sqlite3 -header -column inemaccbot.db <<'SQL'
select id, status, tarefa, chat_id, resultado, erro
from jobs
where id = 4;
SQL

echo
ls -lh state/artefatos/explicativo/4.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=nw=1 state/artefatos/explicativo/4.mp4
