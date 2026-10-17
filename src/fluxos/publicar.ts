import { copiarParaDestino } from '../gateway/entrega.js';
export function publicarVideo(origem:string,titulo:string,dir:string,urls:string[],_tipo:string):string {
  const path=copiarParaDestino(origem,dir,titulo.endsWith('.mp4')?titulo:titulo+'.mp4');
  return urls.length?urls[0].replace(/\/$/,'')+'/'+encodeURIComponent(path.split(/[\\/]/).at(-1)!):path;
}
