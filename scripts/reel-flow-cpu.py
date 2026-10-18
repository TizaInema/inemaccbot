#!/usr/bin/env python3
"""Adaptador do contrato reel.montar para a VPS sem GPU."""
import argparse
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
venv = ROOT / '.venv-media/bin/python'
if venv.exists() and Path(sys.executable).resolve() != venv.resolve() and os.getenv('INEMACCBOT_MEDIA_VENV') != '1':
    os.execve(str(venv), [str(venv), __file__, *sys.argv[1:]], {**os.environ, 'INEMACCBOT_MEDIA_VENV': '1'})
from media_cpu import reel, run

parser = argparse.ArgumentParser()
for name in ('avatar', 'ws', 'alvo', 'textos', 'saida'):
    parser.add_argument('--' + name, required=True)
parser.add_argument('--flow'); parser.add_argument('--cta'); parser.add_argument('--sem-legenda', action='store_true')
args = parser.parse_args()
text = Path(args.textos).read_text(encoding='utf-8')
headline = re.search(r'(?im)^(?:hook(?: do topo)?|headline|titulo|título)\s*:\s*(.+)$', text)
title = headline.group(1).strip(' *"') if headline else args.alvo.replace('-', ' ').upper()
speech = re.search(r'(?is)###\s*FALA[^\n]*\n(.*?)(?=\n#{1,3}\s|\Z)', text)
caption = re.sub(r'[*_`#]', '', speech.group(1)).strip()[:360] if speech else 'Aprenda a usar inteligência artificial na prática.'
dest = Path(args.saida); dest.parent.mkdir(parents=True, exist_ok=True)
if args.cta and Path(args.cta).is_file():
    body = Path(args.ws) / 'corpo-cpu.mp4'; body.parent.mkdir(parents=True, exist_ok=True)
    reel(args.avatar, body, title, caption)
    # Normaliza a CTA ao mesmo tamanho; evita concatenação incompatível.
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', body, '-i', args.cta,
         '-filter_complex', '[0:v]setsar=1[v0];[1:v]scale=720:1280,setsar=1[v1];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
         '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-c:a', 'aac', dest])
else:
    reel(args.avatar, dest, title, caption)
print(str(dest))
