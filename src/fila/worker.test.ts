import { afterEach,beforeEach,describe,it,expect } from 'vitest';
import { abrirDb } from '../db/abrir.js';
import { aplicarMigrations } from '../db/migrations.js';
import { FilaSqlite } from './store.js';
import { Worker,type Tarefa } from './worker.js';
let fila:FilaSqlite;let now:number;let notices:number[];
beforeEach(()=>{now=100;notices=[];const db=abrirDb(':memory:');aplicarMigrations(db,()=>now);fila=new FilaSqlite(db,()=>now);});
afterEach(()=>fila.db.close());
function worker(tarefas:Record<string,Tarefa>) {return new Worker(fila,{
  fila:'io',dono:'a',concorrencia:1,leaseSegundos:10,tarefas,runners:{},promptDe:()=>{throw new Error('unexpected');},
  log:()=>{},redigir:s=>s,aoTerminar:async j=>{notices.push(j.id);},
},()=>now);}
const novo=()=>fila.enfileirar({fila:'io',kind:'function',tarefa:'test',input:'{}',chat_id:1});
describe('execução e interrupções',()=>{
  it('persiste o resultado antes de notificar',async()=>{
    novo();const w=worker({test:async()=>'resultado'});expect(await w.passo()).toBe(true);
    expect(fila.obter(1)?.status).toBe('done');expect(fila.obter(1)?.resultado).toBe('resultado');expect(notices).toEqual([1]);
  });
  it('cancelar libera trabalho e não permite conclusão tardia',async()=>{
    novo();let finish!:(s:string)=>void;const w=worker({test:()=>new Promise(r=>{finish=r;})});
    const run=w.passo();fila.cancelar(1);await w.bater();await run;finish('tarde');
    expect(fila.obter(1)?.status).toBe('canceled');expect(notices).toEqual([]);
  });
  it('worker que perde a posse não confirma o trabalho',async()=>{
    novo();const w=worker({test:()=>new Promise(()=>{})});const run=w.passo();
    now=111;fila.recuperarLeasesVencidos();fila.reclamar('io','b',10);await w.bater();await run;
    expect(fila.obter(1)?.lease_owner).toBe('b');expect(notices).toEqual([]);
  });
  it('dreno forçado termina mesmo se uma tarefa não coopera',async()=>{
    novo();const w=worker({test:()=>new Promise(()=>{})});const run=w.passo();await w.abortar();await run;
    expect(fila.obter(1)?.status).toBe('queued');expect(await w.passo()).toBe(false);
  });
});
