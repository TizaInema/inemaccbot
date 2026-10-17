import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Config } from '../config.js';
export const LIMITE_MENSAGEM=4000;
export interface Transporte { responder(chatId:number,texto:string):Promise<void>;enviarDocumento?(chatId:number,path:string):Promise<void> }
export interface TelegramUpdate {update_id:number;message?:{chat:{id:number};text?:string;caption?:string;document?:{file_id:string;file_name?:string};video?:{file_id:string;file_name?:string}}}
export async function apiTelegram(token:string,method:string,body:Record<string,unknown>|FormData,signal?:AbortSignal):Promise<unknown> {
  const form=body instanceof FormData;
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',headers:form?undefined:{'content-type':'application/json'},body:form?body:JSON.stringify(body),
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45_000)]):AbortSignal.timeout(45_000),
  });
  const data=await response.json() as {ok:boolean;result:unknown;description?:string};
  if(!response.ok||!data.ok) throw new Error(`Telegram ${response.status}: ${data.description ?? 'requisição recusada'}`);
  return data.result;
}
export function criarBot(cfg:Config,deps:{aoComando:(chatId:number,texto:string)=>Promise<string>;log:(s:string)=>void;baixarAnexo?:(id:string,nome?:string)=>Promise<string>}):{bot:{init():Promise<void>;start():Promise<void>;stop():Promise<void>};transporte:Transporte} {
  const controller=new AbortController(); let offset=0; let polling:Promise<void>|undefined;
  const allowed=new Set(cfg.allowedChatIds);
  const transporte:Transporte={
    async responder(chatId,texto) {
      for(let i=0;i<texto.length;i+=LIMITE_MENSAGEM) await apiTelegram(cfg.botToken,'sendMessage',{chat_id:chatId,text:texto.slice(i,i+LIMITE_MENSAGEM),link_preview_options:{is_disabled:true}});
    },
    async enviarDocumento(chatId,path) {
      const form=new FormData();form.set('chat_id',String(chatId));form.set('document',new Blob([await readFile(path)]),basename(path));
      await apiTelegram(cfg.botToken,'sendDocument',form);
    },
  };
  const handle=async(update:TelegramUpdate)=> {
    const msg=update.message;if(!msg||!allowed.has(msg.chat.id)) return;
    let texto=msg.text ?? msg.caption ?? '';
    const anexo=msg.document ?? msg.video;
    if(anexo&&deps.baixarAnexo) {
      const path=await deps.baixarAnexo(anexo.file_id,anexo.file_name);
      texto=texto?texto.replace('{{anexo}}',path):`Arquivo recebido: ${path}. Use um comando de /skills com esse caminho.`;
      if(!msg.caption) {await transporte.responder(msg.chat.id,texto);return;}
    }
    if(!texto) return;
    try {await transporte.responder(msg.chat.id,await deps.aoComando(msg.chat.id,texto));}
    catch(e) {deps.log(`comando falhou: ${String(e)}`);await transporte.responder(msg.chat.id,'Não consegui concluir o pedido. Consulte /status ou tente novamente.');}
  };
  const loop=async()=> {
    while(!controller.signal.aborted) {
      try {
        const updates=await apiTelegram(cfg.botToken,'getUpdates',{offset,timeout:30,allowed_updates:['message']},controller.signal) as TelegramUpdate[];
        for(const update of updates) {await handle(update);offset=update.update_id+1;}
      } catch(e) {
        if(controller.signal.aborted) return;
        // Deixe o systemd reiniciar falhas persistentes sem manter um processo surdo.
        throw e;
      }
    }
  };
  return {transporte,bot:{
    async init(){await apiTelegram(cfg.botToken,'getMe',{});await apiTelegram(cfg.botToken,'deleteWebhook',{drop_pending_updates:false});},
    start(){polling??=loop();return polling;},
    async stop(){controller.abort();await polling?.catch(()=>{});},
  }};
}
