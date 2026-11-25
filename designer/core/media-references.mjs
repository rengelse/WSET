import {createHash} from 'node:crypto';
import {sectionImageKey} from './renderer-runtime.mjs';
// Website-only references. Never walk XML/property data or arbitrary strings.
const safe=p=>typeof p==='string'&&/^\/assets\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg|avif|svg)$/.test(p);
const text=(s,v)=>typeof v==='string'?v:v?.[s.defaultLanguage]||v?.no||v?.en||'';
const slot=(s,k)=>s.brand?.images?.[k]||`/assets/${k}.webp`;
const categoryFor=(s)=>s.slot==='hero'||s.type==='hero'?'background':s.slot==='team'?'team':'website';
const groupNames={services:'Tjenester',projects:'Prosjekter',team:'Ansatte',reviews:'Kundeomtaler'};
const paths=m=>new Set([m.src,...Object.values(m.variants||{}).flat()].filter(safe));
export function bindRecordImage(site,record,src){
 if(!safe(src))throw Error('Ugyldig bildefil.');
 const key='media-'+createHash('sha256').update(src).digest('hex');
 site.brand.images??={};site.brand.images[key]=src;record.img=key;
}
function enumerate(site){
 const out=[];const add=(ref,set)=>{if(safe(ref.src))out.push({...ref,set});};
 for(const p of site.sitePages||[]){if(p.id==='properties')continue;for(const s of p.sections||[]){
  const key=sectionImageKey(s);const defaultSrc=key?(s.slot==='hero'&&s.source!=='home'&&site.pages?.[s.source]?.heroImageUrl||slot(site,key)):s.type==='hero'?'/assets/hero.webp':s.type==='imageText'?'/assets/hero-square.webp':null;
  const title=text(site,p.title)||p.id,section=text(site,s.title)||({hero:'Hovedbilde',why:'Hvorfor',overview:'Introduksjon',intro:'Om oss',team:'Personell',gallery:'Galleri'}[s.slot||s.type]||s.slot||s.type);
  const common={pageId:p.id,sectionId:s.id,kind:'section',category:categoryFor(s)};
  if(s.image||defaultSrc)add({...common,id:`section:${p.id}:${s.id}:image`,field:'image',src:s.image||defaultSrc,preset:s.type==='imageText'?'card':'hero',title:`${title} / ${section}`},v=>s.image=v);
  if(s.type==='gallery')for(const [i,g] of (s.images||[]).entries())add({...common,id:`section:${p.id}:${s.id}:gallery:${i}`,field:'gallery',index:i,src:g.src,preset:'gallery',title:`${title} / ${section} / Bilde ${i+1}`},v=>g.src=v);
 }}
 for(const group of Object.keys(groupNames))for(const r of site[group]||[]){
  const title=`${groupNames[group]} / ${r.name||text(site,r.title||r.head||r.role)||r.id}`;
  const common={kind:group,recordId:r.id,category:group};
  const field=(f,preset)=>add({...common,id:`${group}:${r.id}:${f}`,field:f,src:r[f],preset,title:`${title} / ${({portrait:'Profilbilde',beforeUrl:'Før-bilde',afterUrl:'Etter-bilde'}[f]||f)}`},v=>r[f]=v);
  if(['services','projects'].includes(group)&&r.img)add({...common,id:`${group}:${r.id}:img`,field:'img',src:slot(site,r.img),preset:'card',title:`${title} / Hovedbilde`},v=>bindRecordImage(site,r,v));
  if(group==='team')field('portrait','portrait');
  if(group==='projects'){
   field('beforeUrl','gallery');field('afterUrl','gallery');
   const gallery=r.gallery?.length?r.gallery:(r.isSample?['/assets/project-before.webp','/assets/project-after.webp','/assets/project-terrace.webp']:[]);
   for(const [i,g] of gallery.entries())add({...common,id:`${group}:${r.id}:gallery:${i}`,field:'gallery',index:i,src:typeof g==='string'?g:g.url,preset:'gallery',title:`${title} / Galleri ${i+1}`},v=>{if(!r.gallery?.length)r.gallery=structuredClone(gallery);if(typeof r.gallery[i]==='string')r.gallery[i]=v;else r.gallery[i].url=v;});
  }
 }
 for(const field of ['logoUrl','lightLogoUrl','faviconUrl'])add({kind:'brand',id:`brand:${field}`,field,src:site.brand?.[field],preset:field==='faviconUrl'?'favicon':'logo',category:'graphics',title:`Logo og grafikk / ${field==='logoUrl'?'Logo':field==='lightLogoUrl'?'Lys logo':'Favicon'}`},v=>site.brand[field]=v);
 const identity=site.smartAssistant?.identity;
 if(identity?.avatar)add({kind:'assistant',id:'assistant:avatar',field:'avatar',src:identity.avatar,preset:'portrait',category:'website',title:'Smart Assistant / Avatar'},v=>{identity.avatar=v;});
 return out;
}
export function mediaReferences(site){return enumerate(site).map(({set,...ref})=>ref);}
export function replacementReferences(site,item){const source=paths(item);return mediaReferences(site).filter(r=>source.has(r.src));}
export function replacementKind(refs){return refs.some(r=>['logo','favicon'].includes(r.preset))?'logo':'photo';}
export function compatibleReplacement(refs,item){return refs.length>0&&refs.every(r=>['logo','favicon'].includes(r.preset)?item.kind==='logo':item.kind!=='logo');}
export function rebindWebsiteMedia(site,{old,replacement,referenceIds,all=false,register=false}){
 if(!old||!replacement||old.id===replacement.id||!safe(old.src)||!safe(replacement.src))throw Error('Velg et annet bilde.');
 const copy=structuredClone(site),source=paths(old),matches=enumerate(copy).filter(r=>source.has(r.src));
 const chosen=all?matches:matches.filter(r=>referenceIds?.includes(r.id));
 if(!chosen.length||(!all&&(!Array.isArray(referenceIds)||new Set(referenceIds).size!==chosen.length)))throw Error('Bildeplasseringen er endret eller finnes ikke. Velg på nytt.');
 if(!compatibleReplacement(chosen,replacement))throw Error('Velg et bilde av riktig type (foto eller logo).');
 copy.media??={items:[]};copy.media.items??=[];
 if(register){if(copy.media.items.some(x=>x.id===replacement.id)||!replacement.original)throw Error('Ugyldig medieregistrering.');copy.media.items.push(structuredClone(replacement));copy.brand.images??={};copy.brand.images[replacement.id]=replacement.src;}
 for(const r of chosen){const next=replacement.variants?.[r.preset]?.at(-1)||replacement.src;if(!safe(next))throw Error('Ugyldig bildevariant.');r.set(next);}
 // Preserve categories on the new item while retaining the original and its metadata.
 const ws=copy.media.workspace??={categories:[],assignments:{}};ws.assignments??={};const categories=[...(ws.assignments[replacement.id]||[]),...(ws.assignments[old.id]||[])];if(categories.length)ws.assignments[replacement.id]=[...new Set(categories)];
 return copy;
}

