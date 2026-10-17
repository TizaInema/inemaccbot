import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.env.INEMACCBOT_REPO ?? '/root/projetos/inemaccbot';
process.chdir(repo);

const { abrirDb } = await import(pathToFileURL(resolve(repo, 'dist/db/abrir.js')).href);
const { FilaSqlite } = await import(pathToFileURL(resolve(repo, 'dist/fila/store.js')).href);

const id = Number(process.argv[2]);
if (!Number.isInteger(id) || id <= 0) {
  throw new Error('uso: node reenqueue-job.mjs <job-id>');
}

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] ??= match[2];
}

const dbPath = process.env.QUEUE_DB ? resolve(process.env.QUEUE_DB) : resolve('inemaccbot.db');
const db = abrirDb(dbPath);
const agora = () => Math.floor(Date.now() / 1000);
const fila = new FilaSqlite(db, agora);

const antigo = fila.obter(id);
if (!antigo) throw new Error(`job ${id} nao existe`);
if (antigo.status === 'queued' || antigo.status === 'running') {
  throw new Error(`job ${id} ainda esta ${antigo.status}`);
}

const perfil = antigo.motor && antigo.modelo && antigo.esforco
  ? { motor: antigo.motor, modelo: antigo.modelo, esforco: antigo.esforco }
  : undefined;

const novo = fila.enfileirar({
  fila: antigo.fila,
  kind: antigo.kind,
  tarefa: antigo.tarefa,
  input: antigo.input,
  prioridade: antigo.prioridade ?? 0,
  max_tentativas: antigo.max_tentativas,
  chat_id: antigo.chat_id ?? undefined,
  perfil,
});

console.log(JSON.stringify({
  antigo: { id: antigo.id, status: antigo.status, tarefa: antigo.tarefa, input: JSON.parse(antigo.input) },
  novo: { id: novo.id, status: novo.status, fila: novo.fila, tarefa: novo.tarefa },
}, null, 2));

db.close();
