#!/usr/bin/env python3
"""Uma cena real pela Agnes Flash, sem envio ao Telegram e sem modelo pago."""
import json
from pathlib import Path
from agnes_story import build
from media_cpu import probe

ROOT = Path(__file__).resolve().parent.parent

def main():
    folder=ROOT/'state/smoke-agnes'; folder.mkdir(parents=True,exist_ok=True)
    spec=folder/'story.json'
    if not spec.exists():
        spec.write_text(json.dumps({'ratio':'16:9','style':'Cinematic watercolor animation, soft natural lighting.',
            'scenes':[{'image_prompt':'A small orange paper boat floating on a calm blue stream, wide shot, morning sunlight, no people, no text.',
                       'end_prompt':'The same orange paper boat floats a little farther along the same calm blue stream, same wide camera framing.',
                       'narration':'Um pequeno barco segue pelo rio.',
                       'motion':'The paper boat drifts slowly forward on the calm water, gentle natural ripples, fixed camera.'}]},ensure_ascii=False,indent=2),encoding='utf-8')
    output=build(spec,folder/'filme.mp4')
    metadata=probe(output)
    streams=metadata['streams']
    visual=next(s for s in streams if s['codec_type']=='video')
    if not any(s['codec_type']=='audio' for s in streams): raise RuntimeError('O filme não tem narração.')
    result={'provider':'Agnes','model':'agnes-video-2.5-flash','video':str(output),
            'width':visual['width'],'height':visual['height'],'seconds':float(metadata['format']['duration']),
            'bytes':output.stat().st_size,'audio':True}
    (folder/'resultado.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))

if __name__=='__main__': main()
