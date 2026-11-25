import {prepareTextPage} from './universal-text.mjs';
import {inlineTargets} from './inline-editing.mjs';
import {publishedContent} from '../engines/cbpm-astro-v1/lib/site-project.mjs';

/** Metadata for the local Designer iframe ONLY; never part of public exports.
 * Deliberately scoped to stable IDs, labels and routes rather than editable HTML.
 */
export function previewEditorMap(site,locale,pageId,html,prepared){
 const content=publishedContent(site);
 const targets=inlineTargets(site,pageId,locale),styleable=prepared?.map||(html?prepareTextPage(site,pageId,locale,html,{targets}).map:new Map());
 const local=value=>typeof value==='string'?value:value?.[locale]||value?.[site.defaultLanguage]||'';
 return {
  pages:site.sitePages.map(p=>({id:p.id,slug:p.slug})),locale,pageId,
  inline:Object.fromEntries(Object.entries(targets).map(([id,targets])=>[id,targets.filter(t=>styleable.has(id+'\0'+t.id)).map(({command,raw,part,sourcePath,sourceIndex,baseValue,baseEncoded,...t})=>{const b=styleable.get(id+'\0'+t.id);return {...t,styleable:true,stylePath:b.path,bindingKey:b.key,whole:b.whole};})])),
  records:Object.fromEntries(['services','projects','team','reviews'].map(group=>[
   group,(content[group]||[]).map(r=>({id:r.id,label:local(r.title||r.head||r.role)||r.name||'',name:r.name||'',url:group==='projects'?`/${locale}/projects/${r.id}/`:''}))
  ]))
 };
}
