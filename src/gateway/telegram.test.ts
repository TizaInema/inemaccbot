import { afterEach,it,expect,vi } from 'vitest';
import { criarBot } from './telegram.js';
import { carregarConfig } from '../config.js';
afterEach(()=>vi.restoreAllMocks());
it('ignora chat não autorizado e aceita comando de chat autorizado sem rede real',async()=>{
  const cfg=carregarConfig({BOT_TOKEN:'123456789:'+'A'.repeat(35),ALLOWED_CHAT_IDS:'7'});
  const chamados:number[]=[];let polls=0;
  let recebido!:()=>void;const processed=new Promise<void>(r=>{recebido=r;});
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
    const method=String(url).split('/').at(-1);
    if(method==='getUpdates') {
      polls++;
      if(polls===1) return Response.json({ok:true,result:[
        {update_id:1,message:{chat:{id:99},text:'/ping'}},
        {update_id:2,message:{chat:{id:7},text:'/ping'}},
      ]});
      return new Promise((_ok,no)=>init?.signal?.addEventListener('abort',()=>no(new Error('abort')),{once:true}));
    }
    return Response.json({ok:true,result:{}});
  });
  const {bot}=criarBot(cfg,{log:()=>{},aoComando:async(id)=>{chamados.push(id);recebido();return 'pong';}});
  await bot.init();const running=bot.start();await processed;
  await new Promise(r=>setTimeout(r,0));await bot.stop();await running;
  expect(chamados).toEqual([7]);
});
