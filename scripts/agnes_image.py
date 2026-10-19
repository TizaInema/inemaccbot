#!/usr/bin/env python3
"""Cliente Agnes para imagem avulsa; chave lida somente em runtime."""
import argparse
import base64
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


def api_key():
    key = os.environ.get('AGNES_API_KEY', '').strip()
    path = Path(os.getenv('INEMACCBOT_PROVIDERS_FILE', str(Path.home() / 'projetos/wifi/.env')))
    if not key and path.is_file():
        for line in path.read_text(encoding='utf-8').splitlines():
            name, separator, value = line.partition('=')
            if separator and name.strip() == 'AGNES_API_KEY':
                key = value.strip().strip('"').strip("'")
    if not key:
        raise RuntimeError('Configure AGNES_API_KEY no cofre de integrações da VPS.')
    return key


def image_reference(path):
    from PIL import Image
    import io
    path = Path(path).expanduser().resolve(strict=True)
    if not path.is_file() or path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('Referência precisa ser uma imagem local de até 10 MB.')
    with Image.open(path) as source:
        source.load()
        image = source.convert('RGB'); image.thumbnail((2048, 2048))
        buffer = io.BytesIO(); image.save(buffer, format='PNG')
    content = buffer.getvalue()
    if len(content) > 10 * 1024 * 1024: raise ValueError('Imagem de referência excede 10 MB após normalização.')
    return 'data:image/png;base64,' + base64.b64encode(content).decode('ascii')


def generate(prompt, output, ratio='16:9', size='1K', refs=None):
    key = api_key()
    sizes = {'16:9': (1312, 736), '9:16': (736, 1312), '1:1': (1024, 1024), '4:3': (1152, 864), '3:4': (864, 1152), '21:9': (1536, 656)}
    if ratio not in sizes or size not in ('1K', '2K', '4K'):
        raise ValueError('Use proporção 16:9, 9:16, 1:1, 4:3 ou 3:4; tamanho 1K, 2K ou 4K.')
    factor = {'1K': 1, '2K': 2, '4K': 3}[size]
    w, h = sizes[ratio]
    body = {'model': os.getenv('AGNES_IMAGE_MODEL', 'agnes-image-2.1-flash'), 'prompt': prompt,
            'size': f'{w * factor}x{h * factor}', 'ratio': ratio, 'extra_body': {'response_format': 'url'}}
    if refs:
        if len(refs) > 2: raise ValueError('Use no máximo duas referências por imagem, conforme o motor videos-agnes.')
        body['extra_body']['image'] = [image_reference(ref) for ref in refs]
    endpoint = os.getenv('AGNES_API_BASE', 'https://apihub.agnes-ai.com/v1').rstrip('/') + '/images/generations'
    if not endpoint.startswith('https://'):
        raise ValueError('A API Agnes precisa usar HTTPS.')
    for attempt in range(4):
        request = urllib.request.Request(endpoint, data=json.dumps(body).encode(),
                                         headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                data = json.load(response)
            image = data['data'][0]
            if image.get('b64_json'):
                content = base64.b64decode(image['b64_json'], validate=True)
            else:
                url = image['url']
                if not url.startswith('https://'):
                    raise ValueError('URL de imagem não segura recebida da API.')
                with urllib.request.urlopen(url, timeout=120) as response:
                    content = response.read(25 * 1024 * 1024 + 1)
            if len(content) > 25 * 1024 * 1024:
                raise ValueError('Imagem recebida excede o limite de tamanho.')
            # Decodifica antes de entregar um arquivo .png ao bot.
            import io
            from PIL import Image
            dest = Path(output); dest.parent.mkdir(parents=True, exist_ok=True)
            temporary = dest.with_suffix(dest.suffix + '.part')
            Image.open(io.BytesIO(content)).convert('RGB').save(temporary, format='PNG')
            temporary.replace(dest)
            return dest
        except urllib.error.HTTPError as error:
            error.close()
            if error.code in (401, 403):
                raise RuntimeError('A Agnes recusou a credencial. Revise a chave no cofre.') from None
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError('Agnes respondeu HTTP ' + str(error.code)) from None
            time.sleep(min(60, 5 * 2**attempt))
    raise RuntimeError('A API Agnes não concluiu a imagem.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('prompt'); parser.add_argument('-o', '--output', required=True)
    parser.add_argument('--ratio', default='16:9'); parser.add_argument('--size', default='1K')
    args = parser.parse_args()
    try:
        print(generate(args.prompt, args.output, args.ratio, args.size))
    except Exception as error:
        # Não imprime mensagens de exceção de clientes que possam conter tokens.
        print('ERRO: ' + (str(error) if isinstance(error, (RuntimeError, ValueError)) else 'Falha ao gerar/baixar a imagem.'))
        raise SystemExit(1)
