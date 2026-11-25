import {markingEntries} from './property-markings.mjs';
/** Generated Kyero v3 projection of explicitly approved own listings. */
import {readFile,writeFile,mkdir,lstat,realpath,rename,rm,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizePropertyDraft} from './property-drafts.mjs';
import {readDraftImage} from './property-draft-images.mjs';
import {parseKyeroXML} from './property-xml.mjs';
import {isLocalPropertyImagePath} from '../engines/cbpm-astro-v1/lib/property-image-path.mjs';
export const OWN_FEED='wset-egne-boliger.xml';
const MARKER='<!-- WSET managed own-property feed v1 -->';
const base='project/property-feeds';
const escapeXml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(name,value)=>`<${name}>${escapeXml(value)}</${name}>`;
const ownId=/^wset-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ownRef=/^WSET-[0-9A-F]{16}$/;
export function validateOwnListing(data,site){
 const d=normalizePropertyDraft(data,site.languages),errors=[];
 for(const [key,label] of [['type','Boligtype'],['town','Sted'],['province','Provins'],['country','Land'],['currency','Valuta']])if(!d[key])errors.push(label+' mangler');
 if(!(Number(d.price)>0))errors.push('Pris må være større enn null');
 if(d.price_freq!=='sale')errors.push('Kun salgsannonser støttes av nettstedets eiendomsregister');
 if((d.latitude==='')!==(d.longitude===''))errors.push('Oppgi begge koordinatene eller ingen');
 const lang=site.defaultLanguage||site.languages?.[0]?.code;
 if(!d.desc[lang]?.trim())errors.push('Beskrivelse på kildespråket mangler ('+lang+')');
 if(!d.photos?.some(p=>p.role==='photo'))errors.push('Minst ett boligfoto kreves');
 if(errors.length)throw Error(errors.join('\n'));
 return d;
}
export function buildOwnFeed(site){
 const items=(site.propertyDrafts?.items||[]).filter(r=>r.publication?.data),seen=new Set(),refs=new Set(),photos=[];
 const properties=items.map(r=>{
  if(!ownId.test(r.id)||!ownRef.test(r.reference)||seen.has(r.id)||refs.has(r.reference))throw Error('Ugyldig eller duplisert egen bolig-ID.');seen.add(r.id);refs.add(r.reference);
  const d=validateOwnListing(r.publication.data,site),date=String(r.publication.updatedAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ugyldig klargjøringsdato.');
  const fields={id:r.id,ref:r.reference,date,price:d.price,currency:d.currency,price_freq:d.price_freq,new_build:'0',type:d.type,town:d.town,province:d.province,country:d.country,location_detail:d.location_detail,beds:d.beds,baths:d.baths,pool:d.pool?'1':'0'};
  const lines=Object.entries(fields).filter(([,v])=>v!=='').map(([k,v])=>tag(k,v));
  if(d.latitude!=='')lines.push('<location>'+tag('latitude',d.latitude)+tag('longitude',d.longitude)+'</location>');
  if(d.built!==''||d.plot!=='')lines.push('<surface_area>'+tag('built',d.built)+tag('plot',d.plot)+'</surface_area>');
  if(d.consumption||d.emissions)lines.push('<energy_rating>'+tag('consumption',d.consumption)+tag('emissions',d.emissions)+'</energy_rating>');
  lines.push('<desc>'+Object.entries(d.desc).filter(([,v])=>v).map(([k,v])=>tag(k,v)).join('')+'</desc>');
  const features=d.features.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(features.length)lines.push('<features>'+features.map(v=>tag('feature',v)).join('')+'</features>');
  lines.push('<images>'+d.photos.map((p,i)=>{const path=`images/${r.id}/${p.file}`;if(!isLocalPropertyImagePath(path))throw Error('Ugyldig boligbilde.');photos.push({file:p.file,path});return `<image id="${i+1}">${tag('url',path)}${p.role==='floorplan'?'<tags><tag>floorplan</tag></tags>':''}</image>`;}).join('')+'</images>');
  return '<property>\n'+lines.map(l=>'  '+l).join('\n')+'\n</property>';
 });
 const bytes=items.length?Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n'+MARKER+'\n<root>\n<kyero><feed_version>3</feed_version></kyero>\n'+properties.join('\n')+'\n</root>\n'):null;
 if(bytes){const records=parseKyeroXML(bytes.toString('utf8'),{sourceCode:'existing--wset-egne-boliger'});if(records.length!==items.length||records.reduce((n,r)=>n+r.images.length,0)!==photos.length)throw Error('Generert XML mistet boligdata.');}
 return {bytes,photos,count:items.length};
}
async function safeDir(root,parts){let current=await realpath(root);for(const part of parts){current=join(current,part);await mkdir(current).catch(e=>{if(e.code!=='EEXIST')throw e;});const m=await lstat(current);if(!m.isDirectory()||m.isSymbolicLink())throw Error('Utrygg boligmappe: '+part);}return current;}
async function fileOrNull(file){try{const m=await lstat(file);if(!m.isFile()||m.isSymbolicLink())throw Error('Utrygg boligfil: '+file);return await readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function atomic(file,bytes){const tmp=join(dirname(file),'.wset-'+randomUUID());try{await writeFile(tmp,bytes,{flag:'wx'});await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
/** Materialize only managed content. Never replace an unrelated XML or image. */
export async function syncOwnFeed(root,site){
 if(!site.propertyDrafts?.publicationManaged&&!site.propertyDrafts?.items?.some(r=>r.publication?.data))return {count:0,managed:false};
 const feed=buildOwnFeed(site),dir=await safeDir(root,['project','property-feeds','Existing']),target=join(dir,OWN_FEED),previous=await fileOrNull(target);
 if(previous&&!previous.toString('utf8').includes(MARKER))throw Error('Reservert filnavn er allerede i bruk: '+OWN_FEED);
 const images=[];for(const photo of feed.photos){const bytes=await readDraftImage(root,photo.file),parts=photo.path.split('/'),folder=await safeDir(root,['project','property-feeds','Existing',...parts.slice(0,-1)]),file=join(folder,parts.at(-1)),prior=await fileOrNull(file);if(prior&&!prior.equals(bytes))throw Error('Boligbilde finnes med annet innhold: '+photo.path);images.push({file,bytes,prior});}
 for(const im of images)if(!im.prior)await writeFile(im.file,im.bytes,{flag:'wx'});
 if(feed.bytes){if(!previous?.equals(feed.bytes))await atomic(target,feed.bytes);}else if(previous)await rm(target);
 return {count:feed.count,managed:true,rollback:async()=>{if(previous)await atomic(target,previous);else await rm(target,{force:true});}};
}
/** Collect the complete active category, retaining supplier filenames and identities. */
export async function propertyExportEntries(root,category,site){
 if(!['New','Existing'].includes(category))throw Error('Ugyldig kategori.');
 const {listLocalFeeds}=await import('./local-property-feeds.mjs');
 const inventory=await listLocalFeeds(root);if(inventory.errors.some(e=>e.startsWith(category+'/')))throw Error('Rett XML-/bildefeil før eksport: '+inventory.errors.filter(e=>e.startsWith(category+'/')).join('; '));
 const entries=[],images=new Set();let count=0,total=0;
 const add=(name,bytes)=>{total+=bytes.length;if(entries.length>=5000||total>400*1024*1024)throw Error('Boligeksport overskrider ZIP-sikkerhetsgrensen.');entries.push({name,bytes});};
 for(const f of inventory.files.filter(f=>f.category===category)){
  const dir=await safeDir(root,['project','property-feeds',category]);const bytes=await fileOrNull(join(dir,f.filename));if(!bytes)throw Error('XML-kilde mangler.');
  const records=parseKyeroXML(bytes.toString('utf8'),{sourceCode:(category==='New'?'new':'existing')+'--'+f.filename.toLowerCase().slice(0,-4)});count+=records.length;add(`storage/imports/${category}/${f.filename}`,bytes);
  if(category==='Existing')for(const r of records)for(const p of r.images)if(isLocalPropertyImagePath(p.url))images.add(p.url);
 }
 for(const path of images){const parts=path.split('/'),dir=await safeDir(root,['project','property-feeds','Existing',...parts.slice(0,-1)]),bytes=await fileOrNull(join(dir,parts.at(-1)));if(!bytes||!bytes.length||bytes.length>15*1024*1024)throw Error('Manglende eller ugyldig boligbilde: '+path);add('storage/imports/Existing/'+path,bytes);}
 const remove=category==='Existing'&&site.propertyDrafts?.publicationManaged&&!inventory.files.some(f=>f.category==='Existing'&&f.filename===OWN_FEED)?['storage/imports/Existing/'+OWN_FEED]:[];
 for(const entry of markingEntries(site,category))add(entry.name,entry.bytes);
 if(!entries.length&&!remove.length)throw Error('Ingen XML-kilder å eksportere i denne kategorien.');
 add('WSET-OVERFORING.json',Buffer.from(JSON.stringify({format:'wset-property-transfer-v1',category,count,files:entries.map(e=>e.name),remove},null,2)+'\n'));
 add('LES-MEG.txt',Buffer.from('Overfør kun storage/ til kontoroten ved siden av www/. Last opp bilder før XML. Behold andre XML-filer og bilder.\n'+(remove.length?'Fjern den tidligere WSET-genererte filen manuelt på serveren: '+remove.join(', ')+'\n':'')+'WSET-OVERFORING.json og LES-MEG.txt skal ikke lastes opp.\n'));
 return {entries,count,remove};
}
export async function exportPropertyCategory({root,category,site,destination}){const result=await propertyExportEntries(root,category,site);const {writeZip}=await import('./project-archive.mjs');const out=resolve(destination),rel=relative(await realpath(root),out);if(!rel||(!rel.startsWith('..'+sep)&&rel!=='..'&&!requireAbsolute(rel)))throw Error('Velg eksportmappe utenfor prosjektet.');if(!out.toLowerCase().endsWith('.zip'))throw Error('Velg en ZIP-fil.');await atomic(out,writeZip(result.entries));return {path:out,count:result.count,remove:result.remove};}
// relative() may return an absolute path on another Windows volume.
const requireAbsolute=p=>/^(?:[A-Za-z]:[\\/]|[\\/])/.test(p);
