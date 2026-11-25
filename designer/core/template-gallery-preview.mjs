/** Disposable read-only gallery server. Only editor-owned renderers execute in Node.
 * Imported browser assets are served in a sandboxed frame on a separate loopback origin.
 */
import {createServer} from 'node:http';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {previewDocument} from './preview-server.mjs';
import {withTemplateRenderer,installedRenderers} from './renderer-runtime.mjs';
import {staticRoutes} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {hasLegalContent,globalLegalJs,globalLegalCss} from '../engines/cbpm-astro-v1/lib/global-content.mjs';
import {pageDesignCss} from './design-styles.mjs';
const types={'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'};
const policy="sandbox allow-scripts; default-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; worker-src 'none'";
const isAsset=name=>['styles.css','designer-sections.css','site.js','favicon.svg'].includes(name)||/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:css|png|jpe?g|webp|avif|svg|woff2?)$/.test(name);
export async function startTemplateGalleryPreview({root,site,template,registry=installedRenderers}){
 const demo=structuredClone(site); // Never change archive or active project.
 // Server-dependent functionality is not executed in gallery mode.
 if(demo.smartAssistant)demo.smartAssistant.enabled=false;
 const routes=withTemplateRenderer(template,()=>staticRoutes(demo),{registry});
 const pages=routes.map(({slug,locale,page})=>({path:'/'+slug+'/',locale,page,label:(demo.sitePages.find(p=>p.id===page)?.title?.[locale]||demo.projects?.find(p=>'project-'+p.id===page)?.title?.[locale]||page)}));
 const home=pages.find(p=>p.locale===demo.defaultLanguage&&p.page==='home')||pages[0];
 if(!home)throw Error('Malen har ingen synlige sider.');
 const base=await realpath(resolve(root,'public'));
 const server=createServer(async(req,res)=>{
  const send=(status,type,body,extra={})=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':policy,'Referrer-Policy':'no-referrer',...extra});res.end(req.method==='HEAD'?undefined:body);};
  const text=(status,msg)=>send(status,'text/plain; charset=utf-8',msg);
  if(!['GET','HEAD'].includes(req.method))return text(405,'Method not allowed');
  if(req.headers.host!==`127.0.0.1:${server.address()?.port}`)return text(403,'Forbidden');
  try{
   const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),name=path.slice(1);
   if(path==='/')return send(302,'text/plain','',{'Location':home.path});
   const design=path.match(/^\/__wset-design\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\.css$/);
   if(design){const [,locale,page]=design;if(!pages.some(p=>p.locale===locale&&p.page===page)||!demo.sitePages.some(p=>p.id===page))return text(404,'Not found');return send(200,types['.css'],withTemplateRenderer(template,()=>pageDesignCss(demo,page,locale),{registry}));}
   if(isAsset(name)){
    const file=resolve(base,name),actual=await realpath(file),st=await lstat(file);
    if(!actual.startsWith(base+sep)||!st.isFile()||st.isSymbolicLink()||st.size>65*1024*1024)return text(404,'Not found');
    let bytes=await readFile(actual);if(hasLegalContent(demo)&&['site.js','styles.css'].includes(name))bytes=Buffer.concat([bytes,Buffer.from(name==='site.js'?globalLegalJs:globalLegalCss)]);
    return send(200,types[extname(name)],bytes);
   }
   const entry=pages.find(p=>p.path===path||p.path===path+'/');if(!entry)return text(404,'Siden eller funksjonen er ikke tilgjengelig i malforhåndsvisningen.');
   const html=withTemplateRenderer(template,()=>previewDocument(demo,entry.locale,entry.page),{registry}).replace('<script src="/__wset-preview-bridge.js" defer></script>','');
   return send(200,'text/html; charset=utf-8',html);
  }catch(error){return text(error.code==='ENOENT'?404:500,'Kunne ikke vise denne ressursen.');}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 let closing;return {origin,url:origin+home.path,pages,close:()=>closing??=new Promise((ok,fail)=>{server.close(e=>e?fail(e):ok());server.closeAllConnections();})};
}
/** One session per editor. Serial operations prevent leaking stages on fast switches. */
export function createTemplateGallerySessions({library,start=startTemplateGalleryPreview}){
 let active=null,queue=Promise.resolve();
 const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function stop(){const old=active;active=null;if(old)try{await old.server.close();}finally{await old.dispose();}}
 return {openCandidate:staged=>serial(async()=>{await stop();const server=await start(staged);active={server,dispose:async()=>{}};return {origin:server.origin,url:server.url,pages:server.pages};}),open:key=>serial(async()=>{await stop();const staged=await library.stagePreview(key);try{const server=await start(staged);active={server,dispose:staged.dispose};return {origin:server.origin,url:server.url,pages:server.pages};}catch(e){await staged.dispose();throw e;}}),close:()=>serial(stop),origin:()=>active?.server.origin||null};
}
