import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Agora, Fila, Job, NovoJob } from './types.js';
export class FilaSqlite {
  constructor(readonly db: DatabaseSync, private readonly agora: Agora) {}
  obter(id: number): Job | undefined { return this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as unknown as Job | undefined; }
  listar(opts: { fila?: Fila; chat_id?: number; desde?: number; limite?: number } = {}): Job[] {
    const where: string[] = []; const args: SQLInputValue[] = [];
    if (opts.fila) { where.push('fila=?'); args.push(opts.fila); }
    if (opts.chat_id !== undefined) { where.push('chat_id=?'); args.push(opts.chat_id); }
    if (opts.desde !== undefined) { where.push('criado_em>=?'); args.push(opts.desde); }
    args.push(Math.min(opts.limite ?? 500, 5000));
    return (this.db.prepare(`SELECT * FROM jobs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`).all(...args) as unknown as Job[]).reverse();
  }
  enfileirar(j: NovoJob): Job {
    if (j.idem_key) { const old = this.db.prepare('SELECT * FROM jobs WHERE idem_key=?').get(j.idem_key); if (old) return old as unknown as Job; }
    const r = this.db.prepare(`INSERT INTO jobs(fila,kind,tarefa,input,prioridade,max_tentativas,chat_id,motor,modelo,esforco,idem_key,flow_ref,disponivel_em,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      j.fila,j.kind,j.tarefa,j.input,j.prioridade ?? 0,j.max_tentativas ?? 3,j.chat_id ?? null,
      j.perfil?.motor ?? null,j.perfil?.modelo ?? null,j.perfil?.esforco ?? null,j.idem_key ?? null,j.flow_ref ?? null,j.disponivel_em ?? this.agora(),this.agora());
    return this.obter(Number(r.lastInsertRowid))!;
  }
  reclamar(fila: Fila, dono: string, lease: number): Job | undefined {
    return this.db.prepare(`UPDATE jobs SET status='running',tentativas=tentativas+1,lease_owner=?,lease_ate=?,iniciado_em=COALESCE(iniciado_em,?) WHERE id=(SELECT id FROM jobs WHERE fila=? AND status='queued' AND disponivel_em<=? ORDER BY prioridade DESC,id LIMIT 1) RETURNING *`).get(dono,this.agora()+lease,this.agora(),fila,this.agora()) as unknown as Job | undefined;
  }
  renovar(id: number, dono: string, lease: number): boolean {
    return Number(this.db.prepare("UPDATE jobs SET lease_ate=? WHERE id=? AND lease_owner=? AND status='running' AND lease_ate>?").run(this.agora()+lease,id,dono,this.agora()).changes)>0;
  }
  concluir(id: number, dono: string, resultado: string, aoAckar?: (j: Job) => void): boolean {
    return this.ack(id,dono,'done',resultado,null,aoAckar);
  }
  private ack(id: number,dono: string,status: Job['status'],resultado: string|null,erro: string|null, hook?: (j: Job)=>void): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const j = this.db.prepare(`UPDATE jobs SET status=?,resultado=?,erro=?,terminado_em=?,lease_owner=NULL,lease_ate=NULL WHERE id=? AND status='running' AND lease_owner=? AND lease_ate>? RETURNING *`).get(status,resultado,erro,this.agora(),id,dono,this.agora()) as unknown as Job | undefined;
      if (j) hook?.(j);
      this.db.exec('COMMIT'); return !!j;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  falhar(id: number,dono: string,erro: string,hook?: (j: Job)=>void): boolean {
    const j=this.obter(id); if (!j) return false;
    if (j.tentativas>=j.max_tentativas) return this.ack(id,dono,'failed',null,erro,hook);
    return Number(this.db.prepare("UPDATE jobs SET status='queued',erro=?,disponivel_em=?,lease_owner=NULL,lease_ate=NULL WHERE id=? AND status='running' AND lease_owner=? AND lease_ate>?").run(erro,this.agora()+Math.min(300,20*2**(j.tentativas-1)),id,dono,this.agora()).changes)>0;
  }
  cancelar(id:number):boolean { return Number(this.db.prepare("UPDATE jobs SET status='canceled',terminado_em=?,lease_owner=NULL,lease_ate=NULL WHERE id=? AND status IN ('queued','running')").run(this.agora(),id).changes)>0; }
  priorizar(id:number,p:number):boolean { return Number(this.db.prepare("UPDATE jobs SET prioridade=? WHERE id=? AND status='queued'").run(p,id).changes)>0; }
  recuperarLeasesVencidos(): {requeued:number;falhados:Job[]} {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const falhados = this.db.prepare("UPDATE jobs SET status='failed',erro='lease expirado: limite de tentativas atingido',terminado_em=?,lease_owner=NULL,lease_ate=NULL WHERE status='running' AND lease_ate<=? AND tentativas>=max_tentativas RETURNING *").all(this.agora(),this.agora()) as unknown as Job[];
      const r=this.db.prepare("UPDATE jobs SET status='queued',erro='lease expirado: tarefa recuperada',disponivel_em=?,lease_owner=NULL,lease_ate=NULL WHERE status='running' AND lease_ate<=?").run(this.agora(),this.agora());
      this.db.exec('COMMIT'); return {requeued:Number(r.changes),falhados};
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  pendentesDeNotificacao():Job[] { return this.db.prepare("SELECT * FROM jobs WHERE status IN ('done','failed') AND notificado_em IS NULL ORDER BY id LIMIT 100").all() as unknown as Job[]; }
  marcarNotificado(id:number):void { this.db.prepare('UPDATE jobs SET notificado_em=? WHERE id=?').run(this.agora(),id); }
}
