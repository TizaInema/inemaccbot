import type { Perfil } from '../fila/types.js';
export function resolverPerfil(opts:{override?:Partial<Perfil>;registry?:Partial<Perfil>;padrao:Perfil}):{perfil:Perfil} {
  const perfil={...opts.padrao,...opts.registry,...opts.override};
  if (!['claude','codex','fake'].includes(perfil.motor)) throw new Error('motor inválido');
  if (!/^[\w./:-]+$/.test(perfil.modelo)) throw new Error('modelo inválido');
  if (!['minimal','low','medium','high','xhigh','max'].includes(perfil.esforco)) throw new Error('esforço inválido');
  return {perfil};
}
