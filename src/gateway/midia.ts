import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { apiTelegram } from './telegram.js';
export function criarBaixadorTelegram(token:string,raiz:string,agora:()=>number):(id:string,nome?:string)=>Promise<string> {
  return async(id,nome)=> {
    const file=await apiTelegram(token,'getFile',{file_id:id}) as {file_path:string;file_size?:number};
    if((file.file_size??0)>20*1024*1024) throw new Error('Anexo excede o limite de download do bot');
    if(!/^[\w./-]+$/.test(file.file_path)||file.file_path.includes('..')) throw new Error('Caminho de anexo inválido');
    const response=await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`,{signal:AbortSignal.timeout(60_000)});
    if(!response.ok) throw new Error(`Download Telegram: HTTP ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length>20*1024*1024) throw new Error('Anexo grande demais');
    const name=(nome ?? file.file_path.split('/').at(-1) ?? 'arquivo').replace(/[^a-zA-Z0-9._-]/g,'_');
    await mkdir(raiz,{recursive:true});const path=join(raiz,`${agora()}-${randomUUID()}-${name}`);
    await writeFile(path,bytes,{flag:'wx',mode:0o600});return path;
  };
}
