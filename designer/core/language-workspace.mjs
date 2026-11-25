import {websiteTranslationStatus} from './translation-status.mjs';
import {languageEntries,languageReport} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
import {renderDynamicSite,activeRenderer} from './renderer-runtime.mjs';
// Derive page associations from the trusted renderer, not from translated words.
// The temporary marker project is never stored or published. JSON contract stays unchanged.
const cache=new WeakMap();
export function templateLanguagePages(site){
 const renderer=activeRenderer(),cached=cache.get(site);
 if(cached?.renderer===renderer)return cached.index;
 const clone=structuredClone(site),locale=clone.defaultLanguage||'no',keys=Object.keys(clone.i18n?.ui?.[locale]||{}),index=new Map(keys.map(k=>[k,[]]));
 if(keys.length){
  clone.i18n.ui[locale]=Object.fromEntries(keys.map((k,i)=>[k,`WSETLANGKEY${i}END`]));
  for(const p of clone.sitePages||[]){p.enabled=true;for(const s of p.sections||[])s.enabled=true;}
  for(const p of clone.sitePages||[]){
   if(p.id==='properties')continue; // PHP listing uses a separate runtime.
   try{const rendered=renderDynamicSite({site:clone,locale,page:p.id});const text=[rendered.html,rendered.title,rendered.description].join(' ');for(const i of new Set([...text.matchAll(/WSETLANGKEY(\d+)END/g)].map(m=>Number(m[1])))){if(keys[i])index.get(keys[i]).push(p.id);}}catch{/* Unmapped keys remain accessible under common template texts. */}
  }
 }
 cache.set(site,{renderer,index});return index;
}
export function workspaceLanguageData(site,locale){
 const index=templateLanguagePages(site),sourceMaps=new Map();
 return {entries:languageEntries(site,locale).map(e=>({...e,translationStatus:websiteTranslationStatus(site,locale,e,site.defaultLanguage,sourceMaps),...(e.kind==='ui'?{pageIds:index.get(e.key)||[]}:{})})),report:languageReport(site,locale)};
}
