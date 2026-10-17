#!/usr/bin/env bash
set -euo pipefail

cd /root/projetos/inemaccbot

SRC=/root/projetos/inemaccbot/state/artefatos/explicativo/4.mp4
DST=/root/projetos/inemaccbot/state/artefatos/explicativo/4-720p.mp4
CHAT_ID=6498951321

ffmpeg -y -hide_banner -loglevel error \
  -i "$SRC" \
  -vf "scale='if(gte(iw,ih),1280,720)':'if(gte(iw,ih),720,1280)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -preset veryfast -crf 28 \
  -c:a aac -b:a 96k \
  -movflags +faststart \
  "$DST"

echo "== arquivo 720p =="
ls -lh "$DST"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=nw=1 "$DST"

set -a
. ./.env
set +a

echo "== enviando ao Telegram =="
curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
  -F "chat_id=${CHAT_ID}" \
  -F "caption=Job 4 em 720p para caber no Telegram." \
  -F "document=@${DST}" \
  | python3 - <<'PY'
import json, sys
data = json.load(sys.stdin)
print(json.dumps({"ok": data.get("ok"), "description": data.get("description")}, ensure_ascii=False))
if not data.get("ok"):
    raise SystemExit(1)
PY
