// Entrega do artefato de um job concluído.
//
// Quem entrega é o GATEWAY, não a fila: `fila/` não pode conhecer Telegram nem
// destinos (§4). O worker termina o job com o CAMINHO do artefato em
// `resultado`; daqui em diante é decisão de apresentação.
//
// Três casos, nesta ordem:
//   1. destino pedido (`| lives3`)  → copia para lá e responde o caminho final;
//   2. texto curto (.txt/.srt)      → manda o CONTEÚDO no chat (é o que se quer
//                                     de uma transcrição — o caminho no disco
//                                     não serve de nada no celular);
//   3. resto                        → manda o arquivo como documento se couber
//                                     no limite do Telegram; senão, o caminho.
//
// Portado do `deliver.ts`/`media.ts` do v1 no que importa: sanitização de nome e
// garantia de que a cópia NUNCA escreve fora do diretório de destino.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, resolve, sep } from 'node:path';

import { LIMITE_MENSAGEM } from './telegram.js';

/**
 * Acima disso, a transcrição vai como ARQUIVO em vez de texto.
 *
 * O valor é UMA mensagem do Telegram, não um número redondo qualquer. Com o
 * limite antigo (100 KB), uma transcrição de 40 minutos — o caso ORDINÁRIO desta
 * skill — virava ~25 `sendMessage` seguidos: o Telegram limita mensagens por
 * chat, então o envio quebraria no meio e o usuário ficaria com metade da
 * transcrição e nenhuma explicação (o job estaria `done` e correto; o que falhou
 * seria a entrega).
 *
 * Transcrição curta continua chegando como texto legível; longa chega como .txt,
 * que é mais útil de qualquer forma — e é o que o v1 fazia.
 */
export const LIMITE_TEXTO_BYTES = LIMITE_MENSAGEM;
/** Teto do `sendDocument` da API do Telegram é 50 MB; ficamos abaixo. */
export const LIMITE_DOCUMENTO_BYTES = 45 * 1024 * 1024;

const EXTS_TEXTO = new Set(['.txt', '.srt', '.md', '.vtt']);
const EXTS_VIDEO = new Set(['.mp4', '.mov', '.webm']);

/** Nome público seguro: sem diretório embutido, sem espaço, sem unicode
 * problemático. `basename` primeiro mata qualquer `../../etc/passwd`. */
export function nomeSeguro(nome: string): string {
  const base = basename(String(nome ?? '').trim()) || 'arquivo';
  const ext = extname(base);
  const raiz = ext ? base.slice(0, -ext.length) : base;
  const limpo = raiz
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    // Ponto na borda sai junto com o hífen: sem isso `...` sobrevive inteiro
    // (`.` vira extensão, `..` vira raiz) e o nome final é `...` — que é
    // exatamente a forma que a sanitização existe para não deixar passar.
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 150);
  const extLimpa = ext.replace(/[^a-zA-Z0-9.]+/g, '').replace(/^\.+$/, '').slice(0, 20);
  return (limpo || 'arquivo') + extLimpa;
}

/**
 * Copia `origem` para dentro de `destinoDir`, sem colisão. Nunca escreve fora
 * de `destinoDir` — a checagem é ciente do separador, porque `startsWith` puro
 * deixaria `/data/midia-secreta` passar contra a raiz `/data/midia` (o mesmo
 * defeito já corrigido no `ffmpeg.thumb` na etapa 1).
 */
export function copiarParaDestino(origem: string, destinoDir: string, nomePedido?: string): string {
  const raiz = resolve(destinoDir);
  mkdirSync(raiz, { recursive: true });

  const nome = nomeSeguro(nomePedido || basename(origem));
  const ext = extname(nome);
  const caule = ext ? nome.slice(0, -ext.length) : nome;

  for (let n = 0; ; n += 1) {
    const candidato = n === 0 ? nome : `${caule}-${n}${ext}`;
    const alvo = resolve(raiz, candidato);
    if (alvo !== raiz && !alvo.startsWith(raiz + sep)) {
      throw new Error('nome de arquivo inválido: escaparia do diretório de destino');
    }
    if (!existsSync(alvo)) {
      copyFileSync(origem, alvo);
      return alvo;
    }
    // Mesmo tamanho: é o arquivo que já entregamos antes (retentativa do mesmo
    // job). Adota em vez de multiplicar cópias — a mesma regra de "procure
    // antes de criar" do §2.5, na escala desta operação.
    if (statSync(alvo).size === statSync(origem).size) return alvo;
  }
}

/**
 * Nome com que o artefato chega ao destino — o padrão ordenável que o v1 usava
 * (`buildOutputName`): `<curso>-<modulo>-<16|9>.mp4`, caindo para
 * `<skill>-<id>-<fmt>` quando não há rótulo.
 *
 * É só o nome de ENTREGA. O arquivo de trabalho continua sendo `<id>.<ext>`,
 * porque ele precisa ser único por job: dois jobs do mesmo módulo com o mesmo
 * nome fariam o segundo "adotar" o vídeo do primeiro achando que era
 * retentativa (é assim que a adoção do render funciona).
 */
