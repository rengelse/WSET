import {normalizeMarking,setMarking,ownSource} from './property-markings.mjs';
import {randomUUID} from 'node:crypto';
import {validateOwnListing} from './property-owned-feed.mjs';
import {draftImageName} from './property-draft-images.mjs';

// Local authoring state only. Published property data remains in Kyero XML.
const fields={type:80,town:120,province:120,country:120,location_detail:200,price:24,currency:3,price_freq:8,beds:12,baths:12,built:24,plot:24,latitude:32,longitude:32,consumption:10,emissions:10};
const numeric=new Set(['price','beds','baths','built','plot','latitude','longitude']);
const plain=(v,max)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)||/<\s*\/?\s*[a-z]/i.test(v))throw Error('Ugyldig tekst i boligkladd.');return v.trim();};
export function normalizePropertyDraft(input,languages){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ugyldig boligkladd.');
 const result={};
 for(const [key,max] of Object.entries(fields)){
  const v=plain(input[key]??'',max);
  if(numeric.has(key)&&v!==''){
   const n=Number(v);if(!/^-?\d+(?:\.\d+)?$/.test(v)||!Number.isFinite(n)|| (key==='latitude'?Math.abs(n)>90:key==='longitude'?Math.abs(n)>180:n<0)||(['beds','baths'].includes(key)&&!Number.isInteger(n)))throw Error('Ugyldig tall i '+key+'.');
  }
  result[key]=v;
 }
 if(result.currency&&!/^[A-Z]{3}$/.test(result.currency))throw Error('Ugyldig valuta.');
 if(result.price_freq&&!['sale','rent'].includes(result.price_freq))throw Error('Ugyldig pristype.');
 result.pool=input.pool===true;
 if(input.marking!==undefined)result.marking=normalizeMarking(input.marking);
 if(input.photos!==undefined){
  if(!Array.isArray(input.photos)||input.photos.length>250)throw Error('For mange boligbilder.');
  const seen=new Set();result.photos=input.photos.map(p=>{if(!p||typeof p.file!=='string'||!draftImageName.test(p.file)||seen.has(p.file)||!['photo','floorplan'].includes(p.role)||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>1920||p.height>1920)throw Error('Ugyldig boligbilde.');seen.add(p.file);return {file:p.file,name:plain(p.name??'',200),width:p.width,height:p.height,role:p.role};});
 }

 result.features=plain(input.features??'',6000);
 if(languages?.some(l=>l.code===input.descSource))result.descSource=input.descSource;
 result.desc={};for(const lang of languages||[]){const code=lang.code;if(typeof code==='string'&&/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code)&&Object.hasOwn(input.desc||{},code))result.desc[code]=plain(input.desc[code],6000);}
 if(input.descTranslation&&typeof input.descTranslation==='object'){result.descTranslation={};for(const l of languages||[]){const m=input.descTranslation[l.code];if(m&&languages.some(x=>x.code===m.source)&&/^[a-f0-9]{16}$/.test(m.sourceHash)&&/^[a-f0-9]{16}$/.test(m.targetHash)&&['manual','automatic'].includes(m.kind))result.descTranslation[l.code]={source:m.source,sourceHash:m.sourceHash,targetHash:m.targetHash,kind:m.kind};}}
 return result;
}
export function applyPropertyDraftCommand(source,command){
 const site=structuredClone(source);const drafts=site.propertyDrafts??={version:1,items:[]};
 if(drafts.version!==1||!Array.isArray(drafts.items))throw Error('Ustøttet kladdformat.');
 if(command.action==='property-draft:prepare'){
  const saved=applyPropertyDraftCommand(site,{...command,action:'property-draft:save'});const record=command.id?saved.propertyDrafts.items.find(r=>r.id===command.id):saved.propertyDrafts.items.at(-1);
  record.publication={data:validateOwnListing(record.data,saved),updatedAt:new Date().toISOString()};saved.propertyDrafts.publicationManaged=true;if(record.data.marking!==undefined)setMarking(saved,ownSource,record.id,record.data.marking);return saved;
 }else if(command.action==='property-draft:withdraw'){
  const record=drafts.items.find(r=>r.id===command.id);if(!record?.publication)throw Error('Annonsen er ikke klargjort.');delete record.publication;drafts.publicationManaged=true;
 }else if(command.action==='property-draft:save'){
  const data=normalizePropertyDraft(command.data,site.languages);
  if(command.id){const record=drafts.items.find(x=>x.id===command.id);if(!record)throw Error('Fant ikke boligkladden.');data.desc={...record.data.desc,...data.desc};if(data.photos===undefined&&record.data.photos)data.photos=record.data.photos;record.data=data;record.updatedAt=new Date().toISOString();}
  else{let id,reference;do{id='wset-'+randomUUID();reference='WSET-'+id.slice(5).replaceAll('-','').slice(0,16).toUpperCase();}while(drafts.items.some(x=>x.id===id||x.reference===reference));drafts.items.push({id,reference,data,updatedAt:new Date().toISOString()});}
 }else if(command.action==='property-draft:delete'){
  const record=drafts.items.find(x=>x.id===command.id);if(!record)throw Error('Fant ikke boligkladden.');if(record.publication)throw Error('Trekk tilbake annonsen før sletting.');drafts.items=drafts.items.filter(x=>x.id!==command.id);
 }else throw Error('Ukjent kladdkommando.');
 return site;
}
