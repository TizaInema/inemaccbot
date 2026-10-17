import { homedir } from 'node:os';
import { resolve } from 'node:path';
export interface Config {
  botToken:string; allowedChatIds:number[]; queueDb:string; stateDir:string; logFile:string;
  projetosDir:string; publicoDir:string; publicoUrls:string[];
  motorPadrao:string; modeloPadrao:string; esforcoPadrao:string;
  heygenEnvPath:string; heygenCli:string; heygenPerfilChrome:string;
}
export function carregarConfig(env:Record<string,string|undefined>):Config {
  const botToken=env.BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN ?? '';
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(botToken)) throw new Error('BOT_TOKEN ausente ou inválido; configure .env no servidor');
  const ids=(env.ALLOWED_CHAT_IDS ?? env.TELEGRAM_ALLOWED_CHAT_ID ?? '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!ids.length || ids.some(s=>! /^-?\d+$/.test(s) || !Number.isSafeInteger(Number(s)))) throw new Error('ALLOWED_CHAT_IDS deve listar os chats autorizados');
  const projetosDir=resolve(env.PROJETOS_DIR ?? resolve(homedir(),'projetos'));
  const stateDir=resolve(env.STATE_DIR ?? 'state');
  if(!['codex','claude'].includes(env.MOTOR_PADRAO ?? 'codex')) throw new Error('MOTOR_PADRAO deve ser codex ou claude');
  return {botToken,allowedChatIds:ids.map(Number),queueDb:resolve(env.QUEUE_DB ?? 'inemaccbot.db'),stateDir,
    logFile:resolve(env.LOG_FILE ?? resolve(stateDir,'inemaccbot.log')),projetosDir,
    publicoDir:resolve(env.PUBLICO_DIR ?? resolve(projetosDir,'output')),
    publicoUrls:(env.PUBLICO_URLS ?? '').split(',').filter(Boolean),
    motorPadrao:env.MOTOR_PADRAO ?? 'codex',modeloPadrao:env.MODELO_PADRAO ?? 'sonnet',esforcoPadrao:env.ESFORCO_PADRAO ?? 'low',
    heygenEnvPath:env.HEYGEN_ENV_PATH ?? '',heygenCli:env.HEYGEN_CLI ?? 'heygen',heygenPerfilChrome:env.HEYGEN_PERFIL_CHROME ?? ''};
}
