import type { Perfil } from './types.js';
export interface ContextoExecucao { prompt: string; cwd: string; perfil: Perfil; vars: Record<string,string>; timeoutMs?: number }
export interface Execucao { aguardar(): Promise<string>; cancelar(): Promise<void>; limpar(): Promise<void> }
export interface Runner { nome: string; iniciar(ctx: ContextoExecucao): Execucao }
export const RUNNERS: Record<string,Runner> = {};
export class FakeRunner implements Runner {
  nome='fake'; chamadas:ContextoExecucao[]=[];
  constructor(private opts:{respostas:string[]}) {}
  iniciar(ctx:ContextoExecucao):Execucao {
    this.chamadas.push(ctx); const resposta=this.opts.respostas.shift() ?? '';
    return {aguardar:async()=>resposta,cancelar:async()=>{},limpar:async()=>{}};
  }
}
