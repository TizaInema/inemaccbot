import { parseComando, executar } from './comandos.js';
import { interpretar } from './interpret.js';
import { responderPergunta } from './answer.js';
import type { SkillDef } from '../dominio/registry.js';
import type { FluxoRegistrado } from '../dominio/registry-fluxos.js';
import type { Fluxos } from '../fluxos/runtime.js';
import type { Agora, Perfil } from '../fila/types.js';
import type { FilaSqlite } from '../fila/store.js';
import type { Runner } from '../fila/runner.js';
export interface DepsMensagem {
  fila:FilaSqlite;agora:Agora;defs:SkillDef[];projetosDir:string;runner:Runner;perfil:Perfil;cwd:string;logFile:string;
  redigir?:(s:string)=>string; areas?:{rotulo:string;caminho:string;doBot:boolean}[];
  raizArtefatos?:string;publicoDir?:string;fluxos?:Fluxos;fluxosRegistrados?:FluxoRegistrado[];
}
export async function tratarMensagem(chatId:number,texto:string,deps:DepsMensagem):Promise<string> {
  const redigir=deps.redigir ?? ((s:string)=>s);
  if(/^\/(start|help)(?:\s|$)/i.test(texto)) texto='/ajuda';
  if(texto.trim()==='/fluxos') return 'Fluxos promocionais indisponíveis nesta recuperação: faltam os projetos e contratos de execução originais. As tarefas individuais estão em /skills.';
  const flow=deps.fluxosRegistrados?.find(f=>texto.trim().startsWith('/'+f.command));
  if(flow) return `O fluxo ${flow.command} depende do projeto ${flow.repo}, ainda não recuperado. Nenhuma tarefa foi iniciada.`;
  const cmd=parseComando(texto,deps.defs,deps.projetosDir);
  if(['status','cancelar','furar','refazer'].includes(cmd.tipo)&&'id' in cmd) {
    const j=deps.fila.obter(cmd.id);
    if(j && j.chat_id!==chatId) return 'id não existe neste chat.';
  }
  if(cmd.tipo==='livre') {
    const interpretation=await interpretar(texto,{...deps,timeoutMs:90_000});
    if(interpretation.tipo==='recusa') return redigir(interpretation.motivo);
    if(interpretation.tipo==='pergunta') {
      // Logs globais não entram em contexto de chat; podem conter dados de outros usuários.
      return redigir(await responderPergunta(interpretation.pergunta,{
        jobsDoChat:deps.fila.listar({chat_id:chatId,limite:100}),cauda:'Consulte /fila e /status para detalhes.',defs:deps.defs,agora:deps.agora(),
      },{...deps,cwd:deps.raizArtefatos ?? deps.cwd}));
    }
    const replies=interpretation.pedidos.map(p=>executar({tipo:'skill',pedido:p},{...deps,chatId,perfilPadrao:deps.perfil}));
    if(interpretation.ignorado) replies.push(`Não atendido: ${interpretation.ignorado}`);
    return redigir(replies.join('\n'));
  }
  // O painel usa uma visão limitada ao chat, inclusive contagens e resultados.
  const scoped=Object.create(deps.fila) as FilaSqlite;
  scoped.listar=(opts={})=>deps.fila.listar({...opts,chat_id:chatId});
  return redigir(executar(cmd,{...deps,fila:scoped,chatId,perfilPadrao:deps.perfil}));
}
