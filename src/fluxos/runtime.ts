import type { Job, Perfil, Agora } from '../fila/types.js';
import type { FilaSqlite } from '../fila/store.js';
import type { EstadoFluxos } from './estado.js';
// Os contratos dos projetos promocionais não sobreviveram ao backup.
// Recusamos ativação/avanço, em vez de simular fases ou inventar resultados.
export class Fluxos {
  constructor(private deps:{fila:FilaSqlite;estado:EstadoFluxos;agora:Agora;log:(s:string)=>void;
    raizArtefatos:string;projetosDir:string;aoEvento:(e:{chatId:number;texto:string})=>void;
    repoDe:(tipo:string)=>string|undefined;publicar:(origem:string,titulo:string,tipo:string)=>unknown;perfilPadrao:Perfil}) {}
  reenfileirarOrfas():void {
    const ativos=this.deps.estado.db.prepare("SELECT count(*) AS n FROM flows WHERE estado NOT IN ('done','failed','canceled')").get();
    if(Number(ativos?.n)>0) throw new Error('Existem fluxos pendentes; recupere o motor original antes de iniciá-los');
  }
  avancar(job:Job):void {if(job.flow_ref) throw new Error('Motor de fluxos promocionais ainda não recuperado');}
}
