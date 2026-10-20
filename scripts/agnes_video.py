#!/usr/bin/env python3
"""Adaptador do videos-agnes dca7c5d: fila, keyframes e imagem -> vídeo."""
import hashlib
import json
import math
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

from agnes_image import api_key, image_reference
from media_cpu import probe, run

MODEL = 'agnes-video-2.5-flash'
RATIOS = {'16:9': (1280,720), '9:16': (720,1280), '1:1': (720,720),
          '4:3': (960,720), '3:4': (720,960), '21:9': (1680,720)}


class ApiError(RuntimeError):
    def __init__(self, status, retry_after=0, reason='servico_indisponivel'):
        self.status = status
        self.retry_after = retry_after
        self.reason = reason
        super().__init__('Agnes respondeu HTTP ' + str(status) + ' (' + reason + ')')


def atomic_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def work_state(spec, output, kind):
    folder = Path(str(output) + '.work'); folder.mkdir(parents=True, exist_ok=True)
    state_file = folder / 'state.json'
    fingerprint = hashlib.sha256(json.dumps({'kind':kind, 'spec':spec}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    state = json.loads(state_file.read_text(encoding='utf-8')) if state_file.exists() else {}
    if state and state.get('fingerprint') != fingerprint:
        raise ValueError('O roteiro mudou. Use um novo arquivo de saída para preservar as gerações anteriores.')
    state.setdefault('fingerprint', fingerprint)
    state.setdefault('source', 'inematds/videos-agnes@dca7c5d5b25f5ed21180e98057ebfca5224c466e')
    atomic_json(state_file, state)
    return folder, state, lambda: atomic_json(state_file, state)


def request(method, path, body=None, root=False):
    base = os.getenv('AGNES_API_BASE', 'https://apihub.agnes-ai.com/v1').rstrip('/')
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Configure uma API Agnes HTTPS, sem credenciais na URL.')
    if root: base = urllib.parse.urlunsplit((parsed.scheme,parsed.netloc,'','',''))
    req = urllib.request.Request(base + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization':'Bearer ' + api_key(), 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as response: return json.load(response)
    except urllib.error.HTTPError as error:
        try: after = min(120, max(0, int(error.headers.get('Retry-After', '0'))))
        except (TypeError, ValueError): after = 0
        detail = error.read(16384).lower()
        reason = ('modelo_sem_canal' if b'no available channel' in detail else
                  'fila_cheia' if b'video_queue_full' in detail or b'queue full' in detail else
                  'limite_de_uso' if b'rate limit' in detail or error.code == 429 else
                  'saldo_ou_cota' if error.code == 402 else
                  'credencial_recusada' if error.code in (401,403) else
                  'parametros_recusados' if error.code == 400 else 'servico_indisponivel')
        error.close()
        raise ApiError(error.code, after, reason) from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError('Falha de conexão com a Agnes; nenhum token foi exibido.') from None


def video_payload(first, motion, seconds, ratio, last=None):
    if ratio not in RATIOS: raise ValueError('Proporção de vídeo não suportada.')
    seconds = int(seconds)
    if not 4 <= seconds <= 12: raise ValueError('Cada clipe Agnes precisa ter de 4 a 12 segundos.')
    body = {'model':MODEL, 'mode':'keyframe', 'size':'720P', 'n':1,
            'seconds':str(seconds), 'aspect_ratio':ratio, 'prompt':motion,
            'first_frame':image_reference(first)}
    if last: body['last_frame'] = image_reference(last)
    return body


def task_status(row):
    # A documentação atual usa video_id + model_name. O motor original usa task_id.
    # Mantemos os dois identificadores e só alternamos a consulta, nunca a criação.
    if row.get('video_id'):
        query = urllib.parse.urlencode({'video_id':row['video_id'], 'model_name':MODEL})
        try: return request('GET', '/agnesapi?' + query, root=True)
        except ApiError as error:
            if error.status not in (400,404): raise
    task = row.get('task_id') or row.get('video_id')
    if not task: raise ValueError('Tarefa sem identificador Agnes.')
    return request('GET', '/videos/' + urllib.parse.quote(str(task), safe=''))


def download_video(url, destination):
    if not isinstance(url,str) or not url.startswith('https://'):
        raise RuntimeError('A Agnes não forneceu um endereço HTTPS de vídeo.')
    destination = Path(destination); temporary = destination.with_suffix('.download.mp4')
    try:
        with urllib.request.urlopen(url, timeout=180) as response, temporary.open('wb') as stream:
            size = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk: break
                size += len(chunk)
                if size > 200 * 1024 * 1024: raise ValueError('Clipe Agnes excede 200 MB.')
                stream.write(chunk)
        if not any(s.get('codec_type') == 'video' for s in probe(temporary).get('streams',[])):
            raise RuntimeError('O arquivo recebido não contém vídeo válido.')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def generate_clip(destination, row, save, body, timeout=2700, interval=15, attempts=6):
    if not 1 <= attempts <= 6: raise ValueError('Use de 1 a 6 tentativas de criação.')
    destination = Path(destination)
    if destination.exists(): return destination
    if not row.get('video_id') and not row.get('task_id'):
        if row.get('creation_pending'):
            raise RuntimeError('Criação anterior sem confirmação. Consulte a Agnes antes de reenviar para evitar duplicação.')
        for attempt in range(attempts):
            row['creation_pending'] = True; save()
            try:
                result = request('POST','/videos',body)
            except ApiError as error:
                row.pop('creation_pending',None); save()
                row['last_error'] = {'http':error.status,'reason':error.reason}; save()
                if error.reason == 'modelo_sem_canal': raise
                if error.status not in (429,503) or attempt == attempts-1: raise
                delay = max(error.retry_after, 70 if error.status == 429 else min(120,30*(attempt+1)))
                print(f'progresso: Agnes HTTP {error.status}; nova tentativa em {delay}s', flush=True)
                time.sleep(delay); continue
            row['video_id'] = result.get('video_id')
            row['task_id'] = result.get('id') or result.get('task_id')
            if not row.get('video_id') and not row.get('task_id'):
                save(); raise RuntimeError('Agnes não confirmou o identificador da criação. Não será reenviada automaticamente.')
            row.pop('creation_pending',None); save(); break
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            result = task_status(row)
        except ApiError as error:
            if error.status not in (429,500,502,503,504): raise
            time.sleep(max(interval,error.retry_after)); continue
        except RuntimeError:
            time.sleep(interval); continue
        status = result.get('status','')
        row['status'] = status; save()
        if status in ('failed','error','cancelled','canceled'):
            raise RuntimeError('A geração falhou na Agnes. O ID foi preservado para consulta.')
        url = result.get('video_url') or result.get('url') or (result.get('metadata') or {}).get('url')
        if status == 'completed':
            if not url: raise RuntimeError('A Agnes concluiu o clipe sem fornecer o arquivo.')
            download_video(url,destination); row['status'] = 'downloaded'; save(); return destination
        print(f'progresso: clipe Agnes {status or "na fila"}', flush=True)
        time.sleep(interval)
    raise RuntimeError('Agnes ainda está processando. Retome este trabalho: o ID salvo evita criar outro clipe.')


def normalize_clip(source, output, ratio, duration, audio=None):
    w,h = RATIOS[ratio]
    args = ['ffmpeg','-nostdin','-y','-v','error','-i',source]
    if audio: args += ['-i',audio]
    args += ['-map','0:v:0'] + (['-map','1:a:0'] if audio else ['-an'])
    args += ['-vf',f'scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration={math.ceil(duration)}',
             '-t',str(duration),'-r','24','-c:v','libx264','-threads','1','-preset','veryfast','-crf','22','-pix_fmt','yuv420p']
    if audio: args += ['-c:a','aac','-ar','44100','-ac','2']
    run(args + ['-movflags','+faststart',output])


def concatenate(clips, output, folder, seconds=None):
    listing = folder / 'concat.txt'
    listing.write_text(''.join("file '" + str(Path(p).resolve()).replace("'","'\\''") + "'\n" for p in clips), encoding='utf-8')
    temporary = Path(str(output) + '.part.mp4')
    args = ['ffmpeg','-nostdin','-y','-v','error','-f','concat','-safe','0','-i',listing,'-c','copy']
    if seconds is not None: args += ['-t',str(seconds)]
    run(args + ['-movflags','+faststart',temporary]); temporary.replace(output)


def animate(spec_path, output):
    api_key()
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    seconds = float(spec.get('seconds',15)); ratio = spec.get('ratio','9:16')
    if not math.isfinite(seconds) or not 4 <= seconds <= 60: raise ValueError('Peça uma animação de 4 a 60 segundos.')
    if ratio not in RATIOS: raise ValueError('Proporção de vídeo não suportada.')
    image = Path(spec['image']).expanduser().resolve(strict=True)
    image_reference(image)
    spec['image_sha256'] = hashlib.sha256(image.read_bytes()).hexdigest()
    output = Path(output).resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    folder,state,save = work_state(spec,output,'animate')
    n = math.ceil(seconds/12); length = max(4,min(12,math.ceil(seconds/n)))
    prompt = spec.get('motion') or 'Very slow cinematic push-in with subtle natural movement.'
    prompt += ' All printed text, logos, badges and screens remain still, sharp and unchanged.'
    clips=[]
    for i in range(n):
        row = state.setdefault('clips',{}).setdefault(str(i),{})
        clip = folder / f'clip-{i}.mp4'
        body = video_payload(image,prompt,length,ratio,image if i < n-1 else None)
        generate_clip(clip,row,save,body)
        normalized = folder / f'clip-{i}-normalized.mp4'
        if not normalized.exists(): normalize_clip(clip,normalized,ratio,length)
        clips.append(normalized)
        print(f'progresso: {i+1}/{n} clipes',flush=True)
    concatenate(clips,output,folder,seconds)
    run(['ffmpeg','-nostdin','-y','-v','error','-i',output,'-vf','fps=1/2,scale=320:-1,tpad=stop_mode=clone:stop_duration=16,tile=4x2','-frames:v','1',folder/'contato.jpg'])
    return output
