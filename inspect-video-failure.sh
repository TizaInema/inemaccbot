#!/usr/bin/env bash
set -euo pipefail

cd /root/projetos/inemaccbot

echo "== time =="
date -Is

echo
echo "== service =="
systemctl --user --no-pager --full status inemaccbot.service | sed -n '1,18p' || true

echo
echo "== jobs 1/2 =="
python3 - <<'PY'
import json, os, pathlib, re, sqlite3, time

env = pathlib.Path(".env").read_text(errors="ignore")
match = re.search(r"^QUEUE_DB=(.+)$", env, re.M)
db = match.group(1).strip() if match else "inemaccbot.db"
if not os.path.exists(db):
    raise SystemExit(f"QUEUE_DB nao existe: {db}")
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
for row in conn.execute("""
    select id, fila, kind, tarefa, status, tentativas, max_tentativas, chat_id,
           motor, modelo, esforco, criado_em, disponivel_em, lease_ate,
           iniciado_em, terminado_em, erro, input, resultado, flow_ref
    from jobs
    where id in (1,2)
    order by id
"""):
    data = dict(row)
    for key in ("input", "resultado"):
        if data.get(key):
            try:
                data[key] = json.loads(data[key])
            except Exception:
                pass
    for key in ("criado_em", "disponivel_em", "lease_ate", "iniciado_em", "terminado_em"):
        value = data.get(key)
        if value:
            try:
                data[key + "_iso"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(value)))
            except Exception:
                pass
    print(json.dumps(data, ensure_ascii=False, indent=2))
PY

echo
echo "== fluxos/fases relacionadas =="
python3 - <<'PY'
import json, os, pathlib, re, sqlite3, time
env = pathlib.Path(".env").read_text(errors="ignore")
db = re.search(r"^QUEUE_DB=(.+)$", env, re.M).group(1).strip()
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
for table, query in [
    ("fluxos", "select * from fluxos order by id desc limit 10"),
    ("fluxo_fases", "select * from fluxo_fases where job_id in (1,2) or estado in ('rodando','pendente') order by fluxo_id, ordem, alvo limit 40"),
]:
    print(f"-- {table} --")
    for row in conn.execute(query):
        data = dict(row)
        for key in ("definicao_json", "dados"):
            if data.get(key):
                try:
                    data[key] = json.loads(data[key])
                except Exception:
                    pass
        print(json.dumps(data, ensure_ascii=False, indent=2))
PY

echo
echo "== artefatos e pids =="
for id in 1 2; do
  echo "-- job $id --"
  ls -lah "state/artefatos/explicativo/${id}.mp4"* 2>/dev/null || true
  if [ -f "state/artefatos/explicativo/${id}.mp4.pid" ]; then
    pid="$(cat "state/artefatos/explicativo/${id}.mp4.pid" 2>/dev/null || true)"
    echo "pid=$pid"
    if [ -n "${pid:-}" ]; then
      ps -fp "$pid" || true
      pstree -ap "$pid" 2>/dev/null || true
    fi
  fi
  if [ -f "state/artefatos/explicativo/${id}.mp4.log" ]; then
    echo "log bytes=$(wc -c < "state/artefatos/explicativo/${id}.mp4.log")"
    tail -n 80 "state/artefatos/explicativo/${id}.mp4.log" || true
  fi
  if [ -f "state/artefatos/explicativo/${id}.mp4.err" ]; then
    echo "err:"
    cat "state/artefatos/explicativo/${id}.mp4.err" || true
  fi
done

echo
echo "== processo relacionados a video/codex/hyperframes/chrome =="
ps -eo pid,ppid,etimes,%mem,%cpu,cmd --sort=etimes | grep -E 'codex|hyperframes|chrome|hf.sh|build-index|kokoro|onnx|ffmpeg' | grep -v grep || true

echo
echo "== projetos recentes em /root/projetos/output =="
find /root/projetos/output -maxdepth 1 -mindepth 1 -type d -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | sort | tail -n 20 || true

echo
echo "== arquivos recentes em projetos de video =="
find /root/projetos/output -maxdepth 4 -type f -mmin -180 -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | sort | tail -n 80 || true

echo
echo "== estrutura resumida dos provaveis projetos =="
for d in /root/projetos/output/ccbot-telegram-botfather /root/projetos/output/*professor* /root/projetos/output/*Professor* /root/projetos/output/*ia* /root/projetos/output/*IA*; do
  [ -d "$d" ] || continue
  echo "-- $d --"
  find "$d" -maxdepth 3 -type f -printf '%p %s bytes\n' | sort | sed -n '1,120p'
done

echo
echo "== logs recentes do bot =="
journalctl --user -u inemaccbot.service --since "90 min ago" --no-pager -o short-iso | tail -n 180 || true
