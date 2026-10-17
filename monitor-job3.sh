#!/usr/bin/env bash
set -euo pipefail

sleep "${1:-0}"
cd /root/projetos/inemaccbot

echo "== jobs =="
sqlite3 inemaccbot.db "select id,status,tentativas,max_tentativas,datetime(criado_em,'unixepoch'),datetime(iniciado_em,'unixepoch'),erro from jobs order by id desc limit 5;"

echo
echo "== service logs =="
journalctl --user -u inemaccbot.service --since '10 min ago' --no-pager -o short-iso | tail -n 120 || true

echo
echo "== artifact =="
ls -lah state/artefatos/explicativo/3.mp4* 2>/dev/null || true

echo
echo "== pid/process =="
if [ -f state/artefatos/explicativo/3.mp4.pid ]; then
  pid="$(cat state/artefatos/explicativo/3.mp4.pid)"
  echo "pid=$pid"
  ps -p "$pid" -o pid,ppid,pgid,sid,etimes,%cpu,%mem,cmd || true
  pstree -ap "$pid" 2>/dev/null || true
fi

echo
echo "== render log tail =="
tail -n 120 state/artefatos/explicativo/3.mp4.log 2>/dev/null || true
