import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve, sep, join } from 'node:path';
import type { Tarefa } from '../worker.js';
export function criarTarefas(opts:{raizMidia:string;heygenEnvPath?:string;heygenCli?:string;heygenPerfilChrome?:string;heygenEstudioScript?:string}):Record<string,Tarefa> {
  return {
    // Não expõe fetch arbitrário contra a rede interna; mantenha como diagnóstico desativado.
    'http.get':async()=>{throw new Error('Diagnóstico HTTP arbitrário desativado; use uma skill do catálogo');},
    'ffmpeg.thumb':async(input,signal)=> {
      const {entrada}=JSON.parse(input) as {entrada:string};
      const root=realpathSync(opts.raizMidia),path=realpathSync(resolve(entrada));
      if(!path.startsWith(root+sep)) throw new Error('arquivo fora da raiz de mídia');
      const output=join(root,`thumb-${Date.now()}.jpg`);
      await new Promise<void>((ok,no)=> {
        const child=spawn('ffmpeg',['-y','-v','error','-i',path,'-frames:v','1',output],{signal,timeout:60_000,stdio:'ignore'});
        child.once('error',no);child.once('close',code=>code===0?ok():no(new Error('ffmpeg falhou')));
      });return output;
    },
  };
}
