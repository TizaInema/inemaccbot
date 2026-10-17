export type Agora = () => number;
export type Fila = 'io' | 'cpu' | 'texto' | 'render' | 'chrome';
export interface Perfil { motor: string; modelo: string; esforco: string }
export interface Job {
  id: number; fila: Fila; kind: 'agent' | 'function'; tarefa: string; input: string;
  prioridade: number; status: 'queued' | 'running' | 'done' | 'failed' | 'canceled';
  tentativas: number; max_tentativas: number; lease_ate: number | null; lease_owner: string | null;
  disponivel_em: number; idem_key: string | null; flow_ref: string | null; chat_id: number | null;
  motor: string | null; modelo: string | null; esforco: string | null;
  resultado: string | null; erro: string | null; notificado_em: number | null;
  criado_em: number; iniciado_em: number | null; terminado_em: number | null;
}
export interface NovoJob {
  fila: Fila; kind: Job['kind']; tarefa: string; input: string; prioridade?: number;
  max_tentativas?: number; chat_id?: number | null; perfil?: Perfil;
  idem_key?: string; flow_ref?: string; disponivel_em?: number;
}
