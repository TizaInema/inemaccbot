import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, resolve, relative } from 'node:path';
import { FILAS } from '../fila/filas.js';
import type { Fila, Perfil } from '../fila/types.js';
export interface Campo { tipo:'texto'|'bandeira';padrao:string;descricao:string;usa?:'entrega' }
export interface SkillDef {
  command:string;fila:Fila;kind:'agent'|'function';prompt:string;artefato_exts:string[];
  max_tentativas:number;timeout_segundos:number;timeout_setup_segundos?:number;
  aceita_destino:boolean;descricao:string;exemplo:string;aguarda_artefato?:boolean;
  perfil?:Partial<Perfil>;campos:Record<string,Campo>;
}
export function validarSkills(raw:unknown,raiz:string):SkillDef[] {
  if(!Array.isArray(raw)||!raw.length) throw new Error('catálogo vazio ou inválido');
  const seen=new Set<string>();
  return raw.map((item)=> {
    if(!item || typeof item!=='object') throw new Error('entrada inválida');
    const d=item as SkillDef;
    if(!/^[a-z][a-z0-9_-]*$/.test(d.command)) throw new Error('command inválido');
    if(seen.has(d.command)) throw new Error('command duplicado'); seen.add(d.command);
    if(!FILAS.includes(d.fila)) throw new Error('fila inválida');
    if(!['agent','function'].includes(d.kind)) throw new Error('kind inválido');
    if(typeof d.prompt!=='string'||isAbsolute(d.prompt)||d.prompt.split(/[\\/]/).includes('..')||relative(raiz,resolve(raiz,d.prompt)).startsWith('..')) throw new Error('prompt deve ser relativo à raiz');
    const path=resolve(raiz,d.prompt);
    if(!existsSync(path)||!readFileSync(path,'utf8').trim()) throw new Error(`prompt ausente ou vazio: ${d.prompt}`);
    if(!Array.isArray(d.artefato_exts)||!d.artefato_exts.length||d.artefato_exts.some(e=>typeof e!=='string'||!/^\.?[a-z0-9]+$/i.test(e))) throw new Error('artefato_exts inválido');
    for(const key of ['max_tentativas','timeout_segundos'] as const) if(!Number.isInteger(d[key])||d[key]<=0) throw new Error(`${key} inválido`);
    if(d.timeout_setup_segundos!==undefined && (!Number.isInteger(d.timeout_setup_segundos)||d.timeout_setup_segundos<=0||d.timeout_setup_segundos>d.timeout_segundos)) throw new Error('timeout_setup_segundos inválido');
    if(typeof d.aceita_destino!=='boolean'||typeof d.descricao!=='string'||typeof d.exemplo!=='string') throw new Error('metadados inválidos');
    const campos=d.campos ?? {};
    for(const [name,c] of Object.entries(campos)) if(!/^[a-z][a-z0-9_]*$/.test(name)||!['texto','bandeira'].includes(c.tipo)||typeof c.padrao!=='string') throw new Error('campos inválidos');
    return {...d,artefato_exts:d.artefato_exts.map(e=>e.replace(/^\./,'').toLowerCase()),campos,perfil:d.perfil&&Object.keys(d.perfil).length?d.perfil:undefined};
  });
}
export function carregarSkills(path:string,raiz:string):SkillDef[] {
  let text:string; try {text=readFileSync(path,'utf8');}catch{throw new Error(`não consegui ler catálogo: ${path}`);}
  let raw:unknown;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('JSON inválido no catálogo');}
  return validarSkills(raw,raiz);
}
export const acharSkill=(defs:SkillDef[],name:string):SkillDef|undefined=>defs.find(d=>d.command===name);
