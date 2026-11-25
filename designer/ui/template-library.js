'use strict';
// A static catalogue: only raster screenshots are displayed, never imported HTML.
(()=>{
 const $=id=>document.getElementById(id);
 const categories={property:'Eiendom',craft:'Håndverk og service',travel:'Reiseliv',business:'Bedrift',restaurant:'Restaurant'};
 let api,create,items=[],selected='',busy=false,epoch=0,lastSignature='',timer=null;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const category=id=>Object.hasOwn(categories,id)?categories[id]:id;
 const btn=(text,cls,fn)=>{const b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b;};
 function status(text,error=false){$('tl-status').textContent=text;$('tl-status').classList.toggle('tl-error',error);}
 function setBusy(value){busy=value;for(const id of ['tl-import','tl-close','tl-category','tl-search','tl-folder','tl-refresh'])$(id).disabled=value;for(const b of $('tl-items').querySelectorAll('button'))b.disabled=value;for(const b of $('tl-detail').querySelectorAll('button'))b.disabled=value||b.dataset.unsupported==='true';}
 async function run(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){status(e.message||String(e),true);}finally{setBusy(false);}}
 function fillCategories(){const select=$('tl-category'),old=select.value;select.replaceChildren();const all=el('option','Alle kategorier');all.value='';select.append(all);for(const id of [...new Set(items.map(e=>e.template.category))].sort()){const option=el('option',category(id));option.value=id;select.append(option);}if([...select.options].some(o=>o.value===old))select.value=old;}
 function visible(){const query=$('tl-search').value.trim().toLowerCase(),cat=$('tl-category').value;return items.filter(e=>(!cat||e.template.category===cat)&&(!query||[e.template.name,e.template.id,e.template.templateVersion,e.template.subcategory,category(e.template.category)].some(s=>s.toLowerCase().includes(query))));}
 function render(){const list=$('tl-items'),shown=visible();list.replaceChildren();if(!shown.some(e=>e.key===selected))selected=shown[0]?.key||'';
  if(!shown.length)list.append(el('p',items.length?'Ingen maler samsvarer med filteret.':'Ingen maler funnet. Legg en mal-ZIP i malmappen eller importer en.','tl-empty'));
  for(const entry of shown){const t=entry.template,b=btn('', 'tl-card',()=>{selected=entry.key;render();});b.setAttribute('aria-pressed',String(entry.key===selected));b.append(el('small',category(t.category)),el('strong',t.name),el('span',t.templateVersion),el('span',entry.supported?'Kan brukes':'Kun bibliotek','tl-state'));list.append(b);}
  void detail();
 }
 async function detail(){const serial=++epoch,host=$('tl-detail'),entry=items.find(e=>e.key===selected);host.replaceChildren();if(!entry){host.append(el('p','Velg en mal for å se detaljer.','tl-empty'));return;}
  const t=entry.template;host.append(el('h3',t.name),el('p',t.id,'tl-id'));
  const data=el('dl',undefined,'tl-meta');for(const [label,value] of [['Kategori',category(t.category)],['Underkategori',t.subcategory],['Versjon',t.templateVersion],['Nettsidemotor',t.engine],['Malkontrakt',String(t.contractVersion)],['Fil',entry.source||'']])data.append(el('dt',label),el('dd',value));host.append(data);
  const shots=el('div',undefined,'tl-shots');host.append(shots);
  if(!entry.previews.length)shots.append(el('p','Ingen forhåndsvisningsbilder i denne malen.','tl-empty'));
  const actions=el('div',undefined,'tl-actions');const use=btn('Opprett nytt prosjekt','btn btn-primary',()=>run(async()=>{if(await create(entry,e=>status(e.message||String(e),true)))$('template-library-dialog').close();}));use.dataset.unsupported=String(!entry.supported);use.disabled=busy||!entry.supported;actions.append(use,btn('Vis ZIP i Utforsker','btn btn-outline',()=>run(()=>api.templateLibraryReveal(entry.key))));host.append(actions);
  if(!entry.supported)host.append(el('p','Denne malen er registrert, men renderer støttes ikke i denne WSET-versjonen.','tl-warning'));
  if(entry.previews.length)try{const images=await api.templateLibraryPreviews(entry.key);if(serial!==epoch)return;for(const device of ['desktop','mobile']){if(!images[device])continue;const figure=el('figure'),img=el('img');img.src=images[device];img.alt=device==='desktop'?'PC-visning':'Mobilvisning';figure.append(img,el('figcaption',img.alt));shots.append(figure);}}catch(e){if(serial===epoch)shots.append(el('p',e.message,'tl-warning'));}
 }
 async function refresh(force=false){const result=await api.templateLibraryList();const sig=JSON.stringify(result);$('tl-root').textContent=result.root||'';if(force||sig!==lastSignature){lastSignature=sig;items=result.items;fillCategories();render();}status(result.issues.length?result.issues.join(' · '):items.length+' malversjoner · automatisk synkronisering',!!result.issues.length);}
 function init(options){({api,create}=options);$('tl-folder').addEventListener('click',()=>run(()=>api.workspaceReveal('templates')));$('tl-refresh').addEventListener('click',()=>run(()=>refresh(true)));$('template-library-dialog').addEventListener('close',()=>{clearInterval(timer);timer=null;});$('tl-close').addEventListener('click',()=>$('template-library-dialog').close());$('template-library-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('tl-category').addEventListener('change',render);$('tl-search').addEventListener('input',render);$('tl-import').addEventListener('click',()=>run(async()=>{const result=await api.templateLibraryImport();if(!result)return;selected=result.entry.key;$('tl-search').value='';$('tl-category').value='';await refresh(true);status(result.alreadyInstalled?'Malversjonen er allerede installert.':'Mal importert til biblioteket.');}));}
 function open(){if(!$('template-library-dialog').open)$('template-library-dialog').showModal();if(!timer)timer=setInterval(()=>{if(!busy&&$('template-library-dialog').open)void run(refresh);},5000);return run(()=>refresh(true));}
 window.wsetTemplateLibrary={init,open};
})();
