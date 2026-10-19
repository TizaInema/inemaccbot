// Runner do motor `codex`. Usa `--output-last-message` para devolver ao worker
// somente a resposta final do agente, sem eco de prompt/metadados do CLI.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter, isAbsolute } from 'node:path';
import { ehNivel, nivel } from '../modelos.js';

import { RUNNERS, type ContextoExecucao, type Execucao, type Runner } from './runner.js';
import { LIMITE_SAIDA_BYTES } from './runner-claude.js';

class Buffer_ {
  texto = '';
  truncou = false;
  constructor(private readonly limite: number) {}
  add(pedaco: string): void {
    if (this.texto.length >= this.limite) { this.truncou = true; return; }
    const cabe = this.limite - this.texto.length;
    if (pedaco.length > cabe) { this.truncou = true; this.texto += pedaco.slice(0, cabe); }
    else this.texto += pedaco;
  }
}

export function promptCodex(ctx: ContextoExecucao): string {
  return [
    'Voce esta rodando dentro de um worker automatico do inemaccbot.',
    'Nao ha operador para confirmar comandos; resolva de ponta a ponta.',
    'Se o prompt mencionar uma skill, leia primeiro /root/.claude/skills/<nome>/SKILL.md',
    'ou .claude/skills/<nome>/SKILL.md no cwd, se existir, e siga os arquivos diretamente referenciados.',
    'Nao instale, atualize, remova pacotes nem altere credenciais persistentes.',
    'Se faltar ferramenta, credencial ou skill, responda ERRO: <motivo curto>.',
    'Na resposta final, devolva apenas a linha de contrato pedida: RENDER:, RESULT: ou ERRO:.',
    '',
    ctx.prompt,
  ].join('\n');
}

export function mapaModelos(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return Object.fromEntries((env.CODEX_MODELOS ?? '').split(',').map(s=>s.split('=').map(x=>x.trim())).filter(p=>p.length===2&&p[0]&&p[1]));
}
export const esforcoCodex = (e:string):string => e==='xhigh'||e==='max'?'high':e;
export function argumentosCodex(ctx: ContextoExecucao, mapaOuArquivo: Record<string,string>|string = mapaModelos()): string[] {
  const outputFile=typeof mapaOuArquivo==='string'?mapaOuArquivo:undefined;
  const mapa=typeof mapaOuArquivo==='string'?mapaModelos():mapaOuArquivo;
  const modelo=mapa[ctx.perfil.modelo] ?? (ehNivel(ctx.perfil.modelo)?nivel('codex',ctx.perfil.modelo).modelo:undefined);
  const roots=(process.env.INEMACCBOT_WRITE_DIRS??'').split(delimiter).filter(p=>p&&isAbsolute(p));
  return [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'workspace-write',
    '-c', 'sandbox_workspace_write.network_access=true',
    ...roots.flatMap(path=>['--add-dir',path]),
    ...(modelo?['--model',modelo]:[]),
    '-c', `model_reasoning_effort="${esforcoCodex(ctx.perfil.esforco)}"`,
    '--color', 'never',
    '-C', ctx.cwd,
    ...(outputFile?['--output-last-message', outputFile]:[]),
    ctx.prompt,
  ];
}

export interface OpcoesCodexRunner {
  binario?: string;
  montarArgs?: (ctx: ContextoExecucao, outputFile: string) => string[];
  limiteSaidaBytes?: number;
}

export class CodexRunner implements Runner {
  nome = 'codex';
  private readonly binario: string;
  private readonly montarArgs: (ctx: ContextoExecucao, outputFile: string) => string[];
  private readonly limiteSaida: number;

  constructor(opts: OpcoesCodexRunner | string = {}) {
    const o = typeof opts === 'string' ? { binario: opts } : opts;
    this.binario = o.binario ?? 'codex';
    this.montarArgs = o.montarArgs ?? ((ctx,output)=>argumentosCodex({...ctx,prompt:promptCodex(ctx)},output));
    this.limiteSaida = o.limiteSaidaBytes ?? LIMITE_SAIDA_BYTES;
  }

  iniciar(ctx: ContextoExecucao): Execucao {
    const tmp = mkdtempSync(join(tmpdir(), 'inemaccbot-codex-'));
    const outputFile = join(tmp, 'last-message.txt');
    const filho = spawn(this.binario, this.montarArgs(ctx, outputFile), {
      cwd: ctx.cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...ctx.vars },
    });

    let cancelado = false;
    let expirou = false;
    const stdout = new Buffer_(this.limiteSaida);
    const stderr = new Buffer_(this.limiteSaida);
    let marcarFechado: () => void;
    const fechado = new Promise<void>((r) => { marcarFechado = r; });
    filho.stdout?.on('data', (d) => stdout.add(String(d)));
    filho.stderr?.on('data', (d) => stderr.add(String(d)));

    const matarArvore = (sinal: NodeJS.Signals): void => {
      if (filho.pid === undefined) return;
      try { process.kill(-filho.pid, sinal); } catch { /* ja morreu */ }
    };

    let relogioTimeout: NodeJS.Timeout | undefined;
    const timeoutMs = ctx.timeoutMs;
    if (timeoutMs !== undefined && timeoutMs > 0) {
      relogioTimeout = setTimeout(() => {
        expirou = true;
        matarArvore('SIGKILL');
      }, timeoutMs);
      relogioTimeout.unref?.();
    }

    const promessa = new Promise<string>((resolve, reject) => {
      filho.on('error', (e) => { clearTimeout(relogioTimeout); reject(e); });
      filho.on('close', (code) => {
        clearTimeout(relogioTimeout);
        marcarFechado();
        if (expirou) {
          return reject(new Error(`${this.binario}: timeout de ${Math.round((timeoutMs ?? 0) / 1000)}s - execucao encerrada`));
        }
        if (cancelado) return reject(new Error('execucao cancelada'));
        if (code === 0) {
          try {
            return resolve(readFileSync(outputFile, 'utf8').trim());
          } catch {
            return reject(new Error(`${this.binario} terminou sem gravar a mensagem final`));
          }
        }
        const cauda = [stderr.texto.trim(), stdout.texto.trim()].filter(Boolean).join('\n').slice(-1200);
        reject(new Error(`${this.binario} saiu com codigo ${code}: ${cauda}`));
      });
    });
    promessa.catch(() => {});

    return {
      aguardar: () => promessa,
      cancelar: async () => {
        cancelado = true;
        clearTimeout(relogioTimeout);
        matarArvore('SIGTERM');
        let relogio: NodeJS.Timeout | undefined;
        const prazo = new Promise<'prazo'>((r) => {
          relogio = setTimeout(() => r('prazo'), 2_000);
        });
        const quem = await Promise.race([fechado.then(() => 'fechou' as const), prazo]);
        clearTimeout(relogio);
        if (quem === 'prazo') matarArvore('SIGKILL');
      },
      limpar: async () => { rmSync(tmp, { recursive: true, force: true }); },
    };
  }
}

RUNNERS.codex = new CodexRunner();
