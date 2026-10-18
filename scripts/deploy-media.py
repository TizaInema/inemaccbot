#!/usr/bin/env python3
"""Atualização verificada, com backup e recuperação automática do serviço."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess

ROOT = Path('/root/projetos/inemaccbot')
ENV = dict(os.environ, XDG_RUNTIME_DIR='/run/user/0')

def call(args, cwd=ROOT):
    subprocess.run([str(a) for a in args], cwd=cwd, env=ENV, check=True)

def config(text):
    return {k.strip(): v.strip().strip('"').strip("'") for line in text.splitlines()
            if not line.lstrip().startswith('#') for k, sep, v in [line.partition('=')] if sep}

def main(revision):
    if not all(c in '0123456789abcdef' for c in revision) or len(revision) != 40: raise ValueError('Informe SHA completo validado.')
    old_env = (ROOT / '.env').read_text()
    values = config(old_env)
    dbpath = Path(values['QUEUE_DB'])
    if not dbpath.is_absolute(): dbpath = ROOT / dbpath
    with sqlite3.connect(f'file:{dbpath}?mode=ro', uri=True) as db:
        if db.execute("SELECT count(*) FROM jobs WHERE status IN ('running','queued')").fetchone()[0]:
            raise RuntimeError('Fila em uso; aguarde antes de atualizar.')
    if subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip():
        raise RuntimeError('Clone de produção com alterações locais; nada alterado.')
    previous = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    backup = Path('/root/backups') / ('inemaccbot-before-media-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(ROOT / '.env', backup / '.env')
    (backup / 'commit.txt').write_text(previous)
    service = Path('/root/.config/systemd/user/inemaccbot.service')
    shutil.copy2(service, backup / service.name)
    newdb = ROOT / 'state/queue-v2.sqlite'
    if newdb.exists(): raise RuntimeError('Banco de destino já existe; revise a migração anterior.')
    call(['systemctl', '--user', 'stop', 'inemaccbot'])
    try:
        with sqlite3.connect(f'file:{dbpath}?mode=ro', uri=True) as source, sqlite3.connect(backup / 'queue.sqlite') as target:
            source.backup(target)
        call(['git', 'fetch', 'origin', 'main'])
        if subprocess.check_output(['git', 'rev-parse', 'origin/main'], cwd=ROOT, text=True).strip() != revision:
            raise RuntimeError('O main não corresponde ao SHA validado.')
        call(['git', 'merge', '--ff-only', revision])
        call(['npm', 'ci']); call(['npm', 'run', 'build'])
        call(['python3', 'scripts/install-media.py', '--skip-python'])
        call(['node', 'scripts/migrate-legacy.mjs', dbpath, newdb])
        changes = {'QUEUE_DB': str(newdb), 'CLAUDE_BIN': '/usr/bin/claude', 'CODEX_BIN': '/usr/local/bin/codex',
                   'MOTOR_PADRAO': 'codex', 'MODELO_PADRAO': 'executor', 'INEMACCBOT_CPU_MEDIA': '1',
                   'INEMACCBOT_WRITE_DIRS': str(ROOT / 'state') + ':' + str(ROOT.parent / 'output')}
        lines = [l for l in old_env.splitlines() if l.partition('=')[0].strip() not in changes]
        updated = '\n'.join(lines + [k + '=' + v for k, v in changes.items()]) + '\n'
        tmp = ROOT / '.env.deploy.tmp'
        with open(tmp, 'w', opener=lambda p,f: os.open(p,f,0o600)) as stream: stream.write(updated)
        tmp.chmod(0o600); tmp.replace(ROOT / '.env')
        call(['systemctl', '--user', 'start', 'inemaccbot'])
        call(['systemctl', '--user', 'is-active', 'inemaccbot'])
        print(json.dumps({'atualizado': revision, 'backup': str(backup), 'banco_original_preservado': str(dbpath)}))
    except Exception:
        # O commit anterior continua no Git; checkout sem reset preserva arquivos não versionados.
        call(['git', 'checkout', '--detach', previous])
        shutil.copy2(backup / '.env', ROOT / '.env')
        call(['npm', 'ci']); call(['npm', 'run', 'build'])
        call(['systemctl', '--user', 'start', 'inemaccbot'])
        raise

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--revision', required=True)
    main(parser.parse_args().revision)
