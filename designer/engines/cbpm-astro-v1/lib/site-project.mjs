import {validateGlobalContent} from './global-content.mjs';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {languageReport,migrateLegacyLocales} from './i18n-core.mjs';
import {validatePropertyModules,enabledPropertyModules} from './property-modules.mjs';
import {validateAssistant} from './smart-assistant.mjs';

const cleanId=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const localeCode=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const imageName=/^\/assets\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif|svg)$/;
const templateSlots={
  home:['hero','trust','services','why','projects','reviews','team','cta'],
  services:['hero','listing','faq','cta'],
  rental:['hero','overview','process','cta'],
  projects:['hero','listing','cta'],
  reviews:['hero','listing','share','cta'],
  about:['hero','intro','values','team','cta'],
  contact:['hero','form']
};
export const builtinTemplateSlots=Object.freeze(templateSlots);
export const sectionTypes=Object.freeze(['template','hero','text','imageText','gallery','cta','services','projects','reviews','team']);
export const safeAssetPath=(path)=>typeof path==='string' && imageName.test(path);
export const safeId=(id)=>typeof id==='string'&&cleanId.test(id);

export function loadSiteProject(root=process.cwd()){
  return migrateLegacyLocales(JSON.parse(readFileSync(resolve(root,'project/website.json'),'utf8')));
}
export function activePages(site){
  return (site.sitePages||[]).filter(p=>p.id!=='properties'&&p.enabled!==false).sort((a,b)=>(a.order??0)-(b.order??0));
}
export function activeLocales(site){
  return (site.languages||[]).filter(l=>l.enabled!==false).sort((a,b)=>(a.order??0)-(b.order??0));
}
export function routeMap(site){
  return Object.fromEntries(activePages(site).map(p=>[p.id,p.slug==='home'?'home':p.slug]));
}
export function routeFor(locale,page,site){
  const routes=routeMap(site);
  const slug=routes[page] || page;
  const suffix=slug==='home'?'':page.startsWith('project-')?`projects/${page.slice(8)}/`:`${slug}/`;
  return `/${encodeURIComponent(locale)}/${suffix}`;
}
/** Project content is projected to a published view, never exposing archived
 * projects, unconsented reviews or disabled service categories to the output.
 * Visible sample employees are included in exported pages for demonstration,
 * while private AI snapshots can explicitly request includeDemoTeam:false.
 */
export function publishedContent(site,{includeDemoTeam=true}={}){
  const byOrder=(a,b)=>(a.order??0)-(b.order??0);
  const cats=(site.categories||[]).filter(c=>c.enabled!==false).sort(byOrder);
  const categoryIds=new Set(cats.map(c=>c.id));
  return {...site,
    categories:cats,
    services:(site.services||[]).filter(s=>s.enabled!==false&&s.isVisible!==false&&categoryIds.has(s.type)).sort(byOrder),
    projects:(site.projects||[]).filter(p=>p.enabled!==false&&p.isVisible!==false).sort(byOrder),
    reviews:(site.reviews||[]).filter(r=>r.enabled!==false&&r.isVisible!==false&&(r.isSample===true||r.permissionConfirmed===true)).sort(byOrder),
    team:(site.team||[]).filter(p=>p.enabled!==false&&p.isVisible!==false&&(includeDemoTeam||p.isSample!==true)).sort(byOrder)
  };
}
export function staticRoutes(site){
  const pages=activePages(site);
  const locales=activeLocales(site);
  const items=[];
  for(const lang of locales){
    for(const p of pages)items.push({locale:lang.code,page:p.id,slug:routeFor(lang.code,p.id,site).replace(/^\/+|\/+$/g,'')});
    if(pages.some(p=>p.id==='projects'))for(const project of publishedContent(site).projects){
      items.push({locale:lang.code,page:'project-'+project.id,slug:routeFor(lang.code,'project-'+project.id,site).replace(/^\/+|\/+$/g,'')});
    }
  }
  return items;
}
function collectImagePaths(obj,paths,path=''){
  if(Array.isArray(obj))return obj.forEach((child,i)=>collectImagePaths(child,paths,`${path}[${i}]`));
  if(obj&&typeof obj==='object')return Object.entries(obj).forEach(([key,val])=>collectImagePaths(val,paths,`${path}.${key}`));
  if(typeof obj==='string'&&obj.startsWith('/assets/'))paths.push({image:obj,at:path});
}
/** Validate the editor project *before* a static site is generated.
 * Errors block publishing. Warnings are non-blocking but visible in preview.
 * Never silently restore a deleted page or section from the original mockup.
 */
