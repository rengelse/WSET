import {insertPropertyModuleLinks} from './property-modules.mjs';
import {renderSite} from './render-site.mjs';
import {activePages,routeMap,safeAssetPath,publishedContent} from './site-project.mjs';
import {splitMainSections,legacySectionMap} from './section-fragments.mjs';
import {applyTemplateText} from './template-editor.mjs';
import {migrateLegacyLocales} from './i18n-core.mjs';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localized=(value,locale,defaultLocale='no')=>{
  if(typeof value==='string')return value;
  return value?.[locale]??value?.[defaultLocale]??'';
};
const localHTML=(value,locale,defaultLocale)=>esc(localized(value,locale,defaultLocale)).replace(/\n/g,'<br>');
const localText=(value,locale,defaultLocale)=>esc(localized(value,locale,defaultLocale));
const imagePath=(path)=>safeAssetPath(path)?esc(path):'';
const iconArrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';

function removeInactiveLinks(html,locale,site){
  // Never leave a link to a page removed from the publication graph.
  const allowed=new Set(['/']);
  for(const p of activePages(site))allowed.add(`/${locale}/${p.slug==='home'?'':p.slug+'/'}`);
  if(activePages(site).some(p=>p.id==='projects'))for(const pr of publishedContent(site).projects){
    if(pr.isVisible!==false&&pr.enabled!==false)allowed.add(`/${locale}/projects/${pr.id}/`);
  }
  return html.replace(/<a\b([^>]*\bhref="(\/[^"]+)"[^>]*)>([\s\S]*?)<\/a>/g,(match,attrs,href)=>{
    if(!href.startsWith(`/${locale}/`)||allowed.has(href))return match;
    return '';
  });
}
function sectionContents(section,ctx){
 const {locale,site,pageMap,renderTemplate}=ctx;
 const d=site.defaultLanguage||'no';
 const t=v=>localText(v,locale,d),h=v=>localHTML(v,locale,d);
 const title=t(section.title),richTitle=h(section.title),lead=t(section.text);
 const kicker=section.kicker?`<span class="text-kicker dark">${t(section.kicker)}</span>`:'';
 const heading=richTitle?`<h2 class="heading">${richTitle}</h2>`:'';
 const leadMarkup=lead?`<p class="section-lead">${lead}</p>`:'';
 const button=()=>{
   const target=pageMap.get(section.target);
   if(!target)return '';
   const suffix=target.slug==='home'?'':`${target.slug}/`;
   return `<a class="btn btn-deep" href="/${encodeURIComponent(locale)}/${suffix}">${t(section.buttonText)||t(target.title)} ${iconArrow}</a>`;
 };
 switch(section.type){
  case 'template':{
    const fragment=applyTemplateText(renderTemplate(section.source,section.slot),site,section.source,section.slot,locale);
    // Optional per-section image override, preserving the original Mal 01 markup
    // exactly when no override exists. Prevents shared asset slots from making a
    // change on one page unexpectedly change another page.
    return safeAssetPath(section.image)?fragment.replace(/(<img\b[^>]*\bsrc=")([^"]*)(")/,(_match,start,_old,end)=>start+imagePath(section.image)+end):fragment;
  }
  case 'hero':{
    const image=imagePath(section.image||'/assets/hero.webp');
    return `<section class="page-hero"><img src="${image}" alt="" class="page-bg"><div class="container page-hero-inner">${kicker}<h1 class="heading">${richTitle}</h1>${leadMarkup}</div></section>`;
  }
  case 'text':return `<section class="section cbpm-editor-text"><div class="container cbpm-editor-prose reveal">${kicker}${heading}${leadMarkup}${button()}</div></section>`;
  case 'imageText':{
    const src=imagePath(section.image||'/assets/hero-square.webp');
    return `<section class="section cbpm-editor-image-text"><div class="container cbpm-editor-pair ${section.imageRight?'is-reversed':''}"><div class="cbpm-editor-photo reveal"><img loading="lazy" src="${src}" alt="${t(section.imageAlt||section.title)}"></div><div class="cbpm-editor-copy reveal">${kicker}${heading}${leadMarkup}${button()}</div></div></section>`;
  }
  case 'gallery':{
    const images=(section.images||[]).filter(image=>safeAssetPath(image.src));
    return `<section class="section cbpm-editor-gallery"><div class="container">${kicker}${heading}${leadMarkup}<div class="cbpm-editor-gallery-grid">${images.map(img=>`<figure class="reveal"><img loading="lazy" src="${imagePath(img.src)}" alt="${t(img.alt)}"><figcaption>${t(img.caption)}</figcaption></figure>`).join('')}</div></div></section>`;
  }
  case 'cta':return `<section class="cta-banner"><div class="container cta-inner"><div>${kicker}${heading}${leadMarkup}</div>${button()}</div></section>`;
  case 'services':return renderTemplate('home','services');
  case 'projects':return pageMap.has('projects')?renderTemplate('home','projects'):'';
  case 'reviews':return renderTemplate('home','reviews');
  case 'team':return renderTemplate('home','team');
  default:throw Error(`Unknown section type '${section.type}' on page ${ctx.pageId}`);
 }
}

function withResponsiveMedia(html,site){
 const responsive=new Map();
 for(const media of site.media?.items||[]){
  for(const [preset,files] of Object.entries(media.variants||{})){
   if(!Array.isArray(files)||files.length<2)continue;
   const sizes=preset==='hero'?'100vw':preset==='portrait'?'(max-width: 700px) 85vw, 360px':
    preset==='card'?'(max-width: 700px) 96vw, (max-width: 1200px) 48vw, 33vw':'(max-width: 700px) 100vw, 50vw';
   const unique=new Map();
   files.forEach((p,i)=>unique.set(media.variantWidths?.[preset]?.[i]||Number(p.match(/-(\d+)\.webp$/)?.[1])||480,p));
   const srcset=[...unique.entries()].map(([width,path])=>`${path} ${width}w`).join(', ');
   for(const filename of files)responsive.set(filename,{srcset,sizes});
   if(preset==='gallery')responsive.set(media.src,{srcset,sizes});
  }
 }
 return html.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g,(tag,url)=>{
  const detail=responsive.get(url);
  return detail&&!tag.includes(' srcset=')?tag.replace(/>$/,` srcset="${detail.srcset}" sizes="${detail.sizes}">`):tag;
 });
}
/** Render a page from a portable project file. Existing Mal 01 components are
 * sourced from the unchanged trusted renderer. The page/section graph is data,
 * so templates can be hidden, moved, replaced or augmented in any order.
 */
