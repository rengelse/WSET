'use strict';
(()=>{
 const $=id=>document.getElementById(id),api=window.cbpm,propertyManager=window.cbpmPropertyManager;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
 let previewOnly=false,treeSearch='',treeCollapsed=false,area='overview',navMode='expanded',focusMode=false,treeVisible=true,inspectorVisible=true,recentProjects=[],managerReady=false;
 let mediaSearch='',mediaFilter='all',mediaCategory='all',mediaUsageFilter='all',mediaView='grid',mediaSort='name',mediaPage=1,mediaBusy=false,translationSearch='',translationFilter='all';
 let propertyView='all',languageWorkspace=null;
 let assistantLocale='',globalLocale='',globalDoc='legal';
 let settingsCategory='profile',settingsPage='home',settingsLocale='',settingsTarget='',settingsWrite=Promise.resolve(true),settingsBusy=false;
 const propertyCategories=[['developments','Nybygg'],['properties','Bruktboliger']];
 const propertyLabel=id=>propertyCategories.find(([key])=>key===id)?.[1]||'Eiendommer';
 const propertyOn=id=>{const m=current.site.propertyModules?.[id];return m?.visibilityExplicit!==true||m.enabled!==false;};
 let current=null,tab='pages',pageId='home',sectionId=null,locale='no',recordId=null,mediaId=null,media=[],templateEntries=[],device='desktop',counter=0,timer,languageData=null,inspectorPane='content',lastPreviewScroll=0,pendingPreviewScroll=0,dragItem=null;
 const areaTabs={website:['pages','categories','services','projects','team','reviews'],properties:['propertyManager'],media:['media'],languages:['languages'],settings:['brand']};
 const areaNames={library:'Mine nettsteder',templates:'Malbibliotek',server:'Server / FTP',publishing:'Publisering',overview:'Oversikt',website:'Nettsider',properties:'Eiendommer',media:'Medier',languages:'Språk',settings:'Innstillinger'};
 const utilityAreas=['library','templates','server','publishing'];
 // The active project and the last website workspace are separate from the current navigation area.
 const contextKey=root=>'wset-workspace-v1:'+(current?.root===root&&current.projectId?current.projectId:root);
 const workspaceMemory=new Map();
 let contextWrite=Promise.resolve(true),selectionEpoch=0,inlineSession=null,templateRequest=0,selectedDesignTarget=null,designRole='heading',globalDesignRole='heading',globalDesignOpen=false;const templateOpenGroups=new Map();const contextExtraOpen=new Set();
 const contextExtraKey=t=>JSON.stringify([t.root,t.pageId,t.sectionId,t.locale,t.id]);
 const templateContext=()=>JSON.stringify([current?.root,pageId,sectionId]);
 function completeInline(ok){const session=inlineSession;inlineSession=null;session?.resolve(ok);if(current)updateTop();}
 async function flushInline(){if(!inlineSession)return true;const session=inlineSession;try{$('site-preview').contentWindow.postMessage({kind:'wset-inline-flush'},current.previewBase)}catch{}return Promise.race([session.done,new Promise(resolve=>setTimeout(()=>{if(inlineSession===session){toast('Fullfør tekstredigeringen med Enter eller Escape.',true);resolve(false);}else resolve(true);},3500))]);}
 let navigationEpoch=0,scrollSaveTimer,previewIdentity=null,previewLoaded=false,restoringScroll=false,previewExpectedUrl=null,previewReadyTimer;
 function storeContext(){
  if(!current||area!=='website')return;
  const context={tab,pageId,propertyView,sectionId,locale,recordId,inlineSelection:{...inlineSelection},device,inspectorPane,treeCollapsed,treeSearch,previewOnly,designRole,designTarget:designTarget(),scroll:Math.max(0,lastPreviewScroll),updated:new Date().toISOString()};
  workspaceMemory.set(current.root,context);
  try{(window.wsetPrefs||localStorage).setItem(contextKey(current.root),JSON.stringify(context))}catch{}
 }
 function readContext(root){if(workspaceMemory.has(root))return workspaceMemory.get(root);try{const value=JSON.parse((window.wsetPrefs||localStorage).getItem(contextKey(root)));return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
 function updatePreviewMode(){const b=$('preview-mode');b.setAttribute('aria-pressed',String(previewOnly));b.textContent=previewOnly?'Rediger':'Forhåndsvis';b.title=previewOnly?'Tilbake til redigering':'Forhåndsvis uten redigeringsmarkeringer';b.setAttribute('aria-label',b.title);}
 async function resume(){
  if(!current||!await commitContextField()||!await flushInline())return;
  if(area==='properties'&&tab==='propertyManager'&&!propertyManager.canLeave())return;
  if(area==='website')storeContext();
  const epoch=++navigationEpoch,root=current.root,c=readContext(root);
  healthRequest++;area='website';focusMode=false;tab=areaTabs.website.includes(c.tab)?c.tab:'pages';
  pageId=current.site.sitePages.some(p=>p.id===c.pageId)?c.pageId:(current.site.sitePages.find(p=>p.id==='home')||current.site.sitePages[0])?.id;
  propertyView=pageId==='properties'&&propertyCategories.some(([id])=>id===c.propertyView)?c.propertyView:'all';
  sectionId=page()?.sections.some(s=>s.id===c.sectionId)?c.sectionId:null;
  locale=current.site.languages.some(l=>l.code===c.locale)?c.locale:current.site.defaultLanguage;
  recordId=c.recordId||null;for(const key of Object.keys(inlineSelection))delete inlineSelection[key];
  if(c.inlineSelection&&typeof c.inlineSelection==='object')for(const group of ['categories','services','projects','team','reviews'])if(typeof c.inlineSelection[group]==='string')inlineSelection[group]=c.inlineSelection[group];
  device=['desktop','tablet','mobile'].includes(c.device)?c.device:'desktop';
  selectedDesignTarget=c.designTarget?.root===current.root&&c.designTarget.pageId===pageId&&c.designTarget.sectionId===sectionId&&c.designTarget.locale===locale&&typeof c.designTarget.id==='string'&&typeof c.designTarget.text==='string'?c.designTarget:null;designRole=['heading','body','button','accent'].includes(c.designRole)?c.designRole:c.designRole==='element'&&selectedDesignTarget?'element':'heading';inspectorPane=c.inspectorPane==='publish'?'advanced':['content','images','appearance','advanced'].includes(c.inspectorPane)?c.inspectorPane:'content';
  treeCollapsed=c.treeCollapsed===true;treeSearch=typeof c.treeSearch==='string'?c.treeSearch:'';$('tree-search').value=treeSearch;
  previewOnly=c.previewOnly===true;updatePreviewMode();lastPreviewScroll=Math.max(0,Number(c.scroll)||0);
  document.querySelectorAll('[data-device]').forEach(b=>{b.classList.toggle('selected',b.dataset.device===device);b.setAttribute('aria-pressed',String(b.dataset.device===device))});$('preview-sheet').className='preview-sheet '+(device==='desktop'?'':device);
  // Show the workspace immediately, even while template fields are loading.
  templateEntries=[];renderAll();refreshPreview(true,{reuse:true});
  await loadTemplate();if(epoch!==navigationEpoch||current?.root!==root||area!=='website')return;
  renderInspector();focusPreview(false);
 }
 const labels={categories:'Kategorier',services:'Tjenester',projects:'Prosjekter',team:'Ansatte',reviews:'Kundeomtaler'};
 const singular={categories:'kategori',services:'tjeneste',projects:'prosjekt',team:'ansatt',reviews:'omtale'};
 const inlineSelection={};
 function sectionCollection(p,s){
  if(!p||!s)return null;
  if(['services','projects','reviews','team'].includes(s.type))return s.type;
  if(s.type!=='template')return null;
  if(['services','projects','reviews','team'].includes(s.slot))return s.slot;
  if(s.slot==='listing'&&['services','projects','reviews'].includes(p.id))return p.id;
  return null;
 }
 const legacyImageSlots=['hero','hero-square','hero-terrace','interior','repairs','electric','aircon','pool','keys','about-team','project-before','project-after','project-terrace','project-bathroom','project-pool','med-courtyard','med-holiday'];
 const originalSlots=()=>current?.rendererHints?.globalImageSlots??legacyImageSlots;
 const local=value=>typeof value==='string'?value:(value?.[locale]??value?.[current?.site.defaultLanguage]??'');
 const pages=()=>[...current.site.sitePages].sort((a,b)=>(a.order??0)-(b.order??0));
 const allLocales=()=>[...current.site.languages].sort((a,b)=>(a.order??0)-(b.order??0));
 const page=()=>current.site.sitePages.find(x=>x.id===pageId)||current.site.sitePages[0];
 const section=()=>page()?.sections.find(x=>x.id===sectionId);
 const records=(collection=tab)=>[...(current.site[collection]||[])].sort((a,b)=>(a.order??0)-(b.order??0));
 const selectedRecordId=(collection)=>tab==='pages' ? (records(collection).some(x=>x.id===inlineSelection[collection])?inlineSelection[collection]:records(collection)[0]?.id) : recordId;
 const record=(collection=tab,id=selectedRecordId(collection))=>records(collection).find(x=>x.id===id);
 const asset=()=>media.find(x=>x.id===mediaId);
 const groupPage={categories:'services',services:'services',projects:'projects',team:'about',reviews:'reviews'};
 const types={template:'Malseksjon',hero:'Hovedbilde',text:'Tekst',imageText:'Bilde og tekst',gallery:'Galleri',cta:'Kontaktfelt',services:'Tjenester',projects:'Prosjekter',reviews:'Kundeomtaler',team:'Ansatte'};
 const sectionLabel=s=>s.type==='template'?({hero:'Hovedbilde',trust:'Trygghet',services:'Tjenester',why:'Hvorfor velge oss',projects:'Prosjekter',reviews:'Kundeomtaler',team:'Ansatte',cta:'Kontakt',listing:'Oversikt',faq:'Spørsmål og svar',process:'Arbeidsflyt',overview:'Introduksjon',intro:'Om oss',values:'Verdier',form:'Kontaktskjema',share:'Del omtale'}[s.slot]||s.slot):local(s.title)||types[s.type];
 function toast(msg,error=false){const e=$('toast');e.textContent=msg;e.classList.toggle('is-error',error);e.hidden=false;clearTimeout(timer);timer=setTimeout(()=>e.hidden=true,5000)}
 const input=(caption,action,field,value,{localized=false,textarea=false,note='',max=10000,extra=''}={})=>`<div class="field"><label>${esc(caption)}</label>${textarea?`<textarea data-command="${action}" data-field="${field}" ${localized?'data-localized="1"':''} ${extra} maxlength="${max}">${esc(value)}</textarea>`:`<input type="text" data-command="${action}" data-field="${field}" ${localized?'data-localized="1"':''} ${extra} value="${esc(value)}" maxlength="${max}">`}${note?`<small class="field-note">${esc(note)}</small>`:''}</div>`;
 const check=(caption,action,field,value,{extra='',disabled=false}={})=>`<div class="field-check"><label>${esc(caption)}</label><input class="switch" type="checkbox" data-command="${action}" data-field="${field}" ${extra} ${value?'checked':''} ${disabled?'disabled':''} aria-label="${esc(caption)}"></div>`;
 const select=(caption,command,field,value,options,extra='')=>`<div class="field"><label>${esc(caption)}</label><select data-command="${command}" data-field="${field}" ${extra}>${options.map(x=>`<option value="${esc(x.value)}" ${x.value===value?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>`;
 const info=(text)=>`<div class="lock-note">${esc(text)}</div>`;
 const localizedValue=(obj,field)=>local(obj?.[field]);
 function mediaSrc(m,preset='gallery'){
  const paths=m?.variants?.[preset];return paths?.at(-1)||m?.src||'';
 }
 function mediaOptions(preset='gallery',currentValue='',contextCategory){
  const preferred=contextCategory||({hero:'background',portrait:'team',logo:'graphics',favicon:'graphics'})[preset];
  const pool=(['logo','favicon'].includes(preset)?media.filter(m=>m.kind==='logo'):media);const choices=[...pool].sort((a,b)=>Number(!!b.categories?.includes(preferred))-Number(!!a.categories?.includes(preferred))).map(m=>({value:mediaSrc(m,preset),label:m.originalName||m.id}));
  if(currentValue&&!choices.some(c=>c.value===currentValue))choices.unshift({value:currentValue,label:'Nåværende bilde'});
  return choices;
 }
 function mediaChoice(label,target,field,currentValue,preset='gallery',{allowEmpty=false,uploadLabel='',cssClass=''}={}){
  const opts=mediaOptions(preset,currentValue,({service:'services',project:'projects',team:'team',brand:'graphics'})[target.kind]),targetJSON=esc(JSON.stringify(target));
  if(allowEmpty)opts.unshift({value:'',label:['brand','assistant'].includes(target.kind)?'— Ikke valgt —':'— Ingen portrett valgt —'});
  const thumb=currentValue&&currentValue.startsWith('/assets/')?`<img class="image-choice-thumb" src="${esc(current.previewBase+currentValue)}" alt="Valgt bilde for ${esc(label)}" loading="lazy">`:'';
  return `<div class="field media-choice ${esc(cssClass)}"><label>${esc(label)}</label>${thumb}${currentValue?`<button type="button" class="btn btn-quiet media-open-library" data-open-media-src="${esc(currentValue)}">Åpne i Medier</button>`:''}${allowEmpty&&!currentValue?`<div class="portrait-empty-state">${['brand','assistant'].includes(target.kind)?'Ingen bildefil er valgt.':'Ingen portrett er valgt for denne ansatte.'}</div>`:''}<select data-media-target="${targetJSON}" data-media-field="${esc(field)}" data-preset="${preset}">${opts.map(o=>`<option value="${esc(o.value)}" ${o.value===currentValue?'selected':''}>${esc(o.label)}</option>`).join('')}</select><button type="button" class="btn btn-outline media-upload-in-context" data-upload-media-target="${targetJSON}" data-upload-media-field="${esc(field)}" data-upload-media-preset="${preset}" data-current-image="${esc(currentValue)}">${esc(currentValue?'Bytt bilde':uploadLabel||'Last opp nytt bilde til dette feltet')}</button></div>`;
 }
 function updateTop(){
  $('project-name').textContent=current.site.brand?.displayName||current.root.split(/[\\/]/).filter(Boolean).at(-1)||current.root;$('project-switch').title=current.root;$('dirty-tag').hidden=!current.dirty&&!window.wsetPropertyDrafts?.hasPending();$('save-btn').disabled=!current.dirty&&!inlineSession&&!window.wsetPropertyDrafts?.hasPending();$('generate-btn').disabled=false;$('copy-btn').disabled=false;$('export-project-btn').disabled=false;$('save-template-btn').disabled=false;
  $('undo-btn').disabled=!current.canUndo||exportBusy;$('redo-btn').disabled=!current.canRedo||exportBusy;
  $('page-heading').textContent=pageId==='properties'&&propertyView!=='all'?propertyLabel(propertyView):local(page()?.title)||'Forsiden';
  $('preview-status').textContent=page()?.enabled===false?'Siden er skjult i publisering':pageId==='properties'?(propertyView!=='all'&&!propertyOn(propertyView)?'Kategorien er skjult i publisering':'Lokale XML-filer · serverdata ikke kontrollert'):'Klikk for å velge · Dobbeltklikk på tekst for å redigere';
  $('validation-short').textContent=current.report.ok?current.report.warnings.length?`${current.report.warnings.length} advarsler`:'Prosjektdata er gyldige':current.report.errors.slice(0,2).join(' · ');
  $('validation-short').style.color=current.report.ok?'#597669':'#af4b4b';
  $('preview-lang').innerHTML=allLocales().map(l=>`<option value="${esc(l.code)}" ${locale===l.code?'selected':''}>${esc(l.flag)} ${esc(l.name)}${l.enabled===false?' · utkast':''}</option>`).join('');
 }
 function renderPagesTree(){
  const query=treeSearch.trim().toLocaleLowerCase();
  const pageRows=pages().filter(p=>!query||local(p.title).toLocaleLowerCase().includes(query)||p.sections.some(s=>sectionLabel(s).toLocaleLowerCase().includes(query))).map(p=>{
   const selected=p.id===pageId;
   const title=esc(local(p.title));
   return `<div class="sidebar-page-wrap" data-tree-drag-page="${esc(p.id)}" draggable="${p.id!=='home'}"><div class="page-row ${selected?'active':''}"><button type="button" class="page-select" data-page="${esc(p.id)}" aria-current="${selected?'page':'false'}"><span class="page-icon" data-tree-chevron="${esc(p.id)}" aria-hidden="true">${selected&&!treeCollapsed?'⌄':'›'}</span><span class="page-name">${title}${p.enabled===false?' · Skjult':''}</span><span class="page-drag-handle" aria-hidden="true">${p.id==='home'?'':'⠿'}</span></button><details class="page-actions"><summary aria-label="Sidehandlinger" title="Sidehandlinger">···</summary><div class="page-action-menu"><label>Synlig <input class="switch" type="checkbox" data-toggle-page="${esc(p.id)}" ${p.enabled!==false?'checked':''} ${p.id==='home'?'disabled':''} aria-label="Vis ${title}"></label><button type="button" class="sidebar-page-delete" data-delete-page-shortcut="${esc(p.id)}" title="Slett ${title}" aria-label="Slett ${title}" ${['home','properties'].includes(p.id)?'disabled':''}>Slett side</button></div></details></div></div>${selected&&!treeCollapsed?sectionsForSelectedPage():''}`;
  }).join('');
  return `<div class="sidebar-flat-pages">${pageRows}</div>`;
  function sectionsForSelectedPage(){
   const selectedPage=pages().find(p=>p.id===pageId);
   if(!selectedPage)return '';
   if(selectedPage.id==='properties')return `<div class="sidebar-sections property-tree" role="group" aria-label="Boligkategorier">${propertyCategories.map(([id,name])=>`<div class="tree-section-row ${propertyView===id?'active':''}"><button type="button" class="sidebar-section-item" data-tree-property="${id}" aria-current="${propertyView===id?'true':'false'}"><span class="tree-dot ${propertyOn(id)&&selectedPage.enabled!==false?'':'muted'}"></span><span class="tree-section-title">${name}</span></button><input class="switch property-tree-switch" type="checkbox" data-toggle-property="${id}" ${propertyOn(id)?'checked':''} ${selectedPage.enabled===false?'disabled':''} aria-label="Vis ${name}" title="Vis ${name}"></div>`).join('')}</div>`;
   const title=esc(local(selectedPage.title));
   return `<div class="sidebar-sections" role="group" aria-label="Seksjoner på ${title}">${selectedPage.sections.map((s,i)=>{
    const active=sectionId===s.id,group=sectionCollection(selectedPage,s),list=group?records(group):[];
    const children=active&&group?`<div class="tree-records" role="group" aria-label="${esc(labels[group])}">${list.map((r,j)=>`<div class="tree-record-row ${selectedRecordId(group)===r.id?'active':''}" draggable="true" data-tree-drag-record="${esc(r.id)}" data-tree-group="${group}"><button type="button" class="tree-record-select" data-tree-record="${esc(r.id)}" data-tree-group="${group}" aria-current="${selectedRecordId(group)===r.id?'true':'false'}"><span class="tree-dot ${r.enabled===false||r.isVisible===false?'muted':''}"></span><span>${esc(local(r.title||r.head||r.role)||r.name||r.id)}</span></button><span class="tree-record-actions"><button type="button" data-tree-move-record="${esc(r.id)}" data-tree-group="${group}" data-direction="-1" ${j===0?'disabled':''} aria-label="Flytt opp">↑</button><button type="button" data-tree-move-record="${esc(r.id)}" data-tree-group="${group}" data-direction="1" ${j===list.length-1?'disabled':''} aria-label="Flytt ned">↓</button></span></div>`).join('')}<button type="button" class="tree-add-record" data-tree-add-record="${group}">+ Legg til ${esc(singular[group])}</button></div>`:'';
    return `<div class="tree-section-block"><div class="tree-section-row ${active?'active':''} ${s.enabled===false?'is-hidden':''}" draggable="true" data-tree-drag-section="${esc(s.id)}"><button type="button" data-sidebar-section="${esc(s.id)}" class="sidebar-section-item" aria-current="${active?'true':'false'}"><span class="tree-section-index">${i+1}</span><span class="tree-section-title">${esc(sectionLabel(s))}</span>${s.enabled===false?'<span class="tree-hidden-pill">Skjult</span>':''}${group?`<span class="tree-count">${list.length}</span>`:''}</button><span class="tree-move-actions"><button type="button" data-sidebar-move-section="${esc(s.id)}" data-direction="-1" ${i===0?'disabled':''} aria-label="Flytt seksjon opp">↑</button><button type="button" data-sidebar-move-section="${esc(s.id)}" data-direction="1" ${i===selectedPage.sections.length-1?'disabled':''} aria-label="Flytt seksjon ned">↓</button></span></div>${children}</div>`;
   }).join('')}${selectedPage.id==='properties'?'':'<button type="button" class="tree-add-section" data-tree-add-section>+ Legg til seksjon</button>'}</div>`;
  }
 }
 function renderPrimaryNavigation(){
  document.body?.classList.toggle('area-website',area==='website');
  document.body?.classList.toggle('area-properties',area==='properties');
  document.body?.classList.toggle('area-media',area==='media');
  document.body?.classList.toggle('area-languages',area==='languages');
  document.body?.classList.toggle('area-settings',area==='settings');
  document.body?.classList.toggle('nav-compact',navMode==='compact');
  document.body?.classList.toggle('wset-focus',focusMode);
  document.body?.classList.toggle('wset-tree-hidden',!treeVisible);
  document.body?.classList.toggle('wset-inspector-hidden',!inspectorVisible);
  document.body?.classList.toggle('area-overview',(area==='overview'||utilityAreas.includes(area))&&!focusMode);
  document.querySelectorAll('[data-area]').forEach(button=>{const active=button.dataset.area===area;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false')});
  document.querySelectorAll('#editor-tabs [data-tab]').forEach(button=>button.hidden=button.dataset.areaFor!==area);
  $('editor-tabs').hidden=true;$('content-type').hidden=area!=='website';$('content-type').value=tab;
  document.querySelectorAll('[data-area]').forEach(b=>b.disabled=!current&&!['overview','library','templates','server'].includes(b.dataset.area));
  $('workspace-heading').textContent=areaNames[area]||'Nettstedet';
  const hints={overview:'Prosjektoversikt og snarveier.',website:'Velg side, seksjon eller innhold.',properties:'Lokalt eiendomsregister og XML-kilder.',media:'Bilder og filvalg for nettstedet.',languages:'Språk og oversettelser på nettstedet.',settings:'Prosjektets bedriftsprofil, kontaktskjema og eksport.'};
  $('workspace-hint').textContent=hints[area]||'';
  $('template-badge').textContent='MAL';
  $('template-description').textContent=current?.template?.name||'Prosjektets nettsidemal';
  $('nav-collapse-btn').setAttribute('aria-expanded',String(navMode==='expanded'));
  $('nav-collapse-btn').setAttribute('aria-label',navMode==='expanded'?'Kompakt meny':'Utvid meny');
  $('nav-collapse-btn').title=navMode==='expanded'?'Kompakt meny':'Utvid meny';
  $('focus-mode-btn').setAttribute('aria-pressed',String(focusMode));
  $('focus-mode-btn').textContent='⛶';
  $('focus-mode-btn').setAttribute('aria-label',focusMode?'Avslutt fokusmodus':'Fokusmodus');
  $('focus-mode-btn').title=focusMode?'Avslutt fokusmodus (Esc)':'Maksimal arbeidsflate';
  for(const [id,visible,label] of [['toggle-tree-btn',treeVisible,'sidetreet'],['toggle-inspector-btn',inspectorVisible,'redigeringspanelet']]){const button=$(id);button.setAttribute('aria-pressed',String(visible));button.title=(visible?'Skjul ':'Vis ')+label+(id==='toggle-tree-btn'?' (Ctrl+Shift+1)':' (Ctrl+Shift+2)');button.setAttribute('aria-label',button.title);button.classList.toggle('selected',visible);}
  $('preview-status').textContent=previewOnly?'Forhåndsvisning uten redigeringsmarkeringer':'Klikk for å velge · Dobbeltklikk på tekst for å redigere';
 }
 function taskKey(){return 'wset-tasks-v1:'+(current.projectId||current.root);}
 function tasks(){try{const result=JSON.parse((window.wsetPrefs||localStorage).getItem(taskKey()));return Array.isArray(result)?result:[]}catch{return []}}
 function setTasks(items){try{(window.wsetPrefs||localStorage).setItem(taskKey(),JSON.stringify(items));renderTasks()}catch{toast('Kunne ikke lagre oppgaver lokalt.',true)}}
 function renderTasks(){$('manual-tasks').innerHTML=tasks().map((t,i)=>`<div class="task-row"><label><input type="checkbox" data-task-toggle="${i}" ${t.done?'checked':''}> <span>${esc(t.text)}</span></label><button type="button" class="btn btn-quiet" data-task-delete="${i}" aria-label="Slett oppgave">×</button></div>`).join('');}
 function renderOverview(){
  $('overview-project-name').textContent=current.site.brand?.displayName||current.root.split(/[\\/]/).filter(Boolean).at(-1)||'Nettsted';
  $('overview-project-root').textContent=current.root;
  $('overview-save-status').textContent=current.dirty?'Ulagrede endringer':'Prosjektet er lagret lokalt';const c=readContext(current.root);if(c.updated)$('overview-save-status').textContent+=' · Sist redigert: '+new Date(c.updated).toLocaleString();
  renderTasks();refreshHealth();
  const root=current.root, enabled=current.site.smartAssistant?.enabled===true;
  $('dashboard-modules').innerHTML=`<p>Smart Assistant: ${enabled?'PÅ':'AV'} · Kontrollerer modul …</p>`;
  api.assistantModuleStatus().then(m=>{if(current?.root!==root||area!=='overview')return;$('dashboard-modules').innerHTML=`<button class="health-area" data-overview-area="settings"><strong>Smart Assistant</strong><span>${enabled?'PÅ':'AV'} · ${m?'Installert v'+esc(m.version):'Ikke installert'} · Server ikke kontrollert</span></button><button class="health-area" data-overview-area="properties"><strong>Eiendommer</strong><span>${current.site.sitePages.some(p=>p.id==='properties'&&p.enabled!==false)?'Side aktiv':'Side skjult eller mangler'}</span></button><button class="health-area" data-overview-area="server"><strong>Server / FTP</strong><span>Filbehandler og tilkoblinger</span></button>`}).catch(()=>{$('dashboard-modules').textContent='Kunne ikke kontrollere modulbibliotek.'});
 }
 let healthRequest=0;
 async function refreshHealth(){
  const request=++healthRequest,root=current?.root;
  $('health-loading').hidden=false;$('health-loading').textContent='Laster prosjektstatus …';$('health-dashboard').hidden=true;
  try{
   const h=await api.health();
   if(request!==healthRequest||root!==current?.root||area!=='overview')return;
   $('health-loading').hidden=true;$('health-dashboard').hidden=false;
   const tile=(value,title,description)=>`<div class="health-metric"><strong>${esc(value)}</strong><span>${esc(title)}</span><small>${esc(description)}</small></div>`;
   $('health-metrics').innerHTML=tile(`${h.metrics.pages.active} / ${h.metrics.pages.total}`,'Aktive nettsider',`${h.metrics.pages.hidden} skjulte`)+tile(h.metrics.properties.count,'Eiendommer i XML',`${h.metrics.properties.files} lokale filer`)+tile(h.metrics.languages.active,'Aktive språk',`${h.metrics.languages.total-h.metrics.languages.translated} manglende tekster`)+tile(media.length,'Medier i biblioteket',`${h.metrics.media.count} importerte`);
   $('health-issue-total').textContent=`${h.issues.length} kontrollpunkter`;
   $('health-issues').innerHTML=h.issues.length?h.issues.map(i=>`<div class="health-issue health-${esc(i.severity)}"><span class="health-level">${i.severity==='error'?'Feil':i.severity==='warning'?'Advarsel':'Info'}</span><div><strong>${esc(i.title)}</strong><p>${esc(i.detail)}</p></div><button class="btn btn-outline" type="button" data-overview-area="${esc(i.area)}" ${i.tab?`data-overview-tab="${esc(i.tab)}"`:""}>Åpne ${esc(areaNames[i.area])}</button></div>`).join(''):'<p class="health-empty">Ingen avvik funnet i de tilgjengelige lokale kontrollene.</p>';
   $('health-areas').innerHTML=h.areas.map(a=>`<button type="button" class="health-area" data-overview-area="${esc(a.id)}"><strong>${esc(a.title)}</strong><span>${esc(a.detail)}</span><span aria-hidden="true">›</span></button>`).join('');
   $('health-languages').innerHTML=h.languages.map(l=>`<div class="health-locale"><strong>${esc(l.name||l.code)} (${esc(l.code)})</strong><span>${l.translated}/${l.total} · ${l.missing} mangler</span><div class="health-progress"><div style="width:${l.total?Math.round(l.translated/l.total*100):100}%"></div></div></div>`).join('')||'<p>Ingen aktive språk.</p>';
   $('health-publish').innerHTML=`<strong>Publiseringsstatus</strong><p>${esc(h.export.status)}</p><small>Ingen bekreftelse av live nettsted. ${h.validity.ok?'Lokal prosjektvalidering bestått.':`${h.validity.errors} lokale valideringsfeil.`}</small>`;
  }catch(error){if(request!==healthRequest)return;$('health-loading').hidden=false;$('health-loading').textContent='Kunne ikke hente prosjektstatus: '+(error.message||String(error));$('health-dashboard').hidden=true;}
 }
 async function chooseArea(next,requestedTab=null){
  if(!await commitContextField()||!await flushInline())return;
  if(!areaNames[next]||(next===area&&!requestedTab))return;
  if(!current){if(!['overview','library','templates','server'].includes(next))return;area=next;renderEmptyWorkspace();return;}
  if(area==='properties'&&tab==='propertyManager'&&!propertyManager.canLeave())return;
  if(next==='website'&&!requestedTab){await resume();return;}
  if(next==='website'&&requestedTab==='property-settings'){if(!current.site.sitePages.some(p=>p.id==='properties'))return;storeContext();navigationEpoch++;area='website';focusMode=false;tab='pages';pageId='properties';propertyView='all';sectionId=null;selectedDesignTarget=null;templateEntries=[];inspectorPane='advanced';treeCollapsed=false;renderAll();refreshPreview(false);return;}
  storeContext();clearTimeout(scrollSaveTimer);const epoch=++navigationEpoch;area=next;focusMode=false;if(next!=='overview')healthRequest++;
  if(next!=='overview'&&!utilityAreas.includes(next))tab=requestedTab&&areaTabs[next].includes(requestedTab)?requestedTab:areaTabs[next][0];
  if(!utilityAreas.includes(next)&&next!=='overview'&&labels[tab])recordId=records()[0]?.id||null;
  if(next==='media'){try{media=await api.mediaList()}catch(error){toast(error.message,true);} }
  if(epoch!==navigationEpoch)return;
  renderAll();if(next==='website')refreshPreview(false);
 }
 function closeProjectPopover(){$('project-popover').hidden=true;$('project-switch').setAttribute('aria-expanded','false')}
 async function showProjectPopover(){
  const menu=$('project-popover');if(!menu.hidden){closeProjectPopover();return;}
  try{recentProjects=typeof api.recentProjects==='function'?await api.recentProjects():(current?[{root:current.root,name:current.root.split(/[\\/]/).pop()}]:[])}
  catch(error){toast(error.message||String(error),true);recentProjects=[]}
  $('recent-project-list').innerHTML=recentProjects.map(project=>`<button type="button" class="project-recent ${project.root===current?.root?'current':''}" data-recent-project="${esc(project.root)}"><strong>${esc(project.name)}</strong><small>${project.root===current?.root?'Åpent':esc(project.updatedLabel||'')}</small></button>`).join('')||'<p class="sidebar-help">Ingen nylige prosjekter.</p>';
  menu.hidden=false;$('project-switch').setAttribute('aria-expanded','true');
 }
 function filterMedia(items,query,kind){
  const term=String(query||'').trim().toLocaleLowerCase();
  return items.filter(m=>(kind==='all'||(kind==='original'&&m.original)||(kind==='uploaded'&&!m.original)||(kind==='logo'&&m.kind==='logo'))&&(!term||[m.id,m.kind,m.src].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
 }
 function filterTranslations(entries,query,filter){
  const term=String(query||'').trim().toLocaleLowerCase();
  return entries.filter(e=>e.active&&String(e.source||'').trim()&&(filter!=='missing'||!String(e.value||'').trim())&&(!term||[e.key,e.source,e.value].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
 }
 function applyTranslationFilter(){
  const entries=document.querySelectorAll('.language-entry');let shown=0;
  entries.forEach(el=>{const match=(!translationSearch||el.dataset.searchText.includes(translationSearch.toLocaleLowerCase()))&&(translationFilter!=='missing'||el.dataset.missing==='true');el.hidden=!match;if(match)shown++;});
  const status=$('translation-results');if(status)status.textContent=`Viser ${shown} av ${entries.length} tekster`;
 }
 function renderSidebar(){
  document.querySelectorAll('.editor-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $('pages-pane').hidden=tab!=='pages';$('property-manager-pane').hidden=tab!=='propertyManager';if(tab==='propertyManager')propertyManager.renderSidebar();$('brand-pane').hidden=tab!=='brand';$('collections-pane').hidden=!labels[tab];$('media-pane').hidden=tab!=='media';$('languages-pane').hidden=tab!=='languages';
  if(tab==='pages')$('pages-list').innerHTML=renderPagesTree();
  if(labels[tab]){
   $('collection-heading').textContent=labels[tab].toUpperCase();
   $('new-record-btn').title='Legg til '+singular[tab];$('new-record-btn').setAttribute('aria-label','Legg til '+singular[tab]);
   $('collection-list').innerHTML=records().map(r=>`<button class="content-record ${recordId===r.id?'active':''}" data-record="${esc(r.id)}"><span>${esc(local(r.title||r.head||r.role)||r.name||r.id)}</span><small>${esc(r.id)} · ${r.isSample===true?'demo – kun forhåndsvisning':r.enabled===false||r.isVisible===false?'skjult':'aktiv'}</small></button>`).join('')||'<p class="empty-state">Ingen oppføringer ennå.</p>';
   if(tab==='team'&&!records('team').some(r=>r.isSample===true))$('collection-list').innerHTML+='<button type="button" class="btn btn-outline full-button" data-add-demo-team>+ Legg til 4 fiktive eksempelansatte</button>';
  }
  if(tab==='languages')$('languages-list').innerHTML=allLocales().map(l=>`<button class="content-record ${locale===l.code?'active':''}" data-select-language="${esc(l.code)}"><span>${esc(l.flag)} ${esc(l.name)}</span><small>/${esc(l.code)}/ · ${l.enabled===false?'Utkast':'Publisert'}</small></button>`).join('');
  if(tab==='media'){
   const filtered=filterMedia(media,mediaSearch,mediaFilter);
   $('media-list').innerHTML=filtered.map(m=>`<button class="media-tile ${mediaId===m.id?'selected':''}" data-media="${esc(m.id)}"><img src="${esc(current.previewBase+m.src)}" loading="lazy" alt=""><span>${esc(m.id)}</span></button>`).join('')||'<p class="empty-state media-empty">Ingen bilder samsvarer med søket.</p>';
   $('media-results').textContent=`Viser ${filtered.length} av ${media.length} bilder`;
   $('media-search').value=mediaSearch;$('media-filter').value=mediaFilter;
  }
  if(tab==='brand'){
   const b=current.site.brand;
   const assistant=current.site.smartAssistant||{enabled:false,showLauncher:true,displayName:'Smart Assistant',endpoint:''};
   $('brand-form').innerHTML=input('Firmanavn','brand:update','displayName',b.displayName)+input('Kortnavn','brand:update','shortName',b.shortName)+input('Logo-tekst','brand:update','logoSubtitle',b.logoSubtitle)+input('Juridisk navn','brand:update','legalName',b.legalName)+input('Dekningsområde','brand:update','area',b.area)+input('Telefon','brand:update','phone',b.phone)+input('E-post','brand:update','email',b.email)+input('WhatsApp','brand:update','whatsapp',b.whatsapp)+`<hr class="separation"><div class="group-head"><h3>KONTAKTSKJEMA</h3></div>`+select('Skjemamodus','contact:update','mode',current.site.contactForm?.mode||'demo',[{value:'demo',label:'Demo – ingen e-post sendes'},{value:'smtp',label:'Aktivt – PHP/SMTP på webserver'}])+input('Personvernerklæring (HTTPS-adresse)','contact:update','privacyUrl',current.site.contactForm?.privacyUrl||'',{note:'Må være fylt ut før skjemaet kan aktiveres. SMTP-passord lagres på serveren, aldri i prosjektet.'});
   $('brand-form').innerHTML+=`<hr class="separation"><div class="group-head"><h3>AI-CHAT</h3></div>`+select('AI-chat','assistant:update','enabled',String(assistant.enabled===true),[{value:'false',label:'AV'},{value:'true',label:'PÅ'}])+input('Assistentnavn','assistant:update','displayName',assistant.displayName||'Smart Assistant')+`<p class="sidebar-help">Når AI-chat er PÅ må en separat Smart Assistant-modul være importert i WSET. Velg nyeste modul-ZIP under «Generer nettside». Browserdel legges i 01-WWW.zip, PHP-motor i 02-UTENFOR-WWW.zip.</p>`;
  }
 }
 function editorLanguageSwitch(){
  if(area==='website')return '';
  return `<div class="inspector-language"><span>Rediger språk</span><div class="inspector-language-buttons" role="group" aria-label="Språk for innhold">${allLocales().map(l=>`<button type="button" class="${locale===l.code?'selected':''}" data-inspector-lang="${esc(l.code)}" aria-pressed="${locale===l.code?'true':'false'}" title="${esc(l.name)}${l.enabled===false?' – utkast':''}">${esc(l.flag||'🌐')} ${esc(l.code.toUpperCase())}</button>`).join('')}</div></div>`;
 }
 function inlineContentInspector(group){
  const chosen=selectedRecordId(group),item=record(group,chosen);
  if(!item)return group==='team'?`<div class="team-portrait-panel"><h3>INGEN ANSATTPROFIL ER OPPRETTET</h3><p class="field-note">Ingen ansattprofil er opprettet ennå. Opprett en ansattprofil, legg inn kontaktinformasjon og språk, og velg et portrett.</p><label class="field"><span>Navn på ansatt</span><input id="new-team-name" type="text" maxlength="160" placeholder="Skriv navn på ansatt" autocomplete="off"></label><button type="button" class="btn btn-outline full-button" data-add-record="team">+ Opprett ansattprofil</button><button type="button" class="btn btn-outline full-button" data-add-demo-team>+ Legg til 4 fiktive eksempelansatte</button></div>`:info(`Ingen ${singular[group]} er valgt. Opprett en ny oppføring under seksjonen til venstre.`);
  return `<div class="chosen-record"><span class="eyebrow">VALGT ${esc(singular[group].toUpperCase())}</span><strong>${esc(local(item.title||item.head||item.role)||item.name||item.id)}</strong><small>${item.isSample===true?'DEMO · kun i forhåndsvisning':item.enabled===false||item.isVisible===false?'Utkast · ikke publisert':'Synlig på nettsiden'}</small></div>`+collectionInspector(group,chosen,inspectorPane);
 }
 function templateTextInspector(group){
  const groups=new Map();const values=group?records(group).flatMap(r=>Object.values(r).flatMap(v=>typeof v==='string'?[v]:v&&typeof v==='object'&&!Array.isArray(v)?Object.values(v):[])).map(v=>String(v)):[];
  const homeHero=page()?.id==='home'&&section()?.slot==='hero';
  const heroParts=homeHero?['heroTitle','heroIntro'].flatMap(k=>local(current.site.pages.home[k]).split(/<[^>]*>/).map(x=>x.trim())):[];
  for(const [i,e] of templateEntries.entries()){
   if(!e.overridden&&(heroParts.includes(e.original)||values.includes(e.original)))continue;
   const key=e.group||'Seksjonsinnhold';if(!groups.has(key))groups.set(key,[]);groups.get(key).push({e,i});
  }
  const open=templateOpenGroups.get(templateContext())||new Set(['Seksjonsinnhold']);
  return [...groups].map(([name,items])=>`<details class="template-copy-details wset-content-group" data-copy-group="${esc(name)}" ${open.has(name)?'open':''}><summary>${esc(name)}</summary>${items.map(({e,i})=>`<div class="field"><label>${esc(e.label||'Tekst')}</label><textarea data-template-index="${i}" rows="${String(e.value).length>90?3:1}" maxlength="10000">${esc(e.overridden?e.value:decode(e.value))}</textarea></div>`).join('')}</details>`).join('');
 }
 const designRoles=[['heading','Overskrifter'],['body','Brødtekst'],['accent','Fremhevet tekst'],['button','Knapper']];
 const designFonts=[['system','System'],['arial','Arial'],['georgia','Georgia'],['verdana','Verdana'],['times','Times New Roman'],['tahoma','Tahoma']];
 function designTarget(){return selectedDesignTarget&&current&&selectedDesignTarget.root===current.root&&selectedDesignTarget.pageId===pageId&&selectedDesignTarget.sectionId===sectionId&&selectedDesignTarget.locale===locale?selectedDesignTarget:null;}
 function contextualTarget(){const t=designTarget();return area==='website'&&tab==='pages'&&inspectorPane==='content'&&t?.contextual?t:null;}
 function contextTranslationKey(t){const id=t.id.split(':');if(id[0]==='section')return `content.sections.${pageId}.${sectionId}.${id[1]}`;if(id[0]==='hero')return `content.pageContent.home.${id[1]}`;if(id[0]==='record'&&id[3]!=='name')return `content.${id[1]}.${id[2]}.${id.slice(3).join('.')}`;return null;}
 function contextualPanel(t){
  const d=current.site.wsetDesign?.sections?.[pageId]?.[sectionId]?.elements?.[locale]?.[t.id]||{},c=t.computed||{};
  const attrs='data-design-scope="element" data-design-role="heading"';
  const val=k=>d[k]??c[k]??'';
  const field=(name,html)=>`<div class="field"><label>${esc(name)}</label>${html}</div>`;
  const displayValue=k=>{const value=val(k);return k==='size'&&value!==''&&Number.isFinite(Number(value))?String(Math.round(Number(value)*10)/10):value;};
  const opt=(v,l,selected)=>`<option value="${esc(v)}" ${selected?'selected':''}>${esc(l)}</option>`;
  const font=c.fontFamily||'';const match=designFonts.find(([v,l])=>v==='system'?/^system-ui/i.test(font):font.split(',')[0].trim().replace(/^["']|["']$/g,'').toLowerCase()===l.toLowerCase());
  const f=d.font||match?.[0]||'';
  const styleSelect=(k,label,opts,value)=>field(label,`<select ${attrs} data-design-property="${k}" aria-label="${esc(label)}">${opts.map(([v,l])=>opt(v,l,String(v)===String(value))).join('')}</select>`);
  const num=(k,label,min,max,step=1)=>field(label,`<div class="wset-context-number"><input ${attrs} data-design-property="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(displayValue(k))}" aria-label="${esc(label)}" placeholder="Standard">${k==='size'||k==='radius'?'<span class="wset-context-unit" aria-hidden="true">px</span>':''}</div>`);
  const color=(k,label)=>field(label,`<div class="wset-context-color"><span class="wset-color-picker"><input ${attrs} data-design-property="${k}" type="color" value="${/^#[0-9a-f]{6}$/i.test(val(k))?esc(val(k)):'#000000'}" aria-label="${esc(label)}"><span class="wset-color-chevron" aria-hidden="true"></span></span><input ${attrs} data-design-property="${k}" type="text" value="${esc(val(k))}" maxlength="7" placeholder="Arv / standard" aria-label="${esc(label)} (HEX)"></div>`);
  const toggle=(k,on,off,label,glyph,active)=>`<button type="button" ${attrs} data-context-toggle="${k}" data-design-value="${active?off:on}" aria-label="${esc(label)}" title="${esc(label)}" aria-pressed="${active}">${glyph}</button>`;
  let controls='',reset='';
  if(t.styleable){controls=`<div class="wset-context-format"><div class="wset-context-pair">${styleSelect('font','Skrifttype',[['',font?font.split(',')[0]+' (mal)':'Arv / standard'],...designFonts],f)}${num('size','Størrelse',10,96,.1)}</div>
   <div class="wset-context-toolbar" role="group" aria-label="Formatering">${toggle('weight','700','400','Fet','<b>B</b>',Number(val('weight'))>=600)}${toggle('italic','italic','normal','Kursiv','<i>I</i>',val('italic')==='italic')}${toggle('decoration','underline','none','Understreking','<u>U</u>',val('decoration')==='underline')}<span class="wset-context-separator"></span>${[['left','Venstre','≡'],['center','Midtstilt','≡'],['right','Høyre','≡']].map(([v,l,g])=>`<button type="button" ${attrs} data-context-toggle="align" data-design-value="${v}" aria-label="${l}" title="${l}" aria-pressed="${val('align')===v||val('align')===(v==='left'?'start':v==='right'?'end':'')}" class="wset-align-${v}"><span></span><span></span><span></span></button>`).join('')}</div>${color('color','Tekstfarge')}`;
   if(t.button)controls+=`${color('background','Bakgrunnsfarge')}${num('radius','Avrunding (px)',0,40)}`;
   controls+=`<details class="wset-context-extra" ${contextExtraOpen.has(contextExtraKey(t))?'open':''}><summary>Avansert formatering</summary>${styleSelect('weight','Skriftvekt',[['','Arv / standard'],['400','Normal'],['500','Medium'],['600','Halvfet'],['700','Fet'],['800','Ekstra fet']],val('weight'))}${num('lineHeight','Linjehøyde',1,2.5,.1)}</details></div>`;
   reset=`<button type="button" class="wset-context-reset" ${attrs} data-design-reset><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8a6 6 0 1 1 0 4M4 3v5h5"/></svg>Tilbakestill formatering</button>`;
  }else controls='<p class="wset-design-context">Formatering styres av malen eller seksjonen.</p>';
  const link=t.button&&t.id==='section:buttonText'&&['cta','text','imageText'].includes(section()?.type)?select('Knappen åpner side','section:update','target',section().target||'contact',current.site.sitePages.map(x=>({value:x.id,label:local(x.title)}))):'';
  return `<div class="wset-context-editor">${controls}<div class="field wset-context-text-field"><label>${esc(t.label||'Tekst')}</label><textarea data-context-text ${typeof t.expected!=='string'?'disabled':''} aria-label="Rediger tekst" maxlength="10000" rows="${t.text.length>90?4:2}">${esc(t.text)}</textarea></div>${contextTranslationKey(t)?`<div class="field"><label>Oversett til</label><select id="context-translate-target">${current.site.languages.filter(l=>l.enabled!==false&&l.code!==locale).map(l=>`<option value="${esc(l.code)}">${esc(l.name)}</option>`).join('')}</select><button type="button" class="btn btn-outline" data-context-translate>Oversett tekstfelt</button></div>`:''}${link}${reset}<div class="wset-context-footer"><button type="button" class="wset-context-back" data-context-back>‹ Hele seksjonen</button></div></div>`;
 }
 function designPanel(global=false){
  const target=global?null:designTarget();const role=global?globalDesignRole:designRole;
  const scope=global?'global':role==='element'&&target?'element':'section';const actualRole=role==='element'?'heading':role;
  const d=current.site.wsetDesign||{},sec=d.sections?.[pageId]?.[sectionId];
  const style=(scope==='global'?d.global?.[actualRole]:scope==='element'?sec?.elements?.[locale]?.[target.id]:sec?.roles?.[actualRole])||{};
  const attrs=`data-design-scope="${scope}" data-design-role="${actualRole}"`;
  const field=(key,label,control)=>`<div class="field wset-design-field"><label>${esc(label)}</label>${control}</div>`;
  const options=(list,value)=>list.map(([v,label])=>`<option value="${esc(v)}" ${String(value??'')===String(v)?'selected':''}>${esc(label)}</option>`).join('');
  const sel=(key,label,list)=>field(key,label,`<select ${attrs} data-design-property="${key}" aria-label="${esc(label)}">${options([['','Arv / standard'],...list],style[key])}</select>`);
  const number=(key,label,min,max,step=1)=>field(key,label,`<input ${attrs} data-design-property="${key}" aria-label="${esc(label)}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(style[key]??'')}" placeholder="Arv / standard">`);
  const color=(key,label)=>field(key,label,`<div class="wset-design-color"><input ${attrs} data-design-property="${key}" type="color" value="${/^#[0-9a-f]{6}$/i.test(style[key]||'')?esc(style[key]):'#103c45'}" title="Velg farge" aria-label="${esc(label)}"><input ${attrs} data-design-property="${key}" type="text" maxlength="7" value="${esc(style[key]||'')}" placeholder="Arv / standard" aria-label="${esc(label)} (HEX)"></div>`);
  let out=`<div class="wset-design-controls"><div class="field"><label>Teksttype</label><select data-design-choose="${global?'global':'section'}" aria-label="Teksttype">${options([...designRoles,...(target?[['element','Valgt tekstelement']]:[])],scope==='element'?'element':actualRole)}</select></div>`;
  if(scope==='element')out+=`<p class="wset-design-context">${esc(target.text.slice(0,100))} · ${esc(locale.toUpperCase())}</p>`;
  else out+=`<p class="wset-design-context">${global?'Alle statiske innholdssider':'Valgt seksjon'} · Alle språk</p>`;
  out+=sel('font','Skrifttype',designFonts)+`<div class="wset-design-pair">${number('size','Størrelse (px)',10,96)}${number('lineHeight','Linjehøyde',1,2.5,.1)}</div>`;
  out+=color('color','Tekstfarge')+`<div class="wset-design-pair">${sel('weight','Skriftvekt',[['400','Normal'],['500','Medium'],['600','Halvfet'],['700','Fet'],['800','Ekstra fet']])}${sel('italic','Skriftstil',[['normal','Normal'],['italic','Kursiv']])}</div>`;
  out+=sel('align','Tekstjustering',[['left','Venstre'],['center','Midtstilt'],['right','Høyre']]);
  if(scope!=='element'&&actualRole==='button')out+=color('background','Bakgrunnsfarge')+number('radius','Avrunding (px)',0,40);
  out+=`<button type="button" class="btn btn-outline full-button" ${attrs} data-design-reset>Tilbakestill til standard</button></div>`;
  return out;
 }
 function designCommand(node,reset=false){const scope=node.dataset.designScope;const property=reset?'reset':node.dataset.contextToggle||node.dataset.designProperty;let value=reset?null:String(node.dataset.designValue??node.value).trim();if(value==='')value=null;else if(['size','radius','lineHeight'].includes(property))value=Number(value);
  const t=designTarget();return {action:'design:update',scope,role:node.dataset.designRole,property,value,...(scope==='global'?{}:{pageId,sectionId,locale,targetId:t?.id})};}
 function pageInspector(){
  const p=page(),s=section();if(!p)return info('Ingen side valgt.');
  let out='';
  if(!s){
   if(p.id==='properties'&&propertyView!=='all'){
    if(inspectorPane==='content')return propertyCategoryFields('content');
    if(inspectorPane==='publish')return propertyCategoryFields('settings');
    return '';
   }
   if(inspectorPane==='content'){
    out+=editorLanguageSwitch();
    out+=`<div class="group-head"><h3>SIDEINFORMASJON</h3><span class="pill">/${esc(p.slug)}/</span></div>`;
    out+=input('Sidetittel','page:update','title',p.title?.[locale]||'',{localized:true,max:140});
    if(!['home','properties'].includes(p.id))out+=input('Nettadresse (slug)','page:update','slug',p.slug,{max:100,note:'Påvirker lenkene til siden på alle språk.'});
    if(p.id==='properties')out+=propertyCategoryFields('content');
    
    if(p.id!=='properties')out+='<div class="group-head"><h3>LEGG TIL SEKSJON</h3></div><div class="add-section"><select id="section-type" aria-label="Seksjonstype">'+['hero','text','imageText','gallery','cta','services','projects','reviews','team'].map(t=>`<option value="${t}">${types[t]}</option>`).join('')+'</select><button data-add-section>+ Legg til</button></div>';
   }else if(inspectorPane==='publish'){
    out+=check('Vis side på nettsiden','page:update','enabled',p.enabled!==false,{disabled:p.id==='home'});
    out+=check('Vis i hovedmeny','page:update','showInNavigation',p.showInNavigation!==false);
    if(p.id==='properties')out+=propertyCategoryFields('settings');
    else out+=info(p.enabled!==false?'Denne siden er med i publiseringen. Skjuler du siden, forsvinner også lenken ved neste eksport.':'Denne siden er et utkast og blir ikke eksportert.');
   }else if(inspectorPane==='advanced'){
    out+=input('SEO-tittel · '+locale.toUpperCase(),'page:update','seoTitle',p.seoTitle?.[locale]||'',{localized:true,max:140});
    out+=input('SEO-beskrivelse · '+locale.toUpperCase(),'page:update','seoDescription',p.seoDescription?.[locale]||'',{localized:true,textarea:true,max:300});
    out+='<div class="group-head"><h3>SIDEHANDLINGER</h3></div>';
    out+=`<div class="arrow-group"><button class="btn btn-outline" data-move-page="-1">↑ Flytt side</button><button class="btn btn-outline" data-move-page="1">↓ Flytt side</button></div>`;
    if(!['home','properties'].includes(p.id))out+='<hr class="separation"><button class="danger-button" data-delete-page>Fjern side og alle seksjoner</button>';
   }else out+=info('Velg en seksjon i sidetreet for å redigere bildene som hører til den.');
   return out;
  }
  const group=sectionCollection(p,s);
  if(contextualTarget())return contextualPanel(contextualTarget());
  if(inspectorPane==='appearance')return designPanel();
  if(inspectorPane==='content'){
   out+=editorLanguageSwitch();
   if(group)out+=inlineContentInspector(group);
   if(s.type==='template'&&p.id==='home'&&s.slot==='team'&&(current.rendererHints?.imageSlots?.team?.home??(!current.rendererHints?'about-team':null))){
    out+=`<div class="team-media-shortcut"><strong>Illustrasjonsbilde for personell på forsiden</strong><p>Dette er det store bildet i Team-seksjonen på forsiden. Det er ikke et portrett knyttet til en ansatt.</p>${mediaChoice('Bilde i personellseksjonen',{kind:'section',pageId:p.id,id:s.id},'image',s.image||current.site.brand.images?.[current.rendererHints?.imageSlots?.team?.home||'about-team']||`/assets/${current.rendererHints?.imageSlots?.team?.home||'about-team'}.webp`,'hero',{uploadLabel:'Bytt / last opp bilde for personellseksjonen'})}</div>`;
   }
   if(s.type==='template'&&p.id==='home'&&s.slot==='hero'){
    out+=input(`Hovedoverskrift · ${locale.toUpperCase()}`,'content:update','heroTitle',current.site.pages.home.heroTitle?.[locale]||'',{localized:true,textarea:true,note:'Linjeskift og utheving med br/em er støttet.'});
    out+=input(`Ingress · ${locale.toUpperCase()}`,'content:update','heroIntro',current.site.pages.home.heroIntro?.[locale]||'',{localized:true,textarea:true});
   }
   if(s.type!=='template'&&['hero','text','imageText','gallery','cta'].includes(s.type)){
    out+=input('Overtittel','section:update','kicker',s.kicker?.[locale]||'',{localized:true});
    out+=input(`Overskrift · ${locale.toUpperCase()}`,'section:update','title',s.title?.[locale]||'',{localized:true,textarea:true});
    out+=input(`Tekst · ${locale.toUpperCase()}`,'section:update','text',s.text?.[locale]||'',{localized:true,textarea:true});
   }
   if(['cta','text','imageText'].includes(s.type))out+=input('Knappetekst','section:update','buttonText',s.buttonText?.[locale]||'',{localized:true})+select('Knappen åpner side','section:update','target',s.target||'contact',current.site.sitePages.map(x=>({value:x.id,label:local(x.title)})));
   if(s.type==='gallery')out+=(s.images||[]).map((img,i)=>`<div class="gallery-copy"><strong>Bilde ${i+1}</strong>${input('Alternativtekst','gallery:update','alt',img.alt?.[locale]||'',{localized:true,extra:`data-image-index="${i}"`})}${input('Bildetekst','gallery:update','caption',img.caption?.[locale]||'',{localized:true,extra:`data-image-index="${i}"`})}</div>`).join('')||info('Galleriet er tomt. Legg til bilder under Bilder.');
   if(s.type==='template')out+=templateTextInspector(group);
  }else if(inspectorPane==='images'){
   if(group)out+=inlineContentInspector(group);
   if(s.type==='template'){
    const templateImageSlots=current.rendererHints?.imageSlots??{hero:{home:'hero',about:'hero-square',contact:'hero-square',rental:'med-courtyard',projects:'hero-terrace',services:'med-holiday',reviews:'med-holiday'},team:{home:'about-team'},intro:{about:'med-courtyard'},why:{home:'hero-square'},overview:{rental:'hero-square'}};
    const slot=templateImageSlots[s.slot]?.[s.source];
    if(slot)out+=mediaChoice(s.slot==='team'?'Illustrasjonsbilde i personellseksjonen på forsiden (ikke ansattportrett)':'Bilde i seksjonen',{kind:'section',pageId:p.id,id:s.id},'image',s.image||(s.slot==='hero'&&s.source!=='home'&&current.site.pages?.[s.source]?.heroImageUrl)||current.site.brand.images?.[slot]||`/assets/${slot}.webp`,'hero');
   }
   if(['hero','imageText'].includes(s.type))out+=mediaChoice('Seksjonsbilde',{kind:'section',pageId:p.id,id:s.id},'image',s.image||(s.type==='hero'?'/assets/hero.webp':'/assets/hero-square.webp'),s.type==='hero'?'hero':'card');
   if(s.type==='gallery'){
    out+=`<div class="group-head"><h3>GALLERIBILDER</h3><span class="pill">${s.images?.length||0}</span></div>`;
    out+=(s.images||[]).map((img,i)=>`<div class="image-in-record"><img src="${esc(current.previewBase+img.src)}" alt=""><span>Bilde ${i+1}</span><button class="btn btn-outline" data-replace-ref="${esc(`section:${p.id}:${s.id}:gallery:${i}`)}" data-current-image="${esc(img.src)}">Bytt</button><button type="button" data-remove-gallery="${i}" class="danger-button">Fjern</button></div>`).join('');
    out+=select('Velg bilde','_galleryChoice','src','',mediaOptions('gallery'))+'<button class="btn btn-outline full-button" data-add-gallery>+ Legg til i galleri</button>';
   }
   if(!out)out+=info('Ingen egne bilder i denne seksjonen. Velg et tjenestekort eller en oppføring for å redigere tilhørende bilder.');
  }else if(inspectorPane==='publish'){
   out+=check('Vis hele seksjonen','section:update','enabled',s.enabled!==false);
   if(group)out+=inlineContentInspector(group);
   out+=info(s.enabled===false?'Seksjonen er skjult. Publiserte enkeltoppføringer vises heller ikke før seksjonen aktiveres.':'Seksjonen er aktiv. Du kan skjule individuelle kort uten å skjule hele seksjonen.');
  }else{
   out+='<div class="group-head"><h3>SEKSJONSHANDLINGER</h3></div>';
   out+=`<div class="arrow-group"><button class="btn btn-outline" data-move-section="${esc(s.id)}" data-direction="-1">↑ Opp</button><button class="btn btn-outline" data-move-section="${esc(s.id)}" data-direction="1">↓ Ned</button></div>`;
   if(s.type!=='template')out+=`<button class="btn btn-outline full-button" data-duplicate-section="${esc(s.id)}">Dupliser seksjon som utkast</button>`;
   if(group)out+=inlineContentInspector(group);
   out+=`<hr class="separation"><button class="danger-button" data-delete-section="${esc(s.id)}">Fjern hele seksjonen</button>`;
  }
  return out;
 }
 function collectionInspector(group=tab,id=selectedRecordId(group),pane=inspectorPane){
  const r=record(group,id);if(!r)return info(`Velg eller opprett en oppføring under ${labels[group]}.`);
  const cmd='collection:update',extra=`data-collection="${group}" data-record-id="${esc(r.id)}"`;
  let out='';
  const text=(caption,key,opts={})=>input(caption,cmd,key,opts.plain?r[key]??'':key==='items'?(r.items||[]).map(x=>local(x)).join('\n'):localizedValue(r,key),{localized:!opts.plain,textarea:opts.textarea!==false,note:opts.note||'',extra});
  if(pane==='content'){
   if(tab!=='pages')out+=editorLanguageSwitch();
   if(group==='categories')out+=text('Kategorinavn','title');
   if(group==='services')out+=text('Tjenestenavn','title')+text('Beskrivelse','desc')+text('Tjenestepunkter (ett per linje)','items',{note:'Hvert punkt oversettes for valgt språk.'})+select('Tjenestekategori',cmd,'type',r.type,current.site.categories.map(c=>({value:c.id,label:local(c.title)})),extra)+text('Ikon (navn)','icon',{plain:true,textarea:false});
   if(group==='projects')out+=text('Prosjektnavn','title')+text('Sted / kategori','place')+text('Beskrivelse','desc')+select('Kategori',cmd,'type',r.type,current.site.categories.map(c=>({value:c.id,label:local(c.title)})),extra);
   if(group==='team'){
    out+=text('Navn','name',{plain:true,textarea:false})+text('Rolle','role')+text('Beskrivelse','description');
    out+=text('Språk (ISO-koder, f.eks. no,es,en)','spokenLanguages',{plain:true,textarea:false,note:'Små flagg vises automatisk på kortet og i detaljvisningen.'});
    out+=text('Telefon (internasjonalt format)','phone',{plain:true,textarea:false})+text('E-post','email',{plain:true,textarea:false})+text('WhatsApp (internasjonalt nummer)','whatsapp',{plain:true,textarea:false});
    out+=`<div class="team-media-shortcut"><strong>Portrettbilde for ${esc(r.name||'den ansatte')}</strong><p>Velg eller last opp et bilde direkte her. Dette er portrettet som vises på ansattkortet på Om oss-siden, ikke illustrasjonen på forsiden.</p>${mediaChoice('Ansattportrett',{kind:'team',id:r.id},'portrait',r.portrait||'','portrait',{allowEmpty:true,uploadLabel:'Bytt / last opp ansattportrett',cssClass:'team-portrait-choice'})}${r.portrait?'<button type="button" class="danger-button full-button" data-remove-team-portrait>Fjern portrett</button>':''}</div>`;
   }
   if(group==='reviews')out+=text('Overskrift','head')+text('Kundeuttalelse','body')+text('Avsender / kategori','by')+text('Kilde','source',{plain:true,textarea:false});
  }else if(pane==='images'){
   if(group==='services')out+=mediaChoice('Bilde på tjenestekort',{kind:'service',id:r.id},'img',current.site.brand.images?.[r.img]||`/assets/${r.img}.webp`,'card');
   if(group==='projects'){
    out+=mediaChoice('Prosjektbilde',{kind:'project',id:r.id},'img',current.site.brand.images?.[r.img]||`/assets/${r.img}.webp`,'card');
    out+=mediaChoice('Før-bilde',{kind:'project',id:r.id},'beforeUrl',r.beforeUrl||'','gallery');
    out+=mediaChoice('Etter-bilde',{kind:'project',id:r.id},'afterUrl',r.afterUrl||'','gallery');
    out+=`<div class="group-head"><h3>PROSJEKTGALLERI</h3><span class="pill">${r.gallery?.length||0}</span></div>`;
    out+=(r.gallery||[]).map((src,i)=>`<div class="image-in-record"><img src="${esc(current.previewBase+(typeof src==='string'?src:src.url))}" alt=""><button class="btn btn-outline" data-replace-ref="${esc(`projects:${r.id}:gallery:${i}`)}" data-current-image="${esc(typeof src==='string'?src:src.url)}">Bytt</button><button type="button" class="danger-button" data-remove-project-gallery="${i}">Fjern</button></div>`).join('');
    out+=select('Velg bilde','_projectChoice','src','',mediaOptions('gallery'))+'<button class="btn btn-outline full-button" data-add-project-gallery>+ Legg til i galleri</button>';
   }
   if(group==='team'){
    out+=`<div class="team-portrait-panel"><h3>ANSATTPORTRETT</h3><p class="field-note">Dette portrettet tilhører kun ${esc(r.name||'den ansatte')}, ikke hele teamseksjonen.</p>`;
    out+=mediaChoice('Portrett for '+(r.name||'ansatt'),{kind:'team',id:r.id},'portrait',r.portrait||'','portrait',{allowEmpty:true,uploadLabel:'Last opp portrett for denne ansatte',cssClass:'team-portrait-choice'});
    out+=r.portrait?'<button type="button" class="danger-button full-button" data-remove-team-portrait>Fjern portrett</button>':'';
    out+='</div>';
   }
   if(!out)out+=info('Denne oppføringen har ingen egne bildefelt.');
  }else if(pane==='publish'){
   if(['services','projects','team','reviews'].includes(group))out+=check('Vis denne oppføringen på nettsiden','collection:publish','visible',r.enabled!==false&&r.isVisible!==false,{extra});
   else out+=check('Aktiv kategori','collection:update','enabled',r.enabled!==false,{extra});
   if(Object.hasOwn(r,'isSample'))out+=check(group==='team'?'Eksempelprofil (vises kun i forhåndsvisning)':'Merket som eksempelinnhold','collection:update','isSample',r.isSample!==false,{extra});
   if(group==='team'&&r.isSample===true)out+=info('DEMO: Denne profilen vises bare i WSET-forhåndsvisningen, ikke på det publiserte nettstedet. Fjern markeringen «Eksempelprofil» først når opplysningene er erstattet med en ekte ansatt.');
   if(group==='projects')out+=check('Fremhev på forsiden',cmd,'featuredOnHome',r.featuredOnHome!==false,{extra});
   if(group==='reviews'){
    out+=check('Bekreftet samtykke fra kunde',cmd,'permissionConfirmed',r.permissionConfirmed===true,{extra});
    out+=info('Ekte kundeomtaler kan bare publiseres når samtykke er bekreftet. Eksempelomtaler merkes som demo.');
   }
   if(group==='team'&&(r.enabled===false||r.isVisible===false))out+=info('Ansattprofilen er skjult. Aktiver den her for å vise portrett og profil på nettsiden.');
  }else{
   out+=`<div class="group-head"><h3>OPPFØRING</h3><span class="pill">${esc(r.id)}</span></div>`;
   out+=`<div class="arrow-group"><button class="btn btn-outline" data-move-record="-1">↑ Opp</button><button class="btn btn-outline" data-move-record="1">↓ Ned</button></div>`;
   out+=`<button class="btn btn-outline full-button" data-duplicate-record>Dupliser som utkast</button>`;
   out+=`<hr class="separation"><button class="danger-button" data-delete-record>Fjern ${esc(singular[group])}</button>`;
  }
  return out;
 }
 const standardMediaCategories=[['background','Bakgrunnsbilder'],['website','Nettsidebilder'],['services','Tjenester'],['projects','Prosjekter'],['team','Ansatte'],['reviews','Kundeomtaler'],['graphics','Logo og grafikk']];
 function mediaCategories(){return [...standardMediaCategories,...(current.site.media?.workspace?.categories||[]).map(c=>[c.id,c.name])];}
 function mediaCategoryName(id){return mediaCategories().find(c=>c[0]===id)?.[1]||id;}
 function inMediaCategory(m,id){return id==='all'||(id==='uncategorized'?!(m.categories||[]).length:(m.categories||[]).includes(id));}
 function mediaFilename(m){return m.originalName||m.id;}
 function mediaSize(n){return !Number.isFinite(n)?'–':n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' MB':Math.ceil(n/1024)+' KB';}
 function renderMediaWorkspace(){
  const host=$('media-workspace'),cats=mediaCategories(),selected=asset();if(!['all','uncategorized',...cats.map(c=>c[0])].includes(mediaCategory))mediaCategory='all';
  const term=mediaSearch.trim().toLocaleLowerCase();const filtered=media.filter(m=>inMediaCategory(m,mediaCategory)&&(mediaUsageFilter==='all'||(mediaUsageFilter==='used'?m.used:!m.used))&&(!term||[m.id,mediaFilename(m),...(m.categories||[]).map(mediaCategoryName)].some(v=>String(v).toLocaleLowerCase().includes(term))));
  filtered.sort((a,b)=>mediaSort==='newest'?(b.modified||0)-(a.modified||0):mediaSort==='size'?(b.bytes||0)-(a.bytes||0):mediaFilename(a).localeCompare(mediaFilename(b),'no'));
  const pageSize=24,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));mediaPage=Math.max(1,Math.min(mediaPage,totalPages));const visible=filtered.slice((mediaPage-1)*pageSize,mediaPage*pageSize);
  const active=selected&&filtered.some(m=>m.id===selected.id)?selected:null;
  const catButton=([id,name])=>`<button type="button" class="mw-category ${mediaCategory===id?'active':''}" data-mw-category="${esc(id)}" aria-pressed="${mediaCategory===id}"><span>${esc(name)}</span><small>${media.filter(m=>inMediaCategory(m,id)).length}</small></button>`;
  const opts=(pairs,value)=>pairs.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
  const card=m=>`<button class="mw-tile ${active?.id===m.id?'active':''}" data-mw-item="${esc(m.id)}" aria-pressed="${active?.id===m.id}" type="button"><img src="${esc(current.previewBase+m.src)}" loading="lazy" alt=""><span class="mw-tile-name" title="${esc(mediaFilename(m))}">${esc(mediaFilename(m))}</span><span class="mw-tile-tags">${(m.categories||[]).map(c=>`<small>${esc(mediaCategoryName(c))}</small>`).join('')||'<small>Ukategorisert</small>'}</span>${mediaView==='list'?`<small>${esc(mediaSize(m.bytes))}</small><small>${m.used?'I bruk':'Ingen registrert bruk'}</small>`:''}</button>`;
  host.innerHTML=`<header class="mw-header"><h1>Medier</h1><div class="mw-actions"><button class="btn btn-primary" data-mw-action="import" ${mediaBusy?'disabled':''}>Importer medier</button><button class="btn btn-outline" data-mw-action="import-logo" ${mediaBusy?'disabled':''}>Importer logo / SVG</button></div></header><div class="mw-layout ${active?'has-detail':''}"><aside class="mw-categories"><div class="mw-cat-head"><h2>Kategorier</h2><button class="btn btn-outline" data-mw-action="new-category" title="Ny kategori">+</button></div>${[['all','Alle medier'],...cats,['uncategorized','Ukategorisert']].map(catButton).join('')}${mediaCategory.startsWith('custom-')?'<div class="mw-actions mw-category-actions"><button class="btn btn-outline" data-mw-action="rename-category">Endre navn</button><button class="btn btn-outline" data-mw-action="remove-category">Fjern kategori</button></div>':''}</aside><div class="mw-main"><div class="mw-tools"><input id="mw-search" type="search" placeholder="Søk etter medier …" aria-label="Søk etter medier" value="${esc(mediaSearch)}"><select id="mw-status" aria-label="Bruk">${opts([['all','Alle medier'],['used','I bruk'],['unused','Ikke i bruk']],mediaUsageFilter)}</select><select id="mw-sort" aria-label="Sorter">${opts([['name','Filnavn'],['newest','Nyeste først'],['size','Største først']],mediaSort)}</select><div class="mw-view"><button type="button" data-mw-view="grid" title="Kortvisning" aria-label="Kortvisning" aria-pressed="${mediaView==='grid'}" class="${mediaView==='grid'?'active':''}">▦</button><button type="button" data-mw-view="list" title="Listevisning" aria-label="Listevisning" aria-pressed="${mediaView==='list'}" class="${mediaView==='list'?'active':''}">☰</button></div></div><p class="mw-count">${filtered.length} medier</p><div class="mw-gallery ${mediaView==='list'?'mw-list':''}">${visible.map(card).join('')||'<p class="mw-empty">Ingen medier i denne visningen.</p>'}</div>${totalPages>1?`<div class="mw-pagination"><button class="btn btn-outline" data-mw-page="${mediaPage-1}" ${mediaPage===1?'disabled':''}>Forrige</button><span>${mediaPage} / ${totalPages}</span><button class="btn btn-outline" data-mw-page="${mediaPage+1}" ${mediaPage===totalPages?'disabled':''}>Neste</button></div>`:''}</div>${active?mediaDetails(active):''}</div>`;
 }
 function mediaDetails(m){
  const currentCategories=m.categories||[],manual=m.manual||[],inferred=m.inferred||[];
  return `<aside class="mw-detail"><div class="mw-detail-head"><h2>Bildeinformasjon</h2><button class="btn btn-quiet" data-mw-action="close-detail" title="Lukk bildeinformasjon" aria-label="Lukk bildeinformasjon">×</button></div><img class="mw-image" src="${esc(current.previewBase+m.src)}" alt="">${m.placements?.length||(!m.legacy&&!m.used&&m.original)?'<button class="btn btn-primary mw-replace-primary" data-mw-action="replace">Bytt bilde</button>':''}<p class="mw-usage ${m.used?'used':''}">${m.used?`I bruk · ${m.placements?.length||(m.usage||[]).length} registrerte referanser`:'Ingen registrerte referanser'}</p><details open><summary>Filinformasjon</summary><dl><dt>Filnavn</dt><dd>${esc(mediaFilename(m))}</dd><dt>Format</dt><dd>${esc(mediaFilename(m).split('.').at(-1).toUpperCase())}</dd><dt>Størrelse</dt><dd>${mediaSize(m.bytes)}</dd><dt>Oppløsning</dt><dd>${m.width&&m.height?`${m.width} × ${m.height} px`:'–'}</dd><dt>Original</dt><dd>${m.legacy?'Malfil / eksisterende nettfil':'Bevart'}</dd></dl></details><details open><summary>Kategorier</summary><div class="mw-category-edit">${mediaCategories().map(([id,name])=>`<label><input type="checkbox" data-mw-assign="${esc(id)}" ${currentCategories.includes(id)?'checked':''} ${inferred.includes(id)?'disabled':''}>${esc(name)}${inferred.includes(id)?'<small>Automatisk</small>':''}</label>`).join('')}</div></details><details open><summary>Brukes på</summary><ul class="mw-refs">${(m.placements||[]).map((x,i)=>`<li><button class="mw-ref-link" data-mw-ref="${i}" title="Åpne i redigering">${esc(x.title)} <span aria-hidden="true">›</span></button></li>`).join('')||(m.usage||[]).map(x=>`<li>${esc(x.title)}</li>`).join('')||'<li>Ingen registrert bruk</li>'}</ul></details>${mediaAltControls(m)}${!m.legacy&&m.kind!=='logo'&&m.original?`<details><summary>Fokuspunkt</summary><label>Horisontalt <input type="range" id="mw-x" min="0" max="100" value="${m.focusX??50}"></label><label>Vertikalt <input type="range" id="mw-y" min="0" max="100" value="${m.focusY??50}"></label><button class="btn btn-outline" data-mw-action="reframe">Oppdater utsnitt</button></details>`:''}<details><summary>Bruk i bildeplass</summary><label>Bildeplass<select id="mw-slot">${originalSlots().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Variant<select id="mw-preset"><option value="hero">Hovedbilde</option><option value="card">Kort</option><option value="portrait">Portrett</option><option value="gallery">Galleri</option></select></label><button class="btn btn-outline" data-mw-action="assign-slot">Bruk bildet</button></details><div class="mw-actions mw-detail-actions">${!m.legacy&&m.original?'<button class="btn btn-outline" data-mw-action="download">Lagre original som …</button>':''}<button class="btn btn-outline mw-remove" data-mw-action="remove" title="Fjern bildet eller en bildetilknytning">Fjern bilde</button></div></aside>`;
 }
 function mediaAltControls(m){
  const paths=new Set(m.paths||[m.src]),fields=[];for(const p of current.site.sitePages||[])for(const s of p.sections||[]){if(s.type==='imageText'&&paths.has(s.image||'/assets/hero-square.webp'))fields.push({label:local(p.title)+' / '+sectionLabel(s),action:'section:update',pageId:p.id,id:s.id,field:'imageAlt',value:s.imageAlt?.[locale]||''});if(s.type==='gallery')for(const [index,img] of (s.images||[]).entries())if(paths.has(img.src))fields.push({label:local(p.title)+' / '+sectionLabel(s)+' · '+(index+1),action:'gallery:update',pageId:p.id,id:s.id,index,field:'alt',value:img.alt?.[locale]||''});}
  if(!fields.length)return '';return `<details><summary>Alt-tekst</summary><label>Språk<select id="mw-alt-lang">${allLocales().map(l=>`<option value="${esc(l.code)}" ${l.code===locale?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>${fields.map(({label,value,...command})=>`<label>${esc(label)}<input type="text" maxlength="1000" data-mw-alt="${esc(JSON.stringify(command))}" value="${esc(value)}"></label>`).join('')}</details>`;
 }
 async function mediaWorkspaceAction(action){
  const m=asset(),root=current.root,importCategory=mediaCategory;
  if(action==='close-detail'){mediaId=null;renderMediaWorkspace();return;}
  if(action==='new-category'||action==='rename-category'){const name=await mediaNameDialog(action==='rename-category'?mediaCategoryName(mediaCategory):'');if(name)await change({action:action==='new-category'?'media:category-add':'media:category-rename',id:mediaCategory,name});return;}
  if(action==='remove-category'){if(confirm('Fjerne kategorien? Bildene beholdes.')){const id=mediaCategory;mediaCategory='all';await change({action:'media:category-remove',id});}return;}
  if(action==='import'||action==='import-logo'){if(mediaBusy)return;mediaBusy=true;renderMediaWorkspace();try{const result=await api.mediaBatch({logo:action==='import-logo'});if(!result||current?.root!==root)return;current=result;const imported=result.uploaded||[];if(!['all','uncategorized'].includes(importCategory))for(const item of imported){if(current?.root!==root)return;current=await api.change({action:'media:categorize',id:item.id,categories:[importCategory]});}media=await api.mediaList();mediaUsageFilter='all';mediaSearch='';mediaPage=1;mediaId=imported.at(-1)?.id||null;updateTop();toast(result.errors?.length?`${imported.length} importert. ${result.errors.join(' · ')}`:`${imported.length} medier importert.`,!!result.errors?.length);}catch(e){toast(e.message,true)}finally{mediaBusy=false;if(area==='media'&&current?.root===root)renderMediaWorkspace();}return;}
  if(!m)return;
  if(action==='assign-slot'){await change({action:'media:slot',key:$('mw-slot').value,src:mediaSrc(m,$('mw-preset').value)});return;}
  if(action==='remove'){await removeFromMedia(m);return;}
  try{if(action==='replace'){await replaceFromMedia(m);return;}if(action==='download'){await api.mediaDownload(m.id);return;}if(action==='reframe'){const result=await api.mediaReframe({id:m.id,focusX:Number($('mw-x').value),focusY:Number($('mw-y').value)});if(current?.root!==root)return;current=result;media=await api.mediaList();renderAll();toast('Fokuspunkt oppdatert.');}}catch(e){toast(e.message,true)}
 }
 async function removeFromMedia(m){
  if(mediaBusy)return;const root=current.root,d=$('mw-remove-dialog'),list=$('mw-remove-refs'),submit=$('mw-remove-submit');
  $('mw-remove-thumb').src=current.previewBase+m.src;$('mw-remove-filename').textContent=mediaFilename(m);
  const refs=m.placements||[],detachable=refs.filter(r=>r.detachable);
  $('mw-remove-title').textContent=m.removable?'Fjern fra mediebiblioteket':'Fjern fra nettstedet';
  $('mw-remove-note').textContent=m.removable?'Bildet fjernes fra biblioteket. Filen beholdes på disk slik at endringen kan angres.':detachable.length?'Velg én plassering å fjerne bildet fra. Bildet beholdes i biblioteket.':'Bildet har en eksisterende referanse eller er nødvendig for malen. Bytt bildet i stedet.';
  list.innerHTML=m.removable?'':refs.map((r,i)=>`<label class="mw-remove-ref"><input type="radio" name="mw-remove-ref" value="${i}" ${r.detachable?'':'disabled'}><span>${esc(r.title)}${r.detachable?'':'<small>Krever et bilde – bruk Bytt bilde</small>'}</span></label>`).join('');
  submit.textContent=m.removable?'Fjern fra biblioteket':'Fjern fra plassering';submit.disabled=!m.removable;
  list.onchange=()=>{submit.disabled=!list.querySelector('input:checked');};
  d.returnValue='cancel';const ok=await new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});d.showModal();});
  if(!ok||current?.root!==root)return;
  if(m.removable){if(await change({action:'media:remove',id:m.id,src:m.src})){mediaId=null;renderMediaWorkspace();toast('Bildet er fjernet fra biblioteket.');}}
  else {const ref=refs[Number(list.querySelector('input:checked')?.value)];if(ref?.detachable&&await change({action:'media:detach',referenceId:ref.id,src:ref.src}))toast('Bildet er fjernet fra plasseringen.');}
 }
 async function replaceFromMedia(m,onlyRef=null){
  if(mediaBusy)return;const root=current.root,refs=(m.placements||[]).filter(r=>!onlyRef||r.id===onlyRef),d=$('mw-replace-dialog');
  if(!refs.length&&(m.legacy||m.used))return;
  const scope=$('mw-replace-scope'),list=$('mw-replace-choices'),submit=$('mw-replace-submit'),gallery=$('mw-replace-gallery'),search=$('mw-replace-search'),source=[...d.querySelectorAll('input[name="mw-source"]')];let replacementId='';
  const sourceValue=()=>source.find(x=>x.checked)?.value||'file';
  $('mw-replace-thumb').src=current.previewBase+m.src;$('mw-replace-filename').textContent=mediaFilename(m);$('mw-replace-context').textContent=refs.length===1?refs[0].title:refs.length?`${refs.length} plasseringer`:'Kun i biblioteket';scope.innerHTML=refs.length>1?'<option value="selected">Velg plasseringer</option><option value="all">Alle plasseringer</option>':'<option value="all">Denne plasseringen</option>';
  $('mw-replace-scope-label').hidden=refs.length<2;
  list.innerHTML=refs.map((r,i)=>`<label><input type="checkbox" value="${i}" ${refs.length===1?'checked':''}> ${esc(r.title)}</label>`).join('');
  source[0].checked=true;source[1].disabled=!refs.length;search.value='';
  const selected=()=>scope.value==='all'?refs:refs.filter((r,i)=>list.querySelector(`input[value="${i}"]`)?.checked);
  const update=()=>{const chosen=selected();list.hidden=scope.value==='all';const pool=media.filter(x=>x.id!==m.id&&chosen.length&&chosen.every(r=>['logo','favicon'].includes(r.preset)?x.kind==='logo':x.kind!=='logo'));if(!pool.some(x=>x.id===replacementId))replacementId='';const library=sourceValue()==='library';$('mw-replace-item-label').hidden=!library;const visible=pool.filter(x=>mediaFilename(x).toLowerCase().includes(search.value.toLowerCase()));gallery.innerHTML=visible.map(x=>`<button type="button" class="mw-replace-tile ${x.id===replacementId?'active':''}" data-replacement-id="${esc(x.id)}" aria-pressed="${x.id===replacementId}"><img src="${esc(current.previewBase+x.src)}" alt="" loading="lazy"><span>${esc(mediaFilename(x))}</span></button>`).join('')||'<p class="dialog-help">Ingen kompatible bilder.</p>';submit.textContent=library?'Bytt bilde':'Velg bildefil';submit.disabled=(!chosen.length&&refs.length>0)||(library&&!replacementId);};
  gallery.onclick=e=>{const b=e.target.closest('[data-replacement-id]');if(b){replacementId=b.dataset.replacementId;update();gallery.querySelector('.active')?.focus();}};scope.onchange=list.onchange=update;source.forEach(r=>r.onchange=update);search.oninput=update;update();d.returnValue='cancel';
  const ok=await new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});d.showModal();});if(!ok||current?.root!==root)return;
  const request={id:m.id,all:!onlyRef&&scope.value==='all',referenceIds:selected().map(r=>r.id),source:sourceValue(),replacementId};
  mediaBusy=true;try{const result=await api.mediaReplace(request);if(!result||current?.root!==root)return;current=result;media=await api.mediaList();mediaId=result.replacementId;mediaCategory='all';mediaSearch='';mediaUsageFilter='all';mediaPage=1;renderAll();refreshPreview();toast(result.replacedCount?`Bilde byttet på ${result.replacedCount} plassering(er).`:'Bildet er erstattet.');}catch(e){toast(e.message,true)}finally{mediaBusy=false;if(area==='media'&&current?.root===root)renderMediaWorkspace();}
 }
 async function openMediaReference(ref){
  if(!ref||!current||!await commitContextField()||!await flushInline())return;
  if(ref.kind==='assistant'){settingsCategory='assistant';await chooseArea('settings','brand');return;}
  if(ref.kind==='brand'){settingsCategory='identity';await chooseArea('settings','brand');return;}
  if(ref.kind==='section'){if(!current.site.sitePages.some(p=>p.id===ref.pageId&&p.sections.some(s=>s.id===ref.sectionId)))return;storeContext();navigationEpoch++;area='website';tab='pages';pageId=ref.pageId;sectionId=ref.sectionId;propertyView='all';}
  else if(['services','projects','team','reviews'].includes(ref.kind)){if(!current.site[ref.kind]?.some(r=>r.id===ref.recordId))return;storeContext();navigationEpoch++;area='website';tab=ref.kind;recordId=ref.recordId;pageId=({services:'services',projects:'projects',team:'about',reviews:'reviews'})[ref.kind];sectionId=null;propertyView='all';}
  else return;
  selectedDesignTarget=null;designRole='heading';inspectorPane='images';previewOnly=false;updatePreviewMode();focusMode=false;treeCollapsed=false;templateEntries=[];renderAll();refreshPreview(false);await loadTemplate();if(area==='website'){renderInspector();const el=[...$('inspector-body').querySelectorAll('[data-replace-ref],[data-upload-media-target]')].find(b=>{if(b.dataset.replaceRef)return b.dataset.replaceRef===ref.id;const t=JSON.parse(b.dataset.uploadMediaTarget);return b.dataset.uploadMediaField===ref.field&&(ref.kind==='section'?t.kind==='section'&&t.id===ref.sectionId:t.id===ref.recordId);});el?.scrollIntoView({block:'nearest'});el?.focus({preventScroll:true});}
 }
 async function openMediaBySrc(src){
  const root=current.root;await chooseArea('media');if(current?.root!==root||area!=='media')return;const m=media.find(x=>(x.paths||[x.src]).includes(src));if(!m){toast('Fant ikke bildet i mediebiblioteket.',true);return;}mediaCategory='all';mediaUsageFilter='all';mediaSearch='';mediaPage=1;mediaId=m.id;renderMediaWorkspace();
 }
 function mediaNameDialog(value){const d=$('mw-category-dialog'),field=$('mw-category-name');field.value=value;return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='ok'?field.value.trim():null),{once:true});d.showModal();field.focus();});}
 function mediaInspector(){
  const m=asset();if(!m)return info('Velg et bilde for å se det og knytte det til nettsiden. Bruk + for å importere et nytt foto.');
  let out=`<div class="group-head"><h3>BILDE</h3><span class="pill">${m.legacy?'Malfil':'Importert'}</span></div><img class="media-inspector-preview" src="${esc(current.previewBase+m.src)}" alt=""><p class="field-note">${esc(m.id)}${m.width?` · ${m.width}×${m.height} piksler`:''}</p>`;
  out+=info(m.kind==='logo'?'Logoen er lagret uten beskjæring, med automatisk tilpassede størrelser og egne favicon-varianter.':'Originalen beholdes. Nye bilder er behandlet i fire formater tilpasset ulike plasseringer. Bildet kan gjenbrukes uten ny opplasting.');
  if(!m.legacy&&m.original&&m.kind!=='logo'){out+=`<div class="field"><label>Fokus X: <span id="focus-x-label">${m.focusX??50}</span>%</label><input type="range" id="focus-x" min="0" max="100" value="${m.focusX??50}"></div><div class="field"><label>Fokus Y: <span id="focus-y-label">${m.focusY??50}</span>%</label><input type="range" id="focus-y" min="0" max="100" value="${m.focusY??50}"></div><button class="btn btn-outline full-button" data-reframe>Beskjær med valgt fokus</button>`;}
  out+=select('Bytt global bildeplass','_slotKey','key','hero',originalSlots().map(x=>({value:x,label:x})));
  out+=select('Bildevariant','_mediaPreset','preset','hero',[{value:'hero',label:'Hovedbilde 16:9'},{value:'card',label:'Kort 4:3'},{value:'portrait',label:'Portrett 4:5'},{value:'gallery',label:'Galleri 3:2'}]);
  out+='<button class="btn btn-outline full-button" data-assign-slot>Bruk i valgt bildeplass</button>';
  return out;
 }
 // Dedicated project settings workspace. Uses the same command/history/media contracts as Nettsider.
 const settingsCategories=[
  ['profile','Bedriftsprofil','Grunnopplysninger om virksomheten','briefcase'],
  ['contact','Kontaktinformasjon','Telefon, e-post og WhatsApp','phone'],
  ['identity','Logo og identitet','Logo, favicon og visuell profil','image'],
  ['appearance','Globalt utseende','Farger og typografi','palette'],
  ['seo','SEO og metadata','Titler og beskrivelser per side','search'],
  ['legal','Juridisk og personvern','Juridiske dokumenter og synlighet','briefcase'],
  ['global','Topptekst og bunntekst','Felles tekster og visningsvalg','image'],
  ['form','Kontaktskjema','Innstillinger for henvendelser','mail'],
  ['assistant','AI-chat','Smart Assistant-modulen','chat']
 ];
 const settingsIcons={briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13h18"/>',phone:'<path d="M5 3l4 1 1 5-3 2a15 15 0 006 6l2-3 5 1 1 4c-1 3-4 3-7 2C7 18 3 12 3 6c0-2 1-3 2-3z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="M3 18l6-6 4 4 3-3 5 5"/>',palette:'<path d="M12 3a9 9 0 100 18h1c2 0 2-3 0-3s-2-3 0-3h4a5 5 0 005-5c0-4-5-7-10-7z"/><circle cx="7" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',search:'<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/>',chat:'<path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',pin:'<path d="M12 22s7-8 7-13a7 7 0 10-14 0c0 5 7 13 7 13z"/><circle cx="12" cy="9" r="2"/>'};
 const swIcon=name=>`<svg class="sw-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${settingsIcons[name]||settingsIcons.briefcase}</svg>`;
 const swGroup=(title,icon,body)=>`<section class="sw-group"><h3>${swIcon(icon)}${esc(title)}</h3><div class="sw-group-body">${body}</div></section>`;
 const swGrid=(body,cols=2)=>`<div class="sw-fields sw-cols-${cols}">${body}</div>`;
 function settingsChecks(){const b=current.site.brand||{},c=current.site.contactForm||{},p=current.site.sitePages.find(p=>p.id==='home'),l=current.site.defaultLanguage;return [
  [!!(b.displayName?.trim()&&b.shortName?.trim()),'Firmanavn og kortnavn'],
  [!!(b.phone?.trim()&&b.email?.trim()),'Telefon og e-post'],
  [!!(b.logoUrl||b.lightLogoUrl),'Opplastet logo'],
  [!!b.faviconUrl,'Eget favicon'],
  [!!(p?.seoTitle?.[l]?.trim()&&p?.seoDescription?.[l]?.trim()),'Egne SEO-felter på forsiden'],
  [c.mode==='smtp','SMTP valgt (levering ikke testet)']];}
 function renderSettingsSide(){const host=$('sw-side');if(!host)return;const b=current.site.brand||{},light=b.logoUrl||b.lightLogoUrl||'',dark=b.lightLogoUrl||b.logoUrl||'';
  const logo=(src,cls,label)=>`<div class="sw-logo ${cls}"><small>${label}</small><div>${src&&b.logoMode!=='text-only'?`<img src="${esc(current.previewBase+src)}" alt="">`:''}${b.logoMode!=='logo-only'||!src?`<strong>${esc(b.shortName||b.displayName||'')}</strong>`:''}</div></div>`;
  const sideHtml=`<div class="sw-card sw-side-card"><h2>Logo og identitet</h2><div class="sw-logo-pair">${logo(light,'sw-light','Lys bakgrunn')}${logo(dark,'sw-dark','Mørk bakgrunn')}</div><button class="btn btn-outline" data-sw-category="identity">Endre logoer</button></div><div class="sw-card sw-side-card"><h2>Favicon</h2><div class="sw-favicon-row"><span>Nettstedets ikon i nettleserfanen</span>${b.faviconUrl?`<img src="${esc(current.previewBase+b.faviconUrl)}" alt="Favicon">`:'<span class="sw-favicon-placeholder">Standard</span>'}</div><button class="btn btn-outline" data-sw-category="identity" data-sw-focus="faviconUrl">Bytt favicon</button></div><div class="sw-card sw-side-card"><h2>Prosjektstatus</h2><div class="sw-checks">${settingsChecks().map(([ok,label])=>`<div><span class="sw-check ${ok?'ok':''}" aria-label="${ok?'Angitt':'Ikke angitt'}">${ok?'✓':'–'}</span><span>${esc(label)}</span></div>`).join('')}</div><p class="sw-note">Kun lokale opplysninger. Ingen kontroll av live nettsted.</p><button class="btn btn-outline" data-sw-action="validate">Kontroller prosjekt</button></div>`;
  if(host.dataset.lastHtml!==sideHtml){host.innerHTML=sideHtml;host.dataset.lastHtml=sideHtml;}
  const footer=$('sw-save-state');if(footer)footer.textContent=current.dirty?'Ulagrede endringer':'Prosjekt lagret';
  const saveButton=$('sw-save');if(saveButton)saveButton.disabled=!current.dirty;
 }
 function renderSettingsWorkspace(){const host=$('settings-workspace'),scroll=host.scrollTop,b=current.site.brand||{},c=current.site.contactForm||{},assistant=current.site.smartAssistant||{};const selected=settingsCategories.find(x=>x[0]===settingsCategory)||settingsCategories[0];settingsCategory=selected[0];
  const brand=(label,key)=>input(label,'brand:update',key,b[key]||'',{extra:`aria-label="${esc(label)}"`});
  const contactFields=()=>swGrid(brand('Telefon','phone')+brand('E-post','email')+brand('WhatsApp','whatsapp'),3);
  let body='';
  if(settingsCategory==='profile')body=swGroup('Grunnopplysninger','briefcase',swGrid(brand('Firmanavn','displayName')+brand('Kortnavn','shortName')+brand('Juridisk navn','legalName')+brand('Organisasjonsnummer / CIF','registrationNumber'))+brand('Dekningsområde','area'))+swGroup('Forretningsadresse','pin',brand('Gateadresse','streetAddress')+swGrid(brand('Postnummer','postalCode')+brand('Sted / by','city')+brand('Land','country'),3)+`<p class="sw-note">Adresse og registreringsnummer lagres i prosjektet. Malen bestemmer om de vises på nettstedet.</p>`)+swGroup('Kontakt','phone',`<div class="sw-contact-summary">${[['Telefon',b.phone],['E-post',b.email],['WhatsApp',b.whatsapp]].map(([k,v])=>`<div><small>${k}</small><strong>${esc(v||'Ikke angitt')}</strong></div>`).join('')}</div><button class="btn btn-outline" data-sw-category="contact">Rediger kontaktinformasjon</button>`);
  if(settingsCategory==='contact')body=swGroup('Kontaktinformasjon','phone',contactFields()+`<p class="sw-note">Kontaktopplysningene brukes av eksisterende mal og kontaktskjema der det støttes.</p>`);
  if(settingsCategory==='identity')body=swGroup('Logo og profil','image',brand('Logo-tekst','logoSubtitle')+brandInspector(true));
  if(settingsCategory==='appearance')body=swGroup('Globalt utseende','palette',designPanel(true));
  if(settingsCategory==='legal'||settingsCategory==='global'){
   const g=current.site.globalContent||{},defaults=current.globalDefaults||{};
   if(!current.site.languages.some(l=>l.code===globalLocale))globalLocale=current.site.defaultLanguage;
   const options=(items,value)=>items.map(x=>`<option value="${esc(x.value)}" ${x.value===value?'selected':''}>${esc(x.label)}</option>`).join('');
   const languageSelect=`<div class="field"><label for="sw-global-locale">Nettstedsspråk</label><select id="sw-global-locale">${options(allLocales().map(l=>({value:l.code,label:l.name})),globalLocale)}</select></div>`;
   const extra=(section,id='')=>`data-global-section="${section}" data-global-id="${id}"`;
   const flag=(section,caption,field,value,id='')=>check(caption,'global-content:update',field,value,{extra:extra(section,id)});
   const text=(section,caption,field,record,id='',textarea=true)=>input(caption,'global-content:update',field,record?.[field]?.[globalLocale]??'',{localized:true,textarea,max:10000,extra:`${extra(section,id)} data-settings-locale="${esc(globalLocale)}" aria-label="${esc(caption)}"`});
   const translate=(configured)=>globalLocale!==current.site.defaultLanguage&&configured?`<button class="btn btn-outline" data-sw-action="global-translate" ${settingsBusy?'disabled':''}>Oversett manglende fra standardspråket</button> <button class="btn btn-outline" data-sw-action="global-retranslate" ${settingsBusy?'disabled':''}>Oversett valgte språk på nytt</button>`:'';
   if(settingsCategory==='legal'){
    const labels={legal:'Juridisk informasjon',privacy:'Personvernerklæring',cookies:'Informasjonskapsler',terms:'Vilkår og betingelser',disclaimer:'Ansvarsfraskrivelse'};
    const legal=g.legal||defaults.legal||{},doc=legal.documents?.[globalDoc]||{};
    const shown=doc.title?.[globalLocale]??doc.title?.[current.site.defaultLanguage]??labels[globalDoc],copy=doc.body?.[globalLocale]??doc.body?.[current.site.defaultLanguage]??'';
    body=swGroup('Juridiske dokumenter','briefcase',swGrid(`<div class="field"><label for="sw-global-doc">Dokument</label><select id="sw-global-doc">${options(Object.entries(labels).map(([value,label])=>({value,label})),globalDoc)}</select></div>`+languageSelect)+flag('legal','Vis dokument på nettstedet','enabled',doc.enabled===true,globalDoc)+flag('legal','Vis bedriftsopplysninger fra Bedriftsprofil','includeCompany',doc.includeCompany===true,globalDoc)+text('legal','Tittel','title',doc,globalDoc,false)+text('legal','Dokumentinnhold','body',doc,globalDoc)+translate(legal.configured)+`<p class="sw-note">Dokumenter med tom tittel eller tom tekst vises ikke. Kontroller juridiske tekster og oversettelser før publisering. Kontaktskjemaets personvernlenke administreres fortsatt under Kontaktskjema.</p>`)+swGroup('Forhåndsvisning','briefcase',`<details class="sw-legal-preview"><summary>${esc(shown||labels[globalDoc])}</summary>${doc.includeCompany?`<p>${esc([b.legalName||b.displayName,b.registrationNumber,[b.streetAddress,b.postalCode,b.city,b.country].filter(Boolean).join(', '),b.email,b.phone].filter(Boolean).join('\n'))}</p>`:''}<p>${esc(copy)}</p></details>`);
   }else{
    const f=g.footer||defaults.footer||{},h=g.header||defaults.header||{};
    body=swGroup('Topptekst','image',flag('header','Vis kontaktknapp i toppmeny','showContact',h.showContact!==false)+flag('header','Vis flytende kontaktknapp','showFloating',h.showFloating!==false))+swGroup('Bunntekst','image',languageSelect+flag('footer','Vis copyright','showCopyright',f.showCopyright!==false)+flag('footer','Vis årstall (oppdateres ved generering)','showYear',f.showYear===true)+flag('footer','Vis tilleggsinformasjon / demotekst','showExtra',f.showExtra!==false)+text('footer','Tilleggsinformasjon','extra',f)+flag('footer','Vis introduksjonstekst','showIntro',f.showIntro!==false)+text('footer','Introduksjonstekst','intro',f)+flag('footer','Bruk dekningsområde fra Bedriftsprofil','useBrandArea',f.useBrandArea===true)+flag('footer','Vis kontakttekst','showContact',f.showContact!==false)+text('footer','Kontakttekst','contact',f)+translate(f.configured)+`<p class="sw-note">Skjul tilleggsinformasjon for å fjerne hele mal- og demoteksten i alle språk. Tomt tekstfelt skjuler den valgte teksten på dette språket.</p>`)+swGroup('Forhåndsvisning','image',`<div class="sw-footer-preview">${f.showCopyright!==false?`<span>© ${f.showYear?new Date().getFullYear()+' · ':''}${esc(b.shortName||'CBPM')} · ${esc(b.displayName||'')}</span>`:''}${f.showExtra!==false?`<span data-global-extra-preview>${esc(f.extra?.[globalLocale]??f.extra?.[current.site.defaultLanguage]??'')}</span>`:''}</div>`);
   }
  }
  if(settingsCategory==='form')body=swGroup('Kontaktskjema','mail',select('Skjemamodus','contact:update','mode',c.mode||'demo',[{value:'demo',label:'Demo – ingen e-post sendes'},{value:'smtp',label:'Aktivt – PHP/SMTP på webserver'}])+input('Personvernerklæring (HTTPS-adresse)','contact:update','privacyUrl',c.privacyUrl||'',{note:'Må være fylt ut før skjemaet kan aktiveres. SMTP-passord lagres på serveren, aldri i prosjektet.'})+`<p class="sw-note">Mottaker: ${esc(b.email||'Ikke angitt')}</p><button class="btn btn-outline" data-sw-category="contact">Rediger kontaktinformasjon</button>`);
  if(settingsCategory==='assistant'){
   const id=assistant.identity?.schema==='wset-assistant-identity-v1'?assistant.identity:null;
   const presets={standard:{name:assistant.displayName||'Smart Assistant',tone:'neutral',color:'#e4eae9'},alba:{name:'Alba',tone:'warm',color:'#e9b775'},luna:{name:'Luna',tone:'casual',color:'#c5c6e7'},clara:{name:'Clara',tone:'professional',color:'#a9d7cf'},custom:{name:assistant.displayName||'Smart Assistant',tone:'neutral',color:'#e4eae9'}};
   const profile=id&&Object.hasOwn(presets,id.profile)?id.profile:'legacy',preset=presets[profile]||presets.standard;
   if(!current.site.languages.some(l=>l.code===assistantLocale))assistantLocale=current.site.defaultLanguage;
   const lang=assistantLocale, fallback=current.site.defaultLanguage, localized=(k)=>id?.[k]?.[lang]??id?.[k]?.[fallback]??'';
   const name=id?.name||preset.name, color=/^#[0-9a-f]{6}$/i.test(id?.accent||'')?id.accent:preset.color;
   const opts=(items)=>items.map(([value,label])=>({value,label}));
   const action='assistant:identity',localExtra=`data-settings-locale="${esc(lang)}"`;
   const field=(label,k,max,textarea=false)=>input(label,action,k,id?.[k]?.[lang]||'',{localized:true,textarea,max,extra:localExtra});
   body=swGroup('Smart Assistant','chat',select('AI-chat','assistant:update','enabled',String(assistant.enabled===true),opts([['false','AV'],['true','PÅ']]))+input('Standardnavn (reserve)','assistant:update','displayName',assistant.displayName||'Smart Assistant',{max:70})+select('Identitet',action,'profile',profile,opts([['legacy','Eksisterende / uten profil'],['standard','Smart Assistant'],['alba','Alba – varm'],['luna','Luna – uformell'],['clara','Clara – profesjonell'],['custom','Egendefinert']]))+info('Identitetsprofil krever Smart Assistant v1.9.10-module.24 eller nyere. Modulen importeres under Generer nettside.'));
   if(profile!=='legacy'){
    const rows=id.shortcuts?.[lang],mode=Array.isArray(rows)?rows.length?'custom':'hidden':'default';
    body+=swGroup('Identitet og personlighet','chat',swGrid(input('Visningsnavn (valgfritt)',action,'name',id.name||'',{max:70,note:`Standard: ${preset.name}`})+select('Kommunikasjonsstil',action,'tone',id.tone||'',opts([['','Profilens standard'],['neutral','Nøytral'],['warm','Vennlig'],['casual','Uformell'],['professional','Profesjonell']]))+input('Avatarfarge (hex)',action,'accent',id.accent||'',{max:7,note:`Standard: ${preset.color}`})+input('Minste responstid (ms)',action,'minResponseMs',String(id.minResponseMs??850),{max:4,note:'0–1500 ms. Ingen ekstra pause ved langsomme svar.'}))+check('Animert skriveindikator',action,'typing',id.typing!==false)+mediaChoice('Avatar / profilbilde',{kind:'assistant'},'avatar',id.avatar||'','portrait',{allowEmpty:true,uploadLabel:'Last opp avatar'})+`<p class="sw-note">Uten bilde brukes profilens monogram. Personligheten påvirker velkomst og hilsener.</p>`);
    const languages=allLocales().map(l=>`<option value="${esc(l.code)}" ${l.code===lang?'selected':''}>${esc(l.name)}</option>`).join('');
    body+=swGroup('Språk og hurtigvalg','chat',`<div class="field"><label for="sw-assistant-locale">Nettstedsspråk</label><select id="sw-assistant-locale">${languages}</select></div>`+field('Undertittel','subtitle',100)+field('Velkomstmelding','welcome',500,true)+`<p class="sw-note">Bruk {name} for assistentens navn. Tomme felt bruker standard- eller reserveoversettelse. Undertittel og velkomst inngår i språkverktøyet når de er angitt.</p>`+select('Hurtigvalg',action,'shortcutMode',mode,opts([['default','Bruk standard / reserve'],['hidden','Skjul alle'],['custom','Egne hurtigvalg']]),`data-localized="1" ${localExtra}`)+input('Egne hurtigvalg (maks 4)',action,'shortcuts',(rows||[]).map(r=>`${r.label} | ${r.message}`).join('\n'),{localized:true,textarea:true,max:1200,extra:localExtra,note:'Én rad per knapp: knappetekst | melding. Endre rekkefølge ved å flytte radene.'})+(lang!==fallback?`<button type="button" class="btn btn-outline" data-sw-action="assistant-translate" ${settingsBusy?'disabled':''}>Oversett manglende assistenttekster fra standardspråket</button>`:''));
    const welcome=localized('welcome').replaceAll('{name}',name)||'Profilens innebygde velkomst vises i nettsideforhåndsvisningen.';
    const previewRows=id.shortcuts?.[lang]??id.shortcuts?.[fallback];
    body+=swGroup('Forhåndsvisning','chat',`<div class="sw-assistant-preview"><div class="sw-assistant-head"><div class="sw-assistant-avatar" style="background:${color}">${id.avatar?`<img src="${esc(current.previewBase+id.avatar)}" alt="">`:esc(profile==='standard'?'✦':name.slice(0,1).toUpperCase())}</div><div><strong>${esc(name)}</strong><small>${esc(localized('subtitle')||'AI-assistent')}</small></div></div><div class="sw-assistant-body"><p>${esc(welcome)}</p>${Array.isArray(previewRows)?previewRows.map(r=>`<span>${esc(r.label)}</span>`).join(''):'<small>Standard hurtigvalg</small>'}</div></div><p class="sw-note">Åpne nettstedets forhåndsvisning for den faktiske assistentmodulen. Ingen live API-kall.</p>`);
   }
  }
  if(settingsCategory==='seo'){
   const p=current.site.sitePages.find(p=>p.id===settingsPage)||current.site.sitePages[0];settingsPage=p?.id||'';if(!current.site.languages.some(l=>l.code===settingsLocale))settingsLocale=current.site.defaultLanguage;
   const opts=(items,value)=>items.map(x=>`<option value="${esc(x.value)}" ${x.value===value?'selected':''}>${esc(x.label)}</option>`).join('');const langs=allLocales().map(l=>({value:l.code,label:l.name}));const targets=langs.filter(l=>l.value!==settingsLocale);if(!targets.some(l=>l.value===settingsTarget))settingsTarget=targets[0]?.value||'';
   const seoField=(label,key,textarea=false)=>input(label,'page:update',key,p?.[key]?.[settingsLocale]||'',{localized:true,textarea,max:2000,extra:`data-page-id="${esc(settingsPage)}" data-settings-locale="${esc(settingsLocale)}" aria-label="${esc(label)}"`});
   body=swGroup('Metadata per side','search',swGrid(`<div class="field"><label for="sw-seo-page">Nettside</label><select id="sw-seo-page">${opts(pages().map(x=>({value:x.id,label:local(x.title)})),settingsPage)}</select></div><div class="field"><label for="sw-seo-locale">Språk</label><select id="sw-seo-locale">${opts(langs,settingsLocale)}</select></div>`)+seoField('SEO-tittel','seoTitle')+seoField('SEO-beskrivelse','seoDescription',true)+`<p class="sw-note">Tomme felt bruker malens standardmetadata. Nettstedets eksisterende noindex-policy endres ikke.</p>`+(targets.length?`<div class="sw-seo-translate"><div class="field"><label for="sw-seo-target">Oversett til</label><select id="sw-seo-target">${opts(targets,settingsTarget)}</select></div><button class="btn btn-outline" data-sw-action="translate" ${settingsBusy?'disabled':''}>Oversett manglende SEO-tekst</button></div>`:''));
  }
  const nav=(x,quick=false)=>`<button type="button" class="sw-nav-button ${selected[0]===x[0]?'active':''}" data-sw-category="${x[0]}" aria-pressed="${selected[0]===x[0]}">${swIcon(x[3])}<span><strong>${x[1]}</strong>${quick?'':`<small>${x[2]}</small>`}</span></button>`;
  host.innerHTML=`<header class="sw-header"><span class="eyebrow">ARBEIDSOMRÅDE</span><h1>Nettstedinnstillinger</h1><p>Administrer nettstedets identitet, kontaktinformasjon og globale innstillinger.</p><nav class="sw-tabs" aria-label="Innstillingsfaner">${settingsCategories.map(x=>nav(x,true)).join('')}</nav></header><div class="sw-layout"><nav class="sw-card sw-nav" aria-label="Innstillingskategorier"><h2>INNSTILLINGSKATEGORIER</h2>${settingsCategories.map(x=>nav(x)).join('')}</nav><section class="sw-card sw-main"><h2>${swIcon(selected[3])}${esc(selected[1])}</h2>${body}<footer class="sw-footer"><span id="sw-save-state" role="status"></span><button type="button" class="btn btn-primary" id="sw-save" data-sw-action="save">Lagre endringer</button></footer></section><aside id="sw-side" class="sw-side"></aside></div>`;
  renderSettingsSide();host.scrollTop=scroll;
 }
 function queueSettingsChange(payload,keep=false){const root=current.root;const task=settingsWrite.catch(()=>false).then(()=>current?.root===root?change(payload,{keepSettingsForm:keep}):false);settingsWrite=task;void task.then(()=>{if(settingsWrite===task)settingsWrite=Promise.resolve(true);},()=>{if(settingsWrite===task)settingsWrite=Promise.resolve(true);});return task;}
 async function settingsFieldChanged(e){const n=e.target;
  if(['sw-global-locale','sw-global-doc'].includes(n.id)){const value=n.value;if(await settingsWrite&&area==='settings'){if(n.id==='sw-global-locale')globalLocale=value;else globalDoc=value;renderSettingsWorkspace();}return;}
  if(n.id==='sw-assistant-locale'){const value=n.value;if(await settingsWrite&&area==='settings'){assistantLocale=value;renderSettingsWorkspace();}return;}
  if(['sw-seo-page','sw-seo-locale','sw-seo-target'].includes(n.id)){const id=n.id,value=n.value;if(!await settingsWrite||area!=='settings')return;if(id==='sw-seo-page')settingsPage=value;if(id==='sw-seo-locale')settingsLocale=value;if(id==='sw-seo-target')settingsTarget=value;renderSettingsWorkspace();return;}
  if(n.dataset.designChoose==='global'){globalDesignRole=n.value;renderSettingsWorkspace();return;}
  if(n.dataset.designProperty){await queueSettingsChange(designCommand(n));return;}
  if(n.dataset.mediaTarget){const target=JSON.parse(n.dataset.mediaTarget);await queueSettingsChange(n.value?{action:'media:assign',target,field:n.dataset.mediaField,src:n.value}:{action:'media:clear',target,field:n.dataset.mediaField});return;}
  const cmd=eventPayload(n);if(!cmd)return;if(cmd.action==='global-content:update'){cmd.section=n.dataset.globalSection;cmd.id=n.dataset.globalId;const keep=n.matches('input[type=text],textarea');if(await queueSettingsChange(cmd,keep)&&keep&&area==='settings'){const g=current.site.globalContent||{},f=g.footer||current.globalDefaults?.footer||{},d=g.legal?.documents?.[globalDoc];const v=(o,k)=>o?.[k]?.[globalLocale]??o?.[k]?.[current.site.defaultLanguage]??'';const legal=$('settings-workspace').querySelector('.sw-legal-preview');if(legal&&d){legal.querySelector('summary').textContent=v(d,'title')||'Dokument';legal.querySelector('p:last-child').textContent=v(d,'body');}const footer=$('settings-workspace').querySelector('.sw-footer-preview');if(footer){const old=footer.querySelector('[data-global-extra-preview]');if(old)old.textContent=v(f,'extra');}}return;}if(cmd.action==='assistant:identity'){if(cmd.field==='shortcutMode'&&cmd.value==='custom'){n.closest('.sw-main')?.querySelector('[data-field=shortcuts]')?.focus();return;}const keep=n.matches('input[type=text],textarea');if(await queueSettingsChange(cmd,keep)&&keep&&area==='settings'&&settingsCategory==='assistant'){const a=current.site.smartAssistant?.identity||{},preview=$('settings-workspace').querySelector('.sw-assistant-preview');if(preview){const p={alba:'Alba',luna:'Luna',clara:'Clara'},name=a.name||p[a.profile]||current.site.smartAssistant.displayName||'Smart Assistant',l=assistantLocale,f=current.site.defaultLanguage;preview.querySelector('.sw-assistant-head strong').textContent=name;preview.querySelector('.sw-assistant-head small').textContent=a.subtitle?.[l]??a.subtitle?.[f]??'AI-assistent';preview.querySelector('.sw-assistant-body p').textContent=(a.welcome?.[l]??a.welcome?.[f]??'Profilens innebygde velkomst vises i nettsideforhåndsvisningen.').replaceAll('{name}',name);const avatar=preview.querySelector('.sw-assistant-avatar');if(!avatar.querySelector('img'))avatar.textContent=a.profile==='standard'?'✦':name.slice(0,1).toUpperCase();avatar.style.background=a.accent||({alba:'#e9b775',luna:'#c5c6e7',clara:'#a9d7cf'}[a.profile]||'#e4eae9');const body=preview.querySelector('.sw-assistant-body');body.querySelectorAll('span,small').forEach(x=>x.remove());const rows=a.shortcuts?.[l]??a.shortcuts?.[f];if(Array.isArray(rows)){for(const row of rows){const el=document.createElement('span');el.textContent=row.label;body.append(el);}}else{const el=document.createElement('small');el.textContent='Standard hurtigvalg';body.append(el);}const mode=$('settings-workspace').querySelector('[data-field=shortcutMode]');if(mode)mode.value=Array.isArray(a.shortcuts?.[l])?(a.shortcuts[l].length?'custom':'hidden'):'default';}}return;}if(cmd.action==='assistant:update'&&cmd.field==='enabled')cmd.value=cmd.value==='true';await queueSettingsChange(cmd,n.matches('input[type=text],textarea'));
 }
 async function settingsClicked(e){const b=e.target.closest('button');if(!b||b.disabled)return;const root=current.root,ds={...b.dataset};if(!await commitContextField()||area!=='settings'||current.root!==root)return;
  if(ds.swCategory){settingsCategory=ds.swCategory;renderSettingsWorkspace();if(ds.swFocus){const el=$('settings-workspace').querySelector(`[data-media-field="${ds.swFocus}"]`);el?.scrollIntoView({block:'center'});el?.focus({preventScroll:true});}return;}
  if(ds.swAction==='save'){await save();return;}if(ds.swAction==='validate'){await validate();return;}
  if(ds.designReset!==undefined){await queueSettingsChange(designCommand(b,true));return;}
  if(ds.openMediaSrc){await openMediaBySrc(ds.openMediaSrc);return;}
  if(ds.uploadMediaTarget){await uploadToField(JSON.parse(ds.uploadMediaTarget),ds.uploadMediaField,ds.uploadMediaPreset||'logo',ds.currentImage||'');return;}
  if(['global-translate','global-retranslate'].includes(ds.swAction)&&!settingsBusy){const overwrite=ds.swAction==='global-retranslate';if(overwrite&&!window.confirm('Erstatt eksisterende oversettelser for dette dokumentet / denne bunnteksten på valgt språk?'))return;const from=current.site.defaultLanguage,to=globalLocale,category=settingsCategory,id=globalDoc;if(from===to)return;const keys=(category==='legal'?['title','body'].map(f=>`content.global.${id}.${f}`):['extra','intro','contact'].map(f=>`content.global.footer.${f}`));settingsBusy=true;renderSettingsWorkspace();try{const [a,d]=await Promise.all([api.languageEntries(from),api.languageEntries(to)]),items=[];for(const key of keys){const sourceText=a.entries.find(x=>x.key===key)?.value,expected=d.entries.find(x=>x.key===key)?.value;if(sourceText?.trim()&&expected!==undefined&&(overwrite||!expected.trim())){const result=await api.translateContent({source:from,target:to,text:sourceText});items.push({key,sourceText,expected,value:result.text});}}if(current?.root!==root||area!=='settings')return;if(!await commitContextField())return;if(!items.length){toast('Ingen manglende tekster å oversette.');return;}if(await queueSettingsChange({action:'language:auto-translate',source:from,target:to,items}))toast('Oversettelse lagret. Kontroller innholdet før publisering.');}catch(error){toast(error.message||String(error),true);}finally{settingsBusy=false;if(area==='settings'&&current?.root===root)renderSettingsWorkspace();}return;}
  if(ds.swAction==='assistant-translate'&&!settingsBusy){
   const identity=structuredClone(current.site.smartAssistant?.identity||{}),from=current.site.defaultLanguage,to=assistantLocale;
   if(from===to)return;settingsBusy=true;renderSettingsWorkspace();
   try{const value={};const translate=async text=>(await api.translateContent({source:from,target:to,text})).text;
    for(const key of ['subtitle','welcome','shortcuts']){const text=identity[key]?.[from];if(Object.hasOwn(identity[key]||{},to))continue;
     if(key==='shortcuts'){if(!Array.isArray(text)||!text.length)continue;const rows=[];for(const row of text)rows.push({label:await translate(row.label),message:await translate(row.message)});value[key]={source:text,value:rows};}
     else if(typeof text==='string'&&text.trim())value[key]={source:text,value:await translate(text)};
    }
    if(current?.root!==root||area!=='settings'||settingsCategory!=='assistant')return;
    if(!Object.keys(value).length){toast('Ingen manglende assistenttekster å oversette.');return;}
    if(await queueSettingsChange({action:'assistant:identity',field:'translateMissing',locale:to,value}))toast('Assistenttekstene er oversatt. Kontroller og lagre prosjektet.');
   }catch(error){toast(error.message||String(error),true);}finally{settingsBusy=false;if(area==='settings'&&current?.root===root)renderSettingsWorkspace();}return;
  }
  if(ds.swAction==='translate'&&!settingsBusy){const p=settingsPage,from=settingsLocale,to=settingsTarget;settingsBusy=true;renderSettingsWorkspace();try{const [a,d]=await Promise.all([api.languageEntries(from),api.languageEntries(to)]);const items=[];for(const f of ['seoTitle','seoDescription']){const key=`content.pages.${p}.${f}`,sourceText=a.entries.find(x=>x.key===key)?.value,expected=d.entries.find(x=>x.key===key)?.value;if(sourceText?.trim()&&expected!==undefined&&!expected.trim()){const result=await api.translateContent({source:from,target:to,text:sourceText});items.push({key,sourceText,expected,value:result.text});}}if(current?.root!==root)return;if(!await commitContextField()||current?.root!==root)return;if(!items.length){toast('Ingen manglende SEO-tekster å oversette.');return;}if(await queueSettingsChange({action:'language:auto-translate',source:from,target:to,items}))toast('Oversettelse lagret.');}catch(err){toast(err.message||String(err),true);}finally{settingsBusy=false;if(area==='settings'&&current?.root===root)renderSettingsWorkspace();}}
 }
 function brandInspector(identityOnly=false){
  const b=current.site.brand,light=b.logoUrl||b.lightLogoUrl||'',dark=b.lightLogoUrl||b.logoUrl||'';
  const preview=(name,src,isDark)=>`<div class="logo-preview-surface ${isDark?'on-dark':'on-light'}"><span>${esc(name)}</span><div class="logo-preview-content">${src&&b.logoMode!=='text-only'?`<img src="${esc(current.previewBase+src)}" alt="Forhåndsvisning av logo" loading="lazy">`:''}${(b.logoMode!=='logo-only'||!src)?`<strong>${esc(b.shortName||'CBPM')}</strong>`:''}</div></div>`;
  let out=identityOnly?'':`<details class="wset-content-group wset-global-design" ${globalDesignOpen?'open':''}><summary>Globalt utseende</summary>${designPanel(true)}</details><div class="group-head"><h3>LOGO OG PROFIL</h3></div>`;
  out+=select('Visning på nettsiden','brand:update','logoMode',b.logoMode||'symbol-text',[{value:'symbol-text',label:'Symbol + firmanavn'},{value:'logo-only',label:'Kun opplastet logo'},{value:'text-only',label:'Kun tekst'}]);
  out+=info('Logoen tilpasses automatisk til toppmeny, mobil og bunntekst uten beskjæring. Velg «Kun opplastet logo» når logoen allerede inneholder firmanavnet.');
  out+='<div class="logo-preview-pair">'+preview('Lys bakgrunn',light,false)+preview('Mørk bakgrunn',dark,true)+'</div>';
  for(const [field,title] of [['logoUrl','Logo for lys bakgrunn'],['lightLogoUrl','Logo for mørk bakgrunn']]){
   out+=mediaChoice(title,{kind:'brand'},field,b[field]||'','logo',{allowEmpty:true,uploadLabel:'Last opp logo uten beskjæring',cssClass:'logo-media-choice'});
  }
  out+=mediaChoice('Favicon (nettleserikon)',{kind:'brand'},'faviconUrl',b.faviconUrl||'','favicon',{allowEmpty:true,uploadLabel:'Last opp favicon'});
  return out+info('Nettstedets toppmeny og bunntekst har mørk bakgrunn i Mal 01 og bruker derfor den lyse logoen («Logo for mørk bakgrunn»). Hvis den mangler, brukes den andre som reserve. Originalfilene lagres lokalt.');
 }

 async function refreshLanguageData(){
  if(!current||!current.site.languages.some(l=>l.code===locale))return;
  try{languageData={locale,...await api.languageEntries(locale)}}catch(error){languageData=null;toast(error.message||String(error),true)}
 }
 function languageInspector(){
  const language=current.site.languages.find(l=>l.code===locale);
  if(!language)return info('Velg et språk for å administrere det.');
  const data=languageData?.locale===locale?languageData:null;
  let out=`<div class="group-head"><h3>SPRÅK · ${esc(language.name)}</h3><span class="pill">${esc(locale.toUpperCase())}</span></div>`;
  out+=input('Språknavn','language:update','name',language.name,{extra:`data-language-code="${esc(locale)}"`});
  out+=input('Undertittel','language:update','subtitle',language.subtitle||'',{extra:`data-language-code="${esc(locale)}"`});
  out+=input('Flagg / symbol','language:update','flag',language.flag||'',{extra:`data-language-code="${esc(locale)}"`});
  out+=check('Publiser dette språket','language:update','enabled',language.enabled!==false,{disabled:locale===current.site.defaultLanguage,extra:`data-language-code="${esc(locale)}"`});
  if(data){const r=data.report;out+=`<div class="language-progress"><strong>${r.translated} / ${r.total} oversettelser</strong><span>${r.complete?'Alle nødvendige tekster er fylt ut':r.missing.length+' mangler · språk kan ikke aktiveres ennå'}</span><progress value="${r.translated}" max="${r.total||1}"></progress></div>`;}
  out+='<div class="language-actions"><button type="button" class="btn btn-outline" data-lang-export>↓ Eksporter JSON</button><button type="button" class="btn btn-outline" data-lang-import>↑ Importer JSON</button></div>';
  out+='<p class="field-note">Eksporten inneholder både faste grensesnitttekster og redaksjonelt innhold. Feltet «reference» viser oversettelseskilden; oversett verdiene under «messages».</p>';
  out+='<div class="group-head"><h3>OVERSETTELSER</h3></div>';
  if(data){
   const entries=filterTranslations(data.entries,'','all').sort((a,b)=>Number(!String(b.value||'').trim())-Number(!String(a.value||'').trim()));
   out+=`<div class="language-tools"><input id="language-search" class="language-search" type="search" value="${esc(translationSearch)}" placeholder="Søk etter nøkkel eller tekst …" aria-label="Søk i oversettelser"><label for="translation-filter" class="sr-only">Vis oversettelser</label><select id="translation-filter" aria-label="Filtrer oversettelser"><option value="all" ${translationFilter==='all'?'selected':''}>Alle tekster</option><option value="missing" ${translationFilter==='missing'?'selected':''}>Kun manglende</option></select></div><p id="translation-results" class="filter-results" role="status" aria-live="polite"></p>`;
   out+=`<div id="translation-list">${entries.map(e=>`<div class="language-entry" data-search-text="${esc((e.key+' '+e.source+' '+e.value).toLowerCase())}" data-missing="${!String(e.value||'').trim()}"><label title="${esc(e.key)}">${esc(e.key)}</label><small>${esc(e.source.slice(0,180))}</small><textarea rows="2" data-translation-key="${esc(e.key)}" placeholder="Mangler oversettelse">${esc(e.value)}</textarea></div>`).join('')}</div>`;
  }else out+=info('Laster oversettelseskatalogen …');
  out+='<hr class="separation"><div class="arrow-group"><button class="btn btn-outline" data-move-language="-1">↑ Opp</button><button class="btn btn-outline" data-move-language="1">↓ Ned</button></div>';
  if(locale!==current.site.defaultLanguage)out+='<button type="button" class="danger-button" data-delete-language>Fjern språk fra prosjektet</button>';
  return out;
 }
 function propertyCategoryFields(pane){
  const p=page();if(p?.id!=='properties')return '';
  const categories=propertyView==='all'?propertyCategories:propertyCategories.filter(([id])=>id===propertyView);
  let out='<div class="group-head"><h3>'+ (pane==='settings'?'Vis boligkategorier':'Menynavn')+'</h3></div>';
  for(const [id,name] of categories){
   const m=current.site.propertyModules?.[id]||{},enabled=propertyOn(id),attrs=`data-module-id="${id}"`;
   if(pane==='settings')out+=check(name,'property-module:update','enabled',enabled,{extra:attrs,disabled:p.enabled===false});
   else out+=`<div class="field"><label>${esc(name)} · ${esc(locale.toUpperCase())}</label><input type="text" maxlength="90" data-command="property-module:update" ${attrs} data-field="label" data-localized="true" value="${esc(m.labels?.[locale]||'')}" placeholder="Standardnavn" aria-label="${esc(name)} – menynavn"></div>`;
  }
  if(pane==='settings'){
   out+='<div class="group-head"><h3>Navigasjon</h3></div>';
   for(const [id,name] of categories){const m=current.site.propertyModules?.[id]||{};out+=check('Eget menypunkt – '+name,'property-module:update','showInNavigation',m.showInNavigation!==false,{extra:`data-module-id="${id}"`,disabled:p.enabled===false||!propertyOn(id)});}
  }
  return out;
 }
 function renderInspector(){
  if(tab==='propertyManager'){propertyManager.renderInspector();return;}
  const p=page(),s=section(),group=tab==='pages'?sectionCollection(p,s):labels[tab]?tab:null,selected=group?record(group):null;
  const title=tab==='pages'?(s?(selected?local(selected.title||selected.head||selected.role)||selected.name||selected.id:sectionLabel(s)):local(p?.title)||'Sider'):tab==='media'?'Mediebibliotek':tab==='brand'?'Bedriftsprofil':tab==='languages'?'Språk og oversettelser':tab==='propertyManager'?'Eiendomsregister':selected?(local(selected.title||selected.head||selected.role)||selected.name||selected.id):labels[tab];
  $('inspector-title').textContent=tab==='pages'&&pageId==='properties'&&propertyView!=='all'?propertyLabel(propertyView):contextualTarget()?(contextualTarget().button?'Rediger knapp':'Rediger tekst'):title;
  $('inspector-subtitle').textContent=tab==='pages'?(s?`${local(p.title)}  ›  ${sectionLabel(s)}${selected?'  ›  '+(local(selected.title||selected.head||selected.role)||selected.name||selected.id):''}`:p.id==='properties'?(propertyView==='all'?'Sideinnstillinger':'Eiendommer › '+propertyLabel(propertyView)):`Sideinnstillinger · ${p.sections.length} seksjoner`):tab==='media'?'Bilder for hele nettstedet.':tab==='languages'?'Oversettelser, språkstatus og JSON-filer.':tab==='propertyManager'?'Lokale XML-filer.':tab==='brand'?'Felles opplysninger for hele nettstedet.':'Rediger valgt oppføring uten å endre seksjonsoppsettet.';
  const segmented=$('inspector-panel-tabs');segmented.hidden=!!contextualTarget()||!(tab==='pages'||labels[tab]);
  if(inspectorPane==='publish')inspectorPane='advanced';
  const imageTab=segmented.querySelector('[data-inspector-pane=images]');imageTab.hidden=tab==='pages'?(!s||(!group&&!['hero','imageText','gallery','template'].includes(s.type))):!['services','projects','team'].includes(tab);
  if(imageTab.hidden&&inspectorPane==='images')inspectorPane='content';
  const appearanceTab=segmented.querySelector('[data-inspector-pane=appearance]');appearanceTab.hidden=tab!=='pages'||!s;if(appearanceTab.hidden&&inspectorPane==='appearance')inspectorPane='content';
  if(!segmented.hidden)segmented.querySelectorAll('[data-inspector-pane]').forEach(b=>{b.classList.toggle('active',b.dataset.inspectorPane===inspectorPane);b.setAttribute('aria-selected',String(b.dataset.inspectorPane===inspectorPane));});
  $('inspector-body').innerHTML=tab==='pages'?pageInspector():tab==='media'?mediaInspector():tab==='brand'?brandInspector():tab==='languages'?languageInspector():collectionInspector();
  if(!segmented.hidden&&inspectorPane==='advanced'){inspectorPane='publish';const visibility=tab==='pages'?pageInspector():collectionInspector();inspectorPane='advanced';$('inspector-body').insertAdjacentHTML('afterbegin',visibility);}
  if(tab==='languages'&&languageData?.locale===locale)applyTranslationFilter();
 }
 function setCanvasMode(mode){
  if(area!=='templates')window.wsetTemplateGallery?.unmount();
  if(area!=='library')window.wsetProjectDashboard?.unmount?.();
  // One source of truth for visibility; never infer an open project from hidden UI.
  propertyManager.showCanvas(mode==='property');
  $('settings-workspace').hidden=mode!=='settings';$('language-workspace').hidden=mode!=='languages';$('media-workspace').hidden=mode!=='media';$('overview-workspace').hidden=mode!=='overview';$('utility-workspace').hidden=mode!=='utility';
  $('preview-outer').hidden=mode!=='preview';document.querySelector('.canvas-head').hidden=mode!=='preview';document.querySelector('.canvas-foot').hidden=mode!=='preview';
 }
 function renderAll(){if(!current)return;
  if(!current.site.sitePages.some(p=>p.id===pageId)){propertyView='all';pageId=(current.site.sitePages.find(p=>p.id==='home')||current.site.sitePages[0])?.id;sectionId=null;}
  if(sectionId&&!page()?.sections.some(s=>s.id===sectionId))sectionId=null;
  if(labels[tab]&&!records(tab).some(r=>r.id===recordId))recordId=records(tab)[0]?.id||null;
  updateTop();renderPrimaryNavigation();
  if(utilityAreas.includes(area)){setCanvasMode('utility');renderUtility();return;}
  if(area==='overview'){setCanvasMode('overview');renderOverview();return;}
  if(area==='media'){setCanvasMode('media');renderMediaWorkspace();return;}
  if(area==='languages'){setCanvasMode('languages');languageWorkspace?.render(current.site,current.root);return;}
  if(area==='settings'){setCanvasMode('settings');renderSettingsWorkspace();return;}
  setCanvasMode(area==='properties'?'property':'preview');if(area==='properties')tab='propertyManager';renderSidebar();renderInspector();storeContext();
 }
 function previewFocus(scroll=false){
  const group=tab==='pages'?sectionCollection(page(),section()):labels[tab]?tab:null;
  return {kind:'cbpm-editor-focus',sectionId:sectionId||null,collection:group,recordId:group?selectedRecordId(group):null,targetId:contextualTarget()?.id||null,scroll,previewOnly};
 }
 function focusPreview(scroll=false){try{$('site-preview').contentWindow?.postMessage(previewFocus(scroll),current.previewBase)}catch{}}
 function refreshPreview(preserveScroll=true,{reuse=false}={}){
  if(inlineSession&&!inlineSession.committing){const before=previewExpectedUrl;void flushInline().then(ok=>{if(ok&&before===previewExpectedUrl)refreshPreview(preserveScroll,{reuse});});return;}
  if(!current||area!=='website')return;
  const p=page();if(!p)return;
  const category=p.id==='properties'?propertyView:'all';
  const identity={root:current.root,base:current.previewBase,locale,pageId:p.id,category,site:current.site};
  pendingPreviewScroll=preserveScroll?lastPreviewScroll:0;if(!preserveScroll)lastPreviewScroll=0;
  if(reuse&&previewLoaded&&previewIdentity&&Object.keys(identity).every(k=>identity[k]===previewIdentity[k])){
   focusPreview(false);try{$('site-preview').contentWindow?.postMessage({kind:'cbpm-preview-restore-scroll',y:pendingPreviewScroll},current.previewBase)}catch{}pendingPreviewScroll=0;return;
  }
  previewIdentity=identity;previewLoaded=false;restoringScroll=true;
  previewExpectedUrl=`${current.previewBase}/__designer-preview/${encodeURIComponent(locale)}/${encodeURIComponent(p.id)}/?rev=${++counter}${category!=='all'?'&category='+encodeURIComponent(category):''}`;
  clearTimeout(previewReadyTimer);$('site-preview').src=previewExpectedUrl;updateTop();
  previewReadyTimer=setTimeout(()=>{if(!previewLoaded&&area==='website')$('preview-status').textContent='Forhåndsvisningen svarte ikke. Velg Oppdater for å prøve igjen.';},5000);
 }
 async function showContentPreview(group,id){
  if(!await flushInline())return;
  const preferred=groupPage[group];
  const dest=current.site.sitePages.find(p=>p.id===preferred);
  if(dest){if(dest.id!==pageId)lastPreviewScroll=0;propertyView='all';pageId=dest.id;const related=dest.sections.find(s=>sectionCollection(dest,s)===group);sectionId=related?.id||null;}
  if(id){if(tab==='pages')inlineSelection[group]=id;else recordId=id;}
  renderAll();refreshPreview(false);
 }
 async function change(payload,{keepSettingsForm=false}={}){try{
  const before=current.site,root=current.root,epoch=navigationEpoch, inspectorScroll=$('inspector-body').scrollTop;
  const result=await api.change(payload);if(current?.root!==root)return;current=result;
  if(result.selection&&epoch===navigationEpoch){if(pageId!==result.selection.pageId)propertyView='all';pageId=result.selection.pageId;sectionId=result.selection.sectionId;}
  if(payload.action==='collection:duplicate'){
   const group=payload.collection,id=current.site[group].find(x=>!before[group].some(old=>old.id===x.id))?.id;
   if(id){if(tab==='pages')inlineSelection[group]=id;else recordId=id;}
  }
  if(payload.action==='inline:text'&&designTarget()?.id===payload.targetId){selectedDesignTarget.text=String(payload.value);if(selectedDesignTarget.contextual)selectedDesignTarget.expected=null;}
  if(payload.action==='template:text'||payload.action==='inline:text'||(result.selection&&section()?.type==='template'))await loadTemplate();
  if(tab==='languages'&&area!=='languages')await refreshLanguageData();
  if(payload.action.startsWith('media:'))media=await api.mediaList();
  if(keepSettingsForm&&area==='settings'&&epoch===navigationEpoch){updateTop();renderSettingsSide();}else renderAll();$('inspector-body').scrollTop=inspectorScroll;refreshPreview();return true;
 }catch(error){toast(error.message||String(error),true);renderAll();return false;}}
 async function undoRedo(direction){if(window.wsetPropertyDrafts?.hasPending()){toast('Lagre kladden før du bruker Angre eller Gjør om.',true);return;}if(!current||!await commitContextField()||!await flushInline())return;
  try{current=await (direction==='undo'?api.undo():api.redo());window.wsetPropertyDrafts?.sync();
   if(tab==='languages'&&area!=='languages')await refreshLanguageData();
   media=await api.mediaList();await loadTemplate();renderAll();if(area==='properties')await propertyManager.refreshLocal();refreshPreview();toast(direction==='undo'?'Endring angret.':'Endring gjenopprettet.');
  }catch(error){toast(error.message||String(error),true)}
 }
 async function loadTemplate(){const request=++templateRequest,s=section(),root=current?.root,selectedPage=pageId,selectedSection=sectionId,selectedLocale=locale;templateEntries=[];if(s?.type==='template'){
   try{const entries=await api.templateTexts({pageId,sectionId,locale});if(request===templateRequest&&current?.root===root&&pageId===selectedPage&&sectionId===selectedSection&&locale===selectedLocale)templateEntries=entries;}catch(error){toast(error.message||String(error),true)}
  }
 }
 async function selectSection(id,selectedText='',collection=null,chosenRecord=null,targetKind='',fieldHint='',imageSrc='',inlineTarget=null,styleable=false,details=null){
  const clickedUrl=previewExpectedUrl;const previousRoot=current?.root;
  if(!await commitContextField()||current?.root!==previousRoot||(details&&clickedUrl!==previewExpectedUrl))return;
  if(inlineSession&&id!==sectionId&&!await flushInline())return;
  const exact=details&&details.id===inlineTarget&&typeof details.expected==='string'&&typeof details.text==='string';
  const token=++selectionEpoch;selectedDesignTarget=exact&&targetKind!=='image'?{root:current.root,pageId,sectionId:id,locale,id:inlineTarget,expected:details.expected,text:details.text,label:details.label,styleable:details.styleable===true,button:details.button===true,computed:details.computed||{},contextual:true}:styleable&&inlineTarget?{root:current.root,pageId,sectionId:id,locale,id:inlineTarget,text:selectedText}:null;designRole=selectedDesignTarget?.styleable===false?'heading':selectedDesignTarget?'element':'heading';
  treeCollapsed=false;sectionId=id;tab='pages';inspectorPane='content';
  if(collection&&chosenRecord&&records(collection).some(r=>r.id===chosenRecord))inlineSelection[collection]=chosenRecord;
  const group=sectionCollection(page(),section());
  if(group&&!chosenRecord&&selectedText.trim().length>=3){
   const text=selectedText.trim().toLocaleLowerCase();
   const matches=records(group).filter(r=>[r.title,r.head,r.body,r.by,r.role,r.name].some(v=>{
    const label=local(v).replace(/<[^>]+>/g,'').trim().toLocaleLowerCase();
    return label===text||(text.length>=5&&label.includes(text));
   }));
   if(matches.length===1)inlineSelection[group]=matches[0].id;
  }
  // Team-card placeholders belong to the website template, not to editable employee records.
  // Clicking a personnel card must open the employee portrait editor, never template-copy overrides.
  if(targetKind==='image'||(group==='team'&&!targetKind))inspectorPane='images';
  const epoch=navigationEpoch,root=current.root;await loadTemplate();if(token!==selectionEpoch||epoch!==navigationEpoch||current?.root!==root||area!=='website'||sectionId!==id)return;renderAll();focusPreview(false);$('pages-list').querySelector('.tree-section-row.active')?.scrollIntoView({block:'nearest'});
  if(contextualTarget()){$('inspector-body').scrollTop=0;return;}
  const fields=[...$('inspector-body').querySelectorAll('textarea[data-field],input[data-field]:not([type=checkbox])')];
  const normalized=v=>decode(String(v||'')).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const hits=fields.filter(f=>normalized(f.value)&&normalized(f.value)===normalized(selectedText));
  const mediaFields=[...$('inspector-body').querySelectorAll('[data-media-target]')];
  const imageMatches=mediaFields.filter(f=>f.value&&f.value===imageSrc);
  const mappedField=inlineTarget?.startsWith('record:')?inlineTarget.split(':').at(-1):inlineTarget?.startsWith('section:')?inlineTarget.split(':').at(-1):null;
  const target=targetKind==='image'?(imageMatches.length===1?imageMatches[0]:mediaFields.length===1?mediaFields[0]:null):mappedField?fields.find(f=>f.dataset.field===mappedField):hits.length===1?hits[0]:fieldHint?fields.find(f=>f.dataset.field===fieldHint):null;
  if(target&&!inlineTarget?.startsWith('template:')){target.scrollIntoView({block:'nearest'});if(!inlineTarget)target.focus({preventScroll:true});return;}
  if(selectedText&&targetKind!=='image'&&group!=='team'){const hits=templateEntries.map((e,i)=>({e,i})).filter(({e})=>normalized(e.original)===normalized(selectedText)||normalized(e.value)===normalized(selectedText));const i=inlineTarget?.startsWith('template:')?templateEntries.findIndex(e=>e.targetId===inlineTarget):hits.length===1?hits[0].i:-1;
   if(i>=0){inspectorPane='content';renderInspector();const input=$('inspector-body').querySelector(`[data-template-index="${i}"]`);if(input?.closest('details')){const details=input.closest('details');details.open=true;const open=templateOpenGroups.get(templateContext())||new Set(['Seksjonsinnhold']);open.add(details.dataset.copyGroup);templateOpenGroups.set(templateContext(),open);}input?.scrollIntoView({block:'nearest'});if(!inlineTarget)input?.focus({preventScroll:true});}}
 }
 async function selectPage(id,category='all'){if(!await commitContextField()||!await flushInline())return;if(id!==pageId||propertyView!==category)lastPreviewScroll=0;propertyView=id==='properties'?category:'all';selectedDesignTarget=null;designRole='heading';treeCollapsed=false;pageId=id;sectionId=null;inspectorPane='content';templateEntries=[];renderAll();refreshPreview(false)}
 async function upload(){try{
  const result=await api.mediaUpload();if(!result)return;
  current=result;media=await api.mediaList();mediaId=result.uploaded.id;tab='media';renderAll();refreshPreview();toast('Bilde importert og optimalisert. Lagre prosjektet for å beholde referansen.');
 }catch(error){toast(error.message||String(error),true)}}
 async function uploadToField(target,field,preset,currentImage=''){
  try{
   const selected=media.find(m=>(m.paths||[m.src]).includes(currentImage));
   const group={service:'services',project:'projects',team:'team'}[target.kind];
   const ref=selected?.placements?.find(r=>r.field===field&&(target.kind==='section'?r.kind==='section'&&r.pageId===target.pageId&&r.sectionId===target.id:target.kind==='brand'?r.kind==='brand':target.kind==='assistant'?r.kind==='assistant':r.kind===group&&r.recordId===target.id));
   if(ref){await replaceFromMedia(selected,ref.id);return;}

   const isLogo=target.kind==='brand';
   const result=isLogo?await api.logoUpload():await api.mediaUpload();if(!result)return;
   current=result;media=await api.mediaList();mediaId=result.uploaded.id;
   const src=mediaSrc(result.uploaded,preset);
   if(!src)throw Error('Ingen bildevariant ble generert.');
   const command=target.kind==='slot'?{action:'media:slot',key:target.key,src}:{action:'media:assign',target,field,src};
   await change(command);
   toast(target.kind==='team'?'Portrett importert til valgt ansatt. Profilen må også være aktiv for å vises på nettsiden. Husk å lagre prosjektet.':'Bildet er importert og knyttet til valgt innhold. Husk å lagre prosjektet.');
  }catch(error){toast(error.message||String(error),true)}
 }
 let exportBusy=false,assistantModule=null;
 async function refreshAssistantModule(){
  const status=$('export-assistant-status'),box=$('export-assistant-module');
  if(!current){box.hidden=true;return;}
  box.hidden=false;
  try{assistantModule=await api.assistantModuleStatus();}
  catch(error){assistantModule=null;status.textContent='Kunne ikke kontrollere modulbibliotek: '+(error.message||String(error));return;}
  const enabled=current.site.smartAssistant?.enabled===true;
  status.textContent=!enabled?'AI-chat er AV. Modulen er valgfri.':assistantModule?`Klar for eksport: ${assistantModule.id} v${assistantModule.version}`:'AI-chat er PÅ, men ingen modul er importert. Importer en ZIP før eksport.';
  box.dataset.missing=String(enabled&&!assistantModule);
 }
 async function importAssistantFromZip(){
  if(exportBusy)return;
  $('export-assistant-import').disabled=true;
  try{
   const result=await api.importAssistantModule();
   if(result){await refreshAssistantModule();refreshPreview(false);toast(`Smart Assistant v${result.version} er importert og valgt for eksport.`);}
  }catch(error){toast(error.message||String(error),true);await refreshAssistantModule();}
  finally{$('export-assistant-import').disabled=false;}
 }
 let publicationKind='website',publicationProfile='',publicationInProgress=false;
 function publicationPaths(){const a=$('publication-account').value.trim().replace(/\/$/,'');const web=$('publication-webroot').value;const label=publicationKind==='website'?'Privat: '+['app','config','storage','vendor'].map(n=>a+'/'+n+'/').join(', '):'Boliger: '+(a||'')+'/storage/imports/'+publicationKind+'/';$('publication-paths').textContent='Offentlig: '+(a||'')+'/'+web+'/ · '+label;}
 async function openPublication(kind){
  if(publicationInProgress||!current)return;try{
   if(!await commitContextField()||!await flushInline())return;
   const result=await api.publicationStatus(),s=result.server,p=s.profiles.find(x=>x.id===s.profileId);publicationKind=kind;publicationProfile=p?.id||'';
   if(kind==='website'&&!result.ready){toast('Generer en ny nettstedseksport før overføring.',true);return;}
   const d=$('publication-transfer-dialog');$('publication-transfer-title').textContent=kind==='website'?'Publiser nettsted':kind==='New'?'Overfør nybygg':'Overfør bruktboliger';
   $('publication-connection').textContent=p?`${p.name} · ${p.protocol.toUpperCase()} · ${p.host}:${p.port}`:'Koble til en serverprofil i Server / FTP først.';
   const start=p?.remoteRoot||'';const match=start.match(/\/(www|public|public_html)\/?$/);$('publication-account').value=match?(start.slice(0,match.index)||'/'):start;
   $('publication-webroot').value=kind==='website'?result.webRoot:match?.[1]||result.webRoot||'www';$('publication-webroot').disabled=kind==='website';
   $('publication-property-options').hidden=kind==='website';$('publication-remove-label').hidden=kind!=='Existing';$('publication-replace-supplier').checked=false;$('publication-remove-own').checked=false;
   $('publication-policy').textContent=kind==='website'?'Eksisterende private driftsdata og konfigurasjon beholdes. Programfiler og nettsider kan erstattes. Utdaterte offentlige filer fjernes ikke automatisk.':'Bilder overføres før XML. Egne annonser og status oppdateres; eksisterende leverandør-XML beholdes som standard. Bruk kun kontomappen utenfor webrot.';
   $('publication-error').hidden=true;$('publication-start').disabled=!p||s.busy;$('publication-connect').hidden=!!p&&!s.busy;publicationPaths();if(!d.open)d.showModal();
  }catch(e){toast(e.message||String(e),true);}
 }
 async function submitPublication(e){e.preventDefault();if(publicationInProgress)return;publicationInProgress=true;$('publication-start').disabled=true;$('publication-start').textContent='Kontrollerer og forbereder …';$('publication-cancel').disabled=true;$('publication-error').hidden=true;
  try{const result=await api.publicationStart({kind:publicationKind,profileId:publicationProfile,accountRoot:$('publication-account').value.trim(),webRoot:$('publication-webroot').value,replaceSupplier:$('publication-replace-supplier').checked,removeOwn:$('publication-remove-own').checked});if(result?.project){current=result.project;updateTop();}if(result?.started){$('publication-transfer-dialog').close();window.wsetServerWorkspace?.focusQueue(current.root);await chooseArea('server');toast('Overføringsjobb startet. Følg status i overføringskøen.'+(result.pendingRemoval?' Tidligere egen XML er ikke fjernet.':''));}}
  catch(e){$('publication-error').textContent=e.message||String(e);$('publication-error').hidden=false;}
  finally{publicationInProgress=false;$('publication-start').disabled=false;$('publication-start').textContent='Kontroller og overfør';$('publication-cancel').disabled=false;}
 }
 async function generateWebsite(){
  if(window.wsetPropertyDrafts?.hasPending()&&!await window.wsetPropertyDrafts.savePending())return;
  if(!await commitContextField())return;
  if(exportBusy||!await flushInline())return;
  const dlg=$('website-export-dialog');
  $('export-close-btn').disabled=false;
  $('export-close-btn').textContent='Avbryt';
  $('export-start-btn').hidden=false;
  $('export-web-root').disabled=false;
  $('export-reveal-btn').hidden=true;$('export-send-btn').hidden=true;
  $('export-result').hidden=true;
  $('export-error').hidden=true;
  $('export-bar').className='export-bar';
  $('export-status').textContent='Velg offentlig mappe og klikk Generer 2 ZIP-filer.';
  if(!dlg.open)dlg.showModal();
  void refreshAssistantModule();
 }
 async function performExport(){
  if(exportBusy||!await flushInline())return;
  await refreshAssistantModule();
  if(current.site.smartAssistant?.enabled===true&&!assistantModule){
   $('export-error').textContent='Smart Assistant er aktivert, men mangler. Importer den nyeste modul-ZIP-en før eksport.';
   $('export-error').hidden=false;
   return;
  }
  exportBusy=true;
  $('generate-btn').disabled=true;$('undo-btn').disabled=true;$('redo-btn').disabled=true;
  $('export-start-btn').hidden=true;
  $('export-web-root').disabled=true;
  $('export-close-btn').disabled=true;
  $('export-status').textContent='Velg mappe for begge ZIP-filene …';
  try{
   const chosenRoot=$('export-web-root').value;
   const result=await api.exportWebsite(chosenRoot);
   if(!result){$('website-export-dialog').close();return;}
   current=result.project;
   renderAll();
   $('export-bar').className='export-bar done';
   $('export-status').textContent='Eksport fullført';
   $('export-path').textContent=result.zipPath;
   $('export-details').textContent=`${result.pageCount} sider · ${result.fileCount} offentlige nettstedfiler · ${(result.bytes/1048576).toFixed(2)} MB totalt. TO ZIP-FILER: Pakk først ut 02-UTENFOR-WWW.zip i kontomappen OVER ${result.webRoot}/. Pakk deretter ut 01-WWW.zip direkte i eksisterende ${result.webRoot}/. Ingen installasjonsfiler eller PHP-installasjon. Ikke overskriv eldre serverkonfigurasjon/XML ved oppdatering. Privat ZIP: ${result.privateZipPath}.${result.warnings.length?' Advarsler: '+result.warnings.join(' · '):''}`;
   $('export-note').textContent=current.site.contactForm?.mode==='smtp'?'PHP/SMTP-modulen er inkludert. Du må konfigurere SMTP sikkert på webserveren og teste virkelig levering før lansering. Nettsiden har fortsatt noindex.':'Skjemaet er fortsatt en demo og sender ingen e-post. Nettsiden har fortsatt noindex.';
   $('export-result').hidden=false;
   $('export-reveal-btn').hidden=false;$('export-send-btn').hidden=false;
  }catch(error){
   $('export-bar').className='export-bar failed';
   $('export-status').textContent='Eksporten kunne ikke fullføres';
   $('export-error').textContent=error.message||String(error);
   $('export-error').hidden=false;
   try{current=await api.state();renderAll()}catch{}
  }finally{
   exportBusy=false;
   $('generate-btn').disabled=false;updateTop();
   $('export-close-btn').disabled=false;
   $('export-close-btn').textContent='Lukk';
  }
 }
 async function save(){if(window.wsetPropertyDrafts?.hasPending()&&!await window.wsetPropertyDrafts.savePending())return;if(!current||!await commitContextField()||!await flushInline())return;try{const next=await api.save();current=next;renderAll();toast('Prosjekt lagret og sikkerhetskopiert.')}catch(error){toast(error.message||String(error),true)}}
 async function validate(){try{const report=await api.validate();current.report=report;renderAll();toast(report.ok?'Prosjekt validert.':report.errors.join(' · '),!report.ok)}catch(error){toast(error.message||String(error),true)}}
  async function chooseLanguage(code){if(!await commitContextField()||!await flushInline())return;if(!current.site.languages.some(l=>l.code===code))return;if(locale!==code){lastPreviewScroll=0;selectedDesignTarget=null;designRole='heading';}locale=code;await loadTemplate();if(tab==='languages'&&area!=='languages')await refreshLanguageData();renderAll();refreshPreview(false)}
 async function activateProject(result){
  if(!result?.site)return;
  ++navigationEpoch;clearTimeout(scrollSaveTimer);previewIdentity=null;previewLoaded=false;previewExpectedUrl=null;clearTimeout(previewReadyTimer);restoringScroll=false;pendingPreviewScroll=0;current=result;settingsCategory='profile';settingsPage='home';settingsLocale=result.site.defaultLanguage;settingsTarget='';globalLocale=result.site.defaultLanguage;globalDoc='legal';settingsWrite=Promise.resolve(true);for(const key of Object.keys(inlineSelection))delete inlineSelection[key];
  if(!managerReady){await propertyManager.init(api,toast,()=>current.site,next=>{current=next;window.wsetPropertyDrafts?.sync();renderAll();refreshPreview(false);refreshHealth();},{publishCategory:category=>openPublication(category),previewBase:()=>current?.previewBase,locale:()=>locale,site:()=>current?.site,draftImageToken:()=>current?.draftImageToken,translate:input=>api.translate(input),addressSearch:request=>api.propertyAddressSearch(request),addressSelect:index=>api.propertyAddressSelect(index),importDraftImages:remaining=>api.propertyDraftImages(remaining),onDirty:updateTop,changeDraft:async command=>{const root=current.root;const next=await api.change(command);if(current?.root!==root)throw Error('Prosjektet er endret.');current=next;updateTop();let saved=false;try{current=await api.save();updateTop();saved=true;}catch(e){toast('Kladden er endret i prosjektet, men lagring feilet: '+e.message,true);}return {site:current.site,saved};}});managerReady=true;}
  else await propertyManager.projectChanged();
  selectedDesignTarget=null;designRole='heading';Object.keys(inlineSelection).forEach(k=>delete inlineSelection[k]);treeSearch='';treeCollapsed=false;$('tree-search').value='';previewOnly=false;updatePreviewMode();pageId='home';propertyView='all';sectionId=null;recordId=null;locale=current.site.defaultLanguage;mediaSearch='';mediaFilter='all';mediaCategory='all';mediaUsageFilter='all';mediaPage=1;mediaId=null;translationSearch='';translationFilter='all';tab='pages';area='overview';focusMode=false;inspectorPane='content';templateEntries=[];lastPreviewScroll=0;
  document.body.classList.remove('wset-no-project');$('welcome-workspace').hidden=true;
  media=await api.mediaList();await resume();
 }
 async function createFromLibrary(entry,onError){
  const input=await window.wsetProjectCreation.open({api,entry});
  if(!input)return false;
  return applyProject(()=>api.templateLibraryCreate(entry.key,input),onError);
 }
 async function applyProject(action,onError){try{if(!await commitContextField()||!await flushInline())return false;if(managerReady&&!propertyManager.canLeave())return false;storeContext();closeProjectPopover();const result=await action();if(!result)return false;await activateProject(result);toast('Prosjekt åpnet.');return true;}catch(error){toast(error.message||String(error),true);if(onError)onError(error);return false;}}
 async function exportEditable(kind){
  if(window.wsetPropertyDrafts?.hasPending()&&!await window.wsetPropertyDrafts.savePending())return;
  if(!await commitContextField())return;
  if(!await flushInline())return;
  if(!current)return toast('Åpne et prosjekt først.',true);
  try{const result=await api.exportEditableProject(kind);if(!result)return;
   current=await api.state();renderAll();toast(kind==='template'?'Redigerbar mal-ZIP er lagret.':'Fullstendig prosjekt-ZIP er lagret.');
  }catch(error){toast(error.message||String(error),true)}
 }
 function renderEmptyWorkspace(){
  renderPrimaryNavigation();$('welcome-workspace').hidden=true;setCanvasMode('utility');
  if(area!=='overview'){renderUtility();return;}
  const host=$('utility-workspace');host.innerHTML='<h1>Oversikt</h1><div id="last-project-card" class="overview-project">Ingen prosjekt åpnet.</div><div class="welcome-actions"><button class="btn btn-primary" data-utility="import">Importer prosjekt eller mal (ZIP)</button><button class="btn btn-outline" data-utility="open">Åpne prosjektmappe</button><button class="btn btn-outline" data-utility="library">Mine nettsteder</button><button class="btn btn-outline" data-utility="templates">Malbibliotek</button><button class="btn btn-outline" data-utility="workspace">Arbeidsområde</button></div>';
  api.recentProjects().then(list=>{if(current||area!=='overview'||!$('last-project-card'))return;const p=list[0];if(p)$('last-project-card').innerHTML=`<div><small>Sist brukte prosjekt</small><h2>${esc(p.name)}</h2><p>${esc(p.updatedLabel||'')}</p></div><button class="btn btn-primary" data-library-root="${esc(p.root)}">Fortsett redigering</button>`;}).catch(e=>toast(e.message,true));
 }
 async function showWelcome(){
  area='overview';document.body.classList.remove('wset-no-project');$('project-name').textContent='Ingen prosjekt';$('dirty-tag').hidden=true;$('save-btn').disabled=true;$('generate-btn').disabled=true;renderEmptyWorkspace();
 }

 async function renderUtility(){const host=$('utility-workspace'),selected=area;
 const applySwitch=async action=>{const next=await action();if(next){await activateProject(next);toast('Prosjekt oppdatert. Generer nettsiden på nytt før publisering.');return true;}return false;};
 if(area==='templates'&&window.wsetTemplateGallery){window.wsetTemplateGallery.mount(host,{api,create:entry=>createFromLibrary(entry),toast,hasProject:()=>!!current,applySwitch});return;}
 if(area==='library'&&window.wsetProjectDashboard){
  const open=async p=>p.root===current?.root?(await resume(),true):applyProject(()=>api.openRecent(p.root));
  const ensure=async p=>p.root===current?.root||await applyProject(()=>api.openRecent(p.root));
  const openUpdate=async(p,entry)=>{if(!await ensure(p)||current?.root!==p.root)return;await chooseArea('templates');if(current?.root!==p.root||area!=='templates')return;const catalogue=await api.templateLibraryList();if(current?.root!==p.root||area!=='templates')return;if(!catalogue.activeUpdate?.newerKeys?.includes(entry.key)||!catalogue.items.some(e=>e.key===entry.key&&e.digest===entry.digest))throw Error('Malversjonen er endret eller ikke lenger tilgjengelig. Synkroniser og velg på nytt.');await window.wsetTemplateCompatibility.open({api,entry,applySwitch,intent:'update'});};
  window.wsetProjectDashboard.mount(host,{api,current,open,openUpdate,copy:async p=>{if(await ensure(p))await applyProject(()=>api.saveAs());},exportProject:async p=>{if(await ensure(p))await exportEditable('project');},toast});return;
 }
 host.innerHTML=`<h1>${esc(areaNames[area])}</h1>`;if(area==='server'){window.wsetServerWorkspace?.mount(host,current?.root||'');return;}if(area==='publishing'){host.innerHTML+='<div class="health-panel"><h2>Generer nettside</h2><p>01-WWW.zip → eksisterende webrot</p><p>02-UTENFOR-WWW.zip → utenfor webrot</p><div class="publication-buttons"><button class="btn btn-primary" data-utility="generate">Generer nettside</button><button class="btn btn-outline" data-utility="publish-server">Overfør siste eksport til server</button></div></div>';return;}host.innerHTML+='<div class="welcome-actions"><button class="btn btn-primary" data-utility="import">Importer prosjekt eller mal (ZIP)</button><button class="btn btn-outline" data-utility="open">Åpne prosjektmappe</button><button class="btn btn-outline" data-utility="templates">Malbibliotek</button><button class="btn btn-outline" data-utility="workspace">Arbeidsområde</button></div><button class="btn btn-outline" data-utility="refresh-library">Oppdater prosjektregister</button><div id="library-list"></div>';try{const result=api.workspaceProjects?await api.workspaceProjects():{items:await api.recentProjects(),issues:[]};const list=result.items;if(area!==selected||!$('library-list'))return;$('library-list').innerHTML=list.map(p=>`<div class="library-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.template?.name||'')} ${esc(p.template?.templateVersion||'')} · ${esc(p.updatedLabel||'')}</small><details><summary>Prosjektdetaljer</summary><small>${esc(p.root)}</small>${p.id?`<small>ID: ${esc(p.id)}</small>`:''}</details></div><button class="btn btn-outline" data-library-root="${esc(p.root)}">Åpne</button></div>`).join('')||'<p>Ingen prosjekter.</p>';if(result.issues.length)$('library-list').insertAdjacentHTML('beforeend',`<p>${esc(result.issues.join(' · '))}</p>`);}catch(error){toast(error.message,true)}}
 function eventPayload(node){const action=node.dataset.command,field=node.dataset.field;
  if(!action||action.startsWith('_'))return null;
  const value=node.type==='checkbox'?node.checked:node.value;
  const command={action,field,value};
  if(node.dataset.localized)command.locale=node.dataset.settingsLocale||locale;
  if(action==='page:update')command.id=node.dataset.pageId||pageId;
  if(action==='property-module:update')command.id=node.dataset.moduleId;
  if(action==='language:update')command.code=node.dataset.languageCode||locale;
  if(action==='section:update'){command.pageId=pageId;command.id=sectionId;}
  if(action==='content:update')command.pageId=pageId;
  if(action==='collection:update'||action==='collection:publish'){command.collection=node.dataset.collection;command.id=node.dataset.recordId;}
  if(action==='gallery:update'){command.pageId=pageId;command.id=sectionId;command.index=Number(node.dataset.imageIndex);}
  return command;
 }
 function queueContextText(node){const t=contextualTarget();if(!t||typeof t.expected!=='string'||node.value===t.text)return contextWrite;
  const payload={action:'inline:text',pageId,sectionId,locale,targetId:t.id,expected:t.expected,value:node.value};
  if(node.dataset.pendingValue===node.value)return contextWrite;node.dataset.pendingValue=node.value;
  contextWrite=contextWrite.catch(()=>false).then(async()=>{if(!await flushInline())return false;return await change(payload)===true;});const pending=contextWrite;void pending.then(()=>{if(contextWrite===pending)contextWrite=Promise.resolve(true);},()=>{if(contextWrite===pending)contextWrite=Promise.resolve(true);});return pending;
 }
 async function commitContextField(){if(area==='settings'){const active=document.activeElement;if(active?.closest('#settings-workspace')&&active.matches('input,textarea,select'))active.blur();if(!await settingsWrite)return false;}if(area==='languages'&&languageWorkspace&&!await languageWorkspace.flush())return false;const node=$('inspector-body').querySelector('[data-context-text]');if(contextualTarget()&&node&&!node.disabled&&node.value!==contextualTarget()?.text)return queueContextText(node);return contextWrite;}
 async function handleField(e){const node=e.target;
  if(node.hasAttribute('data-context-text')){await queueContextText(node);return;}
  if(node.dataset.designChoose){if(node.dataset.designChoose==='global'){globalDesignRole=node.value;globalDesignOpen=true;}else designRole=node.value;renderInspector();return;}
  if(node.dataset.designProperty){const payload=designCommand(node);if(await commitContextField()&&await flushInline())await change(payload);return;}
  if(node.dataset.translationKey!==undefined){await change({action:'language:translate',locale,key:node.dataset.translationKey,value:node.value});return;}
  if(node.dataset.templateIndex!==undefined){
   const entry=templateEntries[Number(node.dataset.templateIndex)];
   if(entry){const payload=entry.occurrence?{action:'inline:text',pageId,sectionId,locale,targetId:entry.targetId,expected:String(entry.value),value:node.value}:{action:'template:text',pageId,id:sectionId,locale,original:entry.original,value:node.value};if(await flushInline())await change(payload);}return;
  }
  if(node.dataset.mediaTarget){
   const target=JSON.parse(node.dataset.mediaTarget);
   const command=((target.kind==='team'&&node.dataset.mediaField==='portrait')||target.kind==='brand')&&!node.value?{action:'media:clear',target,field:node.dataset.mediaField}:target.kind==='slot'?{action:'media:slot',key:target.key,src:node.value}:{action:'media:assign',target,field:node.dataset.mediaField,src:node.value};
   await change(command);return;
  }
  const payload=eventPayload(node);if(payload){if(payload.action==='assistant:update'&&payload.field==='enabled')payload.value=payload.value==='true';if(await flushInline())await change(payload);}
 }
 async function addRecord(group=tab){
  const typed=group==='team'?document.getElementById('new-team-name')?.value:null;
  let label;
  if(group==='team'&&!document.getElementById('new-team-name')){
   // Native prompt windows are unreliable in certain Electron contexts. Use a real input instead.
   label=await new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='wset-team-create-dialog';
    dialog.innerHTML='<form method="dialog"><h3>Opprett ansattprofil</h3><label>Navn på ansatt<input name="employeeName" maxlength="160" required autocomplete="off" placeholder="Navn på ansatt"></label><div class="wset-team-create-actions"><button value="cancel" type="button" data-cancel-team-create>Avbryt</button><button value="create" type="submit">Opprett ansatt</button></div></form>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-cancel-team-create]').addEventListener('click',()=>dialog.close('cancel'));
    dialog.addEventListener('close',()=>{const value=dialog.returnValue==='create'?dialog.querySelector('[name="employeeName"]').value:'';dialog.remove();resolve(value)},{once:true});
    dialog.showModal();dialog.querySelector('[name="employeeName"]').focus();
   });
  }else label=group==='team'?typed:prompt(`Navn på ny ${singular[group]}:`);
  if(!label?.trim()){if(group==='team'&&document.getElementById('new-team-name'))toast('Skriv inn navn på den ansatte først.',true);return;}
  const slug=label.toLowerCase().replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if(!slug||!/[a-z]/.test(slug[0])){toast('Navnet må inneholde bokstaver.',true);return;}
  let id=slug,number=2;while(records(group).some(x=>x.id===id))id=`${slug}-${number++}`;
  if(tab==='pages')inlineSelection[group]=id;else recordId=id;
  await change({action:'collection:add',collection:group,id,title:label.trim()});
 }
 function setupPanelResize(){
  for(const [id,css,sign,min,max] of [['resize-tree','--wset-side-width',1,185,460],['resize-inspector','--wset-inspector-width',-1,240,530]]){
   const grip=$(id),key='wset-width-'+id;const apply=n=>{const width=Math.max(min,Math.min(max,n));document.body.style.setProperty(css,width+'px');grip.setAttribute('aria-valuenow',String(width));try{(window.wsetPrefs||localStorage).setItem(key,String(width))}catch{}};
   try{const saved=Number((window.wsetPrefs||localStorage).getItem(key));if(saved)apply(saved)}catch{}
   const width=()=>parseFloat(getComputedStyle(document.body).getPropertyValue(css));
   grip.addEventListener('pointerdown',e=>{if(e.button!==0)return;const x=e.clientX,w=width();grip.setPointerCapture(e.pointerId);const move=e=>apply(w+sign*(e.clientX-x));const stop=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('lostpointercapture',stop)};grip.addEventListener('pointermove',move);grip.addEventListener('lostpointercapture',stop);});
   grip.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();apply(width()+sign*(e.key==='ArrowRight'?16:-16));}});
  }
 }
 function init(){
  window.wsetWorkspace?.init({api,onChange:()=>{if(['library','templates'].includes(area))renderUtility();}});
  window.wsetTemplateLibrary?.init({api,create:(entry,onError)=>createFromLibrary(entry,onError)});
  $('template-library-open').addEventListener('click',()=>{closeProjectPopover();if(window.wsetTemplateGallery)chooseArea('templates');else window.wsetTemplateLibrary?.open();});
  languageWorkspace=window.wsetLanguageWorkspace?.create({host:$('language-workspace'),api,change,toast,addLanguage:()=>{$('add-language-form').reset();$('language-dialog').showModal()},isActive:()=>area==='languages'&&!!current});
  try{const saved=(window.wsetPrefs||localStorage).getItem('wset-navigation-mode-rc18');navMode=saved==='compact'?'compact':'expanded';treeVisible=(window.wsetPrefs||localStorage).getItem('wset-tree-visible')!=='false';inspectorVisible=(window.wsetPrefs||localStorage).getItem('wset-inspector-visible')!=='false'}catch{}
  const setPanel=(which,visible)=>{if(which==='tree'){treeVisible=visible;try{(window.wsetPrefs||localStorage).setItem('wset-tree-visible',String(visible))}catch{}}else{inspectorVisible=visible;try{(window.wsetPrefs||localStorage).setItem('wset-inspector-visible',String(visible))}catch{}}renderPrimaryNavigation()};
  $('toggle-tree-btn').addEventListener('click',()=>setPanel('tree',!treeVisible));
  $('toggle-inspector-btn').addEventListener('click',()=>setPanel('inspector',!inspectorVisible));
  $('primary-navigation').addEventListener('click',event=>{const b=event.target.closest('[data-area]');if(b)chooseArea(b.dataset.area)});
  $('nav-collapse-btn').addEventListener('click',()=>{navMode=navMode==='expanded'?'compact':'expanded';try{(window.wsetPrefs||localStorage).setItem('wset-navigation-mode-rc18',navMode)}catch{}renderPrimaryNavigation()});
  const toggleFocus=()=>{if(area==='overview')chooseArea('website');else{focusMode=!focusMode;renderPrimaryNavigation()}};
  $('focus-mode-btn').addEventListener('click',toggleFocus);
  $('project-switch').addEventListener('click',showProjectPopover);
  $('recent-project-list').addEventListener('click',event=>{const button=event.target.closest('[data-recent-project]');if(button){if(button.dataset.recentProject===current?.root){closeProjectPopover();return;}applyProject(()=>api.openRecent(button.dataset.recentProject))}});
  document.addEventListener('click',event=>{if(!event.target.closest('.project-picker'))closeProjectPopover();if(!event.target.closest('.app-options'))document.querySelector('.app-options')?.removeAttribute('open')});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('project-popover').hidden)closeProjectPopover();else if(focusMode){focusMode=false;renderPrimaryNavigation()}}});
  $('task-form').addEventListener('submit',e=>{e.preventDefault();const text=$('task-text').value.trim();if(current&&text){setTasks([...tasks(),{text,done:false}]);$('task-text').value='';}});
  $('manual-tasks').addEventListener('change',e=>{if(e.target.dataset.taskToggle===undefined)return;const items=tasks(),i=Number(e.target.dataset.taskToggle);if(items[i]){items[i].done=e.target.checked;setTasks(items)}});
  $('manual-tasks').addEventListener('click',e=>{const b=e.target.closest('[data-task-delete]');if(b)setTasks(tasks().filter((_,i)=>i!==Number(b.dataset.taskDelete)));});
  $('utility-workspace').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.libraryRoot){if(b.dataset.libraryRoot===current?.root)resume();else applyProject(()=>api.openRecent(b.dataset.libraryRoot));}else if(b.dataset.utility==='import')applyProject(()=>api.importEditableProject());else if(b.dataset.utility==='open')applyProject(()=>api.open());else if(b.dataset.utility==='generate')generateWebsite();else if(b.dataset.utility==='publish-server')openPublication('website');else if(b.dataset.utility==='library')chooseArea('library');else if(b.dataset.utility==='templates'){if(window.wsetTemplateGallery)chooseArea('templates');else window.wsetTemplateLibrary?.open();}else if(b.dataset.utility==='workspace')window.wsetWorkspace?.open();else if(b.dataset.utility==='refresh-library')renderUtility();});
  $('welcome-library').addEventListener('click',()=>{$('welcome-title').textContent='Mine nettsteder';$('welcome-recent').scrollIntoView({block:'nearest'});});
  $('welcome-last').addEventListener('click',e=>{const b=e.target.closest('[data-welcome-recent]');if(b)applyProject(()=>api.openRecent(b.dataset.welcomeRecent));});
  $('overview-workspace').addEventListener('click',event=>{if(event.target.closest('[data-resume]')){resume();return;}const next=event.target.closest('[data-overview-area]');if(next)chooseArea(next.dataset.overviewArea,next.dataset.overviewTab||null);else if(event.target.closest('[data-overview-publish]'))generateWebsite();else if(event.target.closest('[data-overview-validate]'))validate();else if(event.target.closest('[data-local-xml]')){const category=event.target.closest('[data-local-xml]').dataset.localXml;propertyManager.importLocal(category).then(()=>refreshHealth()).catch(error=>toast(error.message,true))}});
  $('open-btn').addEventListener('click',()=>applyProject(()=>api.open()));$('copy-btn').addEventListener('click',()=>applyProject(()=>api.saveAs()));
  $('import-project-btn').addEventListener('click',()=>applyProject(()=>api.importEditableProject()));
  $('export-project-btn').addEventListener('click',()=>exportEditable('project'));
  $('save-template-btn').addEventListener('click',()=>exportEditable('template'));
  $('welcome-import').addEventListener('click',()=>applyProject(()=>api.importEditableProject()));
  $('welcome-open').addEventListener('click',()=>applyProject(()=>api.open()));
  $('welcome-recent').addEventListener('click',e=>{const button=e.target.closest('[data-welcome-recent]');if(button)applyProject(()=>api.openRecent(button.dataset.welcomeRecent));});
  $('copy-btn').disabled=!current;
  $('export-project-btn').disabled=!current;
  $('save-template-btn').disabled=!current;

  $('undo-btn').addEventListener('click',()=>undoRedo('undo'));$('redo-btn').addEventListener('click',()=>undoRedo('redo'));
  $('save-btn').addEventListener('click',save);$('generate-btn').addEventListener('click',generateWebsite);$('validate-btn').addEventListener('click',validate);$('refresh-btn').addEventListener('click',async()=>{if(await flushInline())refreshPreview();});
  $('export-start-btn').addEventListener('click',performExport);
  $('export-assistant-import').addEventListener('click',importAssistantFromZip);
  $('export-close-btn').addEventListener('click',()=>$('website-export-dialog').close());
  $('export-send-btn').addEventListener('click',()=>{$('website-export-dialog').close();void openPublication('website');});
  $('publication-transfer-form').addEventListener('submit',submitPublication);
  $('publication-cancel').addEventListener('click',()=>{if(!publicationInProgress)$('publication-transfer-dialog').close();});
  $('publication-transfer-dialog').addEventListener('cancel',e=>{if(publicationInProgress)e.preventDefault();});
  $('publication-connect').addEventListener('click',()=>{$('publication-transfer-dialog').close();void chooseArea('server');});
  $('publication-account').addEventListener('input',publicationPaths);$('publication-webroot').addEventListener('change',publicationPaths);
  $('export-reveal-btn').addEventListener('click',async()=>{try{await api.revealExport()}catch(error){toast(error.message||String(error),true)}});
  $('website-export-dialog').addEventListener('cancel',event=>{if(exportBusy)event.preventDefault()});
  api.onExportProgress(info=>{if(!exportBusy)return;if(info?.message)$('export-status').textContent=String(info.message).slice(0,280)});
  $('content-type').addEventListener('change',e=>{const b=[...$('editor-tabs').querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===e.target.value);b?.click();});
  $('tree-search').addEventListener('input',e=>{treeSearch=e.target.value;$('pages-list').innerHTML=renderPagesTree();storeContext();});
  $('preview-mode').addEventListener('click',async()=>{if(!await flushInline())return;previewOnly=!previewOnly;updatePreviewMode();storeContext();$('preview-status').textContent=previewOnly?'Forhåndsvisning uten redigeringsmarkeringer':'Klikk for å velge · Dobbeltklikk på tekst for å redigere';focusPreview(false);});
  setupPanelResize();
  $('editor-tabs').addEventListener('click',async e=>{const button=e.target.closest('[data-tab]');if(!button)return;if(tab==='propertyManager'&&button.dataset.tab!==tab&&!propertyManager.canLeave())return;area=button.dataset.areaFor||area;tab=button.dataset.tab;inspectorPane='content';
   if(labels[tab]){recordId=records()[0]?.id||null;showContentPreview(tab,recordId);return;}
   if(tab==='media')mediaId=media[0]?.id;
   if(tab==='languages'){await refreshLanguageData();renderAll();refreshPreview();return;}
   if(tab==='brand'){pageId='home';sectionId=null;}
   renderAll();
   if(tab==='pages'||tab==='brand')refreshPreview();
  });

  $('preview-lang').addEventListener('change',e=>chooseLanguage(e.target.value));
  $('inspector-panel-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-inspector-pane]');if(!b)return;inspectorPane=b.dataset.inspectorPane;renderInspector();storeContext();});
  $('site-preview').addEventListener('load',()=>{if(!current)return;previewLoaded=false;focusPreview(false);if(previewIdentity)try{$('site-preview').contentWindow?.postMessage({kind:'wset-preview-ping'},current.previewBase)}catch{}});
  document.querySelectorAll('[data-device]').forEach(btn=>btn.addEventListener('click',()=>{device=btn.dataset.device;
   document.querySelectorAll('[data-device]').forEach(b=>{b.classList.toggle('selected',b===btn);b.setAttribute('aria-pressed',String(b===btn))});$('preview-sheet').className='preview-sheet '+(device==='desktop'?'':device);renderPrimaryNavigation();storeContext();}));
  $('pages-list').addEventListener('click',async e=>{
   const del=e.target.closest('[data-delete-page-shortcut]');
   if(del){const id=del.dataset.deletePageShortcut,p=current.site.sitePages.find(x=>x.id===id);if(!p||id==='home')return;
    if(confirm(`Slette siden «${local(p.title)}» permanent fra prosjektet? Alle seksjonene på siden slettes. Lagre prosjektet etterpå.`))await change({action:'page:delete',id});return;
   }
   const moveS=e.target.closest('[data-sidebar-move-section]');
   if(moveS){await change({action:'section:move',pageId,id:moveS.dataset.sidebarMoveSection,direction:Number(moveS.dataset.direction)});return;}
   const moveR=e.target.closest('[data-tree-move-record]');
   if(moveR){await change({action:'collection:move',collection:moveR.dataset.treeGroup,id:moveR.dataset.treeMoveRecord,direction:Number(moveR.dataset.direction)});return;}
   const addR=e.target.closest('[data-tree-add-record]');
   if(addR){await addRecord(addR.dataset.treeAddRecord);return;}
   const recordButton=e.target.closest('[data-tree-record]');
   if(recordButton){selectedDesignTarget=null;designRole='heading';inlineSelection[recordButton.dataset.treeGroup]=recordButton.dataset.treeRecord;inspectorPane='content';renderSidebar();renderInspector();storeContext();focusPreview(true);return;}
   if(e.target.closest('[data-tree-add-section]')){sectionId=null;inspectorPane='content';renderAll();$('inspector-body').querySelector('.add-section')?.scrollIntoView({block:'center'});return;}
   const property=e.target.closest('[data-tree-property]');if(property){await selectPage('properties',property.dataset.treeProperty);return;}
   const sec=e.target.closest('[data-sidebar-section]');
   if(sec){await selectSection(sec.dataset.sidebarSection);focusPreview(true);renderSidebar();return;}
   const btn=e.target.closest('[data-page]');if(btn){if(btn.dataset.page===pageId&&e.target.closest('[data-tree-chevron]')){treeCollapsed=!treeCollapsed;renderSidebar();storeContext();return;}area='website';tab='pages';selectPage(btn.dataset.page)}
  });
  // Pages have a flat, independently draggable list. The home page stays first.
  // Sections and records remain restricted to their own page/collection.
  $('pages-list').addEventListener('dragstart',e=>{
   const section=e.target.closest('[data-tree-drag-section]'),item=e.target.closest('[data-tree-drag-record]'),pageRow=e.target.closest('[data-tree-drag-page]');
   dragItem=item?{kind:'record',id:item.dataset.treeDragRecord,group:item.dataset.treeGroup,pageId}:section?{kind:'section',id:section.dataset.treeDragSection,pageId}:pageRow&&pageRow.dataset.treeDragPage!=='home'?{kind:'page',id:pageRow.dataset.treeDragPage}:null;
   if(!dragItem){e.preventDefault();return;}
   e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragItem.id);
  });
  $('pages-list').addEventListener('dragover',e=>{
   const row=dragItem?.kind==='page'?e.target.closest('[data-tree-drag-page]'):dragItem?.kind==='record'?e.target.closest('[data-tree-drag-record]'):e.target.closest('[data-tree-drag-section]');
   $('pages-list').querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));
   if(!row||!dragItem||(dragItem.kind!=='page'&&dragItem.pageId!==pageId)||(dragItem.kind==='record'&&row.dataset.treeGroup!==dragItem.group)||row.dataset.treeDragPage==='home')return;
   e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drag-over');
  });
  $('pages-list').addEventListener('drop',async e=>{
   const dragged=dragItem;dragItem=null;$('pages-list').querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));
   if(!dragged||(dragged.kind!=='page'&&dragged.pageId!==pageId))return;
   const row=dragged.kind==='page'?e.target.closest('[data-tree-drag-page]'):dragged.kind==='record'?e.target.closest('[data-tree-drag-record]'):e.target.closest('[data-tree-drag-section]');
   if(!row||(dragged.kind==='record'&&row.dataset.treeGroup!==dragged.group)||row.dataset.treeDragPage==='home')return;
   const beforeId=dragged.kind==='page'?row.dataset.treeDragPage:dragged.kind==='record'?row.dataset.treeDragRecord:row.dataset.treeDragSection;
   if(dragged.id===beforeId)return;e.preventDefault();
   if(dragged.kind==='page'){const bounds=row.getBoundingClientRect();const after=e.clientY>bounds.top+bounds.height/2;await change({action:'page:reorder',id:dragged.id,...(after?{afterId:beforeId}:{beforeId})});}
   else if(dragged.kind==='record')await change({action:'collection:reorder',collection:dragged.group,id:dragged.id,beforeId});
   else await change({action:'section:reorder',pageId,id:dragged.id,beforeId});
  });
  $('pages-list').addEventListener('dragend',()=>{dragItem=null;$('pages-list').querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'))});
  $('pages-list').addEventListener('change',async e=>{const id=e.target.dataset.togglePage,category=e.target.dataset.toggleProperty,value=e.target.checked;if(!id&&!category)return;if(!await commitContextField()||!await flushInline()){renderSidebar();return;}if(id)await change({action:'page:update',id,field:'enabled',value});else await change({action:'property-module:update',id:category,field:'enabled',value});});
  $('new-page-btn').addEventListener('click',()=>{
   $('add-page-form').reset();
   const supported=current.site.pageTemplate?.blank?.available===true;
   $('blank-template-status').textContent=supported?'Siden opprettes som utkast med tomt innhold og design fra aktiv mal.':'Aktiv nettsidemal har foreløpig ingen kompatibel tom sidemal. Funksjonen blir tilgjengelig når malen leverer denne.';
   $('new-page-submit').disabled=!supported;
   $('page-dialog').showModal();
  });
  $('add-page-form').addEventListener('submit',e=>{e.preventDefault();if(e.submitter?.value==='cancel'){$('page-dialog').close();return;}
   const values=new FormData(e.target);$('page-dialog').close();change({action:'page:add',title:values.get('title'),slug:values.get('slug')});});
  $('collection-list').addEventListener('click',async e=>{if(e.target.closest('[data-add-demo-team]')){await change({action:'team:add-samples'});toast('Demoansatte lagt til. Husk å lagre.');return;}const b=e.target.closest('[data-record]');if(b){recordId=b.dataset.record;inspectorPane=tab==='team'?'images':'content';showContentPreview(tab,recordId)}});
  $('new-record-btn').addEventListener('click',()=>addRecord(tab));
  $('xml-language-preset').addEventListener('change',e=>{
    const names={no:['Norsk','🇳🇴'],en:['English','🇬🇧'],es:['Español','🇪🇸'],de:['Deutsch','🇩🇪'],da:['Dansk','🇩🇰'],fi:['Suomi','🇫🇮'],fr:['Français','🇫🇷'],nl:['Nederlands','🇳🇱'],pl:['Polski','🇵🇱'],sv:['Svenska','🇸🇪'],ru:['Русский','🇷🇺']};
    const selected=names[e.target.value];if(!selected)return;
    const form=$('add-language-form');form.elements.namedItem('code').value=e.target.value;
    form.elements.namedItem('name').value=selected[0];form.elements.namedItem('flag').value=selected[1];
  });
  $('new-language-btn').addEventListener('click',()=>{$('xml-language-preset').value='';$('language-dialog').showModal()});
  $('add-language-form').addEventListener('submit',async e=>{e.preventDefault();if(e.submitter?.value==='cancel'){$('language-dialog').close();return;}const d=new FormData(e.target);$('language-dialog').close();const code=String(d.get('code')||'').trim().toLowerCase();await change({action:'language:add',code,name:d.get('name'),flag:d.get('flag')});if(current.site.languages.some(l=>l.code===code)){if(area==='languages'){languageWorkspace?.selectTarget(code);return;}locale=code;await refreshLanguageData();renderAll();refreshPreview();}});
  $('languages-list').addEventListener('click',async e=>{const b=e.target.closest('[data-select-language]');if(!b)return;locale=b.dataset.selectLanguage;await refreshLanguageData();renderAll();refreshPreview()});
  $('media-workspace').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.mwCategory!==undefined){mediaCategory=b.dataset.mwCategory;mediaPage=1;mediaId=null;renderMediaWorkspace();}else if(b.dataset.mwItem!==undefined){mediaId=b.dataset.mwItem;renderMediaWorkspace();}else if(b.dataset.mwView!==undefined){mediaView=b.dataset.mwView;renderMediaWorkspace();}else if(b.dataset.mwPage!==undefined){mediaPage=Number(b.dataset.mwPage);renderMediaWorkspace();}else if(b.dataset.mwRef!==undefined)await openMediaReference(asset()?.placements?.[Number(b.dataset.mwRef)]);else if(b.dataset.mwAction)await mediaWorkspaceAction(b.dataset.mwAction);});
  $('media-workspace').addEventListener('input',e=>{if(e.target.id!=='mw-search')return;mediaSearch=e.target.value;const pos=e.target.selectionStart;mediaPage=1;renderMediaWorkspace();$('mw-search').focus();$('mw-search').setSelectionRange(pos,pos);});
  $('media-workspace').addEventListener('change',async e=>{const el=e.target;if(el.id==='mw-status'){mediaUsageFilter=el.value;mediaPage=1;renderMediaWorkspace();}else if(el.id==='mw-sort'){mediaSort=el.value;mediaPage=1;renderMediaWorkspace();}else if(el.id==='mw-alt-lang'){locale=el.value;renderMediaWorkspace();$('mw-alt-lang')?.closest('details')?.setAttribute('open','');}else if(el.dataset.mwAlt){await change({...JSON.parse(el.dataset.mwAlt),locale,value:el.value});$('mw-alt-lang')?.closest('details')?.setAttribute('open','');}else if(el.dataset.mwAssign&&asset()){const m=asset(),ids=new Set(m.manual||[]);if(el.checked)ids.add(el.dataset.mwAssign);else ids.delete(el.dataset.mwAssign);await change({action:'media:categorize',id:m.id,categories:[...ids]});}});
  $('media-upload-btn').addEventListener('click',upload);
  $('media-search').addEventListener('input',e=>{mediaSearch=e.target.value;renderSidebar();$('media-search').focus();$('media-search').setSelectionRange(mediaSearch.length,mediaSearch.length)});
  $('media-filter').addEventListener('change',e=>{mediaFilter=e.target.value;renderSidebar()});
  $('media-list').addEventListener('click',e=>{const b=e.target.closest('[data-media]');if(b){mediaId=b.dataset.media;renderAll()}});
  $('inspector-body').addEventListener('toggle',e=>{const d=e.target;if(d.matches?.('.wset-context-extra')&&d.isConnected){const t=contextualTarget();if(t){const key=contextExtraKey(t);if(d.open)contextExtraOpen.add(key);else contextExtraOpen.delete(key);}return;}if(d.matches?.('.wset-global-design')&&d.isConnected)globalDesignOpen=d.open;if(!d.matches?.('details[data-copy-group]')||!d.isConnected)return;const open=templateOpenGroups.get(templateContext())||new Set(['Seksjonsinnhold']);if(d.open)open.add(d.dataset.copyGroup);else open.delete(d.dataset.copyGroup);templateOpenGroups.set(templateContext(),open);},true);
  $('settings-workspace').addEventListener('input',e=>{if(e.target.matches('input[data-command],textarea[data-command]')){$('sw-save').disabled=false;$('save-btn').disabled=false;$('sw-save-state').textContent='Ulagrede endringer';}});
  $('settings-workspace').addEventListener('change',settingsFieldChanged);
  $('settings-workspace').addEventListener('click',settingsClicked);
  $('brand-form').addEventListener('change',handleField);$('inspector-body').addEventListener('change',handleField);
  $('inspector-body').addEventListener('input',e=>{if(e.target.id==='language-search'){translationSearch=e.target.value.trim().toLocaleLowerCase();applyTranslationFilter();}if(['focus-x','focus-y'].includes(e.target.id)){const label=$(e.target.id+'-label');if(label)label.textContent=e.target.value}});
  $('inspector-body').addEventListener('change',e=>{if(e.target.id==='translation-filter'){translationFilter=e.target.value;applyTranslationFilter();}});
  $('inspector-body').addEventListener('click',async e=>{const tr=e.target.closest('[data-context-translate]');if(tr){const t=contextualTarget(),key=t&&contextTranslationKey(t),origin=current?.root,from=locale,to=$('context-translate-target')?.value;if(!key||!to)return;tr.disabled=true;try{if(!await commitContextField()||!await flushInline()||current?.root!==origin)return;const [a,b]=await Promise.all([api.languageEntries(from),api.languageEntries(to)]);const sourceText=a.entries.find(x=>x.key===key)?.value,expected=b.entries.find(x=>x.key===key)?.value;if(!sourceText?.trim()||expected===undefined)throw Error('Tekstfeltet støtter ikke automatisk oversettelse. Bruk Språk.');if(expected.trim()&&!confirm('Erstatte eksisterende oversettelse?'))return;toast('Oversetter tekstfelt lokalt …');const r=await api.translateContent({source:from,target:to,text:sourceText});if(current?.root!==origin)return;if(await change({action:'language:auto-translate',source:from,target:to,items:[{key,sourceText,expected,value:r.text}]}))toast('Oversettelse lagret.');}catch(err){toast(err.message||String(err),true);}finally{tr.disabled=false;}return;}const back=e.target.closest('[data-context-back]');if(back){if(!await commitContextField())return;selectedDesignTarget=null;designRole='heading';inspectorPane='content';renderInspector();focusPreview(false);storeContext();return;}const toggle=e.target.closest('[data-context-toggle]');if(toggle){const payload=designCommand(toggle);if(await commitContextField()&&await flushInline())await change(payload);return;}const reset=e.target.closest('[data-design-reset]');if(reset){const payload=designCommand(reset,true);if(await commitContextField()&&await flushInline())await change(payload);return;}
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.inspectorLang!==undefined){await chooseLanguage(b.dataset.inspectorLang);return;}
   if(b.dataset.langExport!==undefined){try{const file=await api.languageExport(locale);if(file)toast('Språkfil lagret: '+file);}catch(error){toast(error.message||String(error),true)}return;}
   if(b.dataset.langImport!==undefined){try{const picked=await api.languageImportSelect();if(!picked)return;const r=picked.inspection;if(!r.ok)throw Error(r.errors.join(' · '));if(!confirm(`Importer oversettelser for ${picked.pack.locale}?\n${r.changed} endringer, ${r.added} nye, ${r.ignored} ukjente nøkler ignorert.\nEksisterende oversettelser slettes ikke.`))return;locale=picked.pack.locale;await change({action:'language:import',pack:picked.pack});toast('Språkfil importert. Husk å lagre prosjektet.')}catch(error){toast(error.message||String(error),true)}return;}
   if(b.dataset.moveLanguage!==undefined){await change({action:'language:move',code:locale,direction:Number(b.dataset.moveLanguage)});return;}
   if(b.dataset.deleteLanguage!==undefined){if(confirm(`Fjerne ${locale} fra språklisten? Standardspråket kan ikke slettes.`)){await change({action:'language:remove',code:locale});locale=current.site.defaultLanguage;await refreshLanguageData();renderAll();refreshPreview()}return;}
   if(b.dataset.clearSection!==undefined){sectionId=null;templateEntries=[];renderAll();return;}
   if(b.dataset.editorRecord){inlineSelection[b.dataset.editorGroup]=b.dataset.editorRecord;renderInspector();focusPreview();return;}
   if(b.dataset.addDemoTeam!==undefined){const result=await change({action:'team:add-samples'});toast('Fiktive eksempelprofiler lagt til. De vises kun i forhåndsvisning. Husk å lagre.');return;}
   if(b.dataset.addRecord){await addRecord(b.dataset.addRecord);return;}
   if(b.dataset.section){await selectSection(b.dataset.section);focusPreview();return;}
   if(b.dataset.duplicateSection){await change({action:'section:duplicate',pageId,id:b.dataset.duplicateSection});inspectorPane='content';renderInspector();return;}
   if(b.dataset.duplicateRecord!==undefined){const group=tab==='pages'?sectionCollection(page(),section()):tab;await change({action:'collection:duplicate',collection:group,id:selectedRecordId(group)});inspectorPane='content';renderAll();return;}
   if(b.dataset.movePage){await change({action:'page:move',id:pageId,direction:Number(b.dataset.movePage)});return;}
   if(b.dataset.moveSection){await change({action:'section:move',pageId,id:b.dataset.moveSection,direction:Number(b.dataset.direction)});return;}
   if(b.dataset.addSection!==undefined){await change({action:'section:add',pageId,type:$('section-type').value});await loadTemplate();return;}
   if(b.dataset.deleteSection){if(confirm('Fjern denne seksjonen?')){await change({action:'section:delete',pageId,id:b.dataset.deleteSection});sectionId=null;renderAll()}return;}
   if(b.dataset.deletePage!==undefined){if(confirm('Fjern siden og dens seksjoner?'))await change({action:'page:delete',id:pageId});return;}
   if(b.dataset.moveRecord){const group=tab==='pages'?sectionCollection(page(),section()):tab;await change({action:'collection:move',collection:group,id:selectedRecordId(group),direction:Number(b.dataset.moveRecord)});return;}
   if(b.dataset.deleteRecord!==undefined){const group=tab==='pages'?sectionCollection(page(),section()):tab,id=selectedRecordId(group);if(confirm(`Fjern ${singular[group]} «${id}»? Seksjonen beholdes.`)){if(tab==='pages')inlineSelection[group]=null;else recordId=null;await change({action:'collection:delete',collection:group,id});if(tab!=='pages')recordId=records(group)[0]?.id||null;renderAll()}return;}
   if(b.dataset.openTeamImages!==undefined){inspectorPane='images';renderInspector();return;}
   if(b.dataset.removeTeamPortrait!==undefined){const id=tab==='pages'?selectedRecordId('team'):recordId;if(id)await change({action:'media:clear',target:{kind:'team',id},field:'portrait'});return;}
   if(b.dataset.replaceRef){const m=media.find(x=>(x.paths||[x.src]).includes(b.dataset.currentImage));if(m?.placements?.some(r=>r.id===b.dataset.replaceRef))await replaceFromMedia(m,b.dataset.replaceRef);else toast('Fant ikke bildeplasseringen.',true);return;}
   if(b.dataset.openMediaSrc){await openMediaBySrc(b.dataset.openMediaSrc);return;}
   if(b.dataset.uploadMediaTarget){
    await uploadToField(JSON.parse(b.dataset.uploadMediaTarget),b.dataset.uploadMediaField,b.dataset.uploadMediaPreset||'gallery',b.dataset.currentImage||'');return;
   }
   if(b.dataset.addGallery!==undefined){const src=$('inspector-body').querySelector('[data-command="_galleryChoice"]')?.value;if(src)await change({action:'gallery:add',pageId,id:sectionId,src});return;}
   if(b.dataset.removeGallery!==undefined){await change({action:'gallery:remove',pageId,id:sectionId,index:Number(b.dataset.removeGallery)});return;}
   if(b.dataset.addProjectGallery!==undefined){const src=$('inspector-body').querySelector('[data-command="_projectChoice"]')?.value;if(src)await change({action:'project:gallery:add',id:selectedRecordId('projects'),src});return;}
   if(b.dataset.removeProjectGallery!==undefined){await change({action:'project:gallery:remove',id:selectedRecordId('projects'),index:Number(b.dataset.removeProjectGallery)});return;}
   if(b.dataset.reframe!==undefined){try{const id=mediaId;current=await api.mediaReframe({id,focusX:Number($('focus-x').value),focusY:Number($('focus-y').value)});media=await api.mediaList();renderAll();refreshPreview();toast('Fokuspunkt oppdatert, bilder generert på nytt.');}catch(error){toast(error.message||String(error),true)}return;}
   if(b.dataset.assignSlot!==undefined){const key=$('inspector-body').querySelector('[data-command="_slotKey"]')?.value;
    const preset=$('inspector-body').querySelector('[data-command="_mediaPreset"]')?.value||'hero';
    await change({action:'media:slot',key,src:mediaSrc(asset(),preset)});return;}
  });
  window.addEventListener('message',e=>{if(!current||e.origin!==current.previewBase||e.source!==$('site-preview').contentWindow)return;
   if(e.data?.kind==='wset-inline-start'){
    const d=e.data;if(area!=='website'||previewOnly||d.href!==previewExpectedUrl||!page()?.sections.some(s=>s.id===d.sectionId)||inlineSession)return;
    let resolve;const done=new Promise(r=>resolve=r);inlineSession={session:d.session,root:current.root,href:d.href,pageId,locale,sectionId:d.sectionId,targetId:d.targetId,expected:d.expected,done,resolve};updateTop();return;
   }
   if(e.data?.kind==='wset-inline-finish'){
    const d=e.data,s=inlineSession;if(!s||s.session!==d.session||s.href!==d.href||s.root!==current.root||s.committing)return;
    if(!d.commit){completeInline(true);return;}s.committing=true;
    change({action:'inline:text',pageId:s.pageId,locale:s.locale,sectionId:s.sectionId,targetId:s.targetId,expected:s.expected,value:d.value}).then(ok=>{if(inlineSession===s)completeInline(ok===true);if(!ok)refreshPreview();});return;
   }
   if(e.data?.kind==='wset-inline-save'){save();return;}
   if(e.data?.kind==='wset-context-details'){
    const t=contextualTarget(),d=e.data;if(!t||area!=='website'||previewOnly||d.href!==previewExpectedUrl||d.sectionId!==sectionId)return;
    if(d.missing===t.id){selectedDesignTarget=null;designRole='heading';renderInspector();storeContext();return;}
    if(d.details?.id!==t.id||typeof d.details.expected!=='string'||typeof d.details.text!=='string')return;
    const fresh={...t,expected:d.details.expected,text:d.details.text,label:d.details.label,styleable:d.details.styleable===true,button:d.details.button===true,computed:d.details.computed||{}};if(JSON.stringify(fresh)===JSON.stringify(t))return;selectedDesignTarget=fresh;
    const active=document.activeElement,body=$('inspector-body');if(body.contains(active)&&active.matches('input,textarea,select')){
     // Refresh the effective values without replacing a field currently being edited.
     const scratch=document.createElement('div');scratch.innerHTML=contextualPanel(fresh);
     for(const input of body.querySelectorAll('[data-design-property],[data-context-text]')){if(input===active)continue;const replacement=[...scratch.querySelectorAll('[data-design-property],[data-context-text]')].find(x=>x.dataset.designProperty===input.dataset.designProperty&&x.tagName===input.tagName&&x.type===input.type);if(replacement){if(input.tagName==='SELECT')input.innerHTML=replacement.innerHTML;input.value=replacement.value;input.disabled=replacement.disabled;}}
     for(const button of body.querySelectorAll('[data-context-toggle]')){const replacement=[...scratch.querySelectorAll('[data-context-toggle]')].find(x=>x.dataset.contextToggle===button.dataset.contextToggle&&(x.dataset.contextToggle!=='align'||x.dataset.designValue===button.dataset.designValue));if(replacement){button.dataset.designValue=replacement.dataset.designValue;button.setAttribute('aria-pressed',replacement.getAttribute('aria-pressed'));}}
    }else renderInspector();storeContext();return;
   }
   if(e.data?.kind==='wset-preview-ready' &&previewIdentity&&e.data.href===previewExpectedUrl){
    previewLoaded=true;clearTimeout(previewReadyTimer);focusPreview(false);try{$('site-preview').contentWindow?.postMessage({kind:'cbpm-preview-restore-scroll',y:pendingPreviewScroll},current.previewBase)}catch{}lastPreviewScroll=pendingPreviewScroll;pendingPreviewScroll=0;restoringScroll=false;
    if(area==='website')$('preview-status').textContent=pageId==='properties'?(page()?.enabled===false?'Siden er skjult i publisering':propertyView!=='all'&&!propertyOn(propertyView)?'Kategorien er skjult i publisering':'Lokale XML-filer · serverdata ikke kontrollert'):previewOnly?'Forhåndsvisning uten redigeringsmarkeringer':'Klikk for å velge · Dobbeltklikk på tekst for å redigere';return;
   }
   if(e.data?.kind==='cbpm-preview-scroll'){if(area==='website'&&!restoringScroll){lastPreviewScroll=Math.max(0,Number(e.data.y)||0);clearTimeout(scrollSaveTimer);scrollSaveTimer=setTimeout(storeContext,200);}return;}
   if(e.data?.kind==='cbpm-preview-select'&&page()?.sections.some(s=>s.id===e.data.id)){
    if(area!=='website'||previewOnly||(e.data.href&&e.data.href!==previewExpectedUrl))return;inspectorVisible=true;treeVisible=true;focusMode=false;treeSearch='';$('tree-search').value='';
    selectSection(e.data.id,typeof e.data.text==='string'?e.data.text.slice(0,10000):'',e.data.collection,e.data.recordId,e.data.targetKind,e.data.fieldHint,typeof e.data.imageSrc==='string'?e.data.imageSrc:'',e.data.inlineTarget,e.data.styleable===true,e.data.details);
   }
   if(area==='website'&&!previewOnly&&e.data?.kind==='wset-preview-brand'){settingsCategory='identity';chooseArea('settings','brand').then(()=>{$('settings-workspace').querySelector('[data-media-target]')?.focus()});
   }
   if(area==='website'&&e.data?.kind==='cbpm-preview-navigate'&&current.site.sitePages.some(p=>p.id===e.data.pageId)){
    tab='pages';selectPage(e.data.pageId);
   }
  });
  window.addEventListener('beforeunload',storeContext);
  window.addEventListener('keydown',e=>{
   if($('app-update-dialog')?.open)return;
   if((e.ctrlKey||e.metaKey)&&e.shiftKey&&!e.altKey&&['1','2'].includes(e.key)){e.preventDefault();if(e.key==='1')setPanel('tree',!treeVisible);else setPanel('inspector',!inspectorVisible);return;}
   if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
   const key=e.key.toLowerCase(),editing=e.target.closest?.('input,textarea,select,[contenteditable]');
   if(key==='s'){e.preventDefault();save();return;}
   if(editing)return; // Keep native text-field undo history intact.
   if(key==='z'){e.preventDefault();undoRedo(e.shiftKey?'redo':'undo');}
   if(key==='y'){e.preventDefault();undoRedo('redo');}
  });
 }
 async function prepareApplicationUpdate(){
  if(exportBusy||mediaBusy||settingsBusy){toast('Fullfør pågående operasjon før oppdatering.',true);return false;}
  if(current&&(!await commitContextField()||!await flushInline()))return false;
  if(window.wsetPropertyDrafts?.hasPending()){
   if(!window.confirm('Du har en boligkladd som ikke er ferdig lagret. Lagre før oppdatering?'))return false;
   if(!await window.wsetPropertyDrafts.savePending())return false;
  }
  if(managerReady&&!propertyManager.canLeave())return false;
  storeContext();return true;
 }
 async function boot(){if(!api){$('project-name').textContent='Åpne med Electron: npm run designer';return;}
  try{init();window.wsetApplicationUpdates?.mount({api,prepare:prepareApplicationUpdate,refresh:async()=>{if(current){const next=await api.state();if(next){current=next;renderAll();}}}});const starting=await api.state();if(!starting?.site){await showWelcome();return;}
    await activateProject(starting);
  }catch(error){toast(error.message||String(error),true)}
 }
 boot();
})();
