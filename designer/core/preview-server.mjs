import {hasLegalContent,globalLegalJs,globalLegalCss} from '../engines/cbpm-astro-v1/lib/global-content.mjs';
import {randomUUID} from 'node:crypto';
import {readDraftImage} from './property-draft-images.mjs';
import {prepareTextPage} from './universal-text.mjs';
import {hasDesign,pageDesignCss} from './design-styles.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,join,sep} from 'node:path';
import {realpath,lstat} from 'node:fs/promises';
import {isLocalPropertyImagePath} from '../engines/cbpm-astro-v1/lib/property-image-path.mjs';
import {staticRoutes,publishedContent,validateSiteProject} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {renderDynamicSite,withTemplateRenderer,installedRenderers} from './renderer-runtime.mjs';
import {readProjectTemplate} from './template-contract.mjs';
import {previewEditorMap} from './preview-editor-map.mjs';
import {enabledPropertyModules,propertyPageEnabled,moduleLabel,moduleRoute} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';
import {propertyModulePreview} from './renderer-runtime.mjs';
import {assistantMarkup} from '../engines/cbpm-astro-v1/lib/smart-assistant.mjs';
import {localPropertyPreviewListings} from './local-property-catalog.mjs';

const types={'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif'};
const allowedFiles=new Set(['styles.css','designer-sections.css','site.js','favicon.svg','designer-preview-select.js','designer-preview.css','smart-assistant.css','smart-assistant.js']);
const policy="default-src 'none'; img-src 'self' data: https:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const mapPolicy="default-src 'none'; img-src 'self' data: https: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; connect-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org; frame-src 'none'; form-action 'none'; base-uri 'none'";
export function previewDocument(site,locale,page){
 const rendered=renderDynamicSite({site,locale,page,annotate:true});
 const reviews=JSON.stringify(publishedContent(site).reviews).replace(/</g,'\\u003c');
 const uiMessages=JSON.stringify({...site.i18n?.ui?.[site.defaultLanguage],...site.i18n?.ui?.[locale]}).replace(/</g,'\\u003c');
 const prepared=site.sitePages.some(p=>p.id===page)?prepareTextPage(site,page,locale,rendered.html):{html:rendered.html,map:new Map()};
 const editorMap=JSON.stringify(previewEditorMap(site,locale,page,rendered.html,prepared)).replace(/</g,'\\u003c');
 const title=String(rendered.title).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const description=String(rendered.description).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 return `<!doctype html><html lang="${rendered.lang}" data-default-locale="${site.defaultLanguage}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><meta name="description" content="${description}"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/designer-sections.css">${hasDesign(site)?`<link rel="stylesheet" href="/__wset-design/${encodeURIComponent(locale)}/${encodeURIComponent(page)}.css">`: ''}<link rel="icon" href="${site.brand?.faviconUrl||'/favicon.svg'}"></head><body data-current-page="${page}"><div id="app">${prepared.html}</div><script id="review-data" type="application/json">${reviews}</script><script id="cbpm-ui-messages" type="application/json">${uiMessages}</script><script id="cbpm-editor-map" type="application/json">${editorMap}</script><script src="/site.js" defer></script><script src="/__wset-preview-bridge.js" defer></script>${assistantMarkup(site,locale,{preview:true})}</body></html>`;
}
/** Read-only loopback preview. Project/website.json, source and backups are never served. */
export async function startDesignerPreview({getSite:readSite,getRoot:readRoot,getTemplate,getModuleRoot:readModuleRoot=()=>null,registry=installedRenderers}){
 const draftImageToken=randomUUID();
 const server=createServer(async(req,res)=>{
  const send=(status,mime,body,extra={})=>{
   res.writeHead(status,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':policy,...extra});
   res.end(body);
  };
  if(req.method!=='GET'&&req.method!=='HEAD'){send(405,'text/plain; charset=utf-8','Method not allowed');return;}
  try{
   const siteAtStart=readSite(),rootAtStart=readRoot(),moduleAtStart=readModuleRoot();
   const getSite=()=>siteAtStart,getRoot=()=>rootAtStart,getModuleRoot=()=>moduleAtStart;
   if(!siteAtStart||!rootAtStart){send(404,'text/plain; charset=utf-8','Ingen nettside åpnet i WSET.');return;}
   const template=getTemplate?getTemplate():await readProjectTemplate(rootAtStart,{registry});
   return await withTemplateRenderer(template,async()=>{
   const url=new URL(req.url,'http://127.0.0.1');
   const pathname=decodeURIComponent(url.pathname);
   if(pathname==='/'||pathname===''){
    send(302,'text/plain; charset=utf-8','',{'Location':`/${getSite().defaultLanguage}/`});return;
   }
   const filename=pathname.slice(1);
   if(filename.startsWith('__wset-draft-image/')){
    const [,token,name,...rest]=filename.split('/');if(token!==draftImageToken||rest.length){send(404,'text/plain','Not found');return;}
    try{send(200,types['.webp'],await readDraftImage(getRoot(),name),{'Cross-Origin-Resource-Policy':'cross-origin'});}catch{send(404,'text/plain','Not found');}return;
   }
   if(filename==='__wset-draft-map'){
    send(200,'text/html; charset=utf-8','<!doctype html><html lang="no"><head><meta charset="utf-8"><link rel="stylesheet" href="/__wset-draft-maplibre.css"><link rel="stylesheet" href="/__wset-draft-map.css"></head><body><div id="map"></div><p id="map-note">Laster kart …</p><script src="/__wset-draft-maplibre.js" defer></script><script src="/__wset-draft-map.js" defer></script></body></html>',{'Content-Security-Policy':mapPolicy});return;
   }
   if(['__wset-draft-map.js','__wset-draft-map.css','__wset-draft-maplibre.js','__wset-draft-maplibre.css'].includes(filename)){
    const ext=extname(filename);const file=filename.includes('maplibre')?new URL('../../node_modules/maplibre-gl/dist/maplibre-gl'+ext,import.meta.url):new URL('../preview/draft-map'+ext,import.meta.url);
    try{send(200,types[ext],await readFile(file));}catch{send(404,'text/plain','Kartbibliotek mangler.');}return;
   }

   const designMatch=pathname.match(/^\/__wset-design\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\.css$/);
   if(designMatch){const [,locale,page]=designMatch,site=getSite();if(!site.languages.some(l=>l.code===locale)||!site.sitePages.some(p=>p.id===page)){send(404,'text/plain','Not found');return;}send(200,types['.css'],pageDesignCss(site,page,locale));return;}
   if(filename==='__wset-preview-bridge.js'||filename==='__wset-preview-selection.css'){
    const js=filename.endsWith('.js');const file=new URL(js?'../preview/bridge.js':'../preview/selection.css',import.meta.url);
    send(200,js?types['.js']:types['.css'],await readFile(file));return;
   }
   if(filename.startsWith('__wset-property-image/')){
    const relative='images/'+filename.slice('__wset-property-image/'.length);
    if(!isLocalPropertyImagePath(relative)){send(404,'text/plain; charset=utf-8','Not found');return;}
    const folder=resolve(getRoot(),'project/property-feeds/Existing/images');
    try{
     const base=await realpath(folder),candidate=join(folder,relative.slice('images/'.length)),file=await realpath(candidate);
     const propertyFolder=join(folder,relative.split('/')[1]);
     if(base!==folder||(await lstat(propertyFolder)).isSymbolicLink()||(await lstat(candidate)).isSymbolicLink()||
        !file.startsWith(base+sep)||!(await lstat(file)).isFile())throw Error('Not an image');
     const bytes=await readFile(file);
     if(bytes.length>15*1024*1024)throw Error('Image too large');
     send(200,types[extname(file)]||'application/octet-stream',bytes);
    }catch{send(404,'text/plain; charset=utf-8','Not found');}
    return;
   }
   if(filename==='property-search.js'){
    if(!getSite()?.sitePages?.some(p=>p.id==='properties')&&!propertyPageEnabled(getSite())){send(404,'text/plain; charset=utf-8','Not found');return;}
    const bytes=await readFile(resolve(getRoot(),'server/property/runtime/property-search.js'));
    send(200,'text/javascript; charset=utf-8',bytes);return;
   }
   if(filename==='property-map.js'){
    const bytes=await readFile(resolve(getRoot(),'server/property/runtime/property-map.js'));
    send(200,'text/javascript; charset=utf-8',bytes);return;
   }
   if(filename==='maplibre-gl.js'||filename==='maplibre-gl.css'){
    try{
     const bytes=await readFile(resolve(getRoot(),'node_modules/maplibre-gl/dist',filename));
     send(200,filename.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',bytes);
    }catch{send(404,'text/plain; charset=utf-8','Kartbibliotek mangler. Installer npm-avhengighetene.');}
    return;
   }
   if(filename==='property-modules.css'){
    if(!getSite()?.sitePages?.some(p=>p.id==='properties')&&!propertyPageEnabled(getSite())){send(404,'text/plain; charset=utf-8','Not found');return;}
    const bytes=await readFile(resolve(getRoot(),'server/property/runtime/property-modules.css'));
    send(200,'text/css; charset=utf-8',bytes);return;
   }
   // Use the imported website's module source in preview, not stale editor copies.
   // Serving browser files is safe: they are never imported/executed by Electron's Node process.
   const assistantAssetMap={
    'smart-assistant.js':'modules/smart-assistant/frontend/smart-assistant.js',
    'smart-assistant-live.js':'modules/smart-assistant/frontend/smart-assistant-live.js',
    'smart-assistant.css':'modules/smart-assistant/styles/smart-assistant.css'
   };
   if(Object.hasOwn(assistantAssetMap,filename)){
    if(getSite()?.smartAssistant?.enabled!==true){send(404,'text/plain; charset=utf-8','Modulen er deaktivert.');return;}
    const approvedModuleRoot=getModuleRoot();
    if(!approvedModuleRoot){send(404,'text/plain; charset=utf-8','Importer Smart Assistant modul-ZIP i WSET.');return;}
    const rel=assistantAssetMap[filename].replace(/^modules\/smart-assistant\//,'');
    const moduleFile=resolve(approvedModuleRoot,rel);
    const metadata=await lstat(moduleFile);
    const base=await realpath(approvedModuleRoot),actual=await realpath(moduleFile);
    if(!actual.startsWith(base+sep)||!metadata.isFile()||metadata.isSymbolicLink())throw Error('Unsafe module file');
    send(200,types[extname(moduleFile)],await readFile(moduleFile));return;
   }
   // Serve only the bundled/recognized language flag names, never arbitrary nested assets.
   if(/^assets\/flags\/(?:no|en|es|de|da|fi|fr|nl|pl|sv|ru)\.svg$/.test(filename)){
    const base=await realpath(resolve(getRoot(),'public'));const file=resolve(base,filename);const actual=await realpath(file);
    if(!actual.startsWith(base+sep)||!(await lstat(file)).isFile()||(await lstat(file)).isSymbolicLink())throw Error('Unsafe flag file');
    send(200,types['.svg'],await readFile(actual));return;
   }
   if(allowedFiles.has(filename)||(/^assets\/[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g|svg|avif)$/).test(filename)){
    const root=getRoot();
    const file=resolve(root,'public',filename);
    let bytes=await readFile(file);
    if(hasLegalContent(getSite())&&['site.js','styles.css'].includes(filename))bytes=Buffer.concat([bytes,Buffer.from(filename==='site.js'?globalLegalJs:globalLegalCss)]);
    send(200,types[extname(file)]||'application/octet-stream',bytes);return;
   }
   const report=validateSiteProject(getSite(),{root:getRoot()});
   if(!report.ok){send(422,'text/plain; charset=utf-8','Prosjektet inneholder ugyldig innhold. Rett feilene før forhåndsvisning.');return;}
   // Designer-only draft endpoint: disabled pages remain previewable/editable,
   // but they are never included in the exported static website.
   const draftRoute=pathname.match(/^\/__designer-preview\/([a-zA-Z0-9-]+)\/([a-z][a-z0-9-]*)\/?$/);
   if(draftRoute){
    const [,locale,pageId]=draftRoute;
    const site=getSite();
    if(!site.languages.some(l=>l.code===locale)||!site.sitePages.some(p=>p.id===pageId)){
     send(404,'text/plain; charset=utf-8','Ukjent side eller språk.');return;
    }
    const draft=structuredClone(site);
    draft.sitePages.find(p=>p.id===pageId).enabled=true;
    if(pageId==='properties'){
     const requested=url.searchParams.get('category');
     const category=['properties','developments'].includes(requested)?requested:'all';
     if(category!=='all'){draft.propertyModules??={};draft.propertyModules[category]={...draft.propertyModules[category],enabled:true,visibilityExplicit:true};}
     send(200,'text/html; charset=utf-8',propertyModulePreview(draft,locale,category,{listings:await localPropertyPreviewListings(getRoot(),draft)}).replace('</body>','<script src="/__wset-preview-bridge.js" defer></script></body>'),{'Content-Security-Policy':mapPolicy});return;
    }
    send(200,'text/html; charset=utf-8',previewDocument(draft,locale,pageId));return;
   }
   const moduleMatch=pathname.match(/^\/([a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*)\/eiendommer(?:\/(boliger-til-salgs|nybygg))?(?:\/(bolig\.php))?\/?$/);
   const legacyMatch=pathname.match(/^\/([a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*)\/(nybygg)(?:\/(bolig\.php))?\/?$/);
   if(moduleMatch||legacyMatch){
    const site=getSite(),language=(moduleMatch||legacyMatch)[1];
    const category=moduleMatch ? (moduleMatch[2]==='boliger-til-salgs'?'properties':moduleMatch[2]==='nybygg'?'developments':'all') : 'developments';
    const detail=moduleMatch?moduleMatch[3]:legacyMatch[3];
    const active=enabledPropertyModules(site);
    if((category==='all'?!propertyPageEnabled(site):!active.some(m=>m.id===category))||!site.languages.some(l=>l.code===language&&l.enabled!==false)){
      send(404,'text/plain; charset=utf-8','Modulen er ikke aktiv.');return;
    }
    send(200,'text/html; charset=utf-8',propertyModulePreview(site,language,category,{filters:Object.fromEntries(url.searchParams),detailId:detail?url.searchParams.get('id'):null,listings:await localPropertyPreviewListings(getRoot(),site)}),{'Content-Security-Policy':mapPolicy});return;
   }
   const slug=pathname.replace(/^\/+|\/+$/g,'');
   const entry=staticRoutes(getSite()).find(p=>p.slug===slug);
   if(!entry){send(404,'text/plain; charset=utf-8','Siden finnes ikke i dette prosjektet.');return;}
   const html=previewDocument(getSite(),entry.locale,entry.page);
   send(200,'text/html; charset=utf-8',html);
   },{registry});
  }catch(error){
   send(500,'text/plain; charset=utf-8','Kunne ikke vise denne siden: '+String(error.message||error).slice(0,300));
  }
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const address=server.address();
 return {url:`http://127.0.0.1:${address.port}`,draftImageToken,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
