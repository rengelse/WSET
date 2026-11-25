'use strict';
// Local preview only. This script is never copied into a website export.
(()=>{
 const map=JSON.parse(document.getElementById('cbpm-editor-map')?.textContent||'{}');
 const send=data=>window.parent.postMessage(data,'*');
 const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
 let previewOnly=false,selected=null,scrollFrame=0,editing=null,serial=0,focusedTarget=null,resizeFrame=0;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/__wset-preview-selection.css';document.head.append(style);
 const cards={services:'.service-card,.detail-card[data-service-type]',projects:'.project-gallery-card,.project-tile,.project-big',team:'[data-team-id]',reviews:'.review-card'};
 function recordFor(el){
  // Prefer stable model markers. A design does not need Mal 01 card classes.
  const explicit=el.closest('[data-content-id],[data-team-id]');
  if(explicit){
   const stable=explicit.dataset.contentId||explicit.dataset.teamId;
   const refs=[explicit,...explicit.querySelectorAll('[data-content-ref]')].map(n=>(n.dataset.contentRef||'').split(':')).filter(parts=>parts[1]===stable&&Object.hasOwn(cards,parts[0]));
   const groups=[...new Set(refs.map(parts=>parts[0]))];
   if(explicit.dataset.teamId)groups.push('team');
   const candidates=Object.keys(cards).filter(collection=>(!groups.length||groups.includes(collection))&&(map.records?.[collection]||[]).some(r=>r.id===stable));
   if(candidates.length===1)return {collection:candidates[0],recordId:stable,card:explicit};
   if(groups.length)return {card:explicit,recordId:null};
  }
  for(const [collection,selector] of Object.entries(cards)){
   const card=el.closest(selector);if(!card)continue;
   const list=map.records?.[collection]||[];
   const stable=card.dataset.contentId||card.dataset.teamId;
   const href=card.matches('a[href]')?card.getAttribute('href'):card.querySelector('a[href*="/projects/"]')?.getAttribute('href');
   const label=norm(card.querySelector(collection==='team'?'.team-card-name':'h3,strong')?.textContent);
   const matches=list.filter(r=>stable?r.id===stable:href&&r.url?r.url===href:label&&(norm(decoded(r.label))===label||norm(decoded(r.name))===label));
   return {collection,recordId:matches.length===1?matches[0].id:null,card};
  }return {};
 }
 const decoded=v=>{const el=document.createElement('textarea');el.innerHTML=String(v).replace(/</g,'&lt;');return el.value;};
 const visible=t=>t.encoded?decoded(t.value):t.value;
 function targetAt(el,event){
  const section=el.closest('[data-cbpm-section]');if(!section||el.closest('input,textarea,select,svg,img,[data-review-nav]'))return null;
  const entries=map.inline?.[section.dataset.cbpmSection]||[];
  const marked=el.closest('[data-wset-bind]');
  if(marked&&section.contains(marked)){
   const target=entries.find(t=>t.bindingKey===marked.dataset.wsetBind);if(!target)return null;
   const direct=[...marked.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
   if(target.whole)return {target,host:marked,section};
   return direct.length===1?{target,node:direct[0],section}:target.value===''?{target,host:marked,section}:null;
  }
  if(entries.some(t=>t.bindingKey))return null;
  const element=el.closest('h1,h2,h3,h4,p,figcaption,strong,em,span,a,button,li,small');if(!element||!section.contains(element))return null;
  const record=recordFor(el),candidates=record.card?entries.filter(t=>t.kind==='record'&&t.recordId===record.recordId&&t.collection===record.collection):entries.filter(t=>t.kind!=='record');
  let node=null;const range=document.caretRangeFromPoint?.(event.clientX,event.clientY);
  if(range?.startContainer.nodeType===Node.TEXT_NODE&&element.contains(range.startContainer))node=range.startContainer;
  const direct=[...element.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  if(!node&&direct.length===1)node=direct[0];
  if(!node)return null;
  const text=node.textContent.trim(),matches=list=>list.filter(t=>norm(visible(t))===norm(text));
  const hero=element.closest('.hero-title,.hero-intro');
  if(hero&&entries.some(t=>t.kind==='hero')){
   const field=hero.classList.contains('hero-title')?'heroTitle':'heroIntro';const hits=matches(candidates.filter(t=>t.kind==='hero'&&t.field===field));if(hits.length===1)return {target:hits[0],node,section};
   const overrides=matches(candidates.filter(t=>t.kind==='template'&&!t.encoded));return overrides.length===1?{target:overrides[0],node,section}:null;
  }
  if(record.card){
   const f=record.collection==='team'?(element.closest('.team-card-name')?'name':element.closest('.team-card-role')?'role':null):record.collection==='reviews'?(element.matches('h3')?'head':element.matches('p')?'body':element.matches('footer>span:first-child')?'by':null):element.matches('h3,strong')?'title':element.matches('p')?'desc':null;
   const hits=f?matches(candidates.filter(t=>t.field===f)):[];return hits.length===1?{target:hits[0],node,section}:null;
  }
  const field=element.closest('h1,h2')?'title':element.closest('p.section-lead')?'text':element.closest('.text-kicker')?'kicker':element.closest('a.btn')?'buttonText':null;
  if(field){const t=candidates.find(t=>t.kind==='section'&&t.field===field);if(t){
   const host=element.closest('h1,h2,p.section-lead,.text-kicker,a.btn');
   if(field==='title'&&[...host.childNodes].every(n=>n.nodeType===Node.TEXT_NODE||n.nodeName==='BR')&&norm(host.innerText)===norm(t.value))return {target:t,host,section};
   if(norm(t.value)===norm(text))return {target:t,node,section};return null;
  }}
  const hits=matches(candidates.filter(t=>t.kind==='template'));return hits.length===1?{target:hits[0],node,section}:null;
 }
 function details(target,host,section){
  const styleable=!!(target.styleable&&target.stylePath&&host&&host===section.querySelector(':scope'+target.stylePath));
  const c=host?getComputedStyle(host):null;
  const color=v=>{const m=String(v).match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/);return m&&(!m[4]||Number(m[4])===1)?'#'+m.slice(1,4).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'';};
  const button=!!host?.matches('a.btn,button');
  return {id:target.id,expected:target.value,text:visible(target),label:target.label||({title:'Overskrift',text:'Tekst',buttonText:'Knappetekst',kicker:'Overtittel',name:'Navn',role:'Rolle',desc:'Beskrivelse',head:'Overskrift',body:'Tekst',by:'Navn',heroTitle:'Overskrift',heroIntro:'Ingress'}[target.field])||'Tekst',styleable,button,computed:c?{fontFamily:c.fontFamily,size:parseFloat(c.fontSize),color:color(c.color),weight:c.fontWeight,italic:c.fontStyle,align:c.textAlign,decoration:c.textDecorationLine.includes('underline')?'underline':'none',lineHeight:c.lineHeight==='normal'?'':Math.round(parseFloat(c.lineHeight)/parseFloat(c.fontSize)*100)/100,background:color(c.backgroundColor),radius:parseFloat(c.borderTopLeftRadius)}:{}};
 }
 function finish(commit=true){
  if(!editing)return;const e=editing;editing=null;
  let value=e.editor.innerText.replace(/\r\n?/g,'\n');if(!e.multiline)value=value.replace(/\n+/g,' ');
  const changed=commit&&value!==e.initial;
  e.editor.removeAttribute('contenteditable');e.editor.removeAttribute('role');e.editor.removeAttribute('aria-label');e.editor.classList.remove('wset-inline-editing');
  if(e.host){e.editor.replaceChildren(...e.originalNodes);}else{e.editor.replaceWith(e.originalNode);}
  send({kind:'wset-inline-finish',session:e.session,href:location.href,commit:changed,value});
 }
 function start(hit){
  if(editing)finish(true);const {target,node,host,section}=hit;
  const editor=host||document.createElement('span'),initial=host?target.value:node.textContent.trim();
  const originalNodes=host?[...host.childNodes]:null;
  if(!host)node.replaceWith(editor);
  editor.textContent=initial;editor.setAttribute('contenteditable','plaintext-only');editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Rediger tekst');editor.classList.add('wset-inline-editing');
  const session=++serial;editing={editor,initial,originalNode:node,originalNodes,host,multiline:!!host,session};
  send({kind:'wset-inline-start',session,href:location.href,sectionId:section.dataset.cbpmSection,targetId:target.id,expected:target.value});
  editor.addEventListener('blur',()=>{if(editing?.session===session)finish(true)},{once:true});
  editor.focus({preventScroll:true});const selection=window.getSelection(),r=document.createRange();r.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(r);
 }
 document.addEventListener('dblclick',e=>{if(previewOnly||editing)return;const el=e.target instanceof Element?e.target:null;if(!el)return;const hit=targetAt(el,e);if(!hit)return;e.preventDefault();e.stopImmediatePropagation();start(hit);},true);
 document.addEventListener('keydown',e=>{if(!editing)return;if(e.key==='Escape'||(e.key==='Enter'&&!e.shiftKey)){e.preventDefault();e.stopImmediatePropagation();finish(e.key!=='Escape');}else if(e.key==='Enter'&&!editing.multiline){e.preventDefault();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();finish(true);send({kind:'wset-inline-save'});}},true);
 document.addEventListener('paste',e=>{if(!editing)return;e.preventDefault();const text=e.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,editing.multiline?text:text.replace(/\r?\n/g,' '));},true);
 function mark(el,scroll=false){selected?.classList.remove('wset-preview-selected');selected=previewOnly?null:el;selected?.classList.add('wset-preview-selected');if(scroll&&el)el.scrollIntoView({block:'nearest',behavior:'instant'});}
 window.addEventListener('message',e=>{
  if(e.source!==window.parent)return;const d=e.data;
  if(d?.kind==='wset-inline-flush'){finish(true);return;}
  if(d?.kind==='wset-preview-ping'){send({kind:'wset-preview-ready',href:window.location.href});return;}
  if(d?.kind==='cbpm-editor-focus'){
   previewOnly=d.previewOnly===true;focusedTarget=d.targetId?{sectionId:d.sectionId,id:d.targetId}:null;
   if(previewOnly){finish(true);mark(null);return;}
   if(editing)return;
   const section=[...document.querySelectorAll('[data-cbpm-section]')].find(n=>n.dataset.cbpmSection===d.sectionId);
   let target=section;if(section&&d.recordId&&cards[d.collection])target=[...section.querySelectorAll(cards[d.collection]+',[data-content-id],[data-team-id]')].find(n=>{const r=recordFor(n);return r.recordId===d.recordId&&r.collection===d.collection;})||section;
   if(section&&d.targetId){
    const entry=map.inline?.[d.sectionId]?.find(t=>t.id===d.targetId);
    if(entry){const host=entry.stylePath?section.querySelector(':scope'+entry.stylePath):null;
     if(host)target=host;
     send({kind:'wset-context-details',href:location.href,sectionId:d.sectionId,details:details(entry,host,section)});
    }else send({kind:'wset-context-details',href:location.href,sectionId:d.sectionId,missing:d.targetId});
   }
   mark(target,d.scroll===true);
  }
  if(d?.kind==='cbpm-preview-restore-scroll')window.scrollTo(0,Math.max(0,Number(d.y)||0));
 });
 window.addEventListener('resize',()=>{if(resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(previewOnly||editing||!focusedTarget)return;const {sectionId,id}=focusedTarget;const section=[...document.querySelectorAll('[data-cbpm-section]')].find(n=>n.dataset.cbpmSection===sectionId),entry=map.inline?.[sectionId]?.find(t=>t.id===id);if(section&&entry?.stylePath){const host=section.querySelector(':scope'+entry.stylePath);if(host)send({kind:'wset-context-details',href:location.href,sectionId,details:details(entry,host,section)});}});});
 window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;send({kind:'cbpm-preview-scroll',y:window.scrollY});});},{passive:true});
 document.addEventListener('click',e=>{
  const el=e.target instanceof Element?e.target:null;if(!el)return;
  if(editing&&editing.editor.contains(el)){if(el.closest('a,button'))e.preventDefault();e.stopImmediatePropagation();return;}
  const section=el.closest('[data-cbpm-section]'),link=el.closest('a[href]');
  if(!previewOnly&&el.closest('a.brand')){e.preventDefault();e.stopImmediatePropagation();send({kind:'wset-preview-brand'});return;}
  if(!previewOnly&&section){
   e.preventDefault();e.stopImmediatePropagation();const record=recordFor(el);
   const image=el.closest('img,.team-portrait-empty')||(!el.closest('h1,h2,h3,p,a,button')&&el.closest('.hero,.page-hero')&&el.closest('.hero-image,.hero-bg,.page-bg'));
   const textNode=el.closest('h1,h2,h3,h4,p,figcaption,strong,.team-card-role,a,button,span');
   const fieldHint=el.closest('.hero-title')?'heroTitle':el.closest('.hero-intro')?'heroIntro':link&&link.classList.contains('btn-deep')?'buttonText':'';
   const hit=targetAt(el,e);
   const styleHost=hit?.host||hit?.node?.parentElement;const styleable=!!(hit?.target.styleable&&styleHost&&hit.target.stylePath&&styleHost===section.querySelector(':scope'+hit.target.stylePath));
   focusedTarget=hit?{sectionId:section.dataset.cbpmSection,id:hit.target.id}:null;mark(styleable?styleHost:record.card||section);
   send({kind:'cbpm-preview-select',href:location.href,details:hit?details(hit.target,styleHost,section):null,id:section.dataset.cbpmSection,collection:record.collection,recordId:record.recordId,targetKind:image?'image':'text',inlineTarget:hit?.target.id||null,styleable,fieldHint,imageSrc:image instanceof HTMLImageElement?image.getAttribute('src')||'':'',text:image?'':norm(textNode?.innerText||textNode?.textContent||el.textContent).slice(0,10000)});return;
  }
  if(link){const href=link.getAttribute('href');const p=map.pages?.find(p=>href===`/${map.locale}/${p.slug==='home'?'':p.slug+'/'}`);if(p){e.preventDefault();e.stopImmediatePropagation();send({kind:'cbpm-preview-navigate',pageId:p.id});}else if(!href?.startsWith('/')&&!href?.startsWith('#'))e.preventDefault();}
 },true);
})();
