/** Build a property page from the *exact* approved Mal 01 shell. The usual
 * static website remains untouched; only <main> becomes a PHP-rendered module. */
import {renderDynamicSite} from './dynamic-site.mjs';
import {assistantMarkup} from './smart-assistant.mjs';
import {publishedContent} from './site-project.mjs';
import {propertyModuleDefinitions,propertyGroupLabel,propertyGroupRoute,moduleRoute} from './property-modules.mjs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function propertyPageShell(site,locale,moduleId){
 const module=moduleId==='all'?{slug:'eiendommer'}:propertyModuleDefinitions[moduleId];if(!module)throw Error('Unknown property module');
 const html=renderDynamicSite({site,locale,page:'home'}).html;
 const start=html.indexOf('<main id="main">'),end=html.lastIndexOf('</main>');
 if(start<0||end<=start)throw Error('Mal 01 shell has no unique main element');
 let head=html.slice(0,start),foot=html.slice(end+'</main>'.length);
 // Page context: preserve the whole approved header/footer, move active state.
 head=head.replace('class="nav-link active" aria-current="page" href="/'+locale+'/"','class="nav-link " href="/'+locale+'/"');
 head=head.replace('href="'+propertyGroupRoute(locale)+'"', 'aria-current="page" href="'+propertyGroupRoute(locale)+'"');
 head=head.replace('class="active" href="/'+locale+'/"','href="/'+locale+'/"');
 head=head.replace('href="/'+locale+'/'+module.slug+'/"', 'href="/'+locale+'/'+module.slug+'/"');
 const baseLocale=['no','en','es'].includes(locale)?site.defaultLanguage:'en';
 const ui={...site.i18n?.ui?.[baseLocale],...site.i18n?.ui?.[locale]};
 const favicon=site.brand?.faviconUrl&&/^\/(?:assets\/|favicon)/.test(site.brand.faviconUrl)?site.brand.faviconUrl:'/favicon.svg';
 // Source data (including rich text) can never add a PHP opening token to
 // generated template files. All shell HTML was originally sanitized.
 for(const part of [head,foot])if(part.includes('<?'))throw Error('Unsafe PHP token in site shell');
 const prefix=`<!doctype html><html lang="${escape(locale)}" data-default-locale="${escape(site.defaultLanguage)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="<?=($error||$notFound)?'noindex,nofollow':'index,follow'?>"><title><?=cbpmEscape($pageTitle)?> | ${escape(site.brand?.shortName||'CBPM')}</title><meta name="description" content="<?=cbpmEscape($pageDescription)?>"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/designer-sections.css"><link rel="stylesheet" href="/property-modules.css"><?php if(($mapMode??false)): ?><link rel="stylesheet" href="/maplibre-gl.css"><?php endif; ?><link rel="icon" href="${escape(favicon)}"></head><body data-current-page="property-module"><div id="app">${head}`;
 const suffix=`${foot}</div><script id="review-data" type="application/json">${safeJSON(publishedContent(site).reviews)}</script><script id="cbpm-ui-messages" type="application/json">${safeJSON(ui)}</script><script src="/site.js" defer></script><?php if(($mapMode??false)): ?><script src="/maplibre-gl.js" defer></script><script src="/property-map.js" defer></script><?php endif; ?><script src="/property-search.js" defer></script>${assistantMarkup(site,locale,{preview:false})}</body></html>`;
 return {prefix,suffix};
}
