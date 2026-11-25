import {migrateLegacyLocales,entriesForSite} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
import {propertyModuleIds} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';
import websiteLocaleBasics from './website-locale-basics.json' with {type:'json'};
import websiteFullTexts from './website-locale-full-texts.json' with {type:'json'};
const FEED_LANGUAGES=[
 ['de','Deutsch','🇩🇪'],['da','Dansk','🇩🇰'],['fi','Suomi','🇫🇮'],['fr','Français','🇫🇷'],
 ['nl','Nederlands','🇳🇱'],['pl','Polski','🇵🇱'],['sv','Svenska','🇸🇪'],['ru','Русский','🇷🇺']
];
/** Non-destructive in-memory upgrades. Source revision remains based on the
 * unmodified file bytes; old projects are written only on explicit Save. */
export function migrateProjectForDesigner(site){
 const copy=migrateLegacyLocales(site);
 // One-time optional REDsp roster migration for projects created before v1.2.18.
 // The public website and the listings use exactly the SAME locale codes.
 // Once migrated, removing one of these languages is a permanent user choice.
 if(!copy.redspLanguageRosterInstalled){
  const known=new Set(copy.languages.map(l=>l.code));
  let order=Math.max(0,...copy.languages.map(l=>Number(l.order)||0));
  for(const [code,name,flag] of FEED_LANGUAGES){
   if(!known.has(code)){
    order+=10;copy.languages.push({code,name,short:code.toUpperCase(),subtitle:name,flag,enabled:true,requiresComplete:false,order});
    known.add(code);
   }
   copy.i18n??={version:1,ui:{}};copy.i18n.ui??={};copy.i18n.ui[code]??={};
  }
  copy.redspLanguageRosterInstalled=true;
 }

 // Standard navigation labels and essential site controls for all 11 languages.
 // Only first-time seeds, never overwrite editor choices or business copy.
 // UI language of Web Designer is independent of this website data.
 if(!copy.websiteLocaleBasicsInstalled){
  const builtInNames={home:'Home',services:'Services',rental:'Rentals & care',projects:'Projects',reviews:'Testimonials',about:'About us',contact:'Contact',properties:'Properties'};
  for(const [code,preset] of Object.entries(websiteLocaleBasics)){
   if(!copy.languages.some(l=>l.code===code))continue;
   for(const page of copy.sitePages||[]){
    if(page.title?.en!==builtInNames[page.id])continue;
    if(!Object.hasOwn(page.title,code))page.title[code]=preset.navigation[page.id]||'';
   }
   copy.i18n??={version:1,ui:{}};copy.i18n.ui??={};copy.i18n.ui[code]??={};
   for(const [key,value] of Object.entries(preset.ui))if(!copy.i18n.ui[code][key])copy.i18n.ui[code][key]=value;
  }
  copy.websiteLocaleBasicsInstalled=true;
 }

 // All built-in Mal 01 UI copy and *unchanged sample content* now have
 // human-authored translations in the eight extra REDsp locales. Never replace
 // editor overrides and never translate customized company text implicitly.
 if(!copy.websiteLocaleFullTextsInstalled){
  copy.i18n??={version:1,ui:{}};copy.i18n.ui??={};
  for(const [code,translations] of Object.entries(websiteFullTexts.ui)){
   if(!copy.languages.some(l=>l.code===code))continue;
   copy.i18n.ui[code]??={};
   for(const [key,value] of Object.entries(translations)){
    const source=websiteFullTexts.uiSource[key];
    if(source && copy.i18n.ui.no?.[key]===source.no && copy.i18n.ui.en?.[key]===source.en &&
       !copy.i18n.ui[code][key])copy.i18n.ui[code][key]=value;
   }
  }
  for(const entry of entriesForSite(copy)){
   const source=websiteFullTexts.contentSource[entry.key];
   if(!source)continue;
   const value=entry.index===undefined?entry.object[entry.field]:entry.object[entry.index];
   if(!value||typeof value!=='object'||value.no!==source.no||value.en!==source.en)continue;
   const translated={...value};
   for(const [code,messages] of Object.entries(websiteFullTexts.content)){
    if(!copy.languages.some(l=>l.code===code))continue;
    if(!translated[code]&&messages[entry.key])translated[code]=messages[entry.key];
   }
   if(entry.index===undefined)entry.object[entry.field]=translated;
   else entry.object[entry.index]=translated;
  }
  copy.websiteLocaleFullTextsInstalled=true;
 }

 const used=new Set();
 (copy.reviews||[]).forEach((review,i)=>{
  let id=review.id;
  if(typeof id!=='string'||!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)||used.has(id)){
   let n=i+1;while(used.has(`review-${n}`))n++;
   id=`review-${n}`;
  }
  review.id=id;used.add(id);
 });
 copy.team??=[];
 copy.media??={items:[]};
 copy.templateTexts??={};
 copy.propertyModules??={};
 // Preserve the old parent default for projects that predate the page, before normalizing categories.
 const legacyPropertyPageEnabled=propertyModuleIds.some(id=>copy.propertyModules[id]?.enabled===true);
 for(const id of propertyModuleIds){
  const module=copy.propertyModules[id]??={showInNavigation:true,labels:{}};
  if(module.visibilityExplicit!==true)module.enabled=true;
 }
 if(!copy.sitePages.some(p=>p.id==='properties')){
  const enabled=legacyPropertyPageEnabled;
  copy.sitePages.push({id:'properties',slug:'eiendommer',enabled,showInNavigation:true,order:Math.max(0,...copy.sitePages.map(p=>p.order??0))+10,title:{no:'Eiendommer',en:'Properties',es:'Inmuebles'},sections:[]});
 }
 return copy;
}
