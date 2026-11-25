import {editGlobalContent} from '../engines/cbpm-astro-v1/lib/global-content.mjs';
import {editIdentity} from '../engines/cbpm-astro-v1/lib/assistant-identity.mjs';
import {recordManualWebsite} from './translation-status.mjs';
import {applyTranslationBatch} from './translation-content.mjs';
import {applyMarkingCommand} from './property-markings.mjs';
import {applyPropertyDraftCommand} from './property-drafts.mjs';
import {applyDesignCommand} from './design-styles.mjs';
import {applyOccurrenceCommand} from './universal-text.mjs';
import {resolveInlineEdit} from './inline-editing.mjs';
import {safeId,sectionTypes} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {applyContentCommand} from './content-commands.mjs';
import {localeValid,languageReport,applyLanguagePack,updateTranslation} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
import {propertyModuleSettings,propertyModuleIds} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';

const clone=structuredClone;
const str=v=>typeof v==='string'?v:String(v??'');
const titleFor=(value,langs,defaultLocale)=>Object.fromEntries(langs.map(l=>[l.code,l.code===defaultLocale?value:'']));
const requirePage=(site,id)=>{
 const page=site.sitePages.find(p=>p.id===id);
 if(!page)throw Error(`Fant ikke side: ${id}`);
 return page;
};
const requireSection=(page,id)=>{
 const section=page.sections.find(s=>s.id===id);
 if(!section)throw Error(`Fant ikke seksjon: ${id}`);
 return section;
};
const uniqueId=(prefix,used)=>{
 let suffix=1;
 while(used.has(`${prefix}-${suffix}`))suffix++;
 return `${prefix}-${suffix}`;
};
function move(list,index,direction){
 const next=index+direction;
 if(index<0||next<0||next>=list.length)return;
 [list[index],list[next]]=[list[next],list[index]];
}
const localizedFields=new Set(['title','seoTitle','seoDescription']);
const sectionLocalizedFields=new Set(['title','text','kicker','buttonText','imageAlt']);
const pageFields=new Set(['slug','enabled','showInNavigation']);
const brandFields=new Set(['shortName','displayName','legalName','logoSubtitle','area','phone','email','whatsapp','logoMode','registrationNumber','streetAddress','postalCode','city','country']);
const sectionFields=new Set(['enabled','image','imageRight','target']);

export const sectionOptions=[
 {value:'hero',label:'Hovedbilde'},
 {value:'text',label:'Tekstseksjon'},
 {value:'imageText',label:'Bilde og tekst'},
 {value:'gallery',label:'Bildegalleri'},
 {value:'cta',label:'Kontaktoppfordring'},
 {value:'services',label:'Tjenester'},
 {value:'projects',label:'Prosjekter'},
 {value:'reviews',label:'Kundeomtaler'},
 {value:'team',label:'Ansatte'}
];

