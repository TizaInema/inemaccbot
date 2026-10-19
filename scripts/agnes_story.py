#!/usr/bin/env python3
"""videos-agnes adaptado: âncoras -> dois keyframes -> voz CPU -> filme no bot."""
import argparse
import json
import math
from pathlib import Path
import sys
from agnes_image import api_key, generate
from agnes_video import (RATIOS, concatenate, generate_clip, normalize_clip,
                         video_payload, work_state)
from agnes_narration import revisar
from media_cpu import probe, run, tts


def validate(spec):
    if not isinstance(spec,dict): raise ValueError('O roteiro deve ser um objeto JSON.')
    scenes = spec.get('scenes',[])
    anchors = spec.get('anchors',[])
    if not isinstance(scenes,list) or not 1 <= len(scenes) <= 8:
        raise ValueError('O filme precisa ter de 1 a 8 cenas.')
    if spec.get('ratio','16:9') not in RATIOS: raise ValueError('Proporção de vídeo não suportada.')
    if not isinstance(anchors,list) or len(anchors) > 8: raise ValueError('Use até 8 âncoras de personagens.')
    ids = set()
    for anchor in anchors:
        if not isinstance(anchor,dict): raise ValueError('Âncora deve ser um objeto JSON.')
        name = anchor.get('id')
        if not isinstance(name,str) or not name or name in ids or not isinstance(anchor.get('prompt'),str) or not anchor['prompt'].strip():
            raise ValueError('Cada âncora exige id único e prompt em inglês.')
        if anchor.get('derive_from') and anchor['derive_from'] not in ids:
            raise ValueError('Uma âncora derivada precisa apontar para uma âncora anterior.')
        ids.add(name)
    for scene in scenes:
        if not isinstance(scene,dict): raise ValueError('Cena deve ser um objeto JSON.')
        if not all(isinstance(scene.get(k),str) and scene[k].strip() for k in ('image_prompt','narration','motion')):
            raise ValueError('Cada cena exige image_prompt, narration e motion.')
        refs = scene.get('refs',list(ids)[:1])
        if not isinstance(refs,list) or len(refs)>2 or any(not isinstance(r,str) or r not in ids for r in refs):
            raise ValueError('Cada cena aceita até duas referências a âncoras existentes.')
        if scene.get('end_prompt') is not None and (not isinstance(scene['end_prompt'],str) or not scene['end_prompt'].strip()):
            raise ValueError('end_prompt deve descrever o quadro final em inglês.')
    return spec


def build(spec_path, output):
    spec = validate(json.loads(Path(spec_path).read_text(encoding='utf-8')))
    api_key()
    output = Path(output).resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    folder,state,save = work_state(spec,output,'story')
    ratio = spec.get('ratio','16:9')
    style = spec.get('style','Cinematic 3D animation, soft lighting, restrained natural colors.')
    anchors = {}
    for i,anchor in enumerate(spec.get('anchors',[])):
        path = folder / f'anchor-{i}.png'
        refs = [anchors[anchor['derive_from']]] if anchor.get('derive_from') else None
        if not path.exists(): generate(anchor['prompt'] + ' ' + style,path,ratio,refs=refs)
        anchors[anchor['id']] = path
        state.setdefault('anchors',{})[anchor['id']] = path.name; save()
        print(f'progresso: âncora {i+1}/{len(spec["anchors"])}',flush=True)
    clips=[]
    for i,scene in enumerate(spec['scenes']):
        row = state.setdefault('scenes',{}).setdefault(str(i),{})
        # A voz vem antes do clipe: sua duração define a duração pedida à Agnes.
        narration,changes = revisar(scene['narration'])
        row['narration'] = {'original':scene['narration'], 'spoken':narration, 'changes':changes}; save()
        audio = folder / f'{i}.wav'
        if not audio.exists(): tts(narration,audio)
        duration = float(probe(audio)['format']['duration'])
        if not 0 < duration <= 120: raise ValueError('Divida a narração: cada cena deve ter até 120 segundos.')
        refs = [anchors[r] for r in scene.get('refs',list(anchors)[:1])]
        first,last = folder / f'{i}-a.png', folder / f'{i}-b.png'
        consistent = ' Keep the same characters, faces, clothing and proportions as the references. Exactly one of each character.'
        if not first.exists(): generate(scene['image_prompt'] + consistent + ' ' + style,first,ratio,refs=refs or None)
        ending = scene.get('end_prompt') or (scene['image_prompt'] + ' Later in the same scene: ' + scene['motion'])
        if not last.exists(): generate(ending + consistent + ' ' + style,last,ratio,refs=[first,*refs[:1]])
        video = folder / f'{i}.mp4'
        body = video_payload(first,scene['motion'],max(4,min(12,math.ceil(duration))),ratio,last)
        generate_clip(video,row,save,body)
        narrated = folder / f'{i}-narrated.mp4'
        if not narrated.exists(): normalize_clip(video,narrated,ratio,duration,audio)
        clips.append(narrated)
        print(f'progresso: {i+1}/{len(spec["scenes"])} cenas',flush=True)
    # Só monta quando TODAS as cenas existem; nunca entrega um filme com buracos.
    concatenate(clips,output,folder)
    run(['ffmpeg','-nostdin','-y','-v','error','-i',output,'-vf',
         'fps=1/2,scale=320:-1,tpad=stop_mode=clone:stop_duration=16,tile=4x2','-frames:v','1',folder/'contato.jpg'])
    return output


if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--spec',required=True); parser.add_argument('--output',required=True)
    args=parser.parse_args()
    try: print(build(args.spec,args.output))
    except Exception as error:
        print('ERRO: ' + (str(error) if isinstance(error,(RuntimeError,ValueError)) else 'Falha na produção do filme Agnes.'),file=sys.stderr)
        raise SystemExit(1)
