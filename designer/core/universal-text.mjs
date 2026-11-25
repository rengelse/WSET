/** One structural binding pass for preview, typography and static publication. */
import {createHash} from 'node:crypto';
import {inlineTargets} from './inline-editing.mjs';
import {splitMainSections} from './renderer-runtime.mjs';
import {parseTextStructure,normalText,decodeText,escapeText,fullText,mixedSlot,buttonNode,classes,attr} from './text-structure.mjs';
const norm=normalText;
const visible=(t,base=false)=>{const value=base&&t.baseValue!==undefined?t.baseValue:t.value;return (base&&t.baseValue!==undefined?t.baseEncoded:t.encoded)?decodeText(value):value;};
const marker=(section,id)=>createHash('sha256').update(section+'\0'+id).digest('hex');
const sectionIdOf=f=>f.match(/^\s*<[^>]*\bdata-cbpm-section="([^"]+)"/)?.[1];
const allowed=new Set('h1 h2 h3 h4 h5 h6 p div a button li span em strong small figcaption label b i dt dd blockquote'.split(' '));
// Source paths distinguish equal text. No fallback from an ambiguous structural
// target to an unrelated node, even if its displayed text happens to match.
export function bindTextTargets(fragment,targets){
 const tree=parseTextStructure(fragment),used=new Set(),bound=[];
 const candidates=tree.slots.filter(s=>allowed.has(s.parent.tag));
 const rank={hero:0,record:1,section:2,template:3,occurrence:4};
 for(const target of [...targets].sort((a,b)=>rank[a.kind]-rank[b.kind])){
  const needle=norm(visible(target,true));if(!needle)continue;
  let slot,whole=false,host;
  if(target.sourcePath!==undefined){
   slot=candidates.find(s=>s.parent.path===target.sourcePath&&s.index===target.sourceIndex&&norm(s.text)===needle&&!used.has(s));
   // A missing/changed source location must not silently select another equal string.
  }else if(target.kind==='section'){
   const nodes=tree.nodes.filter(n=>allowed.has(n.tag)&&!n.excluded&&fullText(n)===needle&&({title:/^h[1-6]$/.test(n.tag),text:n.tag==='p'&&classes(n).includes('section-lead'),kicker:classes(n).includes('text-kicker'),buttonText:buttonNode(n)}[target.field]));
   if(nodes.length===1){host=nodes[0];const direct=candidates.filter(s=>s.parent===host&&!used.has(s));if(direct.length===1)slot=direct[0];else if(target.field==='title'&&direct.length&&host.children.every(c=>c.tag==='br'))whole=true;}
  }else if(target.kind==='hero'){
   const cls=target.field==='heroTitle'?'hero-title':'hero-intro';const hits=candidates.filter(s=>{for(let n=s.parent;n?.tag;n=n.parent)if(classes(n).includes(cls))return norm(s.text)===needle&&!used.has(s);return false;});if(hits.length===1)slot=hits[0];else if(hits.length>1)slot=hits[0]; // canonical hero parts occur in model order
  }else if(target.kind==='record'){
   // Unbound record (e.g. inactive or unrendered card) is not a text target.
   continue;
  }
  if(!slot&&!whole)continue;
  if(slot){used.add(slot);host=slot.parent;}
  if(whole){for(const s of candidates.filter(s=>s.parent===host))used.add(s);}
  bound.push({target,slot,host,whole,wrap:!whole&&mixedSlot(slot),button:buttonNode(host)});
 }
 return bound;
}
// Preview always receives precise host markers. Published HTML receives only the
// span wrappers needed for text runs and literal overrides, never editor markers.
function prepareFragment(fragment,sectionId,targets){
 const bindings=bindTextTargets(fragment,targets),edits=[];
 for(const b of bindings){const {target:t,slot,host,whole,wrap}=b,key=marker(sectionId,t.id);b.key=key;
  const ref=t.kind==='record'?`${t.collection}:${t.recordId}:${t.field}`:'';
  const refAttr=ref&&!attr(host,'data-content-ref')?` data-content-ref="${escapeText(ref)}"`:'';
  if(wrap){const raw=slot.raw,leading=raw.match(/^\s*/)[0],trailing=raw.match(/\s*$/)[0];const body=t.kind==='occurrence'&&t.value!==t.baseValue?escapeText(t.value):raw.trim();edits.push({start:slot.start,end:slot.end,value:`${leading}<site-text data-wset-bind="${key}"${refAttr}>${body}</site-text>${trailing}`});}
  else{const at=host.openEnd-1;edits.push({start:at,end:at,value:` data-wset-bind="${key}"${refAttr}`});if(slot&&t.kind==='occurrence'&&t.value!==t.baseValue){const raw=slot.raw;edits.push({start:slot.start,end:slot.end,value:raw.match(/^\s*/)[0]+escapeText(t.value)+raw.match(/\s*$/)[0]});}}
 }
 let html=fragment;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))html=html.slice(0,e.start)+e.value+html.slice(e.end);
 const parsed=parseTextStructure(html),map=new Map();
 for(const b of bindings){const node=parsed.nodes.find(n=>attr(n,'data-wset-bind')===b.key);if(node)map.set(b.target.id,{path:node.path,key:b.key,recordRef:b.target.kind==='record'?`${b.target.collection}:${b.target.recordId}:${b.target.field}`:null,button:b.button&&!b.wrap,whole:b.whole,target:b.target});}
 return {html,map};
}
export function prepareTextPage(site,pageId,locale,html,{sectionIds,targets=inlineTargets(site,pageId,locale)}={}){
 const parts=splitMainSections(html),map=new Map(),fragments=[];
 const ids=parts.sections.map((f,i)=>sectionIds?.[i]||sectionIdOf(f));
 for(const [i,f] of parts.sections.entries()){const id=ids[i];const prepared=id?prepareFragment(f,id,targets[id]||[]):{html:f,map:new Map()};fragments.push(prepared.html);for(const [targetId,b] of prepared.map)map.set(id+'\0'+targetId,b);}
 return {html:parts.before+fragments.join('')+parts.after,fragments,map,ids};
}
export const stripEditorTextMarkers=html=>html.replace(/ data-wset-bind="[a-f0-9]{64}"/g,'');
export const hasOccurrenceText=site=>Object.values(site.wsetTextOverrides||{}).some(p=>Object.values(p||{}).some(s=>Object.values(s||{}).some(l=>Object.keys(l||{}).length)));
export function applyOccurrenceCommand(site,cmd){
 const {pageId,sectionId,locale,targetId,value}=cmd;
 if(typeof value!=='string'||value.length>10000||!/^occurrence:[a-f0-9]{64}$/.test(targetId))throw Error('Ugyldig tekstfelt.');
 const target=inlineTargets(site,pageId,locale)[sectionId]?.find(t=>t.id===targetId&&t.kind==='occurrence');if(!target)throw Error('Fant ikke tekstfeltet.');
 const next=structuredClone(site);const p=(next.wsetTextOverrides??={})[pageId]??={};const s=p[sectionId]??={};const l=s[locale]??={};l[targetId]=value;return next;
}
