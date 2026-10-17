import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { carregarSkills } from './dominio/registry.js';
const skillPorComando:Record<string,string>={transcrever:'inemavox',dublar:'inemavox',explicativo:'video-explicativo',curso:'videos-cursos-inema',demo:'video-demonstrativo',reel:'reel-edita-inema',reelpromo:'reel-promoavatar',reelinematds:'reel-edita-inematds',historia:'videos-agnes',imagem:'imagens-agnes'};
export function diagnosticar(raiz=resolve(fileURLToPath(new URL('..',import.meta.url)))) {
  const defs=carregarSkills(join(raiz,'config','skills.json'),raiz);
  const executores=Object.fromEntries(['codex','claude','ffmpeg','ffprobe'].map(bin=>[bin,spawnSync(bin,['--version'],{encoding:'utf8',timeout:10_000,shell:false}).status===0]));
  return {node:process.version,executores,skills:defs.map(d=>{
    const name=skillPorComando[d.command];
    const roots=[join(raiz,'.claude','skills'),join(homedir(),'.claude','skills'),join(homedir(),'.agents','skills')];
    const path=roots.map(r=>join(r,name,'SKILL.md')).find(p=>existsSync(p));
    return {comando:d.command,skill:name,instalada:!!path};
  }),fluxos:'indisponíveis: contratos e projetos originais não recuperados'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(diagnosticar(),null,2));}catch(e){console.error(String(e));process.exitCode=1;}
}
