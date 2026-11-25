/** Workspace paths and rebuildable local project registry. No website code is executed. */
import {mkdir,readFile,writeFile,rename,rm,readdir,lstat,realpath,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,relative,isAbsolute,sep,basename,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecentProjects,describeRecentProjects} from './recent-projects.mjs';
import {readProjectTemplate} from './template-contract.mjs';
import {normalizeDashboardInfo} from './project-dashboard.mjs';
import {normalizeLifecycle,updateLifecycle,publicationEvent,publicationSummary,contentDigest} from './project-lifecycle.mjs';
import {migrateProjectForDesigner} from './project-migrations.mjs';
import {validateSiteProject} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
export const folders={templates:'Templates',projects:'Projects',modules:'Modules',backups:'Backups',exports:'Exports',archive:'Archive'};
const validPath=p=>typeof p==='string'&&p.length<=4096&&isAbsolute(p)&&!p.includes('\0');
const inside=(a,b)=>{const r=relative(a,b);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep));};
async function atomic(file,data){await mkdir(dirname(file),{recursive:true});const tmp=file+'.tmp-'+randomUUID();try{await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function directories(path){try{return (await readdir(path,{withFileTypes:true})).filter(x=>x.isDirectory()&&!x.isSymbolicLink()&&!x.name.startsWith('.')&&!x.name.endsWith('.importing')).map(x=>join(path,x.name));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function ordinaryFile(file){const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink())throw Error('Ikke en ordinær fil: '+file);return st;}
const localMeta=root=>join(root,'.wset-local-project.json');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function workspacePaths(root,overrides={}){if(!validPath(root))throw Error('Velg en absolutt arbeidsområdemappe.');for(const [k,p] of Object.entries(overrides)){if(!Object.hasOwn(folders,k)||!validPath(p))throw Error('Ugyldig mappeinnstilling.');}return Object.fromEntries(Object.entries(folders).map(([k,name])=>[k,resolve(overrides[k]||join(root,name))]));}
async function prepare(root,overrides){const paths=workspacePaths(root,overrides);await mkdir(root,{recursive:true});const actual={};for(const [k,p] of Object.entries(paths)){await mkdir(p,{recursive:true});actual[k]=await realpath(p);}const all=Object.values(actual);for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)if(inside(all[i],all[j])||inside(all[j],all[i]))throw Error('Arbeidsområdets mapper må være adskilte, ikke overlappe.');return actual;}
export async function createWorkspace({dataRoot,defaultRoot,recentFile,unified=null}){
 const config=join(dataRoot,'wset-workspace.json'),registry=join(dataRoot,'wset-project-registry.json');
 let saved=unified?{schema:1,root:unified.root,overrides:{}}:await json(config,null),issues=unified?.issues||[],paths,queue=Promise.resolve();
 const serialize=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 if(unified){paths=unified.paths;}else if(!saved){
  saved={schema:1,root:resolve(defaultRoot),overrides:{}};paths=await prepare(saved.root,saved.overrides);
  // Legacy archives are copied once, originals retained. No project moves: server scopes depend on paths.
  for(const dir of await directories(join(dataRoot,'templates'))){try{const source=join(dir,'template.zip');await ordinaryFile(source);const dest=join(paths.templates,'Migrated-'+basename(dir)+'.zip');await copyFile(source,dest,constants.COPYFILE_EXCL).catch(e=>{if(e.code!=='EEXIST')throw e;});}catch(e){issues.push('Tidligere mal: '+e.message);}}
  // Existing modules remain at their original path if present, preserving approval/checksums.
  const oldModules=join(dataRoot,'modules');if((await directories(oldModules)).length){saved.overrides.modules=oldModules;paths=await prepare(saved.root,saved.overrides);}
  await atomic(config,saved);
 }else{if(saved.schema!==1)throw Error('Ukjent arbeidsområdeformat.');paths=workspacePaths(saved.root,saved.overrides);}
 const state=()=>({root:saved.root,overrides:{...saved.overrides},paths:{...paths},issues:[...issues]});
 async function remember(root,{fresh=false}={}){
  root=await realpath(root);if(unified&&dirname(root)!==paths.projects&&dirname(root)!==paths.archive)throw Error('Prosjektet må ligge direkte under Projects eller Archive.');await ordinaryFile(join(root,'project','website.json'));
  let meta;try{await ordinaryFile(localMeta(root));meta=await json(localMeta(root),null);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(fresh||!meta){meta={schema:1,id:randomUUID(),createdAt:new Date().toISOString()};await atomic(localMeta(root),meta);}
  if(meta.schema!==1||!uuid.test(meta.id))throw Error('Ugyldig lokal prosjektidentitet: '+root);
  return {root,archived:!!unified&&dirname(root)===paths.archive,id:meta.id,createdAt:meta.createdAt,dashboard:normalizeDashboardInfo(meta.dashboard||{}),lifecycle:normalizeLifecycle(meta.lifecycle||{}),publication:publicationSummary(meta.publications),designChangedAt:meta.designChangedAt||null,lastPublishedDigest:(Array.isArray(meta.publications)?meta.publications:[]).find(r=>r.kind==='website'&&r.outcome==='completed')?.digest||null};
 }
 async function readRegistry(){try{const r=await json(registry,[]);if(!Array.isArray(r))throw new SyntaxError('Ugyldig prosjektregister.');return r.filter(x=>validPath(x?.root)&&uuid.test(x?.id));}catch(e){if(!unified||!(e instanceof SyntaxError))throw e;await rename(registry,registry+'.corrupt-'+randomUUID());issues.push('Prosjektregisteret var skadet og er gjenoppbygget fra prosjektmappene.');return [];}}
 async function refreshProjects(){
  const old=await readRegistry(),roots=new Set(unified?[]:old.map(x=>x.root)),warnings=[];
  for(const base of (unified?[paths.projects,paths.archive]:[paths.projects,join(dataRoot,'projects')]))try{for(const p of await directories(base))roots.add(p);}catch(e){warnings.push(e.message);}
  if(!unified)for(const p of await readRecentProjects(recentFile))roots.add(p);
  const found=[],seen=new Set();for(const p of roots){try{const st=await lstat(p);if(!st.isDirectory()||st.isSymbolicLink())continue;await ordinaryFile(join(p,'package.json'));await ordinaryFile(join(p,'project','website.json'));const item=await remember(p);if(seen.has(item.root))continue;seen.add(item.root);if(found.some(x=>x.id===item.id)){if(unified){warnings.push('Duplisert prosjekt-ID, ikke registrert: '+item.root);continue;}warnings.push('Duplisert prosjekt-ID: '+item.root+' (ny lokal ID tildelt)');Object.assign(item,await remember(p,{fresh:true}));}found.push(item);}catch(e){if(e.code!=='ENOENT')warnings.push(e.message);}}
  const next=[...found,...(!unified?old.filter(x=>!seen.has(x.root)&&!found.some(y=>y.id===x.id)):[])].map(({root,id,createdAt})=>({root,id,createdAt}));if(JSON.stringify(next)!==JSON.stringify(old))await atomic(registry,next);
  const descriptions=await describeRecentProjects(found.map(x=>x.root));const items=await Promise.all(descriptions.map(async(p,i)=>{let template=null;try{template=await readProjectTemplate(p.root);}catch(e){warnings.push(e.message);}return {...p,...found[i],template};}));
  return {items,issues:warnings};
 }
 async function knownMeta(id){
  const item=(await refreshProjects()).items.find(p=>p.id===id);if(!item)throw Error('Prosjektet finnes ikke i prosjektregisteret.');
  const file=localMeta(item.root);await ordinaryFile(file);const meta=await json(file,null);if(meta?.id!==id)throw Error('Prosjektidentiteten er endret.');return {item,file,meta};
 }
 return {state,configure:(key,path)=>serialize(async()=>{if(unified)throw Error('Bruk flytting av hele arbeidsområdet.');if(!validPath(path)||key!=='root'&&!Object.hasOwn(folders,key))throw Error('Ugyldig arbeidsområdevalg.');await refreshProjects();const next={...saved,overrides:{...saved.overrides}};if(key==='root'){next.root=resolve(path);next.overrides={};}else next.overrides[key]=resolve(path);const nextPaths=await prepare(next.root,next.overrides);await atomic(config,next);saved=next;paths=nextPaths;return state();}),
  projects:()=>serialize(refreshProjects),
  archiveProject:(id,restore=false)=>serialize(async()=>{if(!unified)throw Error('Krever samlet arbeidsområde.');const {item}=await knownMeta(id);if(item.archived!==!!restore)throw Error('Prosjektet har allerede valgt plassering.');const dest=join(restore?paths.projects:paths.archive,basename(item.root));try{await lstat(dest);throw Error('Målmappen finnes allerede: '+dest);}catch(e){if(e.code!=='ENOENT')throw e;}await rename(item.root,dest);return {root:dest,id:item.id};}),
  updateLifecycle:(id,input)=>serialize(async()=>{const {file,meta}=await knownMeta(id);const lifecycle=updateLifecycle(meta.lifecycle||{},input);await atomic(file,{...meta,lifecycle});return lifecycle;}),
  validateLifecycle:(id)=>serialize(async()=>{const {item,file,meta}=await knownMeta(id);const source=join(item.root,'project','website.json');const st=await ordinaryFile(source);if(st.size>20*1024*1024)throw Error('Prosjektfilen er for stor.');const bytes=await readFile(source);let ok=false,errors=1,warnings=0;try{await readProjectTemplate(item.root);const result=validateSiteProject(migrateProjectForDesigner(JSON.parse(bytes.toString('utf8'))),{root:item.root});ok=result.ok;errors=result.errors.length;warnings=result.warnings.length;}catch{/* A parse/contract failure counts as one failed check. */}if(!bytes.equals(await readFile(source)))throw Error('Prosjektet ble endret under kontroll. Kjør på nytt.');const lifecycle={...normalizeLifecycle(meta.lifecycle||{}),validation:{at:new Date().toISOString(),digest:contentDigest(bytes),ok,errors,warnings}};await atomic(file,{...meta,lifecycle});return lifecycle.validation;}),
  publicationHistory:(id)=>serialize(async()=>{const {meta}=await knownMeta(id);return Array.isArray(meta.publications)?meta.publications:[];}),
  recordPublication:(root,input)=>serialize(async()=>{const entry=await remember(root);const file=localMeta(entry.root);await ordinaryFile(file);const meta=await json(file,null);if(meta?.id!==entry.id)throw Error('Prosjektidentiteten er endret.');const event=publicationEvent(input);await atomic(file,{...meta,publications:[event,...(Array.isArray(meta.publications)?meta.publications:[])]});return event;}),
  updateDashboard:(id,input)=>serialize(async()=>{
  const info=normalizeDashboardInfo(input);const item=(await refreshProjects()).items.find(p=>p.id===id);
  if(!item)throw Error('Prosjektet finnes ikke i prosjektregisteret.');
  const file=localMeta(item.root);await ordinaryFile(file);const meta=await json(file,null);if(meta?.id!==id)throw Error('Prosjektidentiteten er endret.');
  await atomic(file,{...meta,dashboard:info});return info;
 }),register:(root,options)=>serialize(async()=>{const entry=await remember(root,options);const old=await readRegistry();if(unified){for(const base of [paths.projects,paths.archive])for(const other of await directories(base)){if(other===entry.root)continue;const meta=await json(localMeta(other),null);if(meta?.id===entry.id)throw Error('Duplisert prosjekt-ID. Bruk Kopier prosjekt.');}}await atomic(registry,[entry,...old.filter(x=>x.root!==entry.root)].map(({root,id,createdAt})=>({root,id,createdAt})));return entry;})};
}
