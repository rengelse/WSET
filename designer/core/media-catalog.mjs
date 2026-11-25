import {mediaReferences,replacementReferences,canDetachMedia,detachWebsiteMedia} from './media-references.mjs';
import {readdir,stat,readFile} from 'node:fs/promises';
import {join,basename,extname} from 'node:path';
import {renderDynamicSite} from './renderer-runtime.mjs';
export const mediaCategories=[['background','Bakgrunnsbilder'],['website','Nettsidebilder'],['services','Tjenester'],['projects','Prosjekter'],['team','Ansatte'],['reviews','Kundeomtaler'],['graphics','Logo og grafikk']];
const safeAsset=/^\/assets\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif|svg)$/i;
const generated=/^(?:photo|logo)-[a-f0-9-]{12}(?:-|\.)/i;
const legacyId=src=>'asset-'+basename(src).replace('.','-');
const localized=(v,site)=>typeof v==='string'?v:v?.[site.defaultLanguage]||v?.no||v?.en||'';
const label=(r,site)=>localized(r.title||r.head||r.role,site)||r.name||r.id;
const categoryForSection=s=>s.type==='hero'||s.slot==='hero'?'background':(['services','projects','team','reviews'].includes(s.type)?s.type:['services','projects','team','reviews'].includes(s.slot)?s.slot:'website');
const lookup=(site,key)=>site.brand?.images?.[key]||`/assets/${key}.webp`;
export function mediaUsage(site){
 const refs=new Map();const add=(src,category,title)=>{if(!safeAsset.test(src||''))return;const list=refs.get(src)||[];if(!list.some(x=>x.category===category&&x.title===title))list.push({category,title});refs.set(src,list)};
 const scan=(value,category,title)=>{if(typeof value==='string'){add(value,category,title);return;}if(Array.isArray(value))value.forEach(v=>scan(v,category,title));else if(value&&typeof value==='object')Object.values(value).forEach(v=>scan(v,category,title));};
 for(const group of ['services','projects','team','reviews'])for(const record of site[group]||[]){const title=mediaCategories.find(x=>x[0]===group)[1]+' / '+label(record,site);if(record.img)add(lookup(site,record.img),group,title);scan(record,group,title);}
 for(const p of site.sitePages||[]){for(const s of p.sections||[])scan(s,categoryForSection(s),label(p,site)+' / '+(localized(s.title,site)||s.slot||s.type));const legacy=site.pages?.[p.id];if(legacy?.heroImageUrl)add(legacy.heroImageUrl,'background',label(p,site)+' / Hovedbilde');}
 for(const field of ['logoUrl','lightLogoUrl','faviconUrl'])add(site.brand?.[field],'graphics','Logo og grafikk / '+field);
 // Render existing static pages (including hidden sections for conservative usage protection).
 // No property runtime, XML files or property image directories are read.
 const copy=structuredClone(site);for(const p of copy.sitePages||[]){if(p.id==='properties')continue;p.enabled=true;for(const s of p.sections||[])s.enabled=true;}
 for(const p of copy.sitePages||[]){if(p.id==='properties')continue;try{
  const html=renderDynamicSite({site:copy,locale:copy.defaultLanguage,page:p.id,annotate:true}).html;
  const parts=html.split(/(?=<\w+\b[^>]*\bdata-cbpm-section=")/);
  for(const part of parts){const id=part.match(/data-cbpm-section="([^"]+)"/)?.[1];const s=p.sections?.find(s=>s.id===id);const category=s?(s.slot==='listing'&&['services','projects','reviews'].includes(p.id)?p.id:categoryForSection(s)):'website';const title=label(p,site)+(s?' / '+(localized(s.title,site)||s.slot||s.type):'');for(const match of part.matchAll(/<img\b[^>]*\bsrc="(\/assets\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif|svg))"[^>]*>/gi)){const tag=match[0];const cat=/class="[^"]*(?:hero-image|page-bg)/.test(tag)?'background':/class="[^"]*logo/.test(tag)?'graphics':category;add(match[1],cat,title);}}
 }catch{/* unsupported template: explicit data references still count; legacy files remain protected */}}
 return refs;
}
export function buildMediaCatalog(site,files=[]){
 const registered=site.media?.items||[],meta=site.media?.workspace||{},refs=mediaUsage(site),references=mediaReferences(site),usedPaths=new Set();
 const entries=registered.filter(x=>safeAsset.test(x.src||'')).map(m=>{const paths=[m.src,...Object.values(m.variants||{}).flat()];paths.forEach(p=>usedPaths.add(p));return {...m,paths,legacy:false,originalName:m.originalName||basename(m.original||m.src)};});
 for(const f of files){const src=typeof f==='string'?f:f.src;if(!safeAsset.test(src||'')||usedPaths.has(src)||generated.test(basename(src)))continue;entries.push({id:legacyId(src),src,paths:[src],legacy:true,originalName:basename(src),kind:/logo|favicon/i.test(src)?'logo':undefined,...(typeof f==='object'?f:{})});usedPaths.add(src);}
 const validCategories=new Set([...mediaCategories.map(x=>x[0]),...(meta.categories||[]).map(x=>x.id)]);
 return entries.map(m=>{const usage=m.paths.flatMap(path=>refs.get(path)||[]).filter((x,i,a)=>a.findIndex(y=>y.category===x.category&&y.title===x.title)===i);const inferred=[...new Set([...usage.map(x=>x.category),...references.filter(r=>m.paths.includes(r.src)).map(r=>r.category),...(m.kind==='logo'?['graphics']:[])])];const raw=Object.hasOwn(meta.assignments||{},m.id)?meta.assignments[m.id]:[];const manual=(Array.isArray(raw)?raw:[]).filter(x=>validCategories.has(x));const categories=[...new Set([...inferred,...manual])];const placements=references.filter(r=>m.paths.includes(r.src)).map(r=>({...r,detachable:canDetachMedia(site,r)}));return {...m,kind:m.kind||(m.legacy&&placements.some(r=>r.kind==='brand')?'logo':undefined),usage,placements,inferred,manual,categories,used:usage.length>0||placements.length>0,removable:!usage.length&&!placements.length&&(!m.legacy||!hasDataReference(site,m.paths))};}).filter(m=>!m.legacy||m.used||!meta.hiddenLegacy?.includes(m.src));
}
export async function readMediaCatalog(site,root){
 const files=[];const dir=join(root,'public','assets');
 for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const src='/assets/'+entry.name;if(!entry.isFile()||!safeAsset.test(src))continue;const info=await stat(join(dir,entry.name)).catch(()=>null);if(info)files.push({src,bytes:info.size,modified:info.mtimeMs});}
 const items=buildMediaCatalog(site,files);
 for(const item of items){const source=item.legacy?join(dir,basename(item.src)):/^project\/media\/originals\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|tif|tiff|svg)$/.test(item.original||'')?join(root,item.original):null;if(!source)continue;const info=await stat(source).catch(()=>null);if(info){item.bytes=info.size;item.modified=info.mtimeMs;}if(!item.width){try{const sharp=(await import('sharp')).default;const m=await sharp(source,{limitInputPixels:45_000_000}).metadata();item.width=m.width;item.height=m.height;}catch{}}}
 return items;
}
export function applyMediaWorkspace(site,command){
 const media=site.media??={items:[]};const w=media.workspace??={categories:[],assignments:{}};w.categories??=[];w.assignments??={};
 const id=String(command.id||'');const name=String(command.name||'').trim();const validName=()=>{if(!name||name.length>60||/[<>]/.test(name))throw Error('Angi et kategorinavn på inntil 60 tegn.');if([...mediaCategories.map(([id,name])=>({id,name})),...w.categories].some(c=>c.id!==id&&c.name.toLowerCase()===name.toLowerCase()))throw Error('Kategorien finnes allerede.');};
 if(command.action==='media:category-add'){validName();let i=1;while(w.categories.some(c=>c.id==='custom-'+i))i++;w.categories.push({id:'custom-'+i,name});}
 else if(command.action==='media:category-rename'){validName();const c=w.categories.find(c=>c.id===id);if(!c)throw Error('Ukjent kategori.');c.name=name;}
 else if(command.action==='media:category-remove'){if(!w.categories.some(c=>c.id===id))throw Error('Ukjent kategori.');w.categories=w.categories.filter(c=>c.id!==id);for(const k of Object.keys(w.assignments))w.assignments[k]=w.assignments[k].filter(v=>v!==id);}
 else if(command.action==='media:categorize'){if(['__proto__','prototype','constructor'].includes(id)||!/^[a-zA-Z0-9_-]{1,140}$/.test(id)||!(media.items.some(m=>m.id===id)||id.startsWith('asset-')))throw Error('Ugyldig bilde-ID.');const allowed=new Set([...mediaCategories.map(x=>x[0]),...w.categories.map(x=>x.id)]);if(!Array.isArray(command.categories)||command.categories.some(c=>!allowed.has(c)))throw Error('Ugyldig kategori.');w.assignments[id]=[...new Set(command.categories)];}
 else if(command.action==='media:detach')return detachWebsiteMedia(site,command);
 else if(command.action==='media:remove'){const item=media.items.find(m=>m.id===id);if(!item){const src=command.src;if(!safeAsset.test(src||'')||legacyId(src)!==id||generated.test(basename(src)))throw Error('Ukjent bilde.');if(mediaUsage(site).has(src)||mediaReferences(site).some(r=>r.src===src)||hasDataReference(site,[src]))throw Error('Bildet har en eksisterende referanse.');w.hiddenLegacy=[...new Set([...(w.hiddenLegacy||[]),src])];delete w.assignments[id];return site;}const paths=[item.src,...Object.values(item.variants||{}).flat()];const refs=mediaUsage(site);if(paths.some(p=>refs.has(p))||replacementReferences(site,item).length)throw Error('Bildet er i bruk. Fjern tilknytningene først.'); // Keep files for undo and existing archive compatibility.
  // Protect any unknown reference outside the catalog, including inactive fields.
  const copy=structuredClone(site);delete copy.media;delete copy.brand?.images?.[id];if(Object.values(copy.brand?.images||{}).some(p=>paths.includes(p))||paths.some(p=>JSON.stringify(copy).includes(JSON.stringify(p))))throw Error('Bildet har en eksisterende referanse.');
  media.items=media.items.filter(m=>m.id!==id);delete w.assignments[id];if(site.brand?.images?.[id]===item.src)delete site.brand.images[id];
 }else throw Error('Ukjent mediekommando.');return site;
}

/** Rebind registered media to freshly generated files, preserving stable catalog ID. */
export function replaceRegisteredMedia(site,id,replacement){
 const old=site.media?.items?.find(m=>m.id===id);if(!old||!replacement||!safeAsset.test(replacement.src||'')||old.kind!==replacement.kind)throw Error('Ugyldig bildeerstatning.');
 const map=new Map([[old.src,replacement.src]]);
 for(const [preset,paths] of Object.entries(old.variants||{})){const next=replacement.variants?.[preset];if(!Array.isArray(next)||next.length!==paths.length||!next.every(p=>safeAsset.test(p)))throw Error('Bildevariantene samsvarer ikke.');paths.forEach((p,i)=>map.set(p,next[i]));}
 const copy=structuredClone(site);const update=value=>{if(typeof value==='string')return map.get(value)||value;if(Array.isArray(value))return value.map(update);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,update(v)]));return value;};
 for(const key of ['brand','sitePages','pages','services','projects','team','reviews','categories'])if(Object.hasOwn(copy,key))copy[key]=update(copy[key]);
 copy.media.items=copy.media.items.map(m=>m.id===id?{...replacement,id}:m);return copy;
}

