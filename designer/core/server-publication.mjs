/** rc.42: map validated publication outputs to explicit server destinations. No server-side extraction. */
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {zipFiles} from './website-generator.mjs';
import {remotePath,safeName} from './server-manager.mjs';
const p=path.posix;
const own='storage/imports/Existing/wset-egne-boliger.xml';
const ownMarker='<!-- WSET managed own-property feed v1 -->';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export async function archiveDigests(pub,priv){return [sha256(await readFile(pub)),sha256(await readFile(priv))];}
export function publicationRoots(accountRoot,webRoot){
 if(typeof accountRoot!=='string'||accountRoot.split('/').some(s=>s==='.'||s==='..'))throw Error('Oppgi nøyaktig absolutt kontomappe.');
 const account=remotePath(accountRoot).replace(/\/$/,'')||'/';
 if(!['www','public','public_html'].includes(webRoot))throw Error('Ugyldig offentlig mappe.');
 if(['www','public','public_html','storage','app','config','vendor'].includes(p.basename(account).toLowerCase()))throw Error('Kontomappen skal ligge over webroten og private mapper.');
 return {account,web:p.join(account,webRoot),webRoot};
}
function checkedName(name){const clean=name.endsWith('/')?name.slice(0,-1):name;for(const part of clean.split('/'))safeName(part);return clean;}
function entry(name,bytes,root,policy='replace',extra={}){const clean=checkedName(name);return {dest:p.join(root,clean),type:name.endsWith('/')?'directory':'file',bytes,policy,...extra};}
const privateAllowed=/^(app|config|storage|vendor)\//;
const publicForbidden=/(^|\/)(?:www|public|public_html|app|config|storage|vendor|project|server|uploads|cbpm-private)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|private-payload|cbpm-private-init/i;
function order(rows){return rows.sort((a,b)=>Number(b.type==='directory')-Number(a.type==='directory')||(a.type==='directory'?a.dest.split('/').length-b.dest.split('/').length:0)|| (a.phase||0)-(b.phase||0)||a.dest.localeCompare(b.dest));}
export async function websitePlan({publicZip,privateZip,digests,accountRoot,webRoot}){
 const roots=publicationRoots(accountRoot,webRoot),pubBytes=await readFile(publicZip),privBytes=await readFile(privateZip);
 if(!digests||sha256(pubBytes)!==digests[0]||sha256(privBytes)!==digests[1])throw Error('ZIP-filene er endret. Generer nettstedet på nytt.');
 const pub=zipFiles(pubBytes),priv=zipFiles(privBytes),rows=[];
 if(!pub.has('index.html')||!pub.has('assets/css/styles.css')||!priv.has('app/properties/cbpm-repository.php'))throw Error('Ufullstendig nettstedseksport.');
 for(const [name,bytes] of priv){if(!privateAllowed.test(name))throw Error('Uventet privat eksportsti: '+name);rows.push(entry(name,bytes,roots.account,/^(config|storage)\//.test(name)?'preserve':'replace',{phase:/\.xml$/i.test(name)?3:1,private:true}));}
 for(const [name,bytes] of pub){if(publicForbidden.test(name))throw Error('Privat eller ugyldig offentlig eksportsti: '+name);rows.push(entry(name,bytes,roots.web,'replace',{phase:/\.html$/i.test(name)?5:name==='cbpm-publication-manifest.json'?6:4}));}
 return {...roots,kind:'website',rows:order(rows)};
}
export function propertyPlan({result,category,accountRoot,webRoot,replaceSupplier=false,removeOwn=false}){
 if(!['New','Existing'].includes(category))throw Error('Ugyldig boligkategori.');const roots=publicationRoots(accountRoot,webRoot),rows=[];
 const prefix=`storage/imports/${category}/`;
 for(const {name,bytes} of result.entries){if(['WSET-OVERFORING.json','LES-MEG.txt'].includes(name))continue;
 if(!name.startsWith(prefix))throw Error('Uventet boligeksportsti: '+name);const tail=name.slice(prefix.length);
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,49}\.xml$/i.test(tail)&&tail!=='wset-listing-status.json'&&!(category==='Existing'&&/^images\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.(?:jpe?g|png|webp|avif)$/i.test(tail)))throw Error('Uventet boligfil: '+name);
 const isOwn=name===own;if(isOwn&&!bytes.toString('utf8').includes(ownMarker))throw Error('Egen XML mangler WSET-identitet.');
 const policy=isOwn?'owned':tail.startsWith('images/')?'immutable':tail==='wset-listing-status.json'?'replace':replaceSupplier&&tail.endsWith('.xml')?'replace':'preserve';
 rows.push(entry(name,bytes,roots.account,policy,{phase:tail.startsWith('images/')?1:tail.endsWith('.xml')?2:3,private:true}));
 }
 if((result.remove||[]).some(name=>name!==own||category!=='Existing'))throw Error('Ugyldig fjerningsmanifest.');
 if(removeOwn&&result.remove?.includes(own))rows.push({dest:p.join(roots.account,own),type:'delete',policy:'owned',bytes:Buffer.alloc(0),phase:4,private:true});
 return {...roots,kind:category,rows:order(rows),pendingRemoval:!removeOwn&&!!result.remove?.length,replaceSupplier:!!replaceSupplier};
}
export const ownedFeedMarker=ownMarker;