export function renderDynamicSite({site,locale,page,annotate=false}={}){
 if(!site||!locale||!page)throw Error('renderDynamicSite needs site, locale and page.');
 site=migrateLegacyLocales(site);
 const active=activePages(site), pageMap=new Map(active.map(p=>[p.id,p]));
 const isProject=page.startsWith('project-');
 if(!pageMap.has(page)&&!isProject)throw Error(`Unpublished or unknown page: ${page}`);
 if(isProject){
   if(!pageMap.has('projects')||!publishedContent(site).projects.some(p=>p.id===page.slice(8)))
    throw Error(`Unpublished project page: ${page}`);
 }
 const siteData={...publishedContent(site),routeMap:routeMap(site),siteNavigation:active.filter(p=>p.showInNavigation!==false)};
 const defaultPage=page;
 const base=renderSite({locale,page:isProject?page:defaultPage,data:siteData});
 if(isProject)return {...base,html:insertPropertyModuleLinks(base.html,site,locale)};
 const target=pageMap.get(page);
 const original=splitMainSections(base.html);
 const cache=new Map();
 const ctx={site,locale,pageId:page,pageMap,renderTemplate(source,slot){
  if(!cache.has(source)){
   const template=source===defaultPage?base:renderSite({locale,page:source,data:siteData});
   cache.set(source,legacySectionMap(source,template.html));
  }
  return cache.get(source)[slot]||'';
 }};
 const htmlParts=(target.sections||[]).filter(s=>s.enabled!==false).map(s=>{
  const content=sectionContents(s,ctx);
  return annotate?content.replace(/^(<\w+)(\s|>)/,(_,tag,tail)=>`${tag} data-cbpm-section="${s.id}"${tail}`):content;
 });
 const newMain=`<main id="main">${htmlParts.join('')}</main>`;
 const html=insertPropertyModuleLinks(withResponsiveMedia(removeInactiveLinks(original.before.slice(0,-'<main id="main">'.length)+newMain+original.after.slice('</main>'.length),locale,site),site),site,locale);
 const t=val=>localized(val,locale,site.defaultLanguage);
 const title=t(target.seoTitle)||t(target.title)||base.title;
 return {...base,html,page,title:`${esc(title)} | ${esc(site.brand?.shortName||'CBPM')}`,
  description:t(target.seoDescription)||base.description};
}
