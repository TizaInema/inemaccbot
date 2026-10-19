import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarCpuMedia, promptCpuMedia } from './cpu-media.js';
let dir:string;
beforeEach(() => { dir=mkdtempSync(join(tmpdir(),'inemaccbot-cpu-')); });
afterEach(() => rmSync(dir,{recursive:true,force:true}));
describe('render controlado pelo bot', () => {
  it('recusa um RENDER anunciado sem roteiro e não dispara processo', () => {
    const disparar=vi.fn();
    expect(() => iniciarCpuMedia(dir,'explicativo',join(dir,'out.mp4'),false,disparar)).toThrow(/não gravou/);
    expect(disparar).not.toHaveBeenCalled();
  });
  it('recusa JSON inválido antes de abrir a espera de arquivo', () => {
    const saida=join(dir,'out.mp4'); writeFileSync(saida+'.spec.json','{invalido');
    expect(() => iniciarCpuMedia(dir,'explicativo',saida,false,vi.fn())).toThrow(/JSON válido/);
  });
  it('inicia o backend e cria os contratos de PID e erro após receber o roteiro', () => {
    const saida=join(dir,'out.mp4'); writeFileSync(saida+'.spec.json','{"scenes":[{"title":"Teste","narration":"Olá"}]}');
    const disparar=vi.fn(); iniciarCpuMedia(dir,'explicativo',saida,true,disparar);
    expect(disparar).toHaveBeenCalledOnce();
    const call=disparar.mock.calls[0]![0];
    expect(call.comando).toContain('run-media-job.py');
    expect(call.comando).toContain('echo $$');
    expect(call.comando).toContain('.pid'); expect(call.comando).toContain('.err');
    expect(call.comando).toContain('--vertical');
  });
  it('o agente recebe tarefa de gravar JSON; o worker inicia o render', () => {
    const prompt=promptCpuMedia('explicativo','Assunto',{vertical:'sim'},'/saida.mp4');
    expect(prompt).toContain('/saida.mp4.spec.json');
    expect(prompt).toContain('NÃO execute render');
    expect(prompt).toContain('RENDER: /saida.mp4');
  });
});
