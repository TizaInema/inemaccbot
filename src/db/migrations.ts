import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Agora } from '../fila/types.js';
export const MIGRATIONS = [{ id: 1, sql: `
CREATE TABLE jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, fila TEXT NOT NULL, kind TEXT NOT NULL,
 tarefa TEXT NOT NULL, input TEXT NOT NULL, prioridade INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'queued', tentativas INTEGER NOT NULL DEFAULT 0,
 max_tentativas INTEGER NOT NULL DEFAULT 3, lease_ate INTEGER, lease_owner TEXT,
 disponivel_em INTEGER NOT NULL, idem_key TEXT UNIQUE, flow_ref TEXT, chat_id INTEGER,
 motor TEXT, modelo TEXT, esforco TEXT, resultado TEXT, erro TEXT, notificado_em INTEGER,
 criado_em INTEGER NOT NULL, iniciado_em INTEGER, terminado_em INTEGER
);
CREATE INDEX jobs_claim ON jobs(fila, status, disponivel_em, prioridade DESC, id);
CREATE INDEX jobs_notify ON jobs(status, notificado_em);
CREATE TABLE flows (id INTEGER PRIMARY KEY, tipo TEXT NOT NULL, chat_id INTEGER NOT NULL,
 estado TEXT NOT NULL, dados TEXT NOT NULL, criado_em INTEGER NOT NULL);
` }];
export function aplicarMigrations(db: DatabaseSync, agora: Agora, migrations = MIGRATIONS): void {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, checksum TEXT NOT NULL, aplicado_em INTEGER NOT NULL)');
  for (const migration of migrations) {
    const checksum = createHash('sha256').update(migration.sql).digest('hex');
    const saved = db.prepare('SELECT checksum FROM migrations WHERE id=?').get(migration.id);
    if (saved) { if (saved.checksum !== checksum) throw new Error(`checksum divergente na migration ${migration.id}`); continue; }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations VALUES (?,?,?)').run(migration.id, checksum, agora());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}
