/** CBPM v1.2.6: local XML-sourced property register. No DB, server account or SaaS.
 * Source + external ID is the immutable identity. JSON is an editable cache,
 * never a second source of imported listings. New records only via XML. */
import {readFile,writeFile,rename,mkdir,copyFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseKyeroXML} from './property-xml.mjs';

const FIELDS=['reference','offer_type','new_build','property_type','city','province','country','location_detail','latitude','longitude','price','currency','beds','baths','built_area','plot_area','has_pool','availability'];
const numeric=new Set(['new_build','price','beds','baths','built_area','plot_area','has_pool','latitude','longitude']);
const sha=data=>createHash('sha256').update(data).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const empty=()=>({format:1,nextId:1,sources:{},records:[]});
const pathOf=root=>join(root,'project','properties.json');
const allowedStatus=new Set(['draft','published','unpublished','archived']);
function makeRecord(n,id){
 const l=n.listing,identity=n.identity;
 const record={id,revision:1,source_code:identity.sourceCode,external_id:identity.externalId,
  reference:identity.reference,offer_type:l.saleOrRent==='rent'?'rent':'sale',new_build:l.newBuild?1:0,
  property_type:l.type,city:l.city,province:l.province,country:l.country,location_detail:l.locationDetail,
  latitude:l.location?.latitude??null,longitude:l.location?.longitude??null,price:l.price,currency:l.currency,
  beds:l.beds,baths:l.baths,built_area:l.builtArea,plot_area:l.plotArea,has_pool:l.pool?1:0,
  availability:l.availability||'unknown',publication_status:'draft',updated_at:new Date().toISOString(),
  descriptions:Object.fromEntries(Object.entries(n.descriptions).map(([loc,description])=>[loc,{title:'',description}])),
  features:[...n.features],images:n.images.map(i=>({source_media_id:i.sourceImageId,source_url:i.url,local_path:null,kind:i.role,license_status:'unverified'})),
  overrides:[],source_modified_at:l.sourceModifiedAt||''};
 return record;
}
function incoming(n,old){const next=makeRecord(n,old.id);next.revision=old.revision;next.publication_status=old.publication_status;next.updated_at=old.updated_at;
 const locked=new Set(old.overrides||[]), protectedFields=[];
 for(const f of FIELDS){if(locked.has(f)){next[f]=old[f];protectedFields.push(f);}}
 for(const [loc,trans] of Object.entries(old.descriptions||{})){
  if(!next.descriptions[loc])next.descriptions[loc]={title:'',description:''};
  for(const f of ['title','description']){
   const key=`descriptions.${loc}.${f}`;
   if(locked.has(key)||f==='title'&&trans.title){next.descriptions[loc][f]=trans[f]||'';if(locked.has(key))protectedFields.push(key);}
  }
 }
 if(locked.has('features')){next.features=old.features;protectedFields.push('features');}
 if(locked.has('images')){next.images=old.images;protectedFields.push('images');}
 else {
  // Approval belongs to an exact source image, never blindly inherited when URL changes.
  const approvals=new Map((old.images||[]).map(im=>[im.source_media_id+'|'+im.source_url,im.license_status]));
  next.images=next.images.map(im=>({...im,license_status:approvals.get(im.source_media_id+'|'+im.source_url)||'unverified'}));
 }
 next.overrides=[...locked];
 const changedFields=FIELDS.filter(f=>!equal(next[f],old[f]));
 const changedLanguages=[...new Set([...Object.keys(old.descriptions||{}),...Object.keys(next.descriptions||{})])].filter(loc=>!equal(old.descriptions?.[loc]||{},next.descriptions?.[loc]||{}));
 const changedFeatures=!equal(next.features,old.features),changedImages=!equal(next.images,old.images);
 const changes={price_before:old.price,price_after:next.price,changed_fields:changedFields,changed_languages:changedLanguages,
  changed_features:changedFeatures,changed_images:changedImages,protected_fields:protectedFields};
 const changed=!!(changedFields.length||changedLanguages.length||changedFeatures||changedImages||next.source_modified_at!==old.source_modified_at);
 if(changed){next.revision++;next.updated_at=new Date().toISOString();}
 return {next,changed,changes};
}
function inspect(doc,incomingRecords){
 const index=new Map(doc.records.map(r=>[r.source_code+'\u0000'+r.external_id,r]));
 const items=[],planned=[];
 for(const n of incomingRecords){
  const key=n.identity.sourceCode+'\u0000'+n.identity.externalId,old=index.get(key);
  const candidate=old?incoming(n,old):{next:makeRecord(n,0),changed:true,changes:{changed_fields:[],changed_languages:[],changed_features:false,changed_images:false,protected_fields:[],price_before:null,price_after:n.listing.price}};
  const action=!old?'create':candidate.changed?'update':'unchanged';
  items.push({action,reference:n.identity.reference,external_id:n.identity.externalId,source_code:n.identity.sourceCode,city:n.listing.city,
   price:n.listing.price,currency:n.listing.currency,changes:candidate.changes});
  planned.push({action,oldId:old?.id,next:candidate.next});
 }
 return {items,planned,summary:{create:items.filter(x=>x.action==='create').length,update:items.filter(x=>x.action==='update').length,unchanged:items.filter(x=>x.action==='unchanged').length,review:0}};
}
export function publicProperties(doc){return doc.records.filter(r=>r.publication_status==='published'&&r.offer_type==='sale').map(r=>{
 const {overrides,source_modified_at,revision,updated_at,external_id,source_code,...rest}=r;
 return {...rest,images:(r.images||[]).filter(im=>im.license_status==='approved'),updated_at};
 });}
