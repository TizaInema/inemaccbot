#!/usr/bin/env python3
"""Teste real local de voz, transcrição, render e reel. Não acessa APIs pagas."""
import json
from pathlib import Path
import media_cpu as media

def main():
    folder = media.ROOT / 'state/smoke-media'; folder.mkdir(parents=True, exist_ok=True)
    phrase = 'Olá. Este é um teste de inteligência artificial do INEMA. Vamos aprender a criar vídeos.'
    audio = media.tts(phrase, folder / 'voz.wav')
    transcript = media.transcribe(audio)
    if 'intelig' not in transcript['text'].lower(): raise RuntimeError('Transcrição não reconheceu a fala de teste.')
    spec = folder / 'spec.json'
    spec.write_text(json.dumps({'scenes': [{'title': 'Inteligência artificial na prática',
        'bullets': ['Transforme conhecimento em projetos', 'Aprenda com exemplos'],
        'narration': phrase}]}, ensure_ascii=False), encoding='utf-8')
    video = folder / 'video.mp4'; media.render(spec, video)
    reel = folder / 'reel.mp4'; media.reel(video, reel, 'Crie seu primeiro projeto com IA', 'Aprenda com exemplos e coloque seu conhecimento em prática.')
    results = {}
    for name, path, size in [('video', video, (1280, 720)), ('reel', reel, (720, 1280))]:
        probe = media.probe(path)
        stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        if (stream['width'], stream['height']) != size: raise RuntimeError('Dimensão inesperada: ' + name)
        if not any(s['codec_type'] == 'audio' for s in probe['streams']): raise RuntimeError('Áudio ausente: ' + name)
        results[name] = {'largura': stream['width'], 'altura': stream['height'], 'segundos': float(probe['format']['duration']), 'bytes': path.stat().st_size}
    results['transcricao'] = transcript['text']
    (folder / 'resultado.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    media.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-frames:v', '1', folder / 'preview.png'])
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
