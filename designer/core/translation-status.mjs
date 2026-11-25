import {createHash} from 'node:crypto';
import {languageEntries} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
const hash=v=>createHash('sha256').update(String(v??'').trim()).digest('hex');
const key=(target,id)=>JSON.stringify([target,id]);
export function recordTranslation(site,{source,target,items},kind='automatic'){
 const registry=site.translationStatus??={version:1,entries:{}};
 for(const i of items)registry.entries[key(target,i.key)]={source,sourceHash:hash(i.sourceText),targetHash:hash(i.value),kind};
 return site;
}
export function websiteTranslationStatus(site,target,entry,source=site.defaultLanguage,sourceMaps=new Map()){
 if(!entry.value?.trim())return 'missing';
 const m=site.translationStatus?.entries?.[key(target,entry.key)];if(!m)return 'unknown';
 if(m.targetHash!==hash(entry.value))return 'manual';
 if(m.source!==source&&!sourceMaps.has(m.source))sourceMaps.set(m.source,new Map(languageEntries(site,target,m.source).map(e=>[e.key,e.source])));const original=m.source===source?entry.source:sourceMaps.get(m.source)?.get(entry.key);
 if(original===undefined||m.sourceHash!==hash(original))return 'stale';
 return m.kind==='manual'?'manual':'translated';
}
export function recordManualWebsite(site,target,id,value){const source=site.defaultLanguage;if(target===source)return site;const row=languageEntries(site,target,source).find(e=>e.key===id);if(row&&value.trim())return recordTranslation(site,{source,target,items:[{key:id,sourceText:row.source,value}]},'manual');return site;}
