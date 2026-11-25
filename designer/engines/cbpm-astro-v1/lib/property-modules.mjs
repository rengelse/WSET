/** Category visibility is an editorial choice, not an XML-inventory flag.
 * Legacy implicit false values mean automatic/default ON. Explicit OFF wins. */
export const propertyModuleDefinitions=Object.freeze({
  properties:Object.freeze({slug:'eiendommer',title:Object.freeze({no:'Boliger til salgs',en:'Properties for sale',es:'Viviendas en venta',de:'Bestandsimmobilien',da:'Boliger til salg',fi:'Myytävät asunnot',fr:'Biens à vendre',nl:'Woningen te koop',pl:'Nieruchomości na sprzedaż',sv:'Bostäder till salu',ru:'Недвижимость на продажу'}),description:Object.freeze({no:'Boliger til salgs og utleie',en:'Properties for sale and rent',es:'Viviendas en venta y alquiler'})}),
  developments:Object.freeze({slug:'nybygg',title:Object.freeze({no:'Nybygg',en:'New developments',es:'Obra nueva',de:'Neubauten',da:'Nybyggeri',fi:'Uudiskohteet',fr:'Programmes neufs',nl:'Nieuwbouw',pl:'Nowe inwestycje',sv:'Nyproduktion',ru:'Новостройки'}),description:Object.freeze({no:'Nye boliger og prosjekter',en:'New-build properties and developments',es:'Viviendas y promociones de obra nueva'})})
});
export const propertyModuleIds=Object.freeze(Object.keys(propertyModuleDefinitions));
/** A sale listing belongs to exactly one category. An active category can be
 * hidden in navigation without hiding its catalogue entries. */
