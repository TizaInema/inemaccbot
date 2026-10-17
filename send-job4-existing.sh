#!/usr/bin/env bash
set -euo pipefail

cd /root/projetos/inemaccbot
set -a
. ./.env
set +a

ARQUIVO=/root/projetos/inemaccbot/state/artefatos/explicativo/4-720p.mp4
RESPOSTA=/tmp/job4-send-response.json

curl -sS -o "$RESPOSTA" -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
  -F "chat_id=6498951321" \
  -F "caption=Job 4 em 720p para caber no Telegram." \
  -F "document=@${ARQUIVO}"

python3 - <<'PY'
import json
from pathlib import Path

d = json.loads(Path("/tmp/job4-send-response.json").read_text())
print(json.dumps({"ok": d.get("ok"), "description": d.get("description")}, ensure_ascii=False))
if not d.get("ok"):
    raise SystemExit(1)
PY
