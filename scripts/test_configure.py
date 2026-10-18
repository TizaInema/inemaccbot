"""Testa o configurador real com rede/processos simulados e credenciais ficticias."""
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import stat
import tempfile
import unittest
from unittest.mock import patch
import urllib.error


class SetupTest(unittest.TestCase):
    def setUp(self):
        self.previous = Path.cwd()
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        self.script = self.root / 'scripts' / 'configure.py'
        shutil.copyfile(Path(__file__).with_name('configure.py'), self.script)
        self.token = '123456789:' + 'A' * 35

    def tearDown(self):
        os.chdir(self.previous)
        self.temp.cleanup()

    def execute(self, error=None):
        response = io.BytesIO(json.dumps({'ok': True, 'result': {'username': 'bot_de_teste'}}).encode())
        with patch('getpass.getpass', return_value=self.token), \
             patch('builtins.input', return_value='123456'), \
             patch('urllib.request.urlopen', side_effect=error, return_value=response), \
             patch('subprocess.run') as runner, patch('time.sleep'), \
             patch('os.getuid', return_value=0, create=True), \
             contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(self.script), run_name='__main__')
            return runner

    def test_configura_e_ativa_sem_rede_ou_servico_real(self):
        runner = self.execute()
        env = self.root / '.env'
        self.assertIn('BOT_TOKEN=' + self.token, env.read_text())
        result = json.loads((self.root / 'state' / 'setup-status.json').read_text())
        self.assertEqual(result['etapa'], 'ativo')
        self.assertNotIn(self.token, json.dumps(result))
        self.assertEqual(runner.call_count, 3)
        if os.name != 'nt':
            self.assertEqual(stat.S_IMODE(env.stat().st_mode), 0o600)

    def test_nao_sobrescreve_configuracao_existente(self):
        env = self.root / '.env'
        env.write_text('PRESERVAR=sim\n')
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertEqual(env.read_text(), 'PRESERVAR=sim\n')

    def test_token_recusado_registra_http_sem_expor_credencial(self):
        error = urllib.error.HTTPError('https://api.telegram.org/redigido', 401, 'Unauthorized', {}, None)
        with self.assertRaisesRegex(SystemExit, 'Token recusado'):
            self.execute(error)
        result = (self.root / 'state' / 'setup-status.json').read_text()
        self.assertIn('401', result)
        self.assertNotIn(self.token, result)
        self.assertFalse((self.root / '.env').exists())


if __name__ == '__main__':
    unittest.main()
