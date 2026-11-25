/** Read-only saved project summaries. No renderer or imported code is executed. */
import {lstat,realpath,open} from 'node:fs/promises';
import {join,relative,isAbsolute,sep,extname} from 'node:path';
import {contentDigest,normalizeLifecycle,lifecycleProgress} from './project-lifecycle.mjs';
const within=(root,file)=>{const r=relative(root,file);return !!r&&!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep);};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const arr=v=>Array.isArray(v)?v:[];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
async function bounded(root,name,max){
 const file=join(root,name),actual=await realpath(file),st=await lstat(file);
 if(!within(root,actual)||!st.isFile()||st.isSymbolicLink()||st.size>max)throw Error('Ugyldig eller for stor prosjektfil.');
 const handle=await open(file,'r');try{const b=Buffer.alloc(st.size+1),{bytesRead}=await handle.read(b,0,b.length,0);if(bytesRead!==st.size)throw Error('Prosjektfilen ble endret under lesing.');return {bytes:b.subarray(0,bytesRead),stat:st};}finally{await handle.close();}
}
export function normalizeDashboardInfo(input={}){
 if(!object(input))throw Error('Ugyldig prosjektinformasjon.');
 const result={};for(const [key,max] of Object.entries({name:160,customer:160,domain:253})){
  const value=input[key]??'';if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw Error('Ugyldig prosjektfelt: '+key);result[key]=value.trim();
 }
 // Domain is administrative information only. Never navigate to an entered URL.
 return result;
}
async function savedSite(root){const {bytes,stat}=await bounded(root,'project/website.json',20*1024*1024);const site=JSON.parse(bytes.toString('utf8'));if(!object(site))throw Error('Ugyldig prosjektdata.');return {site,stat,digest:contentDigest(bytes)};}
export async function dashboardSummary(item){
 try{
  const {site,stat,digest}=await savedSite(item.root);const info=normalizeDashboardInfo(item.dashboard||{});
  const pages=arr(site.sitePages),languages=arr(site.languages);
  const lifecycle=normalizeLifecycle(item.lifecycle||{});const {lastPublishedDigest,...safe}=item;
  return {...safe,lifecycle,progress:lifecycleProgress(lifecycle,digest),publication:{...item.publication,contentChanged:item.designChangedAt&&item.publication?.lastPublication&&item.designChangedAt>item.publication.lastPublication?true:lastPublishedDigest?lastPublishedDigest!==digest:null},dashboard:info,websiteName:text(site.brand?.displayName)||item.name,name:info.name||item.name,updatedAt:stat.mtime.toISOString(),pages:pages.filter(p=>p&&p.enabled!==false).length,languages:languages.filter(l=>l&&l.enabled!==false).length,media:arr(site.media?.items).length,readable:true};
 }catch(e){return {...item,name:item.dashboard?.name||item.name,readable:false,error:e.message};}
}
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif'};
function raster(bytes,ext){if(ext==='.png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(ext==='.jpg'||ext==='.jpeg')return bytes[0]===255&&bytes[1]===216;if(ext==='.webp')return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(ext==='.avif')return bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12));return false;}
export async function dashboardCover(item){
 try{
  const {site}=await savedSite(item.root);const home=arr(site.sitePages).find(p=>p?.id==='home'&&p.enabled!==false);
  const hero=arr(home?.sections).find(s=>s?.enabled!==false&&(s?.slot==='hero'||s?.type==='hero'));
  // For Mal 01 the saved home hero is the appropriate project-specific cover.
  // Other renderers can supply an explicit hero image; no guessed remote URLs.
  const src=hero&&(hero.image||site.brand?.images?.hero||(item.template?.id==='property.mediterranean-premium'?'/assets/hero.webp':''));
  if(typeof src!=='string'||!/^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/i.test(src))return null;
  const ext=extname(src).toLowerCase(),{bytes}=await bounded(item.root,'public'+src,2*1024*1024);
  if(!raster(bytes,ext))return null;return 'data:'+mime[ext]+';base64,'+bytes.toString('base64');
 }catch{return null;}
}
