#!/usr/bin/env python3
"""Backend de render iniciado pelo bot após o agente gravar um roteiro."""
import argparse
import json
from pathlib import Path
import sys
import tempfile
import media_cpu as media

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--command', required=True, choices=['explicativo','curso','demo','reel','reelpromo','reelinematds','historia','animar'])
    parser.add_argument('--spec', required=True); parser.add_argument('--output', required=True)
    parser.add_argument('--vertical', action='store_true')
    args = parser.parse_args()
    output = Path(args.output).resolve(); output.parent.mkdir(parents=True, exist_ok=True)
    if args.command.startswith('reel'):
        data = json.loads(Path(args.spec).read_text(encoding='utf-8'))
        if not isinstance(data.get('source'), str) or not isinstance(data.get('title'), str): raise ValueError('O reel exige source e title.')
        with tempfile.TemporaryDirectory(dir=output.parent) as folder:
            source = media.source_media(data['source'], folder)
            media.reel(source, output, data['title'][:95], str(data.get('caption', ''))[:300])
    elif args.command == 'animar':
        from agnes_video import animate
        animate(args.spec,output)
    elif args.command == 'historia':
        from agnes_story import build
        build(args.spec, output)
    else:
        media.render(args.spec, output, args.vertical)
    print(str(output))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('ERRO: ' + str(error)[:1000], file=sys.stderr)
        raise SystemExit(1)
