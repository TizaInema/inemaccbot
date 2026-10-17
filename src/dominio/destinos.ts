import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
export const ehTokenDestino=(t:string):boolean=>/^lives[1-9]\d*$/.test(t);
export function resolverDestino(token:string,projetos:string):string|undefined {
  if (!ehTokenDestino(token)) return;
  const root=resolve(projetos),path=resolve(root,`yt-pub-${token}`,'imports','videos');
  if (!existsSync(path)) return;
  if (!realpathSync(path).startsWith(realpathSync(root)+sep)) return;
  return path;
}
export function listarDestinos(projetos:string):string[] {
  if (!existsSync(projetos)) return [];
  return readdirSync(projetos).filter(n=>/^yt-pub-lives[1-9]\d*$/.test(n)).map(n=>n.slice(7)).filter(n=>resolverDestino(n,projetos)).sort();
}