export class LocalPropertyStore{
 constructor(root){this.root=root;this.pending=null;}
 async load(){
  let data;
  try{data=await readFile(pathOf(this.root));}catch(e){if(e.code==='ENOENT')return {doc:empty(),revision:null};throw e;}
  const doc=JSON.parse(data.toString('utf8'));
  if(doc.format!==1||!Array.isArray(doc.records)||!Number.isSafeInteger(doc.nextId)||doc.nextId<1||!doc.sources||typeof doc.sources!=='object')throw Error('Ugyldig properties.json.');
  return {doc,revision:sha(data)};
 }
 async persist(doc,expected){
  const file=pathOf(this.root),actual=await readFile(file).then(sha,e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(actual!==expected)throw Error('Eiendomsregisteret er endret fra et annet program. Les det inn på nytt.');
  await mkdir(join(this.root,'project'),{recursive:true});
  if(actual){const dir=join(this.root,'project','backups');await mkdir(dir,{recursive:true});await copyFile(file,join(dir,`properties-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,6)}.json`));}
  const temp=join(this.root,'project',`.properties-${randomUUID()}.tmp`);
  try{await writeFile(temp,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});await rename(temp,file);}catch(e){await import('node:fs/promises').then(fs=>fs.rm(temp,{force:true}));throw e;}
 }
 async list({q='',page=1}={}){
  const {doc}=await this.load();const needle=String(q).toLowerCase().slice(0,100);
  const filtered=doc.records.filter(r=>[r.reference,r.city,r.source_code,r.external_id].some(s=>String(s||'').toLowerCase().includes(needle)));
  const current=Math.max(1,Math.min(100000,Number(page)||1));
  return {records:filtered.slice((current-1)*50,current*50),total:filtered.length,page:current};
 }
 async get({id}){const {doc}=await this.load(),record=doc.records.find(r=>r.id===Number(id));if(!record)throw Error('Eiendommen finnes ikke.');return {record};}
 async stage({sourceCode,sourceName,filename,bytes}){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(sourceCode)||!sourceName?.trim()||sourceName.length>160)throw Error('Ugyldig kildekode eller kildenavn.');
  if(!Buffer.isBuffer(bytes)||bytes.length>25*1024*1024||bytes.length<10)throw Error('XML må være maks 25 MB.');
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const incomingRecords=parseKyeroXML(xml,{sourceCode}),{doc,revision}=await this.load();
  const plan=inspect(doc,incomingRecords),checksum=sha(bytes);
  this.pending={sourceCode,sourceName,filename,revision,checksum,incomingRecords,createdAt:Date.now()};
  return {run:{id:checksum.slice(0,12),source_code:sourceCode,filename,state:'preview',seen:incomingRecords.length,checksum},summary:plan.summary,items:plan.items.slice(0,50),page:1,pages:Math.max(1,Math.ceil(plan.items.length/50))};
 }
 async preview({page=1}={}){
  const pending=this.pending;if(!pending)throw Error('Ingen import venter på godkjenning.');
  const {doc,revision}=await this.load();if(revision!==pending.revision)throw Error('Eiendomsregisteret har endret seg etter forhåndsvisning. Velg XML-filen på nytt.');
  const plan=inspect(doc,pending.incomingRecords),p=Math.max(1,Number(page)||1),pages=Math.max(1,Math.ceil(plan.items.length/50));
  return {run:{id:pending.checksum.slice(0,12),source_code:pending.sourceCode,filename:pending.filename,state:'preview',seen:plan.items.length,checksum:pending.checksum},summary:plan.summary,items:plan.items.slice((p-1)*50,p*50),page:p,pages};
 }
 async approve({checksum}){
  const pending=this.pending;if(!pending||checksum!==pending.checksum)throw Error('Importen er utløpt eller kontrollsummen stemmer ikke.');
  const {doc,revision}=await this.load();if(revision!==pending.revision)throw Error('Eiendomsregisteret har endret seg. Last inn XML på nytt.');
  const plan=inspect(doc,pending.incomingRecords);
  for(const entry of plan.planned){if(entry.action==='unchanged')continue;
   if(entry.action==='create')entry.next.id=doc.nextId++;
   if(entry.action==='create')doc.records.push(entry.next);
   else {const pos=doc.records.findIndex(r=>r.id===entry.oldId);doc.records[pos]=entry.next;}
  }
  doc.sources[pending.sourceCode]={name:pending.sourceName,lastImport:new Date().toISOString(),checksum:pending.checksum};
  await this.persist(doc,revision);this.pending=null;
  return {summary:plan.summary,imported:plan.items.length};
 }
 discard(){this.pending=null;return {ok:true};}
 async save(record){
  const {doc,revision}=await this.load(),index=doc.records.findIndex(r=>r.id===Number(record.id));
  if(index<0)throw Error('Nye eiendommer må registreres via XML-import.');
  const old=doc.records[index];if(record.revision!==old.revision)throw Error('Eiendommen er endret siden du åpnet den. Last inn på nytt.');
  if(record.source_code!==old.source_code||record.external_id!==old.external_id||Number(record.id)!==old.id)throw Error('XML-identitet kan ikke endres.');
  const next=structuredClone(old),locks=new Set(old.overrides||[]);
  for(const f of FIELDS){if(record[f]===undefined)continue;
   let val=record[f];if(numeric.has(f)){val=val===''||val===null?null:Number(val);if(val!==null&&(!Number.isFinite(val)||val<0&&f!=='longitude'&&f!=='latitude'))throw Error('Ugyldig tallfelt: '+f);}
   if(!equal(old[f],val)){next[f]=val;locks.add(f);}
  }
  for(const [loc,translation] of Object.entries(record.descriptions||{})){
   if(!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(loc))throw Error('Ugyldig språkkode.');
   if(!next.descriptions[loc])next.descriptions[loc]={title:'',description:''};
   for(const f of ['title','description'])if(translation[f]!==undefined&&translation[f]!==next.descriptions[loc][f]){
    next.descriptions[loc][f]=String(translation[f]).slice(0,50000);locks.add(`descriptions.${loc}.${f}`);
   }
  }
  if(record.features&&!equal(record.features,old.features)){next.features=record.features.map(v=>String(v).slice(0,300));locks.add('features');}
  if(record.images){
   if(!Array.isArray(record.images)||record.images.length>1000)throw Error('For mange bilder.');
   const fresh=record.images.map((im)=>({source_media_id:im.source_media_id??null,source_url:im.source_url??null,local_path:im.local_path??null,
    kind:im.kind==='floorplan'?'floorplan':'photo',license_status:im.license_status==='approved'?'approved':'unverified'}));
   // License approval changes alone must NOT lock entire feed image list.
   const mediaContent=images=>images.map(({license_status,...im})=>im);
   if(!equal(mediaContent(fresh),mediaContent(old.images))){locks.add('images');next.images=fresh;}
   else next.images=fresh;
  }
  if(record.publication_status!==undefined){if(!allowedStatus.has(record.publication_status))throw Error('Ugyldig publiseringsstatus.');next.publication_status=record.publication_status;}
  next.overrides=[...locks];
  if(equal(next,old))return {record:old};
  next.revision++;next.updated_at=new Date().toISOString();doc.records[index]=next;await this.persist(doc,revision);
  return {record:next};
 }
 async status({id,revision,action}){
  const {record}=await this.get({id});
  if(record.revision!==revision)throw Error('Eiendommen ble endret. Last inn på nytt.');
  const next={publish:'published',unpublish:'unpublished',archive:'archived',restore:'draft'}[action];
  if(!next)throw Error('Ukjent publiseringshandling.');
  return this.save({...record,publication_status:next});
 }
}
