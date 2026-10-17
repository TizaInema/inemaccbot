import type { Transporte } from './telegram.js';
import type { Job } from '../fila/types.js';
import { planejarEntrega, type OpcoesEntrega } from './entrega.js';
export function criarNotificador(transporte:Transporte,opts:{
  redigir?:(s:string)=>string;log?:(s:string)=>void;temArtefato?:(j:Job)=>boolean;entregaDe?:(j:Job)=>OpcoesEntrega;
}={}):(j:Job)=>Promise<void> {
  return async job=> {
    if(!['done','failed'].includes(job.status)) return;
    const redigir=opts.redigir ?? ((s:string)=>s);
    let text=job.status==='done'?`✅ Job j${job.id} concluído.`:`❌ Job j${job.id}: ${(job.erro ?? 'falha sem detalhe').slice(0,2500)}`;
    let anexo:string|undefined;
    if(job.status==='done'&&job.resultado) {
      if(opts.temArtefato?.(job)) { const entrega=planejarEntrega(job.resultado,opts.entregaDe?.(job));text+='\n'+entrega.mensagem;anexo=entrega.anexo; }
      else text+='\n'+job.resultado.slice(0,2500);
    }
    if(job.chat_id===null) return;
    // Inclui o caminho antes do envio: permite recuperar um anexo cuja rede falhou.
    if(anexo) text+='\nArquivo: '+anexo;
    await transporte.responder(job.chat_id,redigir(text));
    if(anexo && transporte.enviarDocumento) try {await transporte.enviarDocumento(job.chat_id,anexo);}catch(e){opts.log?.(redigir(`anexo não enviado: ${String(e)}`));}
  };
}
