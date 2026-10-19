// Caminho real registry -> Codex -> render destacado -> artefato, sem Telegram.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { carregarSkills } from '../dist/dominio/registry.js';
import { criarPromptDe } from '../dist/fila/skills.js';
import { CodexRunner } from '../dist/fila/runner-codex.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cwd = join(root, 'state/smoke-skill'); mkdirSync(cwd, {recursive:true});
const perfil = {motor:'codex', modelo:'executor', esforco:'low'};
const promptDe = criarPromptDe({
  cpuMedia:true,
  defs:carregarSkills(join(root, 'config/skills.json'), root), raizRepo:root,
  projetosDir:dirname(root), raizArtefatos:cwd, cwd, perfilPadrao:perfil,
});
const ctx = await promptDe({id:1, tarefa:'explicativo', motor:'codex', modelo:'executor', esforco:'low',
  input:JSON.stringify({entrada:'Teste interno: faça uma única cena curta de 8 segundos sobre aprender inteligência artificial, com dois tópicos e narração PT-BR. Use fatos gerais, sem pesquisa externa.', campos:{vertical:'não'}}),
});
const execution = new CodexRunner({binario:process.env.CODEX_BIN || '/usr/local/bin/codex'}).iniciar({...ctx, timeoutMs:300000});
try {
  const raw = await execution.aguardar();
  writeFileSync(join(cwd, 'resposta.txt'), raw);
  const target = ctx.interpretarSaida(raw);
  await ctx.aguardarArtefato(target, new AbortController().signal);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',target], {encoding:'utf8'}));
  if (!probe.streams.some(s => s.codec_type === 'audio') || !probe.streams.some(s => s.codec_type === 'video')) throw new Error('Artefato sem áudio/vídeo.');
  const result = {skill:'explicativo', contrato:'ok', duracao:Number(probe.format.duration), arquivo:target};
  writeFileSync(join(cwd, 'resultado.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await execution.limpar(); }
