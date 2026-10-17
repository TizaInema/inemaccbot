#!/usr/bin/env python3
"""Configura o bot no terminal do servidor; não imprime nem envia o token ao Git."""
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

root = Path(__file__).resolve().parent.parent
os.chdir(root)
token = getpass.getpass('Token do bot Telegram (oculto): ').strip()
if not re.fullmatch(r'\d{5,}:[A-Za-z0-9_-]{20,}', token):
    raise SystemExit('Formato do token inválido. Nenhum arquivo alterado.')
ids = input('IDs dos chats autorizados, separados por vírgula: ').strip()
if not ids or any(not re.fullmatch(r'-?\d+', part.strip()) for part in ids.split(',')):
    raise SystemExit('IDs inválidos. Nenhum arquivo alterado.')
try:
    req = urllib.request.Request('https://api.telegram.org/bot' + token + '/getMe', data=b'')
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.load(response)
    if not result.get('ok'):
        raise ValueError('token recusado')
except Exception:
    raise SystemExit('Não foi possível validar o token no Telegram. Nenhum arquivo alterado.')
values = {
    'BOT_TOKEN': token, 'ALLOWED_CHAT_IDS': ids, 'MOTOR_PADRAO': 'codex',
    'MODELO_PADRAO': 'sonnet', 'ESFORCO_PADRAO': 'low',
    'PROJETOS_DIR': str(root.parent), 'STATE_DIR': str(root / 'state'),
    'QUEUE_DB': str(root / 'inemaccbot.db'), 'LOG_FILE': str(root / 'state' / 'inemaccbot.log'),
    'PUBLICO_DIR': str(root.parent / 'output'),
}
env_path = root / '.env'
if env_path.exists():
    raise SystemExit('.env já existe. Preserve-o e edite manualmente; nada sobrescrito.')
with env_path.open('x', encoding='utf-8', opener=lambda path, flags: os.open(path, flags, 0o600)) as env:
    env.write(''.join(key + '=' + value + '\n' for key, value in values.items()))
print('Configuração salva com permissão 600. Bot: @' + result['result'].get('username', ''))
subprocess.run(['node', 'dist/doctor.js'], check=True)
subprocess.run(['systemctl', '--user', 'enable', '--now', 'inemaccbot.service'], check=True,
               env={**os.environ, 'XDG_RUNTIME_DIR': '/run/user/' + str(os.getuid())})
print('Serviço ativado. Envie /ping ao bot a partir de um chat autorizado.')
