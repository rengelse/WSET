import {globalTranslationEntries} from './global-content.mjs';
import defaultUiCatalog from './default-ui-catalog.json' with {type:'json'};
/** CBPM locale packs and translation registry. Pure functions; no external CMS.
 * The website is one page/section graph. Only text varies by locale.
 */
export const LANGUAGE_PACK_FORMAT='cbpm-language-v1';
export const LEGACY_LOCALES=['no','en','es']; // migration only; no runtime language limit
const idPattern=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const safeText=v=>typeof v==='string'&&v.length<=10000&&!/<[^>]*>/.test(v.replace(/<\/?em>/gi,'').replace(/<br\s*\/?>/gi,''));
const messageObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const codeOkay=s=>typeof s==='string'&&idPattern.test(s);
export const localeValid=codeOkay;
export function translate(value,locale,defaultLocale='no'){
 if(typeof value==='string')return value;
 if(!messageObject(value))return '';
 return value[locale]??value[defaultLocale]??'';
}
/** Migrate old [no,en,es] content once; leave already migrated projects alone. */
export function migrateLegacyLocales(project){
 const site=structuredClone(project);
 const asObject=(obj,field)=>{
  if(Array.isArray(obj?.[field]))obj[field]=Object.fromEntries(LEGACY_LOCALES.map((code,i)=>[code,obj[field][i]??'']));
 };
 for(const s of site.services||[]){asObject(s,'title');asObject(s,'desc');s.items=(s.items||[]).map(row=>Array.isArray(row)?Object.fromEntries(LEGACY_LOCALES.map((code,i)=>[code,row[i]??''])):row);}
 for(const p of site.projects||[])for(const field of ['title','place','desc'])asObject(p,field);
 for(const r of site.reviews||[])for(const field of ['head','body','by'])asObject(r,field);
 site.i18n??={version:1,ui:{}};
 site.i18n.ui??={};
 // Extend old project data in-memory; do not activate or invent an AI connection.
 site.smartAssistant??={enabled:false,displayName:'Smart Assistant'};
 site.smartAssistant.showLauncher=true;
 site.smartAssistant.publicReady=site.smartAssistant.enabled===true;
 site.smartAssistant.endpoint='/api/assistant/api.php';
 // Add newly bundled UI keys to older projects without overwriting editor changes.
 for(const [code,defaults] of Object.entries(defaultUiCatalog))
  site.i18n.ui[code]={...defaults,...(site.i18n.ui[code]||{})};
 return site;
}
/** Translator-facing flat keys, stable across pages and records (uses IDs, never array positions except list entries). */
export function entriesForSite(site){
 const entries=[];
 function field(key,obj,name,active=true){
  if(!messageObject(obj?.[name]))return;
  entries.push({key,object:obj,field:name,active});
 }
 for(const p of site.sitePages||[]){
  const enabled=p.enabled!==false;
  for(const name of ['title','seoTitle','seoDescription'])field(`pages.${p.id}.${name}`,p,name,enabled);
  for(const s of p.sections||[]){
   for(const name of ['title','text','kicker','buttonText','imageAlt'])field(`sections.${p.id}.${s.id}.${name}`,s,name,enabled&&s.enabled!==false);
   for(const [i,img] of (s.images||[]).entries())for(const name of ['alt','caption'])field(`sections.${p.id}.${s.id}.images.${i}.${name}`,img,name,enabled&&s.enabled!==false);
  }
 }
 for(const [id,page] of Object.entries(site.pages||{}))for(const name of ['heroTitle','heroIntro'])field(`pageContent.${id}.${name}`,page,name,(site.sitePages||[]).some(p=>p.id===id&&p.enabled!==false));
 for(const c of site.categories||[])field(`categories.${c.id}.title`,c,'title',c.enabled!==false);
 for(const s of site.services||[]){const enabled=s.enabled!==false&&s.isVisible!==false&&(site.categories||[]).some(c=>c.id===s.type&&c.enabled!==false);
  for(const name of ['title','desc'])field(`services.${s.id}.${name}`,s,name,enabled);
  for(const [i,row] of (s.items||[]).entries()){if(messageObject(row))entries.push({key:`services.${s.id}.items.${i}`,object:s.items,index:i,active:enabled});}
 }
 for(const p of site.projects||[])for(const name of ['title','place','desc'])field(`projects.${p.id}.${name}`,p,name,p.enabled!==false&&p.isVisible!==false);
 for(const r of site.reviews||[])for(const name of ['head','body','by'])field(`reviews.${r.id}.${name}`,r,name,r.enabled!==false&&r.isVisible!==false);
 for(const p of site.team||[])for(const name of ['role','description'])field(`team.${p.id}.${name}`,p,name,p.enabled!==false&&p.isVisible!==false);
 const identity=site.smartAssistant?.identity;
 if(identity?.schema==='wset-assistant-identity-v1')for(const name of ['subtitle','welcome'])field(`assistant.${name}`,identity,name,site.smartAssistant.enabled===true);
 entries.push(...globalTranslationEntries(site));
 return entries;
}
function getEntry(entry){return entry.index===undefined?entry.object[entry.field]:entry.object[entry.index];}
function setEntry(entry,value){if(entry.index===undefined)entry.object[entry.field]=value;else entry.object[entry.index]=value;}
export function languageEntries(site,locale,sourceLocale=site.defaultLanguage||'no'){
 const ui=site.i18n?.ui||{};
 const result=[];
 const allUi=new Set(Object.keys(ui[sourceLocale]||{}));
 for(const key of allUi)result.push({key,source:ui[sourceLocale]?.[key]??'',value:ui[locale]?.[key]??'',active:true,kind:'ui'});
 for(const entry of entriesForSite(site)){
  const translations=getEntry(entry);
  result.push({key:`content.${entry.key}`,source:translations?.[sourceLocale]??'',value:translations?.[locale]??'',active:entry.active,kind:'content'});
 }
 return result;
}
export function languageReport(site,locale){
 const sourceLocale=site.defaultLanguage||'no';
 const entries=languageEntries(site,locale,sourceLocale);
 const required=entries.filter(e=>e.active&&e.source.trim()!=='');
 const missing=required.filter(e=>e.value.trim()==='').map(e=>e.key);
 return {locale,total:required.length,translated:required.length-missing.length,missing,complete:!missing.length};
}
export function createLanguagePack(site,locale){
 if(!(site.languages||[]).some(l=>l.code===locale))throw Error('Språket finnes ikke i prosjektet.');
 const meta=site.languages.find(l=>l.code===locale);
 const entries=languageEntries(site,locale);
 const messages=Object.fromEntries(entries.map(e=>[e.key,e.value]));
 const reference=Object.fromEntries(entries.map(e=>[e.key,e.source]));
 return {format:LANGUAGE_PACK_FORMAT,locale,sourceLocale:site.defaultLanguage,name:meta.name,reference,messages};
}
export function inspectLanguagePack(site,pack){
 const errors=[];
 if(!messageObject(pack)||pack.format!==LANGUAGE_PACK_FORMAT)errors.push('Feil filformat. Forventet cbpm-language-v1.');
 if(!codeOkay(pack?.locale))errors.push('Ugyldig språkkode.');
 if(!messageObject(pack?.messages))errors.push('Språkfilen mangler messages-objektet.');
 if(!messageObject(pack?.reference))errors.push('Språkfilen mangler reference-objektet.');
 const current=(site.languages||[]).some(l=>l.code===pack?.locale);
 if(!current)errors.push(`Språket ${String(pack?.locale||'')} er ikke opprettet. Opprett språket først.`);
 if(errors.length)return {ok:false,errors,added:0,changed:0,ignored:0,empty:0};
 const entries=languageEntries(site,pack.locale);
 const known=new Map(entries.map(e=>[e.key,e]));
 let changed=0,added=0,ignored=0,empty=0;
 for(const [key,value] of Object.entries(pack.messages)){
  if(!known.has(key)){ignored++;continue;}
  if(typeof value!=='string'||!safeText(value)){errors.push(`Ugyldig tekst i ${key}`);continue;}
  if(key.startsWith('content.global.')&&(/<[^>]*>/.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))){errors.push(`Ugyldig global tekst i ${key}`);continue;}
  if(key.startsWith('content.assistant.')&&(value.length>(key.endsWith('.subtitle')?100:500)||/[<>\u0000-\u001f\u007f]/.test(value))){errors.push(`Ugyldig assistenttekst i ${key}`);continue;}
  if(!value.trim()){empty++;continue;}
  const prev=known.get(key).value;
  if(prev!==value){changed++;if(!prev)added++;}
 }
 return {ok:errors.length===0,errors,locale:pack.locale,changed,added,ignored,empty,total:entries.length};
}
/** Never let arbitrary JSON paths from a language file mutate site structure. */
export function applyLanguagePack(site,pack){
 const inspection=inspectLanguagePack(site,pack);
 if(!inspection.ok)throw Error(inspection.errors.join('\n'));
 const next=structuredClone(site);
 const locale=pack.locale;
 const entries=new Map(entriesForSite(next).map(e=>[`content.${e.key}`,e]));
 next.i18n??={version:1,ui:{}};next.i18n.ui??={};next.i18n.ui[locale]??={};
 for(const [key,value] of Object.entries(pack.messages)){
  if(typeof value!=='string'||!value.trim())continue; // Partial imports cannot erase existing translations.
  if(key.startsWith('ui.')){
   if(Object.hasOwn(next.i18n.ui[next.defaultLanguage]||{},key))next.i18n.ui[locale][key]=value;
  }else if(entries.has(key)){
   const entry=entries.get(key),record=getEntry(entry);
   setEntry(entry,{...record,[locale]:value});
  }
 }
 return next;
}

/** Single-field editing, including clearing a translation (unlike additive file import). */
export function updateTranslation(site,locale,key,value){
 const inspect={format:LANGUAGE_PACK_FORMAT,locale,messages:{[key]:value},reference:{}};
 const report=inspectLanguagePack(site,inspect);
 if(!report.ok)throw Error(report.errors.join('\n'));
 const next=structuredClone(site);
 if(key.startsWith('ui.'))next.i18n.ui[locale][key]=value;
 else {
  const item=entriesForSite(next).find(e=>`content.${e.key}`===key);
  if(!item)throw Error('Ukjent oversettelsesnøkkel.');
  const old=getEntry(item);setEntry(item,{...old,[locale]:value});
 }
 return next;
}
