#!/usr/bin/env bash
set -euo pipefail

cd /root/projetos/inemaccbot

echo "== job 3 response columns =="
sqlite3 -header -column inemaccbot.db <<'SQL'
select
  id,
  status,
  resultado,
  erro,
  datetime(terminado_em,'unixepoch') as terminado_em_utc,
  notificado_em,
  datetime(notificado_em,'unixepoch') as notificado_em_utc
from jobs
where id = 3;
SQL

echo
echo "== notification-related logs =="
journalctl --user -u inemaccbot.service --since '2026-10-13 14:50:00' --no-pager -o short-iso | tail -n 160 || true

echo
echo "== artifact stats =="
stat -c '%n %s bytes %y' state/artefatos/explicativo/3.mp4
