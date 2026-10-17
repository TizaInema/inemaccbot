import { afterEach,it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarServico,type Servico } from './index.js';
import { carregarConfig } from './config.js';
let svc:Servico|undefined;let dir:string|undefined;
afterEach(async()=>{await svc?.parar();svc=undefined;if(dir)rmSync(dir,{recursive:true,force:true});});
it('inicia, processa uma tarefa persistida, notifica e desliga sem timers',async()=>{
  dir=mkdtempSync(join(tmpdir(),'inemaccbot-servico-'));
  const cfg=carregarConfig({BOT_TOKEN:'123456789:'+'A'.repeat(35),ALLOWED_CHAT_IDS:'7',
    STATE_DIR:join(dir,'state'),QUEUE_DB:join(dir,'queue.db'),LOG_FILE:join(dir,'bot.log'),PROJETOS_DIR:dir});
  const messages:string[]=[];
  svc=criarServico(cfg,{
    agora:()=>Math.floor(Date.now()/1000),intervaloOciosoMs:5,heartbeatMs:50,timeoutDrenoMs:1000,
    log:()=>{},criarTarefas:()=>({smoke:async()=>'persistido'}),
    criarTransporte:(_cfg,deps)=>({
      transporte:{responder:async(_id,text)=>{messages.push(text);}},
      iniciar:async()=>{expect(await deps.aoComando(7,'/ping')).toBe('pong');},parar:async()=>{},
    }),
  });
  await svc.iniciar();
  svc.fila.enfileirar({fila:'io',kind:'function',tarefa:'smoke',input:'{}',chat_id:7});
  const deadline=Date.now()+3000;
  while(!messages.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  expect(svc.fila.obter(1)?.status).toBe('done');expect(messages.join('')).toContain('persistido');
  await svc.parar();expect(svc.timers()).toBe(0);
});
