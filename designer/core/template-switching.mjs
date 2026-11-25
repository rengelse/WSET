/** rc.52: staged local transaction, no publication or implicit archive-code execution. */
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readdir,readFile,writeFile,mkdir,copyFile,rename,rm,realpath} from 'node:fs/promises';
import {join,dirname,basename,relative,sep} from 'node:path';
import {readDesignerProject} from './project-storage.mjs';
import {assertTemplateUpdate} from './template-versions.mjs';
import {analyzeTemplateCompatibility} from './template-compatibility.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const generated=new Set(['node_modules','dist','.astro','preview-offline','exports']);
const exists=async p=>{try{await lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const digest=async p=>{const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');};
// Do not follow symlinks/junctions. Cache directories are retained in the original backup, never reused.
export async function inventory(root){
 const items=new Map(),caseNames=new Set();
 async function walk(dir,prefix=''){for(const name of (await readdir(dir)).sort()){
  if(!prefix&&generated.has(name))continue;
  const rel=prefix+name,p=join(dir,name),st=await lstat(p),key=rel.toLowerCase();
  if(caseNames.has(key)||st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory()))throw Error('Utrygg eller tvetydig prosjektfil: '+rel);caseNames.add(key);
  if(st.isDirectory()){items.set(rel,{dir:true});await walk(p,rel+'/');}else items.set(rel,{digest:await digest(p),size:st.size});
 }}
 const st=await lstat(root);if(!st.isDirectory()||st.isSymbolicLink())throw Error('Prosjektmappen må være en ordinær mappe.');await walk(root);return items;
}
const fingerprint=items=>sha(JSON.stringify([...items].sort(([a],[b])=>a.localeCompare(b))));
const isCode=n=>/^(?:src|scripts|site-tools)\//.test(n)||/^public\/assets\/.*\.(?:css|js|mjs)$/.test(n)||/^(?:package(?:-lock)?\.json|astro\.config\.mjs|README\.md)$/.test(n)||/^public\/(?:styles\.css|designer-sections\.css|site\.js|designer-preview(?:-select)?\.(?:js|css)|favicon\.svg)$/.test(n);
const isAsset=n=>n.startsWith('public/assets/');
const isMetadata=n=>n==='project/template.json'||n.startsWith('project/template-previews/');
const inside=(a,b)=>b===a||b.startsWith(a+sep);
async function atomicJson(file,value){const tmp=file+'.tmp-'+randomUUID();try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
async function copyInventory(root,dest,items){await mkdir(dest,{mode:0o700});for(const [n,v] of items){const p=join(dest,n);if(v.dir)await mkdir(p,{recursive:true});else{await mkdir(dirname(p),{recursive:true});await copyFile(join(root,n),p);if(await digest(p)!==v.digest)throw Error('Prosjektfil endret under kopiering: '+n);}}}
const ticketPattern=/^\.wset-switch-[0-9a-f-]{36}$/;
async function backupParent(root,backupRoot){if(!backupRoot)return dirname(root);const meta=JSON.parse(await readFile(join(root,'.wset-local-project.json'),'utf8'));if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meta.id))throw Error('Ugyldig prosjekt-ID.');const dir=join(backupRoot,meta.id);await mkdir(dir,{recursive:true});if(relative(dir,await realpath(dir))!=='')throw Error('Utrygg sikkerhetskopimappe.');return dir;}
async function newStage(root,backupRoot){const dir=join(await backupParent(root,backupRoot),'.wset-switch-'+randomUUID());await mkdir(dir,{mode:0o700});return dir;}
async function readManifest(dir,root){if(!ticketPattern.test(basename(dir)))throw Error('Ugyldig sikkerhetskopi.');const meta=JSON.parse(await readFile(join(dir,'transaction.json'),'utf8'));if(meta.schema!==1||(meta.projectId?meta.projectId!==(await (async()=>{const f=await exists(root)?root:join(dir,'original');return JSON.parse(await readFile(join(f,'.wset-local-project.json'),'utf8'));})()).id:meta.root!==root))throw Error('Sikkerhetskopien tilhører ikke prosjektet.');return meta;}
export async function prepareTemplateSwitch({source,target,staged,registry,intent='switch',backupRoot}){
 if(intent!=='switch'&&intent!=='update')throw Error('Ugyldig maloperasjon.');
 const kind=intent==='update'||source.template.id===target.template.id?'update':'switch';if(kind==='update')assertTemplateUpdate(source.template,target.template);
 if(source.dirty)throw Error('Lagre prosjektet før malbytte.');const root=await realpath(source.root);
 const before=await inventory(root),sourceDigest=fingerprint(before),saved=await readDesignerProject(root,{registry});
 if(saved.revision!==source.revision||JSON.stringify(saved.site)!==JSON.stringify(source.site)||JSON.stringify(saved.template)!==JSON.stringify(source.template))throw Error('Prosjektet er endret. Last inn på nytt.');
 const report=await analyzeTemplateCompatibility({source,target,registry});if(report.counts.blocked)throw Error('Malbytte blokkert: '+report.rows.filter(x=>x.status==='blocked').slice(0,5).map(x=>x.id).join(', '));
 if(JSON.stringify(staged.template)!==JSON.stringify(target.template))throw Error('Målmalen er endret.');
 const dir=await newStage(root,backupRoot),candidate=join(dir,'candidate');
 try{
  await copyInventory(root,candidate,before);
  const targetItems=await inventory(staged.root),sourceCase=new Map([...before.keys()].map(n=>[n.toLowerCase(),n]));const replaced=[],added=[],preserved=[];
  for(const [n,v] of targetItems){if(v.dir)continue;const old=before.get(n),caseMatch=sourceCase.get(n.toLowerCase());
   if(caseMatch&&caseMatch!==n)throw Error('Filnavnkonflikt: '+n);
   if(old?.dir)throw Error('Fil/mappe-konflikt: '+n);
   if(isCode(n)||isMetadata(n)||isAsset(n)&&!old){if(old?.digest===v.digest)continue;const p=join(candidate,n);await mkdir(dirname(p),{recursive:true});await copyFile(join(staged.root,n),p);(old?replaced:added).push(n);}
   else if(isAsset(n)&&old&&old.digest!==v.digest)preserved.push(n);
   else if(n.startsWith('server/')&&(!old||old.digest!==v.digest))throw Error('Malen krever endring i serverkode. Separat migrering må avklares: '+n);
  }
  // A removed design file cannot silently persist from the old renderer; explicit conservative block.
  for(const [n,v] of before)if(!v.dir&&isCode(n)&&!targetItems.has(n)&&!['README.md','package-lock.json'].includes(n))throw Error('Kildekode uten motpart i ny mal: '+n);
  await writeFile(join(candidate,'project/template.json'),JSON.stringify(target.template,null,2)+'\n');
  const next=await readDesignerProject(candidate,{registry});
  if(next.revision!==source.revision||JSON.stringify(next.site)!==JSON.stringify(source.site))throw Error('Kandidatens prosjektinnhold avviker.');
  const prepared=await inventory(candidate);
  if(fingerprint(await inventory(root))!==sourceDigest)throw Error('Prosjektet ble endret under klargjøring.');
  return {root,dir,candidate,kind,sourceDigest,sourceTemplate:source.template,targetTemplate:target.template,targetDigest:target.digest,report,replaced,added,preserved,preparedDigest:fingerprint(prepared),prepared,site:next.site,revision:next.revision};
 }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
}
export async function disposeTemplateSwitch(plan){if(plan&&!(await exists(join(plan.dir,'original'))))await rm(plan.dir,{recursive:true,force:true});}
async function swap({root,dir,candidate,journal,meta}){
 const original=join(dir,'original');await atomicJson(join(dir,'transaction.json'),{schema:1,root,...(dirname(dir)!==dirname(root)?{projectId:JSON.parse(await readFile(join(root,'.wset-local-project.json'),'utf8')).id}:{}),...meta,at:new Date().toISOString()});
 // Durable pointer lives outside the moving project. Recovery never overwrites an existing root.
 await mkdir(dirname(journal),{recursive:true});if(await exists(journal))throw Error('En tidligere maltransaksjon må gjenopprettes først.');
 await atomicJson(journal,{schema:1,root,dir,candidate});
 try{await rename(root,original);try{await rename(candidate,root);}catch(e){await rename(original,root);throw e;}}
 catch(e){if(await exists(root))await rm(journal,{force:true});throw e;}
 await rm(journal,{force:true});return {backup:dir};
}
export async function recoverTemplateSwitch(journal,backupRoot){
 if(!await exists(journal))return false;const j=JSON.parse(await readFile(journal,'utf8'));
 if(j.schema!==1||(dirname(j.dir)!==dirname(j.root)&&(!backupRoot||dirname(dirname(j.dir))!==backupRoot||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(basename(dirname(j.dir)))))||!ticketPattern.test(basename(j.dir))||j.candidate!==join(j.dir,'candidate'))throw Error('Ugyldig maltransaksjon.');
 await readManifest(j.dir,j.root);const original=join(j.dir,'original');
 if(!await exists(j.root)){if(!await exists(original))throw Error('Prosjekt og sikkerhetskopi mangler: '+j.root);await rename(original,j.root);}
 await rm(journal,{force:true});return true;
}
export async function commitTemplateSwitch({plan,journal,verifyBuild,checkTarget,approved=false}){
 if(!approved)throw Error('Malbytte krever eksplisitt godkjenning.');
 if(fingerprint(await inventory(plan.root))!==plan.sourceDigest)throw Error('Prosjektet er endret. Kjør ny kontroll.');
 if(fingerprint(await inventory(plan.candidate))!==plan.preparedDigest)throw Error('Kandidaten er endret. Kjør ny kontroll.');
 await checkTarget();
 const buildRoot=join(plan.dir,'build');await copyInventory(plan.candidate,buildRoot,plan.prepared);
 try{await verifyBuild({...plan,candidate:buildRoot});}finally{await rm(buildRoot,{recursive:true,force:true});}
 if(fingerprint(await inventory(plan.candidate))!==plan.preparedDigest)throw Error('Kandidaten er endret under bygging.');
 if(fingerprint(await inventory(plan.root))!==plan.sourceDigest)throw Error('Prosjektet ble endret under bygging.');
 await checkTarget();
 // Remove dry-run outputs so no candidate export is mistaken for a published website.
 for(const name of ['dist','exports','.astro','preview-offline'])await rm(join(plan.candidate,name),{recursive:true,force:true});
 await markDesignChanged(plan.root,plan.candidate);
 if(fingerprint(await inventory(plan.root))!==plan.sourceDigest)throw Error('Prosjektet ble endret før aktivering.');
 return swap({root:plan.root,dir:plan.dir,candidate:plan.candidate,journal,meta:{from:plan.sourceTemplate,to:plan.targetTemplate,kind:plan.kind||'switch',originalDigest:plan.sourceDigest}});
}
async function markDesignChanged(root,candidate){const p=join(root,'.wset-local-project.json');if(await exists(p)){const meta=JSON.parse(await readFile(p,'utf8'));meta.designChangedAt=new Date().toISOString();if(meta.lifecycle)meta.lifecycle.validation=null;await atomicJson(join(candidate,'.wset-local-project.json'),meta);}}
export async function listTemplateBackups(root,backupRoot){root=await realpath(root);const parent=await backupParent(root,backupRoot),out=[];for(const d of await readdir(parent,{withFileTypes:true})){if(!d.isDirectory()||!ticketPattern.test(d.name))continue;const dir=join(parent,d.name);try{const m=await readManifest(dir,root);if(await exists(join(dir,'original')))out.push({id:d.name,...m});}catch{}}return out.sort((a,b)=>b.at.localeCompare(a.at));}
export async function rollbackTemplateSwitch({root,id,journal,expectedRevision,approved=false,registry,backupRoot}){
 if(!approved||!ticketPattern.test(id))throw Error('Tilbakeføring krever en godkjent sikkerhetskopi.');root=await realpath(root);const old=join(await backupParent(root,backupRoot),id),meta=await readManifest(old,root),backup=join(old,'original');
 const current=await readDesignerProject(root,{registry});if(expectedRevision&&current.revision!==expectedRevision)throw Error('Prosjektet er endret siden åpning. Last inn på nytt.');const previous=await readDesignerProject(backup,{registry}),before=fingerprint(await inventory(root));
 // Preserve the selected backup as well as today's full original, including newer work.
 const dir=await newStage(root,backupRoot),candidate=join(dir,'candidate');
 try{const files=await inventory(backup);if(meta.originalDigest&&fingerprint(files)!==meta.originalDigest)throw Error('Sikkerhetskopien er endret.');await copyInventory(backup,candidate,files);if(fingerprint(await inventory(candidate))!==fingerprint(files)||fingerprint(await inventory(root))!==before)throw Error('Prosjekt eller sikkerhetskopi er endret.');
  await markDesignChanged(root,candidate);
  if(fingerprint(await inventory(root))!==before)throw Error('Prosjektet ble endret før tilbakeføring.');
  return await swap({root,dir,candidate,journal,meta:{kind:'rollback',from:current.template,to:previous.template,restoredFrom:id,originalDigest:before}});
 }catch(e){if(!await exists(join(dir,'original'))&&!await exists(journal))await rm(dir,{recursive:true,force:true});throw e;}
}
