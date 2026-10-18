#!/usr/bin/env bash
# Usa somente o HyperFrames que já está no cache. Nunca instala durante um job.
set -euo pipefail
bin=$(python3 - <<'PY'
import glob,json,pathlib
choices=[]
for name in glob.glob(str(pathlib.Path.home()/'.npm/_npx/*/node_modules/hyperframes/package.json')):
    p=pathlib.Path(name)
    try:
        version=tuple(int(x) for x in json.loads(p.read_text())['version'].split('.'))
        choices.append((version,p.parent/'bin/hyperframes.mjs'))
    except (ValueError,KeyError): pass
print(str(max(choices)[1]) if choices else '')
PY
)
if [ -z "$bin" ]; then echo 'ERRO: HyperFrames não instalado no cache.' >&2; exit 1; fi
exec node "$bin" "$@"