/** Pure, explicit editing contract. No arbitrary property paths, code or layout editing. */
export function applyEditorCommand(source,command){
 if(!source||typeof command!=='object'||!command)throw Error('Ugyldig redigeringskommando.');
 if(command.action==='language:auto-translate')return {site:applyTranslationBatch(source,command),selection:null};
 if(command.action==='property-marking:set')return {site:applyMarkingCommand(source,command),selection:null};
 if(['property-draft:save','property-draft:delete','property-draft:prepare','property-draft:withdraw'].includes(command.action))return {site:applyPropertyDraftCommand(source,command),selection:null};
 if(command.action==='design:update')return {site:applyDesignCommand(source,command),selection:null};
 if(command.action==='inline:text'){const resolved=resolveInlineEdit(source,command);return resolved.action==='inline:occurrence'?{site:applyOccurrenceCommand(source,resolved),selection:null}:applyEditorCommand(source,resolved);}
 const site=clone(source);
 const {action}=command;
 if(action==='global-content:update'){editGlobalContent(site,command);if(command.locale)return {site:recordManualWebsite(site,command.locale,`content.global.${command.section==='legal'?command.id:command.section}.${command.field}`,command.value),selection:null};return {site,selection:null};}
 if(action==='language:import')return {site:applyLanguagePack(site,command.pack),selection:null};
 if(action==='language:translate')return {site:recordManualWebsite(updateTranslation(site,str(command.locale),str(command.key),str(command.value)),str(command.locale),str(command.key),str(command.value)),selection:null};
 if(action.startsWith('collection:')||action.startsWith('media:')||action.startsWith('gallery:')||action.startsWith('project:gallery:')||action==='template:text')
  return {site:applyContentCommand(site,command),selection:null};
 switch(action){
 case 'language:add':{
  const code=str(command.code).trim().toLowerCase();
  if(!localeValid(code)||site.languages.some(l=>l.code===code))throw Error('Språkkoden er ugyldig eller finnes allerede.');
  const name=str(command.name).trim();if(!name||name.length>70)throw Error('Angi språknavn.');
  site.languages.push({code,name,short:code.toUpperCase().slice(0,8),subtitle:name,flag:str(command.flag||'🌐').slice(0,12),enabled:false,requiresComplete:true,order:Math.max(0,...site.languages.map(l=>l.order??0))+10});
  site.i18n??={version:1,ui:{}};site.i18n.ui[code]={};
  break;
 }
 case 'language:remove':{
  const code=str(command.code);
  if(code===site.defaultLanguage)throw Error('Standardspråket kan ikke fjernes.');
  if(!site.languages.some(l=>l.code===code))throw Error('Fant ikke språket.');
  site.languages=site.languages.filter(l=>l.code!==code);
  delete site.i18n?.ui?.[code]; // Other content is retained for reversible language recovery.
  break;
 }
 case 'language:update':{
  const code=str(command.code),record=site.languages.find(l=>l.code===code);
  if(!record)throw Error('Ukjent språk.');
  if(command.field==='enabled'){
   if(code===site.defaultLanguage&&command.value===false)throw Error('Standardspråket må være aktivt.');
   if(command.value===true&&record.requiresComplete!==false){const check=languageReport(site,code);if(!check.complete)throw Error(`Språket mangler ${check.missing.length} oversettelser. Importer eller fyll inn før aktivering.`);}
   record.enabled=Boolean(command.value);
  }else if(['name','subtitle','flag','short'].includes(command.field)){
   record[command.field]=str(command.value).trim().slice(0,80);
  }else throw Error('Ukjent språkfelt.');
  break;
 }
 case 'language:settings':{
  const record=site.languages.find(l=>l.code===str(command.code));
  if(!record)throw Error('Ukjent språk.');
  const name=str(command.name).trim();if(!name||name.length>70)throw Error('Angi språknavn.');
  record.name=name;record.subtitle=str(command.subtitle).trim().slice(0,80);record.flag=str(command.flag).trim().slice(0,80);break;
 }
 case 'language:reorder':{
  const ordered=[...site.languages].sort((a,b)=>(a.order??0)-(b.order??0));
  const from=ordered.findIndex(l=>l.code===command.code),to=ordered.findIndex(l=>l.code===command.target);
  if(from<0||to<0)throw Error('Ukjent språk.');if(from===to)break;
  const [item]=ordered.splice(from,1);const at=ordered.findIndex(l=>l.code===command.target);ordered.splice(at+(command.after===true?1:0),0,item);ordered.forEach((l,i)=>l.order=i*10);break;
 }
 case 'language:move':{
  const ordered=[...site.languages].sort((a,b)=>(a.order??0)-(b.order??0));
  move(ordered,ordered.findIndex(l=>l.code===command.code),command.direction===-1?-1:1);
  ordered.forEach((l,i)=>l.order=i*10);break;
 }
 case 'property-module:update':{
  const id=str(command.id);
  if(!propertyModuleIds.includes(id))throw Error('Ukjent eiendomsmodul.');
  const field=str(command.field);
  site.propertyModules??={};
  const item=site.propertyModules[id]??={...propertyModuleSettings(site,id)};
  if(field==='enabled'||field==='showInNavigation'){
    if(typeof command.value!=='boolean')throw Error('Modulvalg må være sann eller usann.');
    item[field]=command.value;
    if(field==='enabled')item.visibilityExplicit=true;
  }else if(field==='label'){
    const lang=str(command.locale);
    if(!site.languages.some(l=>l.code===lang))throw Error('Ukjent språk.');
    const label=str(command.value).trim();
    if(label.length>90||/[<>]/.test(label))throw Error('Ugyldig modulnavn.');
    item.labels??={};
    if(label)item.labels[lang]=label;else delete item.labels[lang];
  }else throw Error('Ukjent modulinnstilling.');
  break;
 }
 case 'contact:update':{
  if(!['mode','privacyUrl'].includes(command.field))throw Error('Ukjent skjemafelt.');
  site.contactForm??={mode:'demo',privacyUrl:''};
  const value=str(command.value).trim();
  if(command.field==='mode'){
    if(!['demo','smtp'].includes(value))throw Error('Ugyldig skjemamodus.');
    site.contactForm.mode=value;
  } else {
    if(value && !((/^https:\/\/[^\s<>"]+$/i).test(value)||(/^\/[a-zA-Z0-9/_-]+\/$/).test(value)))throw Error('Bruk en HTTPS- eller intern nettsideadresse.');
    site.contactForm.privacyUrl=value.slice(0,500);
  }
  break;
 }
 case 'assistant:identity':{editIdentity(site,command);break;}
 case 'assistant:update':{
  const field=str(command.field);
  if(!['enabled','displayName'].includes(field))throw Error('Ukjent assistentinnstilling. Kun AV/PÅ og navn er tilgjengelig.');
  site.smartAssistant??={enabled:false,displayName:'Smart Assistant'};
  if(field==='enabled'){
   if(typeof command.value!=='boolean')throw Error('Assistentvalg må være boolsk.');
   site.smartAssistant.enabled=command.value;
  }else{
   const name=str(command.value).trim();
   if(!name||name.length>70||/[<>]/.test(name))throw Error('Ugyldig assistentnavn.');
   site.smartAssistant.displayName=name;
  }
  // Internal deployment details are no longer user-facing settings.
  site.smartAssistant.showLauncher=true;
  site.smartAssistant.publicReady=site.smartAssistant.enabled;
  site.smartAssistant.endpoint='/api/assistant/api.php';
  break;
 }
 case 'brand:update':{
  if(!brandFields.has(command.field))throw Error('Ukjent bedriftsfelt.');
  if(command.field==='logoMode'&&!['symbol-text','logo-only','text-only'].includes(command.value))throw Error('Ugyldig logovisning.');
  site.brand[command.field]=str(command.value).slice(0,500);
  break;
 }
 case 'page:add':{
  const slug=str(command.slug).trim().toLowerCase();
  if(!safeId(slug)||['home','eiendommer','nybygg'].includes(slug)||slug.startsWith('project-'))throw Error('Ugyldig sideadresse. Bruk små bokstaver og bindestrek.');
  if(site.sitePages.some(p=>p.slug===slug))throw Error('Denne sideadressen finnes allerede.');
  const id=uniqueId('side',new Set(site.sitePages.map(p=>p.id)));
  const label=str(command.title||'Ny side').trim()||'Ny side';
  const title=titleFor(label,site.languages,site.defaultLanguage);
  // The site template owns its blank-page design. Never invent a hero or copy another page.
  const blank=site.pageTemplate?.blank;
  if(!blank||blank.available!==true||typeof blank.layoutId!=='string'||!safeId(blank.layoutId))
   throw Error('Aktiv nettsidemal mangler en kompatibel tom sidemal. Ny side kan ikke opprettes før malen støtter dette.');
  site.sitePages.push({id,slug,title,order:Math.max(0,...site.sitePages.map(p=>p.order??0))+10,
   enabled:false,showInNavigation:false,layoutId:blank.layoutId,sections:[]});
  return {site,selection:{pageId:id,sectionId:null}};
 }
 case 'page:delete':{
  if(command.id==='home')throw Error('Forsiden kan ikke slettes.');
  if(command.id==='properties')throw Error('Eiendommer-siden kan ikke slettes. Bruk Vis/skjul i stedet.');
  requirePage(site,command.id);
  site.sitePages=site.sitePages.filter(p=>p.id!==command.id);
  if(site.wsetDesign?.sections)delete site.wsetDesign.sections[command.id];
  return {site,selection:{pageId:'home',sectionId:null}};
 }
 case 'page:update':{
  const page=requirePage(site,command.id);
  if(pageFields.has(command.field)){
   if(command.field==='slug'){
    const slug=str(command.value).trim().toLowerCase();
    if(['home','properties'].includes(page.id)||['home','eiendommer','nybygg'].includes(slug)||slug.startsWith('project-')||!safeId(slug))throw Error('Ugyldig sideadresse.');
    if(site.sitePages.some(p=>p.id!==page.id&&p.slug===slug))throw Error('Sideadressen er allerede i bruk.');
    page.slug=slug;
   }else{
    if(page.id==='home'&&command.field==='enabled'&&command.value===false)throw Error('Forsiden må være aktiv.');
    page[command.field]=Boolean(command.value);
    if(page.id==='properties'&&command.field==='enabled')page.visibilityExplicit=true;
   }
  }else if(localizedFields.has(command.field)){
   if(!site.languages.some(l=>l.code===command.locale))throw Error('Ukjent språk.');
   page[command.field]??={};
   page[command.field][command.locale]=str(command.value).slice(0,2000);
   if(['seoTitle','seoDescription'].includes(command.field))recordManualWebsite(site,command.locale,`content.pages.${page.id}.${command.field}`,page[command.field][command.locale]);
  }else throw Error('Dette sidefeltet kan ikke redigeres.');
  break;
 }
 case 'page:reorder':{
  const ordered=[...site.sitePages].sort((a,b)=>(a.order??0)-(b.order??0));
  if(command.id==='home'||command.beforeId==='home')throw Error('Forsiden skal alltid ligge først.');
  if(Boolean(command.beforeId)===Boolean(command.afterId))throw Error('Velg én plassering for siden.');
  const source=ordered.findIndex(p=>p.id===command.id);
  const target=ordered.findIndex(p=>p.id===(command.beforeId||command.afterId));
  if(source<0||target<0)throw Error('Fant ikke siden som skal flyttes.');
  const [moving]=ordered.splice(source,1);
  const index=ordered.findIndex(p=>p.id===(command.beforeId||command.afterId));
  ordered.splice(index+(command.afterId?1:0),0,moving);
  ordered.forEach((p,i)=>p.order=i*10);
  break;
 }
 case 'page:move':{
  const ordered=[...site.sitePages].sort((a,b)=>(a.order??0)-(b.order??0));
  if(command.id==='home')break;
  const pos=ordered.findIndex(p=>p.id===command.id);
  if(pos<0)throw Error('Fant ikke siden.');
  if(pos+(command.direction===-1?-1:1)>0)move(ordered,pos,command.direction===-1?-1:1);
  ordered.forEach((p,i)=>p.order=i*10);
  break;
 }
 case 'section:add':{
  const page=requirePage(site,command.pageId);
  const type=str(command.type);
  if(!sectionTypes.includes(type)||type==='template')throw Error('Ugyldig ny seksjonstype.');
  const id=uniqueId(type.toLowerCase(),new Set(page.sections.map(s=>s.id)));
  const title=titleFor('Ny seksjon',site.languages,site.defaultLanguage);
  const section={id,type,enabled:true,title,text:titleFor('',site.languages,site.defaultLanguage)};
  if(type==='hero')section.image='/assets/hero.webp';
  if(type==='imageText')section.image='/assets/hero-square.webp';
  if(type==='gallery')section.images=[];
  if(type==='cta')section.target='contact';
  page.sections.push(section);
  return {site,selection:{pageId:page.id,sectionId:id}};
 }
 case 'section:delete':{
  const page=requirePage(site,command.pageId);
  requireSection(page,command.id);
  page.sections=page.sections.filter(s=>s.id!==command.id);
  if(site.wsetDesign?.sections?.[page.id])delete site.wsetDesign.sections[page.id][command.id];
  return {site,selection:{pageId:page.id,sectionId:null}};
 }
 case 'section:duplicate':{
  const page=requirePage(site,command.pageId),original=requireSection(page,command.id);
  if(original.type==='template')throw Error('Mal 01-seksjoner kan ikke dupliseres. Legg til en ny innholdsseksjon i stedet.');
  const id=uniqueId(original.id+'-copy',new Set(page.sections.map(s=>s.id)));
  const copy=clone(original);copy.id=id;copy.enabled=false;
  const i=page.sections.findIndex(s=>s.id===original.id);
  page.sections.splice(i+1,0,copy);
  if(site.wsetDesign?.sections?.[page.id]?.[original.id])site.wsetDesign.sections[page.id][id]=clone(site.wsetDesign.sections[page.id][original.id]);
  return {site,selection:{pageId:page.id,sectionId:id}};
 }
 case 'section:reorder':{
  const page=requirePage(site,command.pageId),from=page.sections.findIndex(s=>s.id===command.id),to=page.sections.findIndex(s=>s.id===command.beforeId);
  if(from<0||to<0)throw Error('Ukjent seksjon.');
  if(from!==to){const [item]=page.sections.splice(from,1);const target=page.sections.findIndex(s=>s.id===command.beforeId);page.sections.splice(target,0,item);}
  break;
 }
 case 'section:move':{
  const page=requirePage(site,command.pageId);
  move(page.sections,page.sections.findIndex(s=>s.id===command.id),command.direction===-1?-1:1);
  break;
 }
 case 'section:update':{
  const page=requirePage(site,command.pageId),section=requireSection(page,command.id);
  if(sectionFields.has(command.field)){
   if(command.field==='enabled'||command.field==='imageRight')section[command.field]=Boolean(command.value);
   else section[command.field]=str(command.value);
  }else if(sectionLocalizedFields.has(command.field)){
   if(section.type==='template')throw Error('Mal 01-seksjonen har låst layout.');
   if(!site.languages.some(l=>l.code===command.locale))throw Error('Ukjent språk.');
   section[command.field]??={};
   section[command.field][command.locale]=str(command.value).slice(0,10000);
  }else throw Error('Dette seksjonsfeltet kan ikke redigeres.');
  break;
 }
 case 'content:update':{
  // Only editable template copy currently present in the v1.1.0 data model.
  if(command.pageId!=='home'||!['heroTitle','heroIntro'].includes(command.field))throw Error('Ukjent maltekst.');
  if(!site.languages.some(l=>l.code===command.locale))throw Error('Ukjent språk.');
  site.pages.home[command.field][command.locale]=str(command.value).slice(0,10000);
  break;
 }
 default:throw Error(`Ukjent operasjon: ${action}`);
 }
 return {site,selection:null};
}
