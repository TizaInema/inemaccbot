#!/usr/bin/env python3
"""Instala fontes fixadas e runtime CPU sem alterar credenciais existentes."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def call(args):
    subprocess.run([str(a) for a in args], check=True)


def link(source, target):
    if target.is_symlink() and target.resolve() == source.resolve():
        return
    if target.exists() or target.is_symlink():
        backup = target.with_name(target.name + '.before-inemaccbot-media')
        if backup.exists() or backup.is_symlink():
            raise RuntimeError('Há um backup prévio de skill; revise antes de substituir: ' + str(target))
        target.rename(backup)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.symlink_to(source, target_is_directory=source.is_dir())


def install(skip_python=False):
    projects = ROOT.parent
    data = json.loads((ROOT / 'config/media-sources.json').read_text(encoding='utf-8-sig'))
    for source in data['sources']:
        name = source['name']
        if not name.replace('-', '').isalnum(): raise ValueError('Nome de dependência inválido')
        dest = projects / name
        if not dest.exists():
            call(['git', 'clone', '--depth', '1', source['url'], dest])
        if not (dest / '.git').exists():
            raise RuntimeError('A pasta de dependência não é um clone Git: ' + str(dest))
        revision = subprocess.check_output(['git', '-C', str(dest), 'rev-parse', 'HEAD'], text=True).strip()
        if revision != source['commit']:
            if subprocess.check_output(['git', '-C', str(dest), 'status', '--porcelain'], text=True).strip():
                raise RuntimeError('Dependência com alterações locais; nada sobrescrito: ' + name)
            call(['git', '-C', dest, 'fetch', '--depth', '1', 'origin', source['commit']])
            call(['git', '-C', dest, 'checkout', '--detach', source['commit']])
    skill_root = Path.home() / '.claude/skills'
    for skill in (ROOT / 'skills').iterdir():
        if (skill / 'SKILL.md').exists(): link(skill, skill_root / skill.name)
    # O motor de textos original é próprio dos repos promocionais.
    text_skill = projects / 'promoavatar/.claude/skills/inemaclub-textos'
    if (text_skill / 'SKILL.md').exists(): link(text_skill, skill_root / 'inemaclub-textos')
    hf = projects / 'promoavatar3/.claude/skills/reel-edita-inema/scripts/hf.sh'
    scripts = ROOT / 'skills/reel-edita-inema/scripts'
    scripts.mkdir(exist_ok=True)
    if not (scripts / 'hf.sh').exists(): link(hf, scripts / 'hf.sh')
    # Compatibilidade do nome antigo /promoclub com o motor de flow.json atual.
    promo = projects / 'inemaclubpromover'
    promo.mkdir(exist_ok=True)
    base = projects / 'promoavatar'
    for name in ('prompts', '.claude', 'scripts', 'templates', 'cta'):
        if (base / name).exists(): link(base / name, promo / name)
    original = json.loads((base / 'flow.json').read_text(encoding='utf-8'))
    original['nome'] = 'promoclub'; original['prefixo'] = 'P'
    original['fases'] = [f for f in original['fases'] if not f.get('opcional') or f['opcional'] == 'api']
    for phase in original['fases']:
        if phase.get('opcional') == 'api': phase.pop('opcional')
        # A aprovação de roteiro é mantida antes de uma chamada externa.
    (promo / 'flow.json').write_text(json.dumps(original, ensure_ascii=False, indent=2), encoding='utf-8')
    cofre = projects / 'wifi'
    cofre.mkdir(exist_ok=True)
    env = cofre / '.env'
    if not env.exists():
        with open(env, 'x', encoding='utf-8', opener=lambda p, f: os.open(p, f, 0o600)) as f:
            f.write('# Credenciais de integrações; preencha somente no servidor.\n')
    env.chmod(0o600)
    output = projects / 'output'
    output.mkdir(exist_ok=True)
    # Pastas de entrega locais. Não instalam nem ativam publicadores do YouTube.
    for source in ('promoavatar', 'promoavatar3'):
        flow = json.loads((projects / source / 'flow.json').read_text(encoding='utf-8'))
        for target in flow['alvos'].values():
            channel = target.get('canal', '')
            if channel.startswith('lives') and channel[5:].isdigit():
                (projects / ('yt-pub-' + channel) / 'imports/videos').mkdir(parents=True, exist_ok=True)
    if not skip_python:
        venv = ROOT / '.venv-media'
        if not (venv / 'bin/python').exists(): call(['python3', '-m', 'venv', '--system-site-packages', venv])
        python = venv / 'bin/python'
        call([python, '-m', 'pip', 'install', '-r', ROOT / 'requirements-media.txt'])
        # O modelo é baixado na instalação, nunca no meio de um job.
        cache = ROOT / 'state/models/whisper'
        call([python, '-c', 'from faster_whisper import WhisperModel; WhisperModel("base",device="cpu",compute_type="int8",download_root=' + repr(str(cache)) + ')'])
    print('Fontes e skills instaladas. As chaves de serviços externos continuam no cofre, fora do Git.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--skip-python', action='store_true')
    args = parser.parse_args(); install(args.skip_python)
