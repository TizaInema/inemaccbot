#!/usr/bin/env python3
"""História JSON -> imagens/clipes Agnes + voz CPU -> MP4. Não envia mensagens."""
import argparse
import base64
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
from agnes_image import api_key, generate
from media_cpu import probe, run, tts


def request(method, path, body=None):
    base = os.getenv('AGNES_API_BASE', 'https://apihub.agnes-ai.com/v1').rstrip('/')
    if not base.startswith('https://'):
        raise ValueError('A API precisa usar HTTPS.')
    req = urllib.request.Request(base + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + api_key(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Agnes vídeo respondeu HTTP ' + str(error.code)) from None


def build(spec_path, output):
    api_key()  # Falha antes de gerar áudio ou fazer uma solicitação sem credencial.
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    scenes = spec.get('scenes', [])
    if not 1 <= len(scenes) <= 12:
        raise ValueError('O filme precisa ter de 1 a 12 cenas.')
    work = Path(str(output) + '.work'); work.mkdir(parents=True, exist_ok=True)
    state_file = work / 'state.json'
    state = json.loads(state_file.read_text()) if state_file.exists() else {}

    def save():
        temp = state_file.with_suffix('.tmp')
        temp.write_text(json.dumps(state), encoding='utf-8'); temp.replace(state_file)

    clips = []
    for i, scene in enumerate(scenes):
        if not all(isinstance(scene.get(k), str) and scene[k].strip() for k in ('image_prompt', 'narration', 'motion')):
            raise ValueError('Cada cena exige image_prompt, narration e motion.')
        row = state.setdefault(str(i), {})
        image, audio, video = (work / f'{i}.{ext}' for ext in ('png', 'wav', 'mp4'))
        if not image.exists(): generate(scene['image_prompt'], image)
        if not audio.exists(): tts(scene['narration'], audio)
        duration = float(probe(audio)['format']['duration'])
        if not row.get('video_id') and not video.exists():
            body = {'model': os.getenv('AGNES_VIDEO_MODEL', 'agnes-video-2.5-flash'),
                    'prompt': scene['motion'], 'mode': 'keyframe', 'seconds': str(max(4, min(12, int(duration + 0.9)))),
                    'n': 1, 'size': '720P', 'aspect_ratio': '16:9',
                    'first_frame': 'data:image/png;base64,' + base64.b64encode(image.read_bytes()).decode()}
            result = request('POST', '/videos', body)
            row['video_id'] = result.get('id') or result.get('task_id') or result.get('video_id')
            if not row['video_id']: raise RuntimeError('Agnes não devolveu o ID do vídeo.')
            save()
        if not video.exists():
            deadline = time.monotonic() + 2700
            while time.monotonic() < deadline:
                result = request('GET', '/videos/' + urllib.parse.quote(str(row['video_id']), safe=''))
                url = (result.get('metadata') or {}).get('url') or result.get('url')
                status = result.get('status', '')
                if status in ('failed', 'error', 'cancelled'):
                    raise RuntimeError('A Agnes informou falha na geração do clipe.')
                if url:
                    if not url.startswith('https://'): raise RuntimeError('A API retornou uma URL de vídeo não segura.')
                    with urllib.request.urlopen(url, timeout=180) as response:
                        content = response.read(200 * 1024 * 1024 + 1)
                    if len(content) > 200 * 1024 * 1024: raise RuntimeError('Clipe maior que 200 MB.')
                    video.write_bytes(content); break
                time.sleep(15)
            else:
                raise RuntimeError('Tempo esgotado na Agnes. O ID foi preservado para retomar sem gerar outro clipe.')
        narrated = work / f'{i}-narrated.mp4'
        if not narrated.exists():
            run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', video, '-i', audio,
                 '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,tpad=stop_mode=clone:stop_duration=120',
                 '-t', str(duration), '-r', '25', '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast',
                 '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '44100', '-ac', '2', narrated])
        clips.append(narrated)
        print(f'progresso: {i + 1}/{len(scenes)} cenas', flush=True)
    listing = work / 'concat.txt'
    listing.write_text(''.join("file '" + str(p).replace("'", "'\\''") + "'\n" for p in clips))
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listing, '-c', 'copy', '-movflags', '+faststart', output])
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--spec', required=True); parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        print(build(args.spec, Path(args.output).resolve()))
    except Exception as error:
        print('ERRO: ' + (str(error) if isinstance(error, (RuntimeError, ValueError)) else 'Falha na produção do filme.'))
        raise SystemExit(1)
