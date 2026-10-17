import { afterEach,beforeEach,describe,it,expect } from 'vitest';
import { abrirDb } from '../db/abrir.js';
import { aplicarMigrations } from '../db/migrations.js';
import { FilaSqlite } from './store.js';
let fila:FilaSqlite;let now:number;
beforeEach(()=>{now=100;const db=abrirDb(':memory:');aplicarMigrations(db,()=>now);fila=new FilaSqlite(db,()=>now);});
afterEach(()=>fila.db.close());
const novo=()=>({fila:'io' as const,kind:'function' as const,tarefa:'test',input:'{}',chat_id:1});
describe('fila durável e posse de tarefas',()=>{
  it('dois workers não reclamam o mesmo job',()=>{
    fila.enfileirar(novo());expect(fila.reclamar('io','a',10)?.id).toBe(1);expect(fila.reclamar('io','b',10)).toBeUndefined();
  });
  it('lease expirado não permite renovação nem conclusão e é recuperado',()=>{
    fila.enfileirar(novo());fila.reclamar('io','a',10);now=111;
    expect(fila.concluir(1,'a','velho')).toBe(false);expect(fila.renovar(1,'a',10)).toBe(false);
    expect(fila.recuperarLeasesVencidos().requeued).toBe(1);
    fila.reclamar('io','b',10);expect(fila.concluir(1,'a','velho')).toBe(false);expect(fila.concluir(1,'b','novo')).toBe(true);
  });
  it('tentativas esgotadas viram falha terminal e ficam pendentes de notificação',()=>{
    fila.enfileirar({...novo(),max_tentativas:1});fila.reclamar('io','a',10);now=111;
    expect(fila.recuperarLeasesVencidos().falhados).toHaveLength(1);
    expect(fila.pendentesDeNotificacao()).toHaveLength(1);fila.marcarNotificado(1);expect(fila.pendentesDeNotificacao()).toEqual([]);
  });
  it('idempotência e cancelamento não duplicam nem reativam o job',()=>{
    fila.enfileirar({...novo(),idem_key:'x'});expect(fila.enfileirar({...novo(),idem_key:'x'}).id).toBe(1);
    fila.reclamar('io','a',10);expect(fila.cancelar(1)).toBe(true);expect(fila.concluir(1,'a','x')).toBe(false);
  });
  it('erro no avanço transacional desfaz a conclusão',()=>{
    fila.enfileirar(novo());fila.reclamar('io','a',10);
    expect(()=>fila.concluir(1,'a','x',()=>{throw new Error('avançar falhou');})).toThrow();expect(fila.obter(1)?.status).toBe('running');
  });
  it('backoff impede retentativa imediata',()=>{
    fila.enfileirar(novo());fila.reclamar('io','a',10);fila.falhar(1,'a','rede');
    expect(fila.reclamar('io','b',10)).toBeUndefined();now=121;expect(fila.reclamar('io','b',10)?.tentativas).toBe(2);
  });
});
