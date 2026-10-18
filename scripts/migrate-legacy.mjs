import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { aplicarMigrations } from '../dist/db/migrations.js';

export function migrar(origem, destino) {
  if (resolve(origem) === resolve(destino) || existsSync(destino)) throw new Error('Destino deve ser um banco novo e separado.');
  const old = new Database(origem, { readonly: true, fileMustExist: true });
  const tabelas = old.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  if (tabelas.includes('flows') && old.prepare('SELECT count(*) AS n FROM flows').get().n)
    throw new Error('Há fluxos legados; migração automática interrompida sem alterar origem.');
  const rows = old.prepare('SELECT * FROM jobs ORDER BY id').all();
  if (rows.some(r => r.status === 'running')) throw new Error('Aguarde os jobs ativos antes de migrar.');
  const fresh = new Database(destino);
  try {
    aplicarMigrations(fresh, () => Math.floor(Date.now() / 1000));
    const columns = new Set(fresh.prepare('PRAGMA table_info(jobs)').all().map(r => r.name));
    fresh.transaction(() => {
      for (const row of rows) {
        const data = Object.fromEntries(Object.entries(row).filter(([k]) => columns.has(k)));
        if (data.fila === 'chrome') data.fila = 'navegador';
        if (data.status === 'queued' && ['transcrever', 'dublar'].includes(data.tarefa)) {
          data.kind = 'function'; data.motor = data.modelo = data.esforco = null;
        }
        if (!['queued', 'running'].includes(data.status)) data.notificado_em ??= data.terminado_em ?? data.criado_em;
        const keys = Object.keys(data);
        fresh.prepare(`INSERT INTO jobs (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(data));
      }
    })();
    if (fresh.prepare('SELECT count(*) AS n FROM jobs').get().n !== rows.length) throw new Error('Contagem divergente.');
    if (fresh.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Falha na integridade do banco.');
    return { jobs: rows.length, integridade: 'ok' };
  } finally { old.close(); fresh.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error('Uso: node scripts/migrate-legacy.mjs origem.db novo.db');
  console.log(JSON.stringify(migrar(process.argv[2], process.argv[3])));
}