// Only remove slots whose renderer has a supported empty state. Required images
// and fallback-driven template slots must be replaced, never blanked.
export function canDetachMedia(site,ref){
 if(ref.kind==='assistant'&&ref.field==='avatar')return true;
 if(ref.kind==='team'&&ref.field==='portrait')return true;
 if(ref.kind==='projects'&&['beforeUrl','afterUrl'].includes(ref.field))return true;
 if(ref.kind==='section'&&ref.field==='gallery')return true;
 if(ref.kind==='projects'&&ref.field==='gallery')return (site.projects.find(p=>p.id===ref.recordId)?.gallery?.length||0)>1;
 return false;
}
export function detachWebsiteMedia(site,{referenceId,src}){
 const ref=mediaReferences(site).find(r=>r.id===referenceId&&r.src===src);
 if(!ref||!canDetachMedia(site,ref))throw Error('Denne bildeplassen krever et bilde. Bytt bildet i stedet.');
 if(ref.kind==='assistant')delete site.smartAssistant.identity.avatar;
 else if(ref.kind==='team')site.team.find(r=>r.id===ref.recordId).portrait='';
 else if(ref.kind==='section')site.sitePages.find(p=>p.id===ref.pageId).sections.find(s=>s.id===ref.sectionId).images.splice(ref.index,1);
 else {const p=site.projects.find(r=>r.id===ref.recordId);if(ref.field==='gallery')p.gallery.splice(ref.index,1);else p[ref.field]='';}
 return site;
}
