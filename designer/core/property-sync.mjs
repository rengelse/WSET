/** v1.2.10: legacy local feed settings are used ONLY for one-time migration.
 * Current XML source configuration lives in the private hosting archive. */
import {readFile,writeFile,rename,mkdir,copyFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {enabledPropertyModules,propertyPageEnabled} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';

const codePattern=/^[a-z][a-z0-9-]{0,63}$/;
export const sourceIntervals=[15,30,60,120,360,720,1440];
export const syncPath=root=>join(root,'project','property-sync.json');
const defaults=()=>({format:1,enabled:false,sources:[]});
export function assertFeedUrl(value){
 let url;try{url=new URL(value);}catch{throw Error('Ugyldig XML-URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||!url.hostname||url.hostname.length>253||!(/^[a-zA-Z0-9.-]+$/.test(url.hostname))||!url.hostname.includes('.')||url.hostname.endsWith('.')||value.length>2048)throw Error('XML-kilden må være en gyldig HTTPS-adresse uten innloggingsinfo, port eller fragment.');
 const host=url.hostname.toLowerCase();
 if(/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('[')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid')||host.endsWith('.example')||host.endsWith('.localhost'))throw Error('XML-URL kan ikke peke til en lokal/IP-basert adresse.');
 return url.href;
}
export function validateSyncSettings(settings){
 if(!settings||typeof settings!=='object'||settings.format!==1||typeof settings.enabled!=='boolean'||!Array.isArray(settings.sources)||settings.sources.length>20)throw Error('Ugyldig XML-synkronisering.');
 const codes=new Set();const sources=settings.sources.map(source=>{
  const code=String(source.code||'').trim(),name=String(source.name||'').trim();
  if(!codePattern.test(code)||codes.has(code)||!name||name.length>160)throw Error('Ugyldig eller duplisert XML-kilde.');
  codes.add(code);
  const enabled=source.enabled===true,url=String(source.url||'').trim(),intervalMinutes=Number(source.intervalMinutes);
  if(url)assertFeedUrl(url);
  if(enabled&&!url)throw Error('Aktiv XML-kilde må ha en HTTPS-adresse.');
  if(!sourceIntervals.includes(intervalMinutes))throw Error('Ugyldig oppdateringsintervall.');
  return {code,name,url,enabled,intervalMinutes};
 });
 if(settings.enabled&&!sources.some(s=>s.enabled))throw Error('Aktiver minst én XML-kilde før automatisk synkronisering slås på.');
 return {format:1,enabled:settings.enabled,sources};
}
export async function loadSyncSettings(root){
 let data;try{data=await readFile(syncPath(root),'utf8');}catch(e){if(e.code==='ENOENT')return defaults();throw e;}
 return validateSyncSettings(JSON.parse(data));
}
export async function saveSyncSettings(root,settings){
 const valid=validateSyncSettings(settings);await mkdir(join(root,'project'),{recursive:true});
 const file=syncPath(root),tmp=join(root,'project',`.property-sync-${randomUUID()}.tmp`);
 try{await writeFile(tmp,JSON.stringify(valid,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file);}finally{await rm(tmp,{force:true}).catch(()=>{});}
 return valid;
}
export function syncPolicy(site){
 const enabled=propertyPageEnabled(site);
 return {pageEnabled:enabled,categories:enabled?enabledPropertyModules(site).map(m=>m.id):[]};
}
/** Operator decisions are an overlay on server-owned feed data, not a stale replacement.
 * Re-export after local publication changes, then upload ONLY this file to the private kit. */
export function operatorDecisions(doc){
 return {format:1,records:doc.records.map(r=>({
  source_code:r.source_code,external_id:r.external_id,
  publication_status:r.publication_status,
  overrides:(r.overrides||[]).filter(x=>typeof x==='string'),
  values:Object.fromEntries((r.overrides||[]).filter(x=>!x.includes('.')&&Object.hasOwn(r,x)).map(x=>[x,r[x]])),
  descriptions:Object.fromEntries(Object.entries(r.descriptions||{}).flatMap(([loc,obj])=>{
   const fields=Object.fromEntries(['title','description'].filter(f=>(r.overrides||[]).includes(`descriptions.${loc}.${f}`)).map(f=>[f,obj[f]||'']));
   return Object.keys(fields).length?[[loc,fields]]:[];
  })),
  image_approvals:(r.images||[]).filter(im=>im.license_status==='approved').map(im=>({source_media_id:im.source_media_id,source_url:im.source_url,local_path:im.local_path})),
  initial:r
 }))};
}
export async function exportOperatorDecisions({root,destination}){
 const output=resolve(destination),folder=resolve(root),rel=relative(folder,output);
 if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('Lagre private overstyringer utenfor CBPM-prosjektet.');
 if(!output.endsWith('.json'))throw Error('Velg en JSON-fil.');
 const {LocalPropertyStore}=await import('./property-store.mjs');
 const {doc}=await new LocalPropertyStore(root).load();
 const tmp=output+'.cbpm-'+randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(operatorDecisions(doc),null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,output);}
 finally{await rm(tmp,{force:true}).catch(()=>{});}
 return {path:output,count:doc.records.length};
}
/** Generate private initial configuration/overrides ONLY. The website ZIP owns executable PHP code. */
export async function exportPrivateSyncKit({root,destination,site}){
 const folder=resolve(root),target=resolve(destination),rel=relative(folder,target);
 if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('Velg målmappe utenfor CBPM-prosjektet.');
 const policy=syncPolicy(site);
 if(!policy.pageEnabled)throw Error('Aktiver Eiendommer-siden før installasjon. Boligkategorier er valgfrie.');
 const {randomBytes,createHash}=await import('node:crypto');
 const token=randomBytes(32).toString('hex');
 const kit=join(target,'storage','property');
 await mkdir(join(target,'storage'),{recursive:true});
 let sourceCount=0,decisionCount=0;
 try{await mkdir(kit,{recursive:false,mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('storage/property finnes allerede. Eksporter til en tom mappe; aldri overskriv aktive serverinnstillinger.');throw e;}
 try{
  await mkdir(join(kit,'sources'),{mode:0o700});await mkdir(join(kit,'staging'),{mode:0o700});await mkdir(join(kit,'backups'),{mode:0o700});await mkdir(join(kit,'cache'),{mode:0o700});
  // Executable PHP remains in the single WSET website export under app/properties/.
  // This initialization exports settings and operator choices, never a parallel PHP runtime.
  // One-time migration of operator decisions ONLY. The old JSON register never becomes
  // the server listing source; original XML must be uploaded and approved on hosting.
  const {doc}=await new (await import('./property-store.mjs')).LocalPropertyStore(root).load();
  const fields=new Set(['reference','offer_type','new_build','property_type','city','province','country','location_detail','latitude','longitude','price','currency','beds','baths','built_area','plot_area','has_pool','availability','features','images']);
  const decisions={},ids={};let nextId=1;
  for(const r of doc.records){
   const key=r.source_code+':'+r.external_id;ids[key]=r.id;nextId=Math.max(nextId,r.id+1);
   const overrideFields=Object.fromEntries((r.overrides||[]).filter(f=>fields.has(f)).map(f=>[f,r[f]]));
   const descriptions={};
   for(const [loc,texts] of Object.entries(r.descriptions||{}))for(const f of ['title','description']){
    if((r.overrides||[]).includes(`descriptions.${loc}.${f}`)){
     descriptions[loc]??={};descriptions[loc][f]=texts[f]||'';
    }
   }
   decisions[key]={status:r.publication_status,fields:overrideFields,descriptions,
    approvals:(r.images||[]).filter(im=>im.license_status==='approved').map(im=>createHash('sha256').update(String(im.source_media_id??'')+'\0'+String(im.source_url??im.local_path??'')).digest('hex'))};
  }
  const oldSync=await loadSyncSettings(root);
  const codes=new Set([...Object.keys(doc.sources||{}),...oldSync.sources.map(x=>x.code)]);
  const sources=[...codes].map(code=>{
   const old=oldSync.sources.find(x=>x.code===code);
   return {code,name:old?.name||doc.sources[code]?.name||code,url:old?.url||'',enabled:false,
    intervalMinutes:old?.intervalMinutes||60,lastSyncAt:'',lastImportAt:'',count:0,checksum:''};
  });
  sourceCount=sources.length;decisionCount=Object.keys(decisions).length;
  const config={format:2,enabled:false,policy,
   adminTokenHash:createHash('sha256').update(token).digest('hex'),sources};
  await writeFile(join(kit,'config.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});
  await writeFile(join(kit,'operators.json'),JSON.stringify({format:2,nextId,ids,decisions},null,2)+'\n',{mode:0o600,flag:'wx'});
  await writeFile(join(kit,'ADMIN-TOKEN-READ-ONCE.txt'),token+'\n',{mode:0o600,flag:'wx'});
  await writeFile(join(kit,'.htaccess'),'Require all denied\n',{mode:0o600,flag:'wx'});
  await writeFile(join(kit,'README-PRIVATE.txt'),[
   'WSET – privat engangskonfigurasjon for eiendomskatalog',
   '',
   '1. Generer nettstedet fra WSET. Leveransen er én ZIP som pakkes ut direkte i eksisterende www/. Privat app/, config/ og storage/ klargjøres automatisk av PHP.',
   '2. Legg offentlige filer i eksisterende www/. Private mapper legges på kontonivået utenfor www/.',
   '3. Kopier config.json og operators.json til samme konto under storage/property/.',
   '4. Ikke overskriv eksisterende konfigurasjon eller operatørbeslutninger på serveren.',
   '5. XML ligger kun i privat storage/imports/New/ og storage/imports/Existing/.',
   '6. PHP-motoren og cron ligger i app/properties/ fra nettstedseksporten; IKKE kopier ekstra PHP-kode.',
   '7. Planlegg cron: php /sti/til/nettside/app/properties/cbpm-cron.php',
   '8. Koble Designer til /api/property/cbpm-admin.php via HTTPS og token for administrasjon.',
   '9. Lagre tokenet sikkert og slett ADMIN-TOKEN-READ-ONCE.txt etter innlesing.',
   '10. Ved senere nettstedseksport: serverens private innstillinger og nyere XML må bevares.',
   'Ingen MySQL, offentlig XML-mapstruktur eller separat PHP-eksportmotor.', ''
  ].join('\n'),{mode:0o600,flag:'wx'});
 }catch(e){await rm(kit,{recursive:true,force:true});throw e;}
 return {path:kit,xmlFolder:'storage/imports/',sources:sourceCount,migratedDecisions:decisionCount,tokenFile:join(kit,'ADMIN-TOKEN-READ-ONCE.txt')};
}