export function propertyCategoryId(record){
  return Number(record?.new_build ?? record?.newBuild ?? 0) === 1 ? 'developments' : 'properties';
}
const slugSafe=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export function propertyModuleSettings(site,id){
  if(!Object.hasOwn(propertyModuleDefinitions,id))throw Error(`Unknown property module ${id}`);
  const item=site?.propertyModules?.[id]||{};
  return {enabled:item.visibilityExplicit===true ? item.enabled!==false : true,showInNavigation:item.showInNavigation!==false,labels:item.labels||{}};
}
export function propertyPageEnabled(site){
  const page=site?.sitePages?.find(p=>p.id==='properties');
  return page ? page.enabled!==false : true; // pre-v1.2.3 projects keep their previous publishing state
}
export function propertyPageNavigation(site){
  const page=site?.sitePages?.find(p=>p.id==='properties');
  return propertyPageEnabled(site) && (!page || page.showInNavigation!==false);
}
export function enabledPropertyModules(site){
  return propertyModuleIds.filter(id=>propertyPageEnabled(site)&&propertyModuleSettings(site,id).enabled).map(id=>({id,...propertyModuleDefinitions[id],...propertyModuleSettings(site,id)}));
}
export function moduleLabel(site,id,locale){
  const defs=propertyModuleDefinitions[id],settings=propertyModuleSettings(site,id);
  return settings.labels[locale]||defs.title[locale]||defs.title[locale?.split('-')[0]]||defs.title.en;
}
export function moduleRoute(locale,id){
  if(!slugSafe.test(locale)||!Object.hasOwn(propertyModuleDefinitions,id))throw Error('Invalid module route');
  return `/${locale}/eiendommer/${id==='properties'?'boliger-til-salgs':'nybygg'}/`;
}
export function validatePropertyModules(site){
 const errors=[],warnings=[];
 const config=site?.propertyModules;
 if(config===undefined)return {errors,warnings};
 if(!config||Array.isArray(config)||typeof config!=='object')return {errors:['propertyModules must be an object.'],warnings};
 for(const [id,value] of Object.entries(config)){
  if(!Object.hasOwn(propertyModuleDefinitions,id)){errors.push(`Unknown property module: ${id}`);continue;}
  if(!value||Array.isArray(value)||typeof value!=='object'){errors.push(`Invalid property module settings: ${id}`);continue;}
  for(const field of ['enabled','showInNavigation'])if(value[field]!==undefined&&typeof value[field]!=='boolean')errors.push(`Invalid ${field}: ${id}`);
  for(const key of Object.keys(value))if(!['enabled','showInNavigation','labels','visibilityExplicit'].includes(key))errors.push(`Unknown module setting ${id}.${key}`);
  if(value.visibilityExplicit!==undefined&&typeof value.visibilityExplicit!=='boolean')errors.push(`Invalid visibilityExplicit: ${id}`);
  if(value.labels!==undefined){
   if(!value.labels||Array.isArray(value.labels)||typeof value.labels!=='object')errors.push(`Invalid labels: ${id}`);
   else for(const [lang,label] of Object.entries(value.labels)){
    if(!(site.languages||[]).some(l=>l.code===lang)||typeof label!=='string'||label.length>90||/[<>]/.test(label))errors.push(`Invalid module label ${id}/${lang}`);
   }
  }
  if(propertyPageEnabled(site)&&propertyModuleSettings(site,id).enabled){
   if((site.sitePages||[]).some(p=>p.id!=='properties'&&p.enabled!==false&&p.slug===propertyModuleDefinitions[id].slug))errors.push(`Module URL ${propertyModuleDefinitions[id].slug} conflicts with an existing page.`);
   warnings.push(`${id}: Hosting requires PHP with XMLReader/DOM and private storage/imports/ outside webroot; no database.`);
  }
 }
 return {errors,warnings};
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/** Shared parent route for both optional property catalogues. */
export function propertyGroupRoute(locale){
 if(!slugSafe.test(locale))throw Error('Invalid locale');
 return `/${locale}/eiendommer/`;
}
export function legacyModuleRoute(locale,id){
 if(!slugSafe.test(locale)||!Object.hasOwn(propertyModuleDefinitions,id))throw Error('Invalid module route');
 return `/${locale}/${propertyModuleDefinitions[id].slug}/`;
}
export function propertyGroupLabel(locale,site){
 const value=site?.sitePages?.find(p=>p.id==='properties')?.title;
 if(value?.[locale])return value[locale];
 return ({no:'Eiendommer',en:'Properties',es:'Inmuebles',de:'Immobilien',da:'Ejendomme',fi:'Kiinteistöt',fr:'Immobilier',nl:'Woningen',pl:'Nieruchomości',sv:'Fastigheter',ru:'Недвижимость'})[locale]||'Properties';
}
/** Public Eiendommer is an ordinary ordered page; category links remain optional. */
export function insertPropertyModuleLinks(html,site,locale){
 if(!propertyPageNavigation(site))return html;
 const visible=enabledPropertyModules(site).filter(m=>m.showInNavigation);
 if(!visible.length && !propertyPageEnabled(site))return html;
 const group=propertyGroupRoute(locale);
 const label=escapeHtml(propertyGroupLabel(locale,site));
 const submenu=visible.map(m=>`<a href="${moduleRoute(locale,m.id)}">${escapeHtml(moduleLabel(site,m.id,locale))}</a>`).join('');
 const desktop=visible.length<=1
  ?`<a class="nav-link cbpm-property-nav-parent" href="${group}">${label}</a>`
  :`<div class="cbpm-property-nav-group"><a class="nav-link cbpm-property-nav-parent" href="${group}">${label}</a><details class="cbpm-property-nav-details"><summary aria-label="${escapeHtml(({no:'Vis eiendomskategorier',en:'Show property categories',es:'Mostrar categorías de inmuebles'})[locale]||'Show property categories')}"><span aria-hidden="true">⌄</span></summary><div class="cbpm-property-nav-dropdown">${submenu}</div></details></div>`;
 const mobile=visible.length<=1
  ?`<a href="${group}">${label}</a>`
  :`<details class="cbpm-property-mobile-group"><summary>${label}</summary><div class="cbpm-property-mobile-children"><a href="${group}">${escapeHtml(({no:'Alle eiendommer',en:'All properties',es:'Todos los inmuebles'})[locale]||'All properties')}</a>${submenu}</div></details>`;
 const ordered=(site.sitePages||[]).filter(p=>p.enabled!==false).sort((a,b)=>(a.order??0)-(b.order??0));
 const idx=ordered.findIndex(p=>p.id==='properties');
 const next=idx<0?null:ordered.slice(idx+1).find(p=>p.id!=='properties');
 const insert=(content,markup,mobileNav)=>{
  if(next){
   const href=`/${locale}/${next.slug==='home'?'':next.slug+'/'}`;
   const marker=`href="${href}"`;
   const markerAt=content.indexOf(marker);
   const anchorAt=markerAt<0?-1:content.lastIndexOf('<a ',markerAt);
   const m=anchorAt<0?null:{index:anchorAt};
   if(m)return content.slice(0,m.index)+markup+content.slice(m.index);
  }
  return content+markup;
 };
 let result=html.replace(/(<nav class="nav-desktop"[^>]*>)([\s\S]*?)(<\/nav>)/,(all,start,content,end)=>start+insert(content,desktop,false)+end);
 result=result.replace(/(<nav id="mobile-nav"[^>]*>)([\s\S]*?)(<\/nav>)/,(all,start,content,end)=>start+insert(content,mobile,true)+end);
 return result;
}
