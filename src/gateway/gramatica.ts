import type { SkillDef } from '../dominio/registry.js';
import type { Perfil } from '../fila/types.js';
import { ehTokenDestino, resolverDestino, listarDestinos } from '../dominio/destinos.js';
export interface PedidoSkill {command:string;entrada:string;destino?:string;destinoToken?:string;perfil?:Partial<Perfil>;campos?:Record<string,string>}
export function analisar(texto:string,defs:SkillDef[],projetos:string):{tipo:'skill';pedido:PedidoSkill}|{tipo:'livre';texto:string}|{tipo:'erro';mensagem:string} {
  const match=texto.match(/^([a-z][\w-]*)\s*:\s*([\s\S]*)$/i);
  if(!match) return {tipo:'livre',texto};
  const def=defs.find(d=>d.command===match[1].toLowerCase());
  if(!def) return {tipo:'erro',mensagem:'skill não registrada. Veja /skills.'};
  const [entrada,...options]=match[2].split('|').map(s=>s.trim());
  if(!entrada) return {tipo:'erro',mensagem:'faltou a entrada da skill'};
  const pedido:PedidoSkill={command:def.command,entrada,campos:{}};
  for(const opt of options) {
    if(ehTokenDestino(opt)) {
      const dest=resolverDestino(opt,projetos);
      if(!def.aceita_destino||!dest) return {tipo:'erro',mensagem:`destino não permitido ou inexistente. Válidos: ${listarDestinos(projetos).join(', ')}`};
      pedido.destino=dest;pedido.destinoToken=opt;continue;
    }
    const [nome,...rest]=opt.split(/\s*=\s*|\s+/); const value=rest.join(' ');
    if(['motor','modelo','esforco'].includes(nome)) { pedido.perfil??={}; pedido.perfil[nome as keyof Perfil]=value; continue; }
    const campo=def.campos[nome];
    if(!campo) return {tipo:'erro',mensagem:`campo desconhecido: ${nome}`};
    pedido.campos![nome]=value||(campo.tipo==='bandeira'?'sim':'');
  }
  return {tipo:'skill',pedido};
}
export const textoSkills=(defs:SkillDef[]):string=>defs.map(d=>`${d.command}: ${d.descricao}\nEx.: ${d.exemplo}`).join('\n\n');
