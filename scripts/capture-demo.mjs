import { chromium } from 'playwright';
import { lookup } from 'node:dns/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isIP } from 'node:net';

function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127);
  }
  const v=address.toLowerCase();
  return !['::','::1'].includes(v)&&!v.startsWith('fc')&&!v.startsWith('fd')&&!v.startsWith('fe8')&&!v.startsWith('fe9')&&!v.startsWith('fea')&&!v.startsWith('feb')&&!v.startsWith('::ffff:');
}
export async function validateUrl(text) {
  const url=new URL(text);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use uma URL HTTP/HTTPS pública sem credenciais.');
  const addresses=await lookup(url.hostname,{all:true});
  if(addresses.some(a=>!publicAddress(a.address)))throw new Error('A captura aceita somente sites públicos.');
  return url;
}
export async function capture(url, folder) {
  await validateUrl(url);mkdirSync(folder,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
    await context.route('**/*',async route=>{try {await validateUrl(route.request().url());await route.continue();}catch{await route.abort();}});
    const page=await context.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(1500);
    const scenes=[];
    for(let i=0;i<3;i++) {
      await page.evaluate(y=>window.scrollTo(0,y),i*600);await page.waitForTimeout(500);
      const image=join(folder,`shot-${i+1}.png`);await page.screenshot({path:image});
      scenes.push({image,title:await page.title(),caption:'',narration:''});
    }
    const spec=join(folder,'screens.json');writeFileSync(spec,JSON.stringify({source:url,scenes},null,2));return spec;
  } finally {await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'))) {
  capture(process.argv[2],resolve(process.argv[3]??'screens')).then(console.log).catch(error=>{console.error(error.message);process.exitCode=1;});
}
