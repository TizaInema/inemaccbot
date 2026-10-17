import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export interface FluxoRegistrado {command:string;repo:string;descricao:string;exemplo:string}
export function carregarFluxos(path:string,raiz:string):FluxoRegistrado[] {
  const raw=JSON.parse(readFileSync(path,'utf8')) as FluxoRegistrado[];
  if(!Array.isArray(raw)) throw new Error('catálogo de fluxos inválido');
  return raw.map(f=>{if(!/^[a-z][\w-]*$/.test(f.command)||!/^[\w-]+$/.test(f.repo)) throw new Error('fluxo inválido');return {...f,repo:resolve(raiz,f.repo)};});
}
