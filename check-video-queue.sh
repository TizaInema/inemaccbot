#!/usr/bin/env bash
set -euo pipefail

cd /root/projetos/inemaccbot

echo "## time"
date -Is

echo "## service"
XDG_RUNTIME_DIR=/run/user/0 systemctl --user is-active inemaccbot || true
XDG_RUNTIME_DIR=/run/user/0 systemctl --user status inemaccbot --no-pager -l | sed -n '1,18p' || true

echo "## node/codex/render processes"
ps -eo pid,ppid,etimes,lstart,cmd \
  | grep -E 'node dist/index.js|codex exec|hyperframes|chrome-headless|ffmpeg|hf.sh|render' \
  | grep -v grep \
  | sed -n '1,80p' || true

echo "## db summary"
python3 - <<'PY'
import json, sqlite3, time
from pathlib import Path

db = sqlite3.connect("inemaccbot.db")
db.row_factory = sqlite3.Row
now = int(time.time())

def rows(sql, args=()):
    return [dict(r) for r in db.execute(sql, args)]

print("now_epoch", now)
print("counts")
for r in rows("select status, fila, count(*) as total from jobs group by status, fila order by status, fila"):
    print(r)

print("recent_jobs")
for r in rows("""
    select id, fila, kind, tarefa, status, tentativas, max_tentativas,
           lease_ate, lease_owner, chat_id, flow_ref, criado_em, iniciado_em, terminado_em,
           substr(coalesce(erro,''),1,220) as erro,
           substr(coalesce(resultado,''),1,220) as resultado
    from jobs
    order by id desc
    limit 12
"""):
    r["age_s"] = now - int(r["criado_em"] or now)
    r["running_s"] = None if not r["iniciado_em"] else now - int(r["iniciado_em"])
    r["lease_left_s"] = None if not r["lease_ate"] else int(r["lease_ate"]) - now
    print(json.dumps(r, ensure_ascii=False))

print("active_or_waiting")
for r in rows("""
    select id, fila, kind, tarefa, status, tentativas, max_tentativas,
           lease_ate, lease_owner, chat_id, flow_ref, criado_em, iniciado_em, terminado_em,
           substr(coalesce(erro,''),1,220) as erro,
           substr(coalesce(resultado,''),1,220) as resultado
    from jobs
    where status in ('queued','running')
    order by prioridade desc, id asc
    limit 20
"""):
    r["age_s"] = now - int(r["criado_em"] or now)
    r["running_s"] = None if not r["iniciado_em"] else now - int(r["iniciado_em"])
    r["lease_left_s"] = None if not r["lease_ate"] else int(r["lease_ate"]) - now
    print(json.dumps(r, ensure_ascii=False))

print("recent_fluxos")
try:
    for r in rows("""
        select id, tipo, prefixo, slug, assunto, chat_id, status, criado_em, terminado_em
        from fluxos
        order by id desc
        limit 8
    """):
        r["age_s"] = now - int(r["criado_em"] or now)
        print(json.dumps(r, ensure_ascii=False))
except sqlite3.Error as e:
    print("fluxos_error", e)
PY

echo "## artifact/render markers"
find /root/projetos/inemaccbot /root/projetos/output /root/projetos -maxdepth 5 \
  \( -name '*.pid' -o -name '*.err' -o -name '*.log' -o -name '*.mp4' \) \
  -mmin -240 -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null \
  | sort \
  | tail -80 || true

echo "## bot log tail"
tail -n 180 inemaccbot.log 2>/dev/null \
  | sed -E 's/[0-9]{8,10}:[A-Za-z0-9_-]{20,}/<telegram-token-redacted>/g; s/sk-or-v1-[A-Za-z0-9]+/<api-key-redacted>/g; s/sk-[A-Za-z0-9_-]+/<api-key-redacted>/g' || true
