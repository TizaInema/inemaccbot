#!/usr/bin/env python3
"""Configura chaves no terminal privado, sem eco e sem Git."""
import getpass
import json
import os
import sys
from pathlib import Path

def main():
    target = Path(os.getenv('INEMACCBOT_PROVIDERS_FILE', str(Path.home() / 'projetos/wifi/.env')))
    target.parent.mkdir(parents=True, exist_ok=True)
    lines = target.read_text(encoding='utf-8').splitlines() if target.exists() else []
    supplied = json.load(sys.stdin) if '--stdin-json' in sys.argv else None
    for name in ('AGNES_API_KEY', 'HEYGEN_API_KEY', 'HEYGEN_AVATAR_ID', 'HEYGEN_VOICE_ID'):
        value = str(supplied.get(name, '') if supplied is not None else getpass.getpass(name + ' (Enter mantém o valor atual): ')).strip()
        if not value:
            continue
        if not all(c.isalnum() or c in '-_.' for c in value):
            raise ValueError('Formato de chave inválido; arquivo preservado.')
        lines = [l for l in lines if l.partition('=')[0].strip() != name]
        lines.append(name + '=' + value)
    temp = target.with_suffix('.tmp')
    with open(temp, 'w', encoding='utf-8', opener=lambda p, f: os.open(p, f, 0o600)) as stream:
        stream.write('\n'.join(lines) + '\n')
    temp.chmod(0o600)
    temp.replace(target)
    print('Cofre atualizado. O diagnóstico informa somente se as chaves estão presentes.')

if __name__ == '__main__':
    main()