function hasDataReference(site,paths){const copy=structuredClone(site);delete copy.media;return paths.some(p=>JSON.stringify(copy).includes(JSON.stringify(p)));}
// Conservative source guard for legacy assets, including hard-coded CSS/PHP.
// This is a catalog removal, not physical deletion. Unknown or unreadable source
// files fail closed; no property image directories are traversed.
export async function verifyLegacyRemoval(root,site,id,src){
 const m=(await readMediaCatalog(site,root)).find(x=>x.id===id&&x.src===src&&x.legacy);
 if(!m?.removable)throw Error('Bildet er i bruk eller finnes ikke.');
 const name=basename(src),stem=name.slice(0,-extname(name).length);
 async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
  if(entry.isSymbolicLink())continue;const path=join(dir,entry.name);
  if(entry.isDirectory()){if(!['node_modules','.git','dist','storage','property-feeds','images','imports'].includes(entry.name))await scan(path);continue;}
  if(!/\.(astro|html|css|scss|js|mjs|cjs|ts|tsx|jsx|php|json|svg)$/i.test(entry.name)||entry.name===name)continue;
  const content=await readFile(path,'utf8');if(content.includes(name)||content.includes("'"+stem+"'")||content.includes('"'+stem+'"'))throw Error('Bildet har en avhengighet i nettsidemalen og kan ikke fjernes. Bytt bildet i stedet.');
 }}
 for(const folder of ['src','public','site-tools','server'])await scan(join(root,folder));
 return true;
}
