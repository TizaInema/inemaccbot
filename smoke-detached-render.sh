#!/usr/bin/env bash
set -euo pipefail

OUT=/tmp/inemaccbot-detached-smoke.mp4
rm -f "$OUT" "$OUT.log" "$OUT.pid" "$OUT.err"

cd /root/projetos/output/ccbot-telegram-botfather
PROJETO="$(pwd)"

nohup setsid bash -c 'echo $$ > "$2.pid"; cd "$1" || exit 70; bash ~/.claude/skills/reel-edita-inema/scripts/hf.sh render --quality high --output "$2" || touch "$2.err"' _ "$PROJETO" "$OUT" >"$OUT.log" 2>&1 < /dev/null &

sleep 15

echo "== markers =="
ls -lah "$OUT"* 2>/dev/null || true

pid="$(cat "$OUT.pid")"
echo "== process =="
ps -p "$pid" -o pid,ppid,pgid,sid,etimes,cmd || true

echo "== log tail =="
tail -n 60 "$OUT.log" || true

if kill -0 "$pid" 2>/dev/null; then
  echo "== stopping smoke process group $pid =="
  kill -TERM "-$pid" 2>/dev/null || true
  sleep 2
  kill -KILL "-$pid" 2>/dev/null || true
fi

rm -f "$OUT" "$OUT.log" "$OUT.pid" "$OUT.err"
