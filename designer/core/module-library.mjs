/** Immutable per-user module library. Import only writes files; it NEVER runs code from a ZIP.
 * WSET supplies an approved module's absolute location to the website's fixed build pipeline.
 */
import {readFile,writeFile,mkdir,rm,rename,lstat,realpath,stat,readdir} from 'node:fs/promises';
import {resolve,join,sep,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {readSafeProjectZipEntries} from './project-archive.mjs';

const prefix='modules/smart-assistant/';
const required=['module.json','frontend/smart-assistant.js','frontend/smart-assistant-live.js','styles/smart-assistant.css','backend/src/Assistant.php','backend/runtime/api.php','backend/runtime/session.php','backend/runtime/entry-api.php'];
const versionRe=/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.+-]+)?$/;
const MAX_MODULE_ZIP=80*1024*1024;
export const MODULE_ID='smart-assistant';
function validateManifest(value){
 if(value?.schema!=='wset-website-module-v1'||value?.id!==MODULE_ID||value?.requiredProjectEngine!=='cbpm-astro-v1'||value?.deployment!=='manual-two-zip'||!versionRe.test(value.version||''))
  throw Error('ZIP-filen er ikke en kompatibel Smart Assistant-modul for CBPM.');
 if(value.public?.js?.join('|')!=='frontend/smart-assistant.js|frontend/smart-assistant-live.js'||value.public?.css?.join('|')!=='styles/smart-assistant.css')
  throw Error('Modulen har et ukjent offentlig grensesnitt.');
 if(!Array.isArray(value.endpoints)||value.endpoints.join('|')!=='/api/assistant/api.php|/api/assistant/session.php')throw Error('Modulen har ukjente endepunkter.');
 return {id:MODULE_ID,version:value.version,engine:value.requiredProjectEngine};
}
export function inspectAssistantModuleZip(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_MODULE_ZIP)throw Error('Modul-ZIP er for stor.');
 const entries=readSafeProjectZipEntries(bytes);
 const mapped=new Map();
 for(const {name,bytes:content} of entries){
  if(!name.startsWith(prefix)||name===prefix)throw Error('Modul-ZIP kan bare inneholde filer under modules/smart-assistant/: '+name);
  const rel=name.slice(prefix.length);
  if(!/^(?:module\.json|README\.md|backend\/[A-Za-z0-9._/-]+|frontend\/[A-Za-z0-9._/-]+|styles\/[A-Za-z0-9._/-]+|integration\/[A-Za-z0-9._/-]+|tests\/[A-Za-z0-9._/-]+)$/.test(rel))throw Error('Uventet modulfil: '+rel);
  if(mapped.has(rel))throw Error('Duplisert modulfil.');
  mapped.set(rel,content);
 }
 for(const name of required)if(!mapped.has(name))throw Error('Smart Assistant mangler fil: '+name);
 let manifest;try{manifest=JSON.parse(mapped.get('module.json').toString('utf8'))}catch{throw Error('Ugyldig module.json i modul-ZIP.');}
 const info=validateManifest(manifest);
 return {...info,files:mapped,checksum:createHash('sha256').update(bytes).digest('hex')};
}
function stateFile(libraryRoot){return join(resolve(libraryRoot),MODULE_ID,'active.json')}
export async function selectedAssistantModule({libraryRoot}={}){
 if(!libraryRoot)return null;
 let state;try{state=JSON.parse(await readFile(stateFile(libraryRoot),'utf8'))}catch{return null;}
 if(!state?.folder||!/^[0-9A-Za-z.+-]+-[a-f0-9]{12}$/.test(state.folder))return null;
 const home=resolve(libraryRoot,MODULE_ID,'versions');
 const folder=resolve(home,state.folder);
 const actual=await realpath(folder).catch(()=>null);
 if(!actual||!actual.startsWith(home+sep))return null;
 let manifest;
 try{manifest=JSON.parse(await readFile(join(actual,'module.json'),'utf8'));validateManifest(manifest)}catch{return null;}
 if(manifest.version!==state.version)return null;
 if(!state.hashes||required.some(name=>!Object.hasOwn(state.hashes,name)))return null;
 // Reject additions to an imported version: PHP staging copies whole backend/src/.
 const actualFiles=[];
 async function inventory(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=join(dir,entry.name);
   if(entry.isSymbolicLink())throw Error('Module has unsafe symbolic link');
   if(entry.isDirectory())await inventory(path);
   else if(entry.isFile())actualFiles.push(path.slice(actual.length+1).replaceAll('\\','/'));
   else throw Error('Unexpected file type in module');
  }
 }
 try{await inventory(actual);}catch{return null;}
 if(actualFiles.length!==Object.keys(state.hashes).length||actualFiles.some(name=>!Object.hasOwn(state.hashes,name)))return null;
 for(const [name,expected] of Object.entries(state.hashes)){
  if(!/^[A-Za-z0-9._/-]+$/.test(name)||name.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(expected))return null;
  const file=resolve(actual,name),info=await lstat(file).catch(()=>null),real=await realpath(file).catch(()=>null);
  if(!info?.isFile()||info.isSymbolicLink()||!real?.startsWith(actual+sep))return null;
  if(createHash('sha256').update(await readFile(real)).digest('hex')!==expected)return null;
 }
 return {id:MODULE_ID,version:manifest.version,root:actual,checksum:state.checksum};
}
export async function importAssistantModule({archive,libraryRoot}={}){
 if(!archive||!libraryRoot)throw Error('Velg en Smart Assistant-ZIP og modulbiblioteket.');
 const info=inspectAssistantModuleZip(await readFile(archive));
 const home=resolve(libraryRoot,MODULE_ID),versions=join(home,'versions');
 await mkdir(versions,{recursive:true});
 const folder=info.version+'-'+info.checksum.slice(0,12);
 const dest=join(versions,folder);
 const pending=join(versions,'.import-'+randomUUID());
 await mkdir(pending,{recursive:false});
 try{
  for(const [name,bytes] of info.files){
   const file=join(pending,name);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});
  }
  const present=await stat(dest).then(()=>true).catch(()=>false);
  if(!present)await rename(pending,dest);
 }finally{await rm(pending,{recursive:true,force:true});}
 // Switch active version atomically ONLY AFTER every required file passes inspection.
 const hashes=Object.fromEntries([...info.files].map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]));
 const next=join(home,'.active-'+randomUUID()+'.json');
 try{await writeFile(next,JSON.stringify({id:MODULE_ID,version:info.version,folder,checksum:info.checksum,hashes},null,2)+'\n',{flag:'wx'});await rename(next,stateFile(libraryRoot));}
 finally{await rm(next,{force:true});}
 const selected=await selectedAssistantModule({libraryRoot});
 if(!selected)throw Error('Modulen ble importert, men kunne ikke verifiseres.');
 return selected;
}
