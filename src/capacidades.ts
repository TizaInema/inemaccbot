import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function temChave(nome: string): boolean {
  if (process.env[nome]?.trim()) return true;
  try {
    const texto = readFileSync(process.env.INEMACCBOT_PROVIDERS_FILE || join(homedir(), 'projetos/wifi/.env'), 'utf8');
    return texto.split('\n').some(l => {
      const i = l.indexOf('=');
      return i > 0 && l.slice(0, i).trim() === nome && !!l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    });
  } catch { return false; }
}

export function pendenciaSkill(comando: string, raiz: string): string | undefined {
  if (['imagem', 'historia'].includes(comando) && !temChave('AGNES_API_KEY'))
    return 'Falta configurar AGNES_API_KEY no cofre da VPS. Use scripts/configure-providers.py no servidor.';
  if (comando !== 'imagem' && !existsSync(join(raiz, '.venv-media/bin/python')))
    return 'O runtime de mídia ainda precisa ser instalado: python3 scripts/install-media.py.';
  return undefined;
}

export function textoDiagnostico(raiz: string): string {
  const comandos = ['transcrever', 'dublar', 'explicativo', 'curso', 'demo', 'reel', 'reelpromo', 'reelinematds', 'imagem', 'historia'];
  return ['Mídia na VPS: CPU, voz sintética Kokoro em português.',
    ...comandos.map(c => `${c}: ${pendenciaSkill(c, raiz) ?? 'disponível'}`),
    `Avatar HeyGen: ${temChave('HEYGEN_API_KEY') ? 'chave configurada; requer créditos e avatar na conta' : 'falta HEYGEN_API_KEY'}`,
    'Fluxos: /promoclub, /promoavatar e /promoavatar3. Aprovação de roteiro antes da geração.'].join('\n');
}