export function validateSiteProject(site,{root=process.cwd(),checkAssets=true}={}){
  const errors=[],warnings=[];
  errors.push(...validateGlobalContent(site));
  const modules=validatePropertyModules(site);errors.push(...modules.errors,...validateAssistant(site));warnings.push(...modules.warnings);
  if(site?.schemaVersion!==1)errors.push('Unsupported project schemaVersion (expected 1).');
  if(site?.contactForm?.mode && !['demo','smtp'].includes(site.contactForm.mode))errors.push('Invalid contact form mode.');
  if(site?.contactForm?.mode==='smtp'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.brand?.email||''))errors.push('Aktivt kontaktskjema krever en gyldig e-postadresse i Bedriftsprofil.');
    const url=site.contactForm.privacyUrl||'';
    if(!((/^https:\/\/[^\s<>"]+$/i).test(url)||(/^\/[a-zA-Z0-9/_-]+\/$/).test(url)))
      errors.push('Aktivt kontaktskjema krever gyldig HTTPS-adresse til personvernerklæring.');
  }
  const langs=site?.languages||[],pages=site?.sitePages||[];
  if(!Array.isArray(langs)||!langs.length)errors.push('Project requires languages.');
  if(!Array.isArray(pages)||!pages.length)errors.push('Project requires sitePages.');
  const lcodes=new Set(),pids=new Set(),pslugs=new Set();
  for(const l of langs){
    if(!localeCode.test(l.code||''))errors.push(`Invalid locale code: ${l.code}`);
    if(lcodes.has(l.code))errors.push(`Duplicate locale: ${l.code}`);
    lcodes.add(l.code);
  }
  if(!lcodeEnabled(langs,site?.defaultLanguage))errors.push('defaultLanguage must be enabled and defined.');
  if(site?.i18n?.ui){for(const l of langs.filter(l=>l.enabled!==false)){const report=languageReport(site,l.code);if(!report.complete){const msg=`${l.code}: ${report.missing.length} manglende oversettelser (${report.missing.slice(0,3).join(', ')}).`;if(l.requiresComplete)errors.push(msg);else warnings.push(msg);}}}
  for(const p of pages){
    if(!safeId(p.id))errors.push(`Invalid page ID: ${p.id}`);
    if(!safeId(p.slug))errors.push(`Invalid page slug for ${p.id}: ${p.slug}`);
    if(p.slug==='home'&&p.id!=='home')errors.push('home route is reserved for page ID home.');
    if(p.id==='properties'&&p.slug!=='eiendommer')errors.push('Eiendommer must use the reserved eiendommer slug.');
    if(p.id!=='properties'&&p.slug==='eiendommer')errors.push('The eiendommer slug is reserved for the property catalogue.');
    if(p.id==='home'&&p.slug!=='home')errors.push('The home page must use slug home.');
    if(p.slug?.startsWith('project-')||p.id?.startsWith('project-'))errors.push(`Page ID or slug conflicts with project route: ${p.id}/${p.slug}`);
    if(pids.has(p.id))errors.push(`Duplicate page ID: ${p.id}`);
    if(pslugs.has(p.slug))errors.push(`Duplicate page slug: ${p.slug}`);
    pids.add(p.id);pslugs.add(p.slug);
    if(!Array.isArray(p.sections))errors.push(`Page ${p.id} is missing sections.`);
    const secIds=new Set();
    for(const s of p.sections||[]){
      if(!safeId(s.id))errors.push(`Invalid section ID on ${p.id}: ${s.id}`);
      if(secIds.has(s.id))errors.push(`Duplicate section ID ${s.id} on ${p.id}`);
      secIds.add(s.id);
      if(!sectionTypes.includes(s.type))errors.push(`Unknown section type '${s.type}' on ${p.id}/${s.id}`);
      if(s.type==='template' && !templateSlots[s.source]?.includes(s.slot))errors.push(`Unknown template slot ${s.source}/${s.slot}`);
      if(s.type==='cta'&&s.target && !pages.some(x=>x.id===s.target&&x.enabled!==false))warnings.push(`${p.id}/${s.id}: CTA target '${s.target}' is unpublished.`);
      if(s.type==='gallery')for(const img of s.images||[])if(!safeAssetPath(img.src))errors.push(`Invalid gallery image path in ${p.id}/${s.id}: ${img.src}`);
      if(s.type==='imageText'&&s.image&&!safeAssetPath(s.image))errors.push(`Invalid image in ${p.id}/${s.id}: ${s.image}`);
      if(s.type==='hero'&&s.image&&!safeAssetPath(s.image))errors.push(`Invalid hero image in ${p.id}/${s.id}: ${s.image}`);
    }
  }
  const home=pages.find(p=>p.id==='home');
  if(!home||home.enabled===false)errors.push('The homepage must remain enabled.');
  if(pages.filter(p=>p.enabled!==false&&p.showInNavigation!==false).length>8)warnings.push('More than 8 menu items may overflow desktop navigation; hide less important pages from navigation.');
  for(const a of site?.categories||[]){if(!safeId(a.id))errors.push(`Invalid service category ${a.id}`);}
  const ids=new Set();
  for(const p of site?.projects||[]){
    if(!safeId(p.id))errors.push(`Invalid project ID: ${p.id}`);
    if(ids.has(p.id))errors.push(`Duplicate project ID: ${p.id}`);
    ids.add(p.id);
  }
  // The old Mal 01 renderer accepts a handful of intentional <br>/<em> tags
  // in its approved editorial headings. Other HTML is not valid editor data.
  function checkText(value,path='project'){
    if(Array.isArray(value))return value.forEach((v,i)=>checkText(v,`${path}[${i}]`));
    if(value&&typeof value==='object')return Object.entries(value).forEach(([k,v])=>checkText(v,`${path}.${k}`));
    if(typeof value==='string'&&/<\s*\/?\s*[a-z]/i.test(value)){
      if(/<\s*(?!br\s*\/?\s*>|em\s*>|\/em\s*>)[a-z\/]/i.test(value))
        errors.push(`Disallowed HTML in ${path}. Only <br> and <em> are permitted in legacy text.`);
    }
  }
  checkText(site);
  const mediaIds=new Set();
  for(const media of site.media?.items||[]){
    if(!safeId(media.id)||mediaIds.has(media.id))errors.push(`Invalid/duplicate media id: ${media.id}`);
    mediaIds.add(media.id);
    if(!safeAssetPath(media.src))errors.push(`Invalid media URL: ${media.src}`);
    if(!/^project\/media\/originals\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|tif|tiff|svg)$/.test(media.original||''))
      errors.push(`Invalid original media file: ${media.id}`);
    else if(checkAssets&&!existsSync(resolve(root,media.original)))errors.push(`Missing original image for ${media.id}`);
    for(const [preset,paths] of Object.entries(media.variants||{})){
      if(!['hero','card','portrait','gallery','logo','favicon'].includes(preset)||!Array.isArray(paths)||!paths.every(safeAssetPath))
        errors.push(`Invalid image renditions: ${media.id}/${preset}`);
    }
  }
  const imgKeys=(site.brand?.images||{});
  for(const [name,path] of Object.entries(imgKeys)){
    if(!safeId(name)||!safeAssetPath(path))errors.push(`Invalid brand image mapping: ${name} => ${path}`);
  }
  if(site.brand?.logoMode&&!['symbol-text','logo-only','text-only'].includes(site.brand.logoMode))errors.push('Invalid logo display mode.');
  for(const name of ['logoUrl','lightLogoUrl','faviconUrl']){
    if(site.brand?.[name]&&!safeAssetPath(site.brand[name]))errors.push(`Invalid brand image path: ${name}`);
  }
  for(const item of [...(site.services||[]),...(site.projects||[])]){
    if(item.img&&!safeId(item.img))errors.push(`Invalid media key '${item.img}'.`);
    else if(checkAssets&&item.img&&!Object.hasOwn(imgKeys,item.img)&&!existsSync(resolve(root,'public/assets',item.img+'.webp')))
      errors.push(`Missing media asset for '${item.img}'.`);
  }
  if(checkAssets){
    const paths=[];collectImagePaths(site,paths);
    for(const {image,at} of paths){
      if(!safeAssetPath(image)){errors.push(`Invalid asset path ${image} at ${at}`);continue;}
      if(!existsSync(resolve(root,'public',image.slice(1))))errors.push(`Missing asset: ${image} at ${at}`);
    }
  }
  return {ok:errors.length===0,errors,warnings};
}
function lcodeEnabled(languages,code){return languages.some(l=>l.code===code&&l.enabled!==false);}
