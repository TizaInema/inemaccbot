import '/root/projetos/inemaccbot/dist/fila/runner-codex.js';
import { RUNNERS } from '/root/projetos/inemaccbot/dist/fila/runner.js';

const exec = RUNNERS.codex.iniciar({
  prompt: 'responda apenas RESULT: /tmp/ok.txt',
  cwd: '/root',
  perfil: { motor: 'codex', modelo: 'sonnet', esforco: 'low' },
  vars: {},
  timeoutMs: 90_000,
});

try {
  console.log(await exec.aguardar());
} finally {
  await exec.limpar();
}
