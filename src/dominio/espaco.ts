import { lstatSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export function tamanhoDe(path:string):{bytes:number;arquivos:number} {
  const result={bytes:0,arquivos:0}; if(!existsSync(path)) return result;
  const stat=lstatSync(path); if(stat.isSymbolicLink()) return result;
  if(stat.isFile()) return {bytes:stat.size,arquivos:1};
  for(const name of readdirSync(path)) { const t=tamanhoDe(join(path,name)); result.bytes+=t.bytes; result.arquivos+=t.arquivos; }
  return result;
}
export const humano=(n:number):string=>n<1024?`${n} B`:n<1024**2?`${(n/1024).toFixed(1)} KB`:n<1024**3?`${(n/1024**2).toFixed(1)} MB`:`${(n/1024**3).toFixed(1)} GB`;
export function medirSubpastas(path:string):{nome:string;bytes:number;arquivos:number}[] {
  if(!existsSync(path)) return [];
  return readdirSync(path,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>({nome:e.name,...tamanhoDe(join(path,e.name))}));
}
