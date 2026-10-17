import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import type { Agora, Fila, Job } from './types.js';
import type { FilaSqlite } from './store.js';
import type { Execucao, Runner } from './runner.js';
import { artefatoPronto, type PromptJob } from './skills.js';
export type Tarefa=(input:string,signal?:AbortSignal)=>Promise<string>;
interface OpcoesWorker {fila:Fila;dono:string;concorrencia:number;leaseSegundos:number;
  tarefas:Record<string,Tarefa>;runners:Record<string,Runner>;promptDe:(job:Job)=>PromptJob;
  log:(s:string)=>void;aoTerminar?:(j:Job)=>Promise<void>;aoAckar?:(j:Job)=>void;redigir:(s:string)=>string;}
interface Ativo {job:Job;abort:AbortController;exec?:Execucao;saida?:string;promise:Promise<void>}
export class Worker {
  private ativos=new Map<number,Ativo>(); private parando=false;
  constructor(private fila:FilaSqlite,private opts:OpcoesWorker,private agora:Agora) {}
  async passo():Promise<boolean> {
    if(this.parando||this.ativos.size>=this.opts.concorrencia) return false;
    const job=this.fila.reclamar(this.opts.fila,this.opts.dono,this.opts.leaseSegundos);if(!job) return false;
    const active:Ativo={job,abort:new AbortController(),promise:Promise.resolve()};this.ativos.set(job.id,active);
    active.promise=this.executar(active);await active.promise;return true;
  }
  private async executar(active:Ativo):Promise<void> {
    const j=active.job;
    let acknowledged=false;
    try {
      this.opts.log(`[job ${j.id}] ${j.fila}/${j.tarefa} motor=${j.motor??'-'}`);
      let result:string;
      if(j.kind==='function') {
        const tarefa=this.opts.tarefas[j.tarefa];if(!tarefa) throw new Error('tarefa não registrada');
        result=await abortavel(tarefa(j.input,active.abort.signal),active.abort.signal);
      } else {
        const ctx=this.opts.promptDe(j);active.saida=ctx.saida;
        const runner=this.opts.runners[ctx.perfil.motor];if(!runner) throw new Error(`executor não disponível: ${ctx.perfil.motor}`);
        if(ctx.aguardaArtefato&&(artefatoPronto(ctx.saida)||renderVivo(ctx.saida))) {
          result=await esperarArtefato(ctx,active.abort.signal);
        } else {
          if(existsSync(ctx.saida+'.err')) throw new Error('render anterior falhou; revise o erro antes de refazer');
          active.exec=runner.iniciar(ctx);
          const output=(await abortavel(active.exec.aguardar(),active.abort.signal)).trim();
          const last=output.split(/\r?\n/).filter(Boolean).at(-1)??'';
          const contract=last.match(/^(RESULT|RENDER|ERRO):\s*(.*)$/);
          if(!contract) throw new Error('agente não devolveu RESULT:, RENDER: ou ERRO:');
          if(contract[1]==='ERRO') throw new Error('o agente reportou erro: '+contract[2]);
          const path=resolve(contract[2].trim());
          // Aceita somente o artefato do próprio job, nunca /etc, .env ou arquivos de outro job.
          if(path!==resolve(ctx.saida)) throw new Error('agente devolveu um caminho diferente do artefato reservado');
          if(!ctx.extensoes.includes(extname(path).slice(1))) throw new Error('extensão de artefato inválida');
          result=ctx.aguardaArtefato?await esperarArtefato(ctx,active.abort.signal):path;
          if(!artefatoPronto(result)) throw new Error('agente terminou sem criar o artefato');
        }
        const root=realpathSync(dirname(ctx.saida));
        if(!realpathSync(result).startsWith(root+sep)) throw new Error('artefato fora da raiz permitida');
      }
      if(active.abort.signal.aborted) return;
      acknowledged=this.fila.concluir(j.id,this.opts.dono,result,this.opts.aoAckar);
    } catch(e) {
      if(!active.abort.signal.aborted) {
        const message=this.opts.redigir(e instanceof Error?e.message:String(e)).slice(0,3000);
        acknowledged=this.fila.falhar(j.id,this.opts.dono,message,this.opts.aoAckar);
        this.opts.log(`[job ${j.id}] ${this.fila.obter(j.id)?.status}: ${message}`);
      }
    } finally {
      try {await active.exec?.limpar();} catch(e){this.opts.log(`limpeza j${j.id}: ${String(e)}`);}
      this.ativos.delete(j.id);
    }
    const final=this.fila.obter(j.id);
    if(acknowledged&&final&&['done','failed'].includes(final.status)) try {
      await this.opts.aoTerminar?.(final);this.fila.marcarNotificado(j.id);
    } catch(e) {this.opts.log(this.opts.redigir(`notificação pendente j${j.id}: ${String(e)}`));}
  }
  async bater():Promise<void> {
    for(const [id,a] of this.ativos) if(!this.fila.renovar(id,this.opts.dono,this.opts.leaseSegundos)) {
      a.abort.abort();await a.exec?.cancelar();
      // Apenas cancelamento explícito mata render destacado; lease perdido pode ter novo dono.
      if(this.fila.obter(id)?.status==='canceled'&&a.saida) matarRender(a.saida);
    }
  }
  async drenar():Promise<void> {this.parando=true;await Promise.allSettled([...this.ativos.values()].map(a=>a.promise));}
  async abortar():Promise<void> {
    this.parando=true;
    for(const [id,a] of this.ativos) {a.abort.abort();await a.exec?.cancelar();if(a.saida)matarRender(a.saida);
      this.fila.falhar(id,this.opts.dono,'execução interrompida no desligamento',this.opts.aoAckar);}
    await Promise.allSettled([...this.ativos.values()].map(a=>a.promise));
  }
}
async function abortavel<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
  let cancelar:()=>void=()=>{};
  const cancelada=new Promise<never>((_ok,no)=>{cancelar=()=>no(new Error('execução cancelada'));signal.addEventListener('abort',cancelar,{once:true});if(signal.aborted)cancelar();});
  try{return await Promise.race([promise,cancelada]);}finally{signal.removeEventListener('abort',cancelar);}
}
function renderPid(path:string):number|undefined {
  try {const text=readFileSync(path+'.pid','utf8').trim();const pid=Number(text);return /^\d+$/.test(text)&&pid>1?pid:undefined;}catch{return;}
}
function renderVivo(path:string):boolean {
  const pid=renderPid(path);if(!pid)return false;
  try {process.kill(pid,0);if(process.platform==='linux'&&/\) Z /.test(readFileSync(`/proc/${pid}/stat`,'utf8')))return false;return true;}catch{return false;}
}
function matarRender(path:string):void {
  const pid=renderPid(path);if(pid) try {process.kill(-pid,'SIGKILL');}catch{/* finalizado */}
}
async function esperarArtefato(ctx:PromptJob,signal:AbortSignal):Promise<string> {
  const deadline=Date.now()+ctx.timeoutArtefatoMs;
  while(Date.now()<deadline) {
    if(signal.aborted) throw new Error('execução cancelada');
    if(existsSync(ctx.saida+'.err')) throw new Error('render falhou (marcador .err)');
    if(artefatoPronto(ctx.saida)&&!renderVivo(ctx.saida)) return ctx.saida;
    await new Promise<void>(r=>{const t=setTimeout(done,1000);function done(){clearTimeout(t);signal.removeEventListener('abort',done);r();}signal.addEventListener('abort',done,{once:true});});
  }
  matarRender(ctx.saida);throw new Error('timeout aguardando render');
}
