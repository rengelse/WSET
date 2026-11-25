import {createHash} from 'node:crypto';
import {renderSite} from './renderer-runtime.mjs';
import {legacySectionMap} from './renderer-runtime.mjs';
import {templateTextEntries} from './renderer-runtime.mjs';
import {parseTextStructure,slotKey,labelFor,classes,attr,ancestor,normalText,decodeText,fullText} from './text-structure.mjs';
import {publishedContent,routeMap,activePages} from '../engines/cbpm-astro-v1/lib/site-project.mjs';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local=(site,locale,v,legacy=false)=>typeof v==='string'?v:String(v?.[locale]??v?.[legacy&&!['no','en','es'].includes(locale)&&site.languages.find(l=>l.code===locale)?.enabled!==false?'en':site.defaultLanguage]??'');
const groupFor=(p,s)=>['services','projects','reviews','team'].includes(s.type)?s.type:s.type==='template'?(['services','projects','reviews','team'].includes(s.slot)?s.slot:s.slot==='listing'&&['services','projects','reviews'].includes(p.id)?p.id:null):null;
const fields={services:['title','desc'],projects:['title','desc','place'],team:['name','role'],reviews:['head','body','by']};
const recordFields=(group,r)=>[...fields[group],...(group==='services'?(r.items||[]).map((_,i)=>`items:${i}`):[])];
const recordValue=(r,field)=>field.startsWith('items:')?r.items?.[Number(field.slice(6))]:r[field];
const templateId=original=>'template:'+createHash('sha256').update(original).digest('hex');
const reserved=new Set(['__proto__','constructor','prototype']);
const occurrenceId=(section,slot)=>'occurrence:'+createHash('sha256').update(section.source+'\0'+section.slot+'\0'+slotKey(slot)+'\0'+slot.raw.trim()).digest('hex');
export const occurrenceValue=(site,pageId,sectionId,locale,id)=>site.wsetTextOverrides?.[pageId]?.[sectionId]?.[locale]?.[id];
export function templateFields(site,p,s,locale,fragment){
 if(s?.type!=='template')return [];
 if(fragment===undefined){const data={...publishedContent(site),routeMap:routeMap(site),siteNavigation:activePages(site).filter(p=>p.showInNavigation!==false)};fragment=legacySectionMap(s.source,renderSite({locale,page:s.source,data}).html)[s.slot]||'';}
 const originals=new Set(templateTextEntries(fragment)),overrides=site.templateTexts?.[s.source]?.[s.slot]?.[locale]||{};
 const tree=parseTextStructure(fragment),counts=new Map(),cards=tree.nodes.filter(n=>n.tag==='article');
 for(const slot of tree.slots){const key=slot.raw.trim();counts.set(key,(counts.get(key)||0)+1);}
 return tree.slots.filter(slot=>{const k=slot.raw.trim();const canonical=attr(slot.parent,'data-content-ref')||(p.id==='home'&&s.source==='home'&&s.slot==='hero'&&ancestor(slot.parent,n=>classes(n).includes('hero-title')||classes(n).includes('hero-intro')));return (!canonical||Object.hasOwn(overrides,k))&&k.length>=3&&!/^(?:[\d\s.,:;|/–—+\-→←✓★]+)$/u.test(k)&&!reserved.has(k);}).map((slot,index)=>{
  const original=slot.raw.trim(),unique=counts.get(original)===1,legacy=unique&&originals.has(original),targetId=legacy?templateId(original):occurrenceId(s,slot);
  const old=Object.hasOwn(overrides,original)?overrides[original]:undefined,override=occurrenceValue(site,p.id,s.id,locale,targetId);
  const baseValue=old??original,card=ancestor(slot.parent,n=>n.tag==='article');
  return {original,value:typeof override==='string'?override:baseValue,label:labelFor(slot.parent),group:card?`Kort ${String(cards.indexOf(card)+1).padStart(2,'0')}`:'Seksjonsinnhold',unique,index,targetId,overridden:typeof override==='string'||old!==undefined,occurrence:!legacy,sourcePath:slot.parent.path,sourceIndex:slot.index,baseValue,baseEncoded:old===undefined};
 });
}
// Existing records retain canonical model IDs, even when two records have the same text.
function recordSlots(fragment,group,records,locale,site){
 const tree=parseTextStructure(fragment),result=new Map(),explicitRefs=new Set();
 // Canonical field markers are independent of card tag, class and position.
 // Duplicate markers are ambiguous, so they must not fall back to legacy matching.
 for(const rec of records)for(const field of recordFields(group,rec)){
  const ref=`${group}:${rec.id}:${field}`,id='record:'+ref;
  const nodes=tree.nodes.filter(n=>attr(n,'data-content-ref')===ref&&!n.excluded);
  if(!nodes.length)continue;explicitRefs.add(id);
  const expected=normalText(decodeText(local(site,locale,recordValue(rec,field),true)));
  if(nodes.length!==1)continue;
  const slots=tree.slots.filter(x=>x.parent===nodes[0]&&normalText(x.text)===expected);
  if(slots.length===1)result.set(id,{sourcePath:nodes[0].path,sourceIndex:slots[0].index});
 }
 const has=(n,c)=>classes(n).includes(c), cards=tree.nodes.filter(n=>group==='services'?(has(n,'service-card')||has(n,'detail-card')):group==='projects'?['project-gallery-card','project-tile','project-big'].some(c=>has(n,c)):group==='team'?!!attr(n,'data-team-id'):has(n,'review-card'));
 const descendants=(card)=>tree.nodes.filter(n=>ancestor(n,x=>x===card));
 for(const [i,card] of cards.entries()){
  const sub=descendants(card);let rec;
  const explicit=attr(card,'data-content-id')||attr(card,'data-team-id');
  if(explicit)rec=records.find(r=>r.id===explicit);
  else if(group==='team')rec=records.find(r=>r.id===attr(card,'data-team-id'));
  else if(group==='projects'){
   const href=[card,...sub].map(n=>attr(n,'href')).find(h=>h.includes('/projects/'));
   if(href)rec=records.find(r=>href.endsWith('/projects/'+r.id+'/'));
  }else if(group==='services'&&cards.length===records.length)rec=records[i];
  else if(group==='reviews'){
   const modal=sub.map(n=>attr(n,'data-modal')).find(x=>/^review-\d+$/.test(x));
   if(modal)rec=records[Number(modal.slice(7))];
  }
  if(!rec){const title=sub.find(n=>n.tag==='h3'||has(n,'team-card-name')||n.tag==='strong');const hits=records.filter(r=>normalText(decodeText(local(site,locale,r.title||r.head||r.name,true)))===fullText(title||card));if(hits.length===1)rec=hits[0];}
  if(!rec)continue;
  for(const field of recordFields(group,rec)){
   if(explicitRefs.has(`record:${group}:${rec.id}:${field}`))continue;
   const node=sub.find(n=>attr(n,'data-content-ref')===`${group}:${rec.id}:${field}`)||sub.find(n=>group==='team'?(field==='name'?has(n,'team-card-name'):has(n,'team-card-role')):group==='reviews'?(field==='head'?n.tag==='h3':field==='body'?n.tag==='p':n.tag==='span'&&n.parent.tag==='footer'&&n.parent.children[0]===n):field==='title'?n.tag==='h3'||(n.tag==='strong'&&group==='projects'):n.tag==='p');
   if(!node)continue;const expected=normalText(decodeText(local(site,locale,recordValue(rec,field),true)));
   const slot=tree.slots.find(x=>x.parent===node&&normalText(x.text)===expected);if(slot)result.set(`record:${group}:${rec.id}:${field}`,{sourcePath:node.path,sourceIndex:slot.index});
  }
 }
 return result;
}
// Generate a narrow contract for the local preview. IDs refer to existing model commands;
// no arbitrary paths or HTML edits are accepted from the iframe.
export function inlineTargets(site,pageId,locale){
 const p=site.sitePages.find(x=>x.id===pageId);if(!p||!site.languages.some(l=>l.code===locale))return {};
 const data={...publishedContent(site),routeMap:routeMap(site),siteNavigation:activePages(site).filter(p=>p.showInNavigation!==false)};
 const cache=new Map(),result={};
 for(const s of p.sections.filter(x=>x.enabled!==false)){
  const entries=[];result[s.id]=entries;let fragment='';
  const add=(id,kind,value,command,extra={})=>{if(typeof value==='string'&&(value.trim()||kind==='occurrence')&&value.length<=10000)entries.push({id,kind,value,command,...extra});};
  if(s.type==='template'){
   if(!cache.has(s.source))cache.set(s.source,legacySectionMap(s.source,renderSite({locale,page:s.source,data}).html));
   fragment=cache.get(s.source)[s.slot]||'';
   for(const entry of templateFields(site,p,s,locale,fragment))if(entry.original.length<=2500){const extra={encoded:!entry.overridden,label:entry.label,sourcePath:entry.sourcePath,sourceIndex:entry.sourceIndex,baseValue:entry.baseValue,baseEncoded:entry.baseEncoded};const command=entry.occurrence?{action:'inline:occurrence',pageId,sectionId:s.id,locale,targetId:entry.targetId}:{action:'template:text',pageId,id:s.id,locale,original:entry.original};add(entry.targetId,entry.occurrence?'occurrence':'template',String(entry.value),command,extra);}
   if(p.id==='home'&&s.source==='home'&&s.slot==='hero'){
    for(const field of ['heroTitle','heroIntro']){
     const raw=local(site,locale,site.pages?.home?.[field],true);if(!raw)continue;
     // Only plain text and the template's existing br/em markup are editable inline.
     if(/<(?!\/?em\s*>|br\s*\/?>)/i.test(raw))continue;
     const parts=raw.split(/(<\/?em\s*>|<br\s*\/?>)/i);
     parts.forEach((part,i)=>{if(i%2===0)add(`hero:${field}:${i}`,'hero',part,{action:'content:update',pageId:'home',field,locale},{raw,part:i,encoded:true,field});});
    }
   }
  }else if(['hero','text','imageText','gallery','cta'].includes(s.type)){
   for(const field of ['title','text','buttonText','kicker'])add(`section:${field}`,'section',local(site,locale,s[field]),{action:'section:update',pageId,id:s.id,field,locale},{field});
  }
  const group=groupFor(p,s);
  if(group&&!fragment){if(!cache.has('home'))cache.set('home',legacySectionMap('home',renderSite({locale,page:'home',data}).html));fragment=cache.get('home')[group]||'';}
  const bindings=group&&fragment?recordSlots(fragment,group,data[group]||[],locale,site):new Map();
  if(group)for(const r of data[group]||[])for(const field of recordFields(group,r)){
   const raw=local(site,locale,recordValue(r,field),true);if(/[<>]/.test(raw))continue;
   const command=field.startsWith('items:')?{action:'collection:item-text',collection:group,id:r.id,index:Number(field.slice(6)),locale}:{action:'collection:update',collection:group,id:r.id,field,...(field==='name'?{}:{locale})};
   add(`record:${group}:${r.id}:${field}`,'record',raw,command,{collection:group,recordId:r.id,field,label:field.startsWith('items:')?'Listepunkt':field==='place'?'Sted':undefined,encoded:group!=='team',...bindings.get(`record:${group}:${r.id}:${field}`)});
  }
 }
 return result;
}
export function resolveInlineEdit(site,request){
 const {pageId,locale,sectionId,targetId,expected,value}=request;
 if(typeof value!=='string'||value.length>10000||typeof expected!=='string'||typeof targetId!=='string')throw Error('Ugyldig direkte tekstredigering.');
 const target=inlineTargets(site,pageId,locale)[sectionId]?.find(t=>t.id===targetId);
 if(!target||target.value!==expected)throw Error('Teksten er endret eller kan ikke redigeres direkte. Prøv igjen.');
 let next=value;
 if(target.kind==='hero'){
  const parts=target.raw.split(/(<\/?em\s*>|<br\s*\/?>)/i);parts[target.part]=esc(value);next=parts.join('');
 }else if(target.kind==='record'&&target.encoded){next=esc(value);}
 // Fixed template overrides and custom sections already escape plain input during rendering.
 if(next.length>10000)throw Error('Teksten er for lang.');
 return {...target.command,value:next};
}
