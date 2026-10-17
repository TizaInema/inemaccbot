import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Job, Perfil } from './types.js';
import type { SkillDef } from '../dominio/registry.js';
import type { ContextoExecucao } from './runner.js';
import { resolverPerfil } from '../dominio/perfil.js';
export interface EntradaSkill {entrada:string;destino?:string;campos?:Record<string,string>;perfil?:Partial<Perfil>}
export interface PromptJob extends ContextoExecucao {saida:string;aguardaArtefato:boolean;timeoutArtefatoMs:number;extensoes:string[]}
export function parseEntradaSkill(text:string):EntradaSkill {
  const o=JSON.parse(text) as EntradaSkill;
  if(typeof o.entrada!=='string'||!o.entrada.trim()) throw new Error('entrada de skill inválida');
  return o;
}
export function criarPromptDe(opts:{defs:SkillDef[];raizRepo:string;raizArtefatos:string;cwd:string;log:(s:string)=>void;perfilPadrao:Perfil}):(job:Job)=>PromptJob {
  return job=> {
    const def=opts.defs.find(d=>d.command===job.tarefa);
    if(!def) throw new Error('skill não registrada');
    const input=parseEntradaSkill(job.input);
    const dir=join(opts.raizArtefatos,def.command);mkdirSync(dir,{recursive:true});
    const saida=resolve(dir,`${job.id}.${def.artefato_exts[0]}`);
    const campos=Object.fromEntries(Object.entries(def.campos).map(([n,c])=>[n,input.campos?.[n]??c.padrao]));
    const vars:Record<string,string>={...campos,input:input.entrada,saida};
    const template=readFileSync(join(opts.raizRepo,def.prompt),'utf8');
    const prompt=template.replace(/\{\{\s*(\w+)\s*\}\}/g,(_m,n:string)=>{if(!(n in vars)) throw new Error(`variável de prompt não declarada: ${n}`);return vars[n];});
    const perfil=resolverPerfil({padrao:opts.perfilPadrao,registry:def.perfil,override:job.motor&&job.modelo&&job.esforco?{motor:job.motor,modelo:job.modelo,esforco:job.esforco}:input.perfil}).perfil;
    return {prompt,cwd:dir,perfil,vars:{},saida,aguardaArtefato:!!def.aguarda_artefato,
      timeoutMs:(def.aguarda_artefato?(def.timeout_setup_segundos??Math.min(1800,def.timeout_segundos)):def.timeout_segundos)*1000,
      timeoutArtefatoMs:def.timeout_segundos*1000,extensoes:def.artefato_exts};
  };
}
export function artefatoPronto(path:string):boolean {try{return existsSync(path)&&statSync(path).isFile()&&statSync(path).size>0;}catch{return false;}}
