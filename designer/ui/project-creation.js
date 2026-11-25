'use strict';
(()=>{
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let active=false;
 async function open({api,entry}){
  if(active||!entry?.supported)return null;
  active=true;
  const d=el('dialog',undefined,'wset-create-project');d.setAttribute('aria-labelledby','wset-create-title');
  try{
   const workspace=await api.workspaceStatus();
   if(!workspace?.paths?.projects)throw Error('Prosjektmappen er ikke tilgjengelig.');
   return await new Promise(resolve=>{
    const form=el('form');form.method='dialog';
    const header=el('header'),h=el('h2','Opprett nytt nettsted');h.id='wset-create-title';const x=el('button','×','icon-close');x.type='button';x.setAttribute('aria-label','Lukk');header.append(h,x);form.append(header);
    const summary=el('section',undefined,'wset-create-summary');summary.append(el('strong',entry.template.name),el('small',(entry.template.category==='property'?'Eiendom':entry.template.category)+' · '+entry.template.templateVersion));form.append(summary);
    function field(label,placeholder,max,required=false){const l=el('label',label),i=el('input');i.type='text';i.placeholder=placeholder;i.maxLength=max;i.required=required;l.append(i);form.append(l);return i;}
    const name=field('Prosjektnavn *','Skriv inn prosjektnavn',160,true),customer=field('Kunde (valgfritt)','Skriv inn kundenavn',160),domain=field('Domene (valgfritt)','www.eksempel.no',253);name.autofocus=true;
    const path=el('section',undefined,'wset-create-path');path.append(el('strong','Prosjektplassering'),el('p',workspace.paths.projects),el('small','En egen prosjektmappe opprettes automatisk.'));form.append(path);
    const note=el('section',undefined,'wset-create-note');note.append(el('strong','Bruk bare maler fra kilder du stoler på'),el('p','Det opprettes en selvstendig prosjektkopi. Originalmalen forblir uendret. Ved publisering kan prosjektets byggeskripter kjøres.'));const consent=el('label',undefined,'wset-create-consent'),trusted=el('input');trusted.type='checkbox';trusted.required=true;consent.append(trusted,el('span','Jeg stoler på kilden til denne malen.'));note.append(consent);form.append(note);
    const footer=el('footer'),cancel=el('button','Avbryt','btn btn-outline'),submit=el('button','Opprett nettsted','btn btn-primary');cancel.type='button';submit.type='submit';footer.append(cancel,submit);form.append(footer);d.append(form);
    let result=null;const cancelDialog=()=>d.close();x.addEventListener('click',cancelDialog);cancel.addEventListener('click',cancelDialog);
    name.addEventListener('input',()=>name.setCustomValidity(''));
    form.addEventListener('submit',e=>{e.preventDefault();if(!name.value.trim()){name.setCustomValidity('Angi prosjektnavn.');name.reportValidity();return;}if(!form.reportValidity())return;result={trusted:trusted.checked,digest:entry.digest,info:{name:name.value.trim(),customer:customer.value.trim(),domain:domain.value.trim()}};d.close();});
    d.addEventListener('close',()=>{d.remove();resolve(result);},{once:true});document.body.append(d);d.showModal();name.focus();
   });
  }finally{d.remove();active=false;}
 }
 window.wsetProjectCreation={open};
})();
