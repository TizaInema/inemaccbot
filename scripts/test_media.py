import json
import os
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import agnes_image
import media_cpu


class MediaTests(unittest.TestCase):
    def test_bloqueia_rede_privada_e_credencial_em_url(self):
        for url in ('file:///etc/passwd', 'https://user:pass@example.org'):
            with self.assertRaises(ValueError): media_cpu.public_url(url)
        with patch('socket.getaddrinfo', return_value=[(socket.AF_INET, 1, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError): media_cpu.public_url('https://example.org')

    def test_url_publica(self):
        with patch('socket.getaddrinfo', return_value=[(socket.AF_INET, 1, 6, '', ('93.184.215.14', 443))]):
            self.assertEqual(media_cpu.public_url('https://example.org/test'), 'https://example.org/test')

    def test_cofre_sem_eco_e_prioridade_do_ambiente(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / '.env'; path.write_text('AGNES_API_KEY="chave-de-teste"\n')
            with patch.dict(os.environ, {'INEMACCBOT_PROVIDERS_FILE': str(path), 'AGNES_API_KEY': ''}):
                self.assertEqual(agnes_image.api_key(), 'chave-de-teste')
            with patch.dict(os.environ, {'INEMACCBOT_PROVIDERS_FILE': str(path), 'AGNES_API_KEY': 'ambiente-teste'}):
                self.assertEqual(agnes_image.api_key(), 'ambiente-teste')

    def test_sem_chave_nao_chama_api(self):
        with patch.dict(os.environ, {'INEMACCBOT_PROVIDERS_FILE': '/arquivo-inexistente', 'AGNES_API_KEY': ''}), patch('urllib.request.urlopen') as request:
            with self.assertRaisesRegex(RuntimeError, 'Configure AGNES_API_KEY'):
                agnes_image.generate('paisagem', '/tmp/nao-criar.png')
            request.assert_not_called()

    def test_traducao_exige_mesma_quantidade(self):
        with tempfile.TemporaryDirectory() as tmp:
            def fake_run(*args, **kwargs):
                (Path(tmp) / 'translation-0.json').write_text(json.dumps(['Olá']))
            with patch.object(media_cpu, 'run', side_effect=fake_run):
                with self.assertRaisesRegex(ValueError, 'quantidade'):
                    media_cpu.translate([{'text': 'Hi'}, {'text': 'World'}], tmp)

    def test_roteiro_vazio_falha_antes_de_renderizar(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / 'spec.json'; spec.write_text('{"scenes": []}')
            with self.assertRaises(ValueError): media_cpu.render(spec, Path(tmp) / 'out.mp4')


if __name__ == '__main__': unittest.main()
