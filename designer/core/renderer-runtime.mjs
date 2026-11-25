/** WSET renderer contract v1. Only editor-owned adapters are executable here.
 * A descriptor selects an exact registered (engine, template ID) pair; archive
 * metadata never provides a module URL or JS entry point. Async scope keeps
 * concurrent preview/edit/export operations on the same adapter, including clones.
 */
import {AsyncLocalStorage} from 'node:async_hooks';
import {legacyRenderer} from '../engines/cbpm-astro-v1/renderer.mjs';
export {legacyRenderer};
export const RENDERER_CONTRACT_VERSION=1;
const methods=['renderPage','renderSource','splitSections','sourceSections','textEntries','renderPropertyPage'];
const key=(engine,id)=>engine+'\0'+id;
export function createRendererRegistry(adapters){
 const entries=new Map();
 for(const adapter of adapters){
  if(!adapter||adapter.contractVersion!==RENDERER_CONTRACT_VERSION||typeof adapter.engine!=='string'||!adapter.engine||typeof adapter.id!=='string'||!adapter.id||methods.some(m=>typeof adapter[m]!=='function'))throw Error('Ugyldig WSET-rendererkontrakt.');
  const k=key(adapter.engine,adapter.id);if(entries.has(k))throw Error('Duplisert WSET-renderer: '+adapter.id);
  entries.set(k,Object.freeze({...adapter}));
 }
 return Object.freeze({resolve(descriptor){
  const adapter=descriptor&&descriptor.contractVersion===1&&entries.get(key(descriptor.engine,descriptor.id));
  if(!adapter)throw Error('Nettsidemalen støttes ikke av denne WSET-versjonen: '+String(descriptor?.id||'ukjent'));
  return adapter;
 }});
}
// Adding an adapter is an editor source change, never a side effect of ZIP import.
export const installedRenderers=createRendererRegistry([legacyRenderer]);
const scope=new AsyncLocalStorage();
export const activeRenderer=()=>scope.getStore()||legacyRenderer;
export function withTemplateRenderer(descriptor,fn,{registry=installedRenderers}={}){
 return scope.run(registry.resolve(descriptor),fn);
}
export function rendererHints(descriptor){const adapter=installedRenderers.resolve(descriptor);return {imageSlots:structuredClone(adapter.imageSlots||{}),globalImageSlots:[...(adapter.globalImageSlots||[])]};}
export function sectionImageKey(section){return activeRenderer().imageSlots?.[section.slot]?.[section.source];}
export function assertRegisteredRenderer(descriptor){installedRenderers.resolve(descriptor);return descriptor;}
function checkedPage(result,adapter){
 if(!result||typeof result.html!=='string'||typeof result.title!=='string'||typeof result.description!=='string'||typeof result.lang!=='string'||!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(result.lang)||!result.html.includes('<main id="main">')||!result.html.includes('</main>'))throw Error('Rendereren returnerte ugyldig side: '+adapter.id);
 return result;
}
export function renderDynamicSite(args){const a=activeRenderer(),r=checkedPage(a.renderPage(args),a);
 if(args.annotate&&args.site.sitePages?.some(p=>p.id===args.page)){
  const allowed=new Set(args.site.sitePages.find(p=>p.id===args.page).sections.filter(s=>s.enabled!==false).map(s=>s.id)),seen=new Set();
  for(const fragment of a.splitSections(r.html).sections){const id=fragment.match(/^\s*<[^>]*\bdata-cbpm-section="([^"]+)"/)?.[1];if(!id||!allowed.has(id)||seen.has(id))throw Error('Rendereren returnerte ugyldig seksjonsidentitet: '+a.id);seen.add(id);}
 }
 return r;
}
export function renderSite(args){const a=activeRenderer();return checkedPage(a.renderSource(args),a);}
export const splitMainSections=html=>activeRenderer().splitSections(html);
export const legacySectionMap=(page,html)=>activeRenderer().sourceSections(page,html);
export const templateTextEntries=fragment=>activeRenderer().textEntries(fragment);
export function propertyModulePreview(site,locale,id,options){const a=activeRenderer(),html=a.renderPropertyPage(site,locale,id,{...options,renderPage:renderDynamicSite});if(typeof html!=='string'||!html.includes('</body>'))throw Error('Rendereren returnerte ugyldig eiendomsvisning: '+a.id);return html;}