export function nomeDeEntrega(
  opts: { command: string; id: number; ext: string; campos?: Record<string, string> },
): string {
  const campos = opts.campos ?? {};
  const fmt = campos.vertical === 'sim' ? '9' : '16';
  const partes = [campos.curso, campos.modulo].filter((p): p is string => !!p && p.trim() !== '');
  const base = partes.length ? partes.join('-') : `${opts.command}-${opts.id}`;
  return nomeSeguro(`${base}-${fmt}.${opts.ext.replace(/^\./, '')}`);
}

export interface Entrega {
  /** Texto a mandar no chat. */
  mensagem: string;
  /** Caminho de um arquivo a anexar, se for o caso. */
  anexo?: string;
}

/**
 * Decide (sem enviar nada) o que fazer com o artefato. Separado do envio para
 * ser testável sem Telegram — nenhum teste deste bot toca a API real.
 */
export interface OpcoesEntrega {
  destinoDir?: string;
  /** Nome com que o arquivo chega ao destino (ver `nomeDeEntrega`). */
  nome?: string;
  /**
   * Mover em vez de copiar. Default é COPIAR: as skills de reel gravam na
   * convenção delas (`~/projetos/output/reels/<slug>/`) e o original tem que
   * ficar lá — o v1 nunca passava `--pasta` nessas skills por isso mesmo.
   */
  mover?: boolean;
  /** Compactador injetavel para testes; producao usa ffmpeg local. */
  compactarVideo?: (caminho: string) => string | undefined;
}

export function caminhoVideo720p(caminho: string): string {
  const ext = extname(caminho) || '.mp4';
  return resolve(dirname(caminho), `${basename(caminho, ext)}-720p.mp4`);
}

export function compactarVideoParaTelegram(caminho: string): string | undefined {
  const destino = caminhoVideo720p(caminho);
  try {
    if (existsSync(destino) && statSync(destino).size > 0 && statSync(destino).size <= LIMITE_DOCUMENTO_BYTES) {
      return destino;
    }
  } catch { /* recomprime abaixo */ }

  const r = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', caminho,
    '-vf', "scale='if(gte(iw,ih),1280,720)':'if(gte(iw,ih),720,1280)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '28',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    destino,
  ], { encoding: 'utf8', timeout: 20 * 60 * 1_000 });

  if (r.status !== 0) return undefined;
  try {
    return statSync(destino).size <= LIMITE_DOCUMENTO_BYTES ? destino : undefined;
  } catch {
    return undefined;
  }
}

export function planejarEntrega(caminho: string, opts: OpcoesEntrega = {}): Entrega {
  if (!caminho) return { mensagem: 'o job terminou sem artefato.' };
  if (!existsSync(caminho)) {
    // Acontece de verdade: o agente declarou `RESULT:` e o arquivo sumiu (ou
    // nunca existiu). Dizer isso é melhor que mandar um caminho quebrado.
    return { mensagem: `o job terminou, mas o arquivo não está lá: ${caminho}` };
  }

  const tamanho = statSync(caminho).size;
  if (opts.destinoDir) {
    const final = copiarParaDestino(caminho, opts.destinoDir, opts.nome);
    if (opts.mover) {
      // Falhar em apagar o original NÃO é falha da entrega: o arquivo já está
      // no destino. Dizer "movi" seria mentira, então o texto muda.
      try {
        unlinkSync(caminho);
        return { mensagem: `pronto (movido): ${final}` };
      } catch {
        return { mensagem: `pronto: ${final}\n(o original ficou em ${caminho} — não consegui apagar)` };
      }
    }
    return { mensagem: `pronto: ${final}` };
  }

  const ext = extname(caminho).toLowerCase();
  if (EXTS_TEXTO.has(ext) && tamanho <= LIMITE_TEXTO_BYTES) {
    const conteudo = readFileSync(caminho, 'utf8').trim();
    return { mensagem: conteudo || `(arquivo vazio) ${caminho}` };
  }

  if (tamanho <= LIMITE_DOCUMENTO_BYTES) {
    return { mensagem: `pronto: ${basename(caminho)}`, anexo: caminho };
  }

  if (EXTS_VIDEO.has(ext)) {
    const compactar = opts.compactarVideo ?? compactarVideoParaTelegram;
    const menor = compactar(caminho);
    if (menor && existsSync(menor) && statSync(menor).size <= LIMITE_DOCUMENTO_BYTES) {
      return { mensagem: `pronto: ${basename(menor)} (720p)`, anexo: menor };
    }
  }

  const mb = Math.round(tamanho / (1024 * 1024));
  return { mensagem: `pronto (${mb} MB, grande demais pro Telegram): ${caminho}` };
}
