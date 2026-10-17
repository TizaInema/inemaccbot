export function redatorPadrao(opts:{segredos?:string[];home?:string}={}):(texto:string)=>string {
  return (texto)=> {
    let r=texto.replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g,'«token redigido»')
      .replace(/(?:sk-[\w-]{16,}|gh[pousr]_[\w]{16,}|github_pat_[\w]{16,})/g,'«chave redigida»');
    for (const segredo of opts.segredos ?? []) if(segredo) r=r.split(segredo).join('«redigido»');
    if(opts.home) r=r.split(opts.home).join('~');
    return r;
  };
}
