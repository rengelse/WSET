import {markingFor} from './property-markings.mjs';
/** Read-only project catalogue composed from the exact XML feed files included in export.
 * No database, network calls, server-side status claims or duplicate source IDs. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {listLocalFeeds} from './local-property-feeds.mjs';
import {parseKyeroXML} from './property-xml.mjs';
import {isLocalPropertyImagePath,localPropertyImagePreviewUrl} from '../engines/cbpm-astro-v1/lib/property-image-path.mjs';
export async function localPropertyCatalog(root,{query='',category='all',type='',city='',page=1,pageSize=50,site,status='',identity=null}={}){
 const inventory=await listLocalFeeds(root),records=[],errors=[...inventory.errors];
 const availableImages=new Set((inventory.images||[]).map(row=>row.path));
 for(const feed of inventory.files){
  try{
   const sourceCode=(feed.category==='New'?'new':'existing')+'--'+feed.filename.toLowerCase().replace(/\.xml$/,'');
   const data=await readFile(resolve(root,'project/property-feeds',feed.category,feed.filename),'utf8');
   for(const item of parseKyeroXML(data,{sourceCode})){
    if(feed.category==='Existing')for(const image of item.images||[]){
     if(isLocalPropertyImagePath(image.url)&&!availableImages.has(image.url))errors.push(`${feed.filename}: mangler bilde ${image.url} i Existing/images/`);
    }
    records.push({...item,marking:markingFor(site,sourceCode,item.identity.externalId),category:feed.category,filename:feed.filename});
   }
  }catch(error){errors.push(`${feed.category}/${feed.filename}: ${error.message}`);}
 }
 const needle=String(query).trim().toLocaleLowerCase();
 const scoped=records.filter(r=>category==='all'||r.category===category);
 const unique=key=>[...new Set(scoped.map(r=>r.listing[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'nb'));
 const filtered=scoped.filter(r=>(!identity||(r.identity.sourceCode===identity.source&&r.identity.externalId===identity.id))&&(!status||(status==='hidden'?!r.marking.visible:r.marking.status===status))&&(!type||r.listing.type===type)&&(!city||r.listing.city===city)&&(!needle||[r.identity.reference,r.identity.externalId,r.listing.city,r.listing.type,r.listing.province,r.filename].some(s=>String(s||'').toLocaleLowerCase().includes(needle))));
 const counts={New:records.filter(r=>r.category==='New').length,Existing:records.filter(r=>r.category==='Existing').length};
 const n=Math.max(1,Math.min(200,Number(pageSize)||50)),p=Math.max(1,Math.min(Math.ceil(filtered.length/n)||1,Number(page)||1));
 return {files:inventory.files,errors,counts,filters:{types:unique('type'),cities:unique('city')},total:filtered.length,allTotal:records.length,page:p,pages:Math.max(1,Math.ceil(filtered.length/n)),records:filtered.slice((p-1)*n,p*n)};
}

/** Read-only website preview of local XML sources, never a publication decision.
 * Unlike the remote PHP catalogue, these are operator-owned *unpublished* files.
 * They are projected only into the loopback editor, with no new database/cache. */
export async function localPropertyPreviewListings(root,site){
 const inventory=await listLocalFeeds(root);
 if(!inventory.files.length)return null;
 const {createHash}=await import('node:crypto');
 const rows=[];
 for(const feed of inventory.files){
  const sourceCode=(feed.category==='New'?'new':'existing')+'--'+feed.filename.toLowerCase().replace(/\.xml$/,'');
  const xml=await readFile(resolve(root,'project/property-feeds',feed.category,feed.filename),'utf8');
  for(const r of parseKyeroXML(xml,{sourceCode})){
   const item=r.listing;
   const marking=markingFor(site,sourceCode,r.identity.externalId);
   if(item.saleOrRent==='rent'||!marking.visible)continue;
   const id=parseInt(createHash('sha256').update(r.identity.sourceCode+'|'+r.identity.externalId).digest('hex').slice(0,12),16);
   rows.push({
    id,marking,reference:r.identity.reference,publication_status:'published',offer_type:'sale',
    new_build:feed.category==='New'?1:0,property_type:item.type,city:item.city,province:item.province,
    location_detail:item.locationDetail,price:item.price,currency:item.currency,
    beds:item.beds,baths:item.baths,built_area:item.builtArea,
    latitude:item.location?.latitude??null,longitude:item.location?.longitude??null,
    descriptions:Object.fromEntries(Object.entries(r.descriptions||{}).map(([lang,description])=>[lang,{description,title:description.slice(0,100)}])),
    images:(r.images||[]).map(image=>({kind:image.role==='floorplan'?'floorplan':'photo',source_url:isLocalPropertyImagePath(image.url)?null:image.url,local_path:isLocalPropertyImagePath(image.url)?localPropertyImagePreviewUrl(image.url):null,license_status:'approved'}))
   });
  }
 }
 return rows;
}
