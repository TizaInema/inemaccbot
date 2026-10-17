import {it,expect} from 'vitest';
import {carregarConfig} from './config.js';
const token='123456789:'+ 'A'.repeat(35);
it('recusa inicialização sem token e sem lista de chats autorizados',()=>{
  expect(()=>carregarConfig({})).toThrow(/BOT_TOKEN/);
  expect(()=>carregarConfig({BOT_TOKEN:token})).toThrow(/ALLOWED_CHAT_IDS/);
  expect(carregarConfig({BOT_TOKEN:token,ALLOWED_CHAT_IDS:'1,-22'}).allowedChatIds).toEqual([1,-22]);
});
