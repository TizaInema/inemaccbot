import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

import { abrirDb } from './dist/db/abrir.js';
import { MIGRATIONS, aplicarMigrations } from './dist/db/migrations.js';
import { FilaSqlite } from './dist/fila/store.js';
import { RUNNERS } from './dist/fila/runner.js';
import './dist/fila/runner-codex.js';
import { carregarSkills } from './dist/dominio/registry.js';
import { tratarMensagem } from './dist/gateway/mensagem.js';

const dir = mkdtempSync(join(tmpdir(), 'ccbot-gateway-smoke-'));

try {
  const db = abrirDb(join(dir, 'fila.db'));
  aplicarMigrations(db, () => 1000, MIGRATIONS);
  const fila = new FilaSqlite(db, () => 1000);
  const defs = carregarSkills(join(process.cwd(), 'config', 'skills.json'), process.cwd());
  const resposta = await tratarMensagem(123, 'crie um video explicativo curto sobre IA para professores', {
    fila,
    agora: () => 1000,
    defs,
    projetosDir: '/root/projetos',
    runner: RUNNERS.codex,
    perfil: { motor: 'codex', modelo: 'sonnet', esforco: 'low' },
    cwd: homedir(),
    logFile: join(dir, 'service.log'),
  });
  const jobs = fila.listar();
  console.log(JSON.stringify({
    resposta,
    total: jobs.length,
    tarefa: jobs[0]?.tarefa,
    fila: jobs[0]?.fila,
    status: jobs[0]?.status,
  }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
