// Verifica o executor real com uma resposta fixa, sem Telegram nem geração de mídia.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CodexRunner } from '../dist/fila/runner-codex.js';

const cwd=resolve('state','smoke');mkdirSync(cwd,{recursive:true});
const runner=new CodexRunner();
const execution=runner.iniciar({
  prompt:'Teste de conectividade. Não use ferramentas nem altere arquivos. Responda somente RESULT: INEMACCBOT_OK',
  cwd,perfil:{motor:'codex',modelo:'sonnet',esforco:'low'},vars:{},timeoutMs:90_000,
});
try {
  const result=await execution.aguardar();
  if(result.trim()!=='RESULT: INEMACCBOT_OK') throw new Error('Resposta inesperada do executor; consulte autenticação e configuração.');
  console.log('Codex autenticado e executor real respondeu corretamente.');
} finally {await execution.limpar();}
