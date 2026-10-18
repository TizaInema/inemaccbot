import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { carregarSkills } from './dominio/registry.js';
import { pendenciaSkill, temChave } from './capacidades.js';
export function diagnosticar(raiz = fileURLToPath(new URL('..', import.meta.url))) {
  const defs = carregarSkills(join(raiz, 'config/skills.json'), raiz);
  return {
    node: process.version,
    executores: Object.fromEntries(['codex', 'claude', 'ffmpeg', 'ffprobe'].map(bin => [bin,
      spawnSync(bin, [bin.startsWith('ff') ? '-version' : '--version'], { timeout: 10000, stdio: 'ignore' }).status === 0])),
    modo: 'CPU; voz Kokoro pf_dora; sem clonagem de voz',
    skills: defs.map(d => ({ comando: d.command, pendencia: pendenciaSkill(d.command, raiz) ?? null })),
    fluxos: ['inemaclubpromover', 'promoavatar', 'promoavatar3'].map(repo => ({ repo, instalado: existsSync(join(raiz, '..', repo, 'flow.json')) })),
    credenciais: { agnes: temChave('AGNES_API_KEY'), heygen: temChave('HEYGEN_API_KEY') },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(diagnosticar(), null, 2)); }
  catch (e) { console.error(String(e)); process.exitCode = 1; }
}
