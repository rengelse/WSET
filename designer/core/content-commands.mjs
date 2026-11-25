import {editIdentity} from '../engines/cbpm-astro-v1/lib/assistant-identity.mjs';
import {bindRecordImage} from './media-references.mjs';
import {applyMediaWorkspace} from './media-catalog.mjs';
import {safeId,safeAssetPath} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
const clone=structuredClone;
const str=v=>String(v??'');
const specifications={
 categories:{local:['title'],plain:[],bool:['enabled'],relations:[]},
 services:{local:['title','desc','items'],plain:['icon'],bool:['enabled','isVisible','isSample'],relations:['type']},
 projects:{local:['title','place','desc'],plain:[],bool:['enabled','isVisible','isSample','featuredOnHome'],relations:['type']},
 team:{local:['role','description'],plain:['name','phone','email','whatsapp','spokenLanguages'],bool:['enabled','isVisible','isSample'],relations:[]},
 reviews:{local:['head','body','by'],plain:['source'],bool:['enabled','isVisible','isSample','permissionConfirmed'],relations:[]}
};
const localMap=(site,value='')=>Object.fromEntries(site.languages.map(l=>[l.code,l.code===site.defaultLanguage?value:'']));
const requireItem=(site,group,id)=>{
 const item=site[group]?.find(x=>x.id===id);
 if(!item)throw Error(`Fant ikke ${group}/${id}`);
 return item;
};
const checkImage=(site,path)=>{
 if(!safeAssetPath(path))throw Error('Ugyldig bildefil.');
 // Files must be in the project's controlled assets directory. Disk existence is
 // checked by project validation; UI cannot inject remote URLs or executable HTML.
};
function editLocalized(item,field,locale,value,site){
 if(!site.languages.some(l=>l.code===locale))throw Error('Ukjent språk.');
 if(field==='items'){
  const lines=str(value).split('\n').map(x=>x.trim()).slice(0,12);
  const prev=Array.isArray(item.items)?item.items:[];
  const count=Math.max(lines.length,prev.length);
  item.items=Array.from({length:count},(_,i)=>({...((prev[i]&&typeof prev[i]==='object'&&!Array.isArray(prev[i]))?prev[i]:{}),[locale]:(lines[i]||'').slice(0,600)}));
 }else{
  const old=item[field];
  item[field]={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[locale]:str(value).slice(0,10000)};
 }
}
export function applyContentCommand(site,command){
 const s=clone(site);const {action}=command;
 const group=str(command.collection),spec=specifications[group];
 if(action.startsWith('collection:')){
  if(!spec)throw Error('Ukjent innholdstype.');
  s[group]??=[];
  if(action==='collection:add'){
   const id=str(command.id).trim().toLowerCase();
   if(!safeId(id)||s[group].some(x=>x.id===id))throw Error('ID må være unik og bruke små bokstaver/bindestrek.');
   const item={id,enabled:false,order:Math.max(0,...s[group].map(x=>x.order??0))+10};
   for(const key of spec.local)item[key]=localMap(s,key==='title'||key==='head'?str(command.title||id).slice(0,160):'');
   if(group==='services'){Object.assign(item,{type:s.categories[0]?.id||'maintenance',img:'repairs',icon:'wrench',items:[],isSample:true,isVisible:false});}
   if(group==='projects'){Object.assign(item,{type:s.categories[0]?.id||'maintenance',img:'repairs',gallery:[],isSample:false,isVisible:false});}
   if(group==='team'){Object.assign(item,{name:str(command.title||id).slice(0,160),portrait:'',phone:'',email:'',whatsapp:'',spokenLanguages:'',isSample:false,isVisible:false});}
   if(group==='reviews'){Object.assign(item,{isSample:true,isVisible:false,permissionConfirmed:false});}
   s[group].push(item);
  }else if(action==='collection:duplicate'){
   const original=requireItem(s,group,command.id),ids=new Set(s[group].map(x=>x.id));
   let index=1,id;do{id=`${original.id}-copy-${index++}`;}while(ids.has(id));
   const copy=clone(original);copy.id=id;copy.enabled=false;
   if(['services','projects','team','reviews'].includes(group))copy.isVisible=false;
   copy.order=(original.order??0)+1;
   if(group==='team')copy.name=str(copy.name)+' (kopi)';
   else if(group==='reviews')copy.head={...copy.head,[s.defaultLanguage]:str(copy.head?.[s.defaultLanguage]||'Omtale')+' (kopi)'};
   else if(copy.title)copy.title={...copy.title,[s.defaultLanguage]:str(copy.title?.[s.defaultLanguage]||'Innhold')+' (kopi)'};
   if(group==='reviews'&&copy.isSample===false){copy.permissionConfirmed=false;}
   const ordered=[...s[group]].sort((a,b)=>(a.order??0)-(b.order??0));
   const position=ordered.findIndex(x=>x.id===original.id);
   ordered.splice(position+1,0,copy);
   ordered.forEach((x,i)=>x.order=i*10);
   s[group]=ordered;
  }else if(action==='collection:reorder'){
   const ordered=[...s[group]].sort((a,b)=>(a.order??0)-(b.order??0));
   const from=ordered.findIndex(x=>x.id===command.id),to=ordered.findIndex(x=>x.id===command.beforeId);
   if(from<0||to<0)throw Error('Ukjent oppføring.');
   if(from!==to){const [item]=ordered.splice(from,1);const dest=ordered.findIndex(x=>x.id===command.beforeId);ordered.splice(dest,0,item);}
   ordered.forEach((x,i)=>x.order=i*10);s[group]=ordered;
  }else if(action==='collection:publish'){
   const item=requireItem(s,group,command.id);
   if(!['services','projects','team','reviews'].includes(group))throw Error('Publisering av denne innholdstypen er ikke støttet.');
   const visible=command.value===true;
   if(group==='reviews'&&visible&&item.isSample!==true&&!item.permissionConfirmed)
    throw Error('Publisering av ekte omtaler krever bekreftet samtykke.');
   item.enabled=visible;item.isVisible=visible;
  }else if(action==='collection:delete'){
   requireItem(s,group,command.id);
   if(group==='categories'&&s.services.some(x=>x.type===command.id))throw Error('Kategori er i bruk. Flytt tjenestene først.');
   s[group]=s[group].filter(x=>x.id!==command.id);
  }else if(action==='collection:move'){
   const items=[...s[group]].sort((a,b)=>(a.order??0)-(b.order??0));
   const i=items.findIndex(x=>x.id===command.id),j=i+(command.direction===-1?-1:1);
   if(i>=0&&j>=0&&j<items.length)[items[i],items[j]]=[items[j],items[i]];
   items.forEach((item,index)=>item.order=index*10);
  }else if(action==='collection:item-text'){
   const item=requireItem(s,group,command.id),index=command.index;
   if(group!=='services'||!Number.isInteger(index)||index<0||index>=item.items.length||!s.languages.some(l=>l.code===command.locale)||typeof command.value!=='string'||command.value.length>600)throw Error('Ugyldig listepunkt.');
   const old=item.items[index];item.items[index]={...(old&&typeof old==='object'?old:{}),[command.locale]:command.value};
  }else if(action==='collection:update'){
   const item=requireItem(s,group,command.id),field=str(command.field);
   if(spec.local.includes(field))editLocalized(item,field,command.locale,command.value,s);
   else if(spec.bool.includes(field)){
    if(group==='reviews'&&field==='isVisible'&&command.value===true&&item.isSample!==true&&!item.permissionConfirmed)throw Error('Publisering av ekte omtaler krever samtykke.');
    item[field]=Boolean(command.value);
    if(group==='reviews'&&field==='isSample'&&item.isSample===false&&!item.permissionConfirmed)item.isVisible=false;
   }else if(spec.plain.includes(field))item[field]=str(command.value).slice(0,500);
   else if(spec.relations.includes(field)){
    if(!s.categories.some(c=>c.id===command.value))throw Error('Ukjent tjenestekategori.');
    item[field]=command.value;
   }else throw Error('Ukjent eller låst innholdsfelt.');
  }else throw Error('Ukjent samlingskommando.');
  return s;
 }
 if(action==='template:text'){
  const page=s.sitePages.find(x=>x.id===command.pageId);
  const section=page?.sections.find(x=>x.id===command.id);
  if(section?.type!=='template'||!s.languages.some(l=>l.code===command.locale))throw Error('Ugyldig Mal 01-redigering.');
  const original=str(command.original),value=str(command.value);
  if(original.length<3||original.length>2500||value.length>10000)throw Error('Ugyldig tekstlengde.');
  s.templateTexts??={};s.templateTexts[section.source]??={};s.templateTexts[section.source][section.slot]??={};
  s.templateTexts[section.source][section.slot][command.locale]??={};
  s.templateTexts[section.source][section.slot][command.locale][original]=value;
  return s;
 }
 if(['media:category-add','media:category-rename','media:category-remove','media:categorize','media:remove','media:detach'].includes(action))return applyMediaWorkspace(s,command);
 if(action==='media:register'){
  const item=command.media;
  if(!item||!safeId(item.id)||!safeAssetPath(item.src)||!item.original||s.media?.items?.some(x=>x.id===item.id))throw Error('Ugyldig medieregistrering.');
  s.media??={items:[]};s.media.items.push(clone(item));
  s.brand.images??={};s.brand.images[item.id]=item.src;
  return s;
 }
 if(action==='media:slot'){
  const key=str(command.key);checkImage(s,command.src);
  if(!safeId(key))throw Error('Ugyldig bildefelt.');
  s.brand.images??={};s.brand.images[key]=command.src;return s;
 }
 if(action==='media:clear'){
  const {target,field}=command;
  if(target?.kind==='assistant'&&field==='avatar'){editIdentity(s,{field:'avatar',value:''});return s;}
  if(target?.kind==='brand'&&['logoUrl','lightLogoUrl','faviconUrl'].includes(field)){s.brand[field]='';return s;}
  if(target?.kind!=='team'||field!=='portrait')throw Error('Ukjent bilde som skal fjernes.');
  requireItem(s,'team',target.id).portrait='';
  return s;
 }
 if(action==='media:assign'){
  const {target,field,src}=command;checkImage(s,src);
  if(target?.kind==='assistant'&&field==='avatar'){editIdentity(s,{field:'avatar',value:src});return s;}
  const allowed={brand:['logoUrl','lightLogoUrl','faviconUrl'],section:['image'],service:['img'],project:['img','beforeUrl','afterUrl'],team:['portrait']};
  if(!allowed[target?.kind]?.includes(field))throw Error('Ukjent mediefelt.');
  let item;
  if(target.kind==='brand')item=s.brand;
  if(target.kind==='section')item=s.sitePages.find(x=>x.id===target.pageId)?.sections.find(x=>x.id===target.id);
  if(target.kind==='service')item=requireItem(s,'services',target.id);
  if(target.kind==='project')item=requireItem(s,'projects',target.id);
  if(target.kind==='team')item=requireItem(s,'team',target.id);
  if(!item)throw Error('Fant ikke mediemål.');
  if(target.kind==='service'||(target.kind==='project'&&field==='img')){
   bindRecordImage(s,item,src);
  }else item[field]=src;
  return s;
 }
 if(action==='gallery:add'||action==='gallery:remove'||action==='gallery:update'){
  const section=s.sitePages.find(x=>x.id===command.pageId)?.sections.find(x=>x.id===command.id);
  if(section?.type!=='gallery')throw Error('Ikke et galleri.');
  section.images??=[];
  if(action==='gallery:add'){checkImage(s,command.src);section.images.push({src:command.src,alt:{},caption:{}});}
  else if(action==='gallery:remove'&&Number.isInteger(command.index)&&command.index>=0&&command.index<section.images.length)section.images.splice(command.index,1);
  else if(action==='gallery:update'&&Number.isInteger(command.index)&&command.index>=0&&command.index<section.images.length&&['alt','caption'].includes(command.field))
    editLocalized(section.images[command.index],command.field,command.locale,command.value,s);
  else throw Error('Ugyldig galleriindeks.');
  return s;
 }
 if(action==='project:gallery:add'||action==='project:gallery:remove'){
  const project=requireItem(s,'projects',command.id);project.gallery??=[];
  if(action.endsWith(':add')){checkImage(s,command.src);project.gallery.push(command.src);}
  else if(Number.isInteger(command.index)&&command.index>=0&&command.index<project.gallery.length)project.gallery.splice(command.index,1);
  else throw Error('Ugyldig indeks.');
  return s;
 }
 throw Error(`Ukjent innholdskommando: ${action}`);
}
