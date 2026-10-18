#!/usr/bin/env python3
"""Configura o bot no terminal do servidor; não imprime nem envia o token ao Git."""
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

root = Path(__file__).resolve().parent.parent
os.chdir(root)

def status(etapa, detalhe):
    """Diagnóstico sem token, IDs de chat ou conteúdo de mensagens."""
    pasta = root / 'state'
    pasta.mkdir(exist_ok=True)
    path = pasta / 'setup-status.json'
    texto = json.dumps({'etapa': etapa, 'detalhe': detalhe,
                        'data': datetime.now(timezone.utc).isoformat()}, ensure_ascii=True)
    with path.open('w', encoding='utf-8', opener=lambda p, f: os.open(p, f, 0o600)) as out:
        out.write(texto)
    path.chmod(0o600)

status('inicio', 'Configurador iniciado')
token = getpass.getpass('Token do bot Telegram (oculto): ').strip()
if not re.fullmatch(r'\d{5,}:[A-Za-z0-9_-]{20,}', token):
    status('token_invalido', 'Formato do token invalido')
    raise SystemExit('Formato do token inválido. Nenhum arquivo alterado.')
status('validando_token', 'Consultando getMe do Telegram')
try:
    req = urllib.request.Request('https://api.telegram.org/bot' + token + '/getMe', data=b'')
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.load(response)
    if not result.get('ok'):
        raise ValueError('token recusado')
except urllib.error.HTTPError as exc:
    status('telegram_http', 'HTTP ' + str(exc.code))
    if exc.code in (401, 404):
        raise SystemExit('Token recusado pelo Telegram. Cole o token NOVO e completo do BotFather.')
    raise SystemExit('Telegram respondeu HTTP ' + str(exc.code) + '. Tente novamente mais tarde.')
except urllib.error.URLError:
    status('telegram_rede', 'Falha de rede ao consultar Telegram')
    raise SystemExit('A VPS nao conseguiu conectar ao Telegram. Avise para verificarmos a rede.')
except Exception:
    status('telegram_resposta', 'Resposta inesperada de getMe')
    raise SystemExit('Não foi possível validar o token no Telegram. Nenhum arquivo alterado.')
status('token_validado', 'Telegram validou o token')
print('Bot validado: @' + result['result'].get('username', ''))
ids = input('IDs dos chats autorizados (Enter para localizar seu chat): ').strip()
if not ids:
    input('Envie /start ao bot no Telegram e depois pressione Enter aqui: ')
    try:
        req = urllib.request.Request('https://api.telegram.org/bot' + token + '/getUpdates', data=b'timeout=0')
        with urllib.request.urlopen(req, timeout=20) as response:
            updates = json.load(response)
        chats = {}
        for update in updates.get('result', []):
            chat = (update.get('message') or {}).get('chat') or {}
            if 'id' in chat:
                chats[chat['id']] = chat.get('username') or chat.get('first_name') or chat.get('title') or ''
        for chat_id, label in chats.items():
            print(str(chat_id) + ' — ' + label)
        if not chats:
            raise SystemExit('Nenhum chat encontrado. Envie /start e execute novamente; nenhum arquivo alterado.')
    except Exception:
        raise SystemExit('Não foi possível localizar o chat. Nenhum arquivo alterado.')
    ids = input('Digite somente os IDs que você autoriza, separados por vírgula: ').strip()
if not ids or any(not re.fullmatch(r'-?\d+', part.strip()) for part in ids.split(',')):
    status('ids_invalidos', 'Lista de chats invalida')
    raise SystemExit('IDs inválidos. Nenhum arquivo alterado.')
values = {
    'BOT_TOKEN': token, 'ALLOWED_CHAT_IDS': ids, 'MOTOR_PADRAO': 'codex',
    'MODELO_PADRAO': 'sonnet', 'ESFORCO_PADRAO': 'low',
    'PROJETOS_DIR': str(root.parent), 'STATE_DIR': str(root / 'state'),
    'QUEUE_DB': str(root / 'inemaccbot.db'), 'LOG_FILE': str(root / 'state' / 'inemaccbot.log'),
    'PUBLICO_DIR': str(root.parent / 'output'),
}
env_path = root / '.env'
if env_path.exists():
    status('configuracao_existente', 'Arquivo .env ja existe; preservado')
    raise SystemExit('.env já existe. Preserve-o e edite manualmente; nada sobrescrito.')
with env_path.open('x', encoding='utf-8', opener=lambda path, flags: os.open(path, flags, 0o600)) as env:
    env.write(''.join(key + '=' + value + '\n' for key, value in values.items()))
print('Configuração salva com permissão 600. Bot: @' + result['result'].get('username', ''))
status('configuracao_salva', 'Arquivo .env salvo com permissao 600')
subprocess.run(['node', 'dist/doctor.js'], check=True)
subprocess.run(['systemctl', '--user', 'enable', '--now', 'inemaccbot.service'], check=True,
               env={**os.environ, 'XDG_RUNTIME_DIR': '/run/user/' + str(os.getuid())})
time.sleep(3)
subprocess.run(['systemctl', '--user', 'is-active', '--quiet', 'inemaccbot.service'], check=True,
               env={**os.environ, 'XDG_RUNTIME_DIR': '/run/user/' + str(os.getuid())})
print('Serviço ativado. Envie /ping ao bot a partir de um chat autorizado.')
status('ativo', 'Servico ativado e confirmado pelo systemd')
