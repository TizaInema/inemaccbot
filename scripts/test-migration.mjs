import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrar } from './migrate-legacy.mjs';

test('preserva origem, histórico e IDs; converte somente tarefas pendentes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inemaccbot-upgrade-'));
  try {
    const path = join(dir, 'old.db'), target = join(dir, 'new.db');
    const db = new Database(path);
    db.exec(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, fila TEXT, kind TEXT, tarefa TEXT, input TEXT, status TEXT, criado_em INTEGER, terminado_em INTEGER, chat_id INTEGER, motor TEXT, modelo TEXT, esforco TEXT);
      CREATE TABLE flows(id INTEGER PRIMARY KEY);
      INSERT INTO jobs VALUES (7,'texto','agent','transcrever','{}','queued',100,NULL,42,'codex','sonnet','low');
      INSERT INTO jobs VALUES (9,'texto','agent','dublar','{}','done',100,200,42,'codex','sonnet','low');`);
    db.close();
    assert.deepEqual(migrar(path, target), {jobs:2, integridade:'ok'});
    const migrated = new Database(target, {readonly:true});
    const pending = migrated.prepare('SELECT * FROM jobs WHERE id=7').get();
    assert.equal(pending.kind, 'function'); assert.equal(pending.motor, null); assert.equal(pending.chat_id, 42);
    const done = migrated.prepare('SELECT * FROM jobs WHERE id=9').get();
    assert.equal(done.kind, 'agent'); assert.equal(done.notificado_em, 200);
    migrated.close();
    const original = new Database(path, {readonly:true});
    assert.equal(original.prepare('SELECT kind FROM jobs WHERE id=7').get().kind, 'agent');
    original.close();
    assert.throws(() => migrar(path, target), /banco novo/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
