import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { argumentosCodex, CodexRunner, promptCodex } from './runner-codex.js';
import { RUNNERS } from './runner.js';

const ctx = () => ({
  prompt: 'faça X\nRESULT: /tmp/instrucao.txt',
  cwd: '/tmp',
  perfil: { motor: 'codex', modelo: 'sonnet', esforco: 'low' },
  vars: {},
});

const criados: string[] = [];
afterEach(() => {
  for (const f of criados.splice(0)) rmSync(f, { recursive: true, force: true });
});

describe('argumentosCodex', () => {
  it('usa output-last-message e nao traduz alias do Claude como modelo do Codex', () => {
    const args = argumentosCodex(ctx(), '/tmp/out.txt');
    expect(args).toContain('exec');
    expect(args).toContain('--output-last-message');
    expect(args).toContain('/tmp/out.txt');
    expect(args).toContain('-C');
    expect(args).toContain('/tmp');
    expect(args).not.toContain('sonnet');
    expect(args.at(-1)).toContain('faça X');
  });

  it('prepara o prompt para execucao autonoma e contrato final', () => {
    const prompt = promptCodex(ctx());
    expect(prompt).toContain('worker automatico');
    expect(prompt).toContain('RENDER:, RESULT: ou ERRO:');
    expect(prompt).toContain('faça X');
  });
});

describe('registro de motores', () => {
  it('registra "codex" em RUNNERS', () => {
    expect(RUNNERS.codex).toBeInstanceOf(CodexRunner);
    expect(RUNNERS.codex.nome).toBe('codex');
  });
});

describe('execucao real de subprocesso', () => {
  it('devolve somente o arquivo de mensagem final, nao stdout', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'inemaccbot-codex-test-'));
    criados.push(tmp);
    const r = new CodexRunner({
      binario: process.execPath,
      montarArgs: (_ctx, outputFile) => [
        '-e',
        [
          'const fs = require("node:fs");',
          'console.log("RESULT: /tmp/eco-do-prompt.txt");',
          `fs.writeFileSync(${JSON.stringify(outputFile)}, "RESULT: /tmp/final.txt");`,
        ].join(''),
      ],
    });
    const saida = await r.iniciar({ ...ctx(), cwd: tmp }).aguardar();
    expect(saida).toBe('RESULT: /tmp/final.txt');
  });
});
