/** WSET editable project ZIP – independent of website deployment archives.
 * This module never runs code found in an imported archive. Import only
 * creates a private local project copy and validates its declared format.
 */
import {readFile,writeFile,mkdir,rename,rm,readdir,lstat,stat,realpath} from 'node:fs/promises';
import {resolve,join,relative,sep,dirname,basename,isAbsolute} from 'node:path';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {TEMPLATE_PATH,parseTemplateDescriptor,resolveTemplateDescriptor} from './template-contract.mjs';
import {normalizeDashboardInfo} from './project-dashboard.mjs';
import {readDesignerProject,readProjectData} from './project-storage.mjs';

export const PROJECT_FORMAT='wset-editable-project';
const MAX_ARCHIVE=512*1024*1024,MAX_FILE=65*1024*1024,MAX_TOTAL=1024*1024*1024,MAX_FILES=12000;
const allowedRoots=new Set(['src','public','server','scripts','project','site-tools','tests','modules']);
const allowedFiles=new Set(['astro.config.mjs','package.json','package-lock.json','README.md']);
const ignored=new Set(['node_modules','dist','exports','.astro','.git','preview-offline','_migration-backup-v101','backups']);
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;});
const crc32=buffer=>{let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const cleanSlashes=p=>p.replaceAll('\\','/');
function safeName(name){
 if(!name||name.length>1024||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.includes(':'))return false;
 const parts=name.replace(/\/$/,'').split('/');
 return parts.every(part=>part&&part!=='.'&&part!=='..'&&!part.endsWith('.')&&!part.endsWith(' ')&&
  !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
function privateName(name){
 const parts=name.split('/');
 return parts.some(n=>ignored.has(n)||n==='.env'||n.startsWith('.env.')||n.startsWith('.secret')||n==='credentials.json'||n==='id_rsa'||n==='id_ed25519');
}
function approvedName(name,kind){
 if(!safeName(name)||privateName(name)||name==='wset-project.json')return false;
 const parts=name.split('/');
 if(!allowedRoots.has(parts[0])&&!allowedFiles.has(name))return false;
 if(parts[0]==='modules'){
  if(parts.length<3||!/^[a-z][a-z0-9-]{0,60}$/.test(parts[1])||!/\.(?:js|mjs|json|php|css|md|svg|webp|png|jpe?g|txt)$/.test(name))return false;
 }
 if(parts[0]==='tests'&&parts[1]!=='fixtures')return false;
 if(kind==='template'&&parts[0]==='project'&&['property-feeds','property-draft-images','backups'].includes(parts[1]))return false;
 return true;
}
// Explicit directory records are optional ZIP metadata. Accept only safe
// directories in the same namespaces as project files; never extract them.
function approvedDirectory(name){
 const path=name.slice(0,-1),parts=path.split('/');
 if(!safeName(name)||privateName(path)||!allowedRoots.has(parts[0]))return false;
 if(parts[0]==='tests'&&parts.length>1&&parts[1]!=='fixtures')return false;
 if(parts[0]==='modules'&&parts.length>1&&!/^[a-z][a-z0-9-]{0,60}$/.test(parts[1]))return false;
 return true;
}
export function writeZip(entries,{privateFiles=false}={}){
 let offset=0;const local=[],central=[];const names=new Set();
 for(const {name,bytes} of entries){
  if(!safeName(name)||names.has(name.toLowerCase()))throw Error('Ugyldig eller duplisert filnavn i prosjektet: '+name);
  names.add(name.toLowerCase());const filename=Buffer.from(name,'utf8');const zipped=deflateRawSync(bytes,{level:6});
  const crc=crc32(bytes),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(8,8);head.writeUInt32LE(crc,14);head.writeUInt32LE(zipped.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(filename.length,26);
  local.push(head,filename,zipped);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE((3<<8)|20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(zipped.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(name.endsWith('/')?(((privateFiles?0o40750:0o40755)<<16)|0x10)>>>0:((privateFiles?0o100640:0o100644)<<16)>>>0,38);c.writeUInt32LE(offset,42);
  central.push(c,filename);offset+=head.length+filename.length+zipped.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0);const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,end]);
}
export function readSafeProjectZipEntries(bytes){
 if(bytes.length>MAX_ARCHIVE||bytes.length<22)throw Error('ZIP-filen er for stor eller ugyldig.');
 let eocd=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--){if(bytes.readUInt32LE(at)===0x06054b50){eocd=at;break;}}
 if(eocd<0)throw Error('ZIP-filen mangler en gyldig sluttindeks.');
 if(bytes.readUInt16LE(eocd+4)!==0||bytes.readUInt16LE(eocd+6)!==0)throw Error('ZIP med flere disker støttes ikke.');
 const count=bytes.readUInt16LE(eocd+10),centralSize=bytes.readUInt32LE(eocd+12);
 let offset=bytes.readUInt32LE(eocd+16),total=0;const entries=[],names=new Set(),paths=new Map();
 if(count>MAX_FILES||offset+centralSize>eocd)throw Error('ZIP-filen inneholder for mange eller ugyldige oppføringer.');
 for(let i=0;i<count;i++){
  if(offset+46>eocd||bytes.readUInt32LE(offset)!==0x02014b50)throw Error('Ødelagt ZIP-indeks.');
  const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),crc=bytes.readUInt32LE(offset+16),length=bytes.readUInt32LE(offset+24),compressed=bytes.readUInt32LE(offset+20);
  const nameLen=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),external=bytes.readUInt32LE(offset+38),localAt=bytes.readUInt32LE(offset+42);
  const next=offset+46+nameLen+extra+comment;
  if(next>eocd)throw Error('Ugyldig ZIP-filnavn.');
  const name=bytes.toString('utf8',offset+46,offset+46+nameLen);offset=next;
  const directory=name.endsWith('/'),type=external>>>16&0o170000;
  if(!safeName(name)||names.has(name.toLowerCase())||!(directory?approvedDirectory(name):approvedName(name,'project')||name==='wset-project.json'))throw Error('Ikke tillatt fil i prosjekt-ZIP: '+name);
  names.add(name.toLowerCase());
  if(type===0o120000)throw Error('Symbolske lenker i ZIP er ikke tillatt.');
  if(directory?(type!==0&&type!==0o040000):(type===0o040000||Boolean(external&0x10)))throw Error('Ugyldig filtype i ZIP: '+name);
  if(directory&&(length!==0||crc!==0))throw Error('Mappeoppføring i ZIP inneholder fildata: '+name);
  // Reject file/directory collisions (including implicit parents) and
  // inconsistent case, even on case-sensitive test hosts.
  const parts=(directory?name.slice(0,-1):name).split('/');
  for(let j=1;j<=parts.length;j++){
   const path=parts.slice(0,j).join('/'),key=path.toLowerCase(),isDir=j<parts.length||directory,prior=paths.get(key);
   if(prior&&(prior.directory!==isDir||prior.path!==path))throw Error('Motstridende fil- eller mappebane i ZIP: '+name);
   paths.set(key,{path,directory:isDir});
  }
  if(flags&1||![0,8].includes(method)||length>MAX_FILE||compressed>MAX_ARCHIVE)throw Error('Utrygg ZIP-oppføring: '+name);
  total+=length;if(total>MAX_TOTAL)throw Error('ZIP-innholdet er for stort.');
  if(localAt+30>bytes.length||bytes.readUInt32LE(localAt)!==0x04034b50)throw Error('Ugyldig filplassering i ZIP.');
  const localNameLen=bytes.readUInt16LE(localAt+26),localExtra=bytes.readUInt16LE(localAt+28);
  const fileAt=localAt+30+localNameLen+localExtra;
  if(fileAt+compressed>bytes.length)throw Error('Avbrutt ZIP-oppføring.');
  if(bytes.toString('utf8',localAt+30,localAt+30+localNameLen)!==name||bytes.readUInt16LE(localAt+8)!==method)throw Error('Motstridende lokal ZIP-oppføring: '+name);
  let data;
  try{data=method===8?inflateRawSync(bytes.subarray(fileAt,fileAt+compressed),{maxOutputLength:directory?1:MAX_FILE+1}):bytes.subarray(fileAt,fileAt+compressed)}
  catch{throw Error('Kunne ikke pakke ut filen: '+name);}
  if(data.length!==length||crc32(data)!==crc)throw Error('ZIP-integritetskontroll feilet: '+name);
  if(!directory)entries.push({name,bytes:data});
 }
 if(offset!==bytes.readUInt32LE(eocd+16)+centralSize)throw Error('Uventet innhold i ZIP-indeksen.');
 return entries;
}
async function collect(root,kind){
 const entries=[];let total=0;
 const walk=async(dir)=>{
  for(const e of await readdir(dir,{withFileTypes:true})){
   const file=join(dir,e.name),name=cleanSlashes(relative(root,file));
   if(privateName(name)||name==='modules/smart-assistant'||name.startsWith('modules/smart-assistant/'))continue;
   if(e.isSymbolicLink())throw Error('Prosjektet inneholder en symbolsk lenke: '+name);
   if(e.isDirectory()){if([...allowedRoots].some(x=>name===x||name.startsWith(x+'/'))&&!(kind==='template'&&(name==='project/property-feeds'||name.startsWith('project/property-feeds/')||name==='project/property-draft-images'||name.startsWith('project/property-draft-images/'))))await walk(file);continue;}
   if(!e.isFile()||!approvedName(name,kind))continue;
   // The module is independently distributed. Never bundle staged public widget
   // files into a website/project ZIP, even if the module source is absent.
   if(['public/smart-assistant.js','public/smart-assistant-live.js','public/smart-assistant.css'].includes(name))continue;
   const st=await stat(file);if(st.size>MAX_FILE)throw Error('Prosjektfilen er for stor til ZIP: '+name);
   total+=st.size;if(total>MAX_TOTAL||entries.length>=MAX_FILES)throw Error('For stort prosjektarkiv.');
   entries.push({name,bytes:await readFile(file)});
  }
 };
 await walk(root);
 return entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
function editableContract(files){
 const descriptor=files.find(f=>f.name==='src/lib/editable-elements.json');if(!descriptor)return null;
 let c;try{c=JSON.parse(descriptor.bytes.toString('utf8'));}catch{throw Error('Ugyldig redigeringskontrakt.');}
 if(c.schema!=='wset-editable-elements-v1'||c.version!==1||c.engine!=='cbpm-astro-v1'||c.fieldAttribute!=='data-content-ref')throw Error('Ustøttet redigeringskontrakt.');
 return {version:1,schema:c.schema,engine:c.engine};
}
function archiveTemplate(files,info={},catalogOnly=false,registry){
 const descriptor=files.find(f=>f.name===TEMPLATE_PATH);
 const pkg=files.find(f=>f.name==='package.json');
 return resolveTemplateDescriptor({descriptor:descriptor?parseTemplateDescriptor(descriptor.bytes):undefined,manifest:info.template,packageVersion:pkg?parseTemplateDescriptor(pkg.bytes).version:undefined,engine:info.engine,catalogOnly,registry});
}
function archiveInfo({kind,name='Nettsted'}){return {format:PROJECT_FORMAT,formatVersion:1,engine:'cbpm-astro-v1',kind,name,createdAt:new Date().toISOString(),deployment:'manual-two-zip'};}
export async function exportEditableProject({root,destination,kind='project',name,registry}={}){
 if(!['project','template'].includes(kind))throw Error('Ukjent type prosjektarkiv.');
 if(!root||!destination||!destination.toLowerCase().endsWith('.zip'))throw Error('Velg en ZIP-fil for lagring.');
 const folder=await realpath(root),out=resolve(destination);
 if(out===folder||out.startsWith(folder+sep))throw Error('Lagre ZIP-filen utenfor prosjektmappen.');
 await readDesignerProject(folder,{registry});
 const files=await collect(folder,kind);
 if(kind==='template'){const f=files.find(f=>f.name==='project/website.json');if(f){const site=JSON.parse(f.bytes.toString('utf8'));if(Object.hasOwn(site,'propertyDrafts')||Object.hasOwn(site,'propertyMarkings')){delete site.propertyDrafts;delete site.propertyMarkings;f.bytes=Buffer.from(JSON.stringify(site,null,2)+'\n');}}}
 if(!files.some(f=>f.name==='project/website.json')||!files.some(f=>f.name==='package.json')||!files.some(f=>f.name==='src/lib/render-site.mjs'))throw Error('Prosjektet mangler kildefiler som trengs for senere redigering.');
 const template=archiveTemplate(files,{},false,registry);
 if(!files.some(f=>f.name===TEMPLATE_PATH))files.push({name:TEMPLATE_PATH,bytes:Buffer.from(JSON.stringify(template,null,2)+'\n')});
 const contract=editableContract(files);const manifest=Buffer.from(JSON.stringify({...archiveInfo({kind,name:name||basename(folder)}),template,...(contract?{editableElements:contract}:{})},null,2)+'\n');
 const zip=writeZip([{name:'wset-project.json',bytes:manifest},...files]);
 if(zip.length>MAX_ARCHIVE)throw Error('Prosjektarkivet overskrider støttet ZIP-størrelse.');
 await mkdir(dirname(out),{recursive:true});const tmp=out+'.tmp-'+randomUUID();
 try{await writeFile(tmp,zip,{flag:'wx'});await rename(tmp,out);}catch(error){await rm(tmp,{force:true});throw error;}
 return {path:out,files:files.length,bytes:zip.length,kind};
}
export async function importEditableProject({archive,projectsDir,registry,projectInfo}={}){
 if(!archive||!projectsDir)throw Error('Velg en prosjekt-ZIP og målmappe.');
 return extractEditableProject({bytes:await readFile(archive),projectsDir,registry,projectInfo});
}
// Catalog validation is isolated from the normal open/import path. No code is executed.
export async function validateTemplateArchive({bytes,scratchDir}){
 const result=await extractEditableProject({bytes,projectsDir:scratchDir,catalogOnly:true});
 try{return {template:result.template};}finally{await rm(result.root,{recursive:true,force:true});}
}
async function extractEditableProject({bytes,projectsDir,catalogOnly=false,registry,projectInfo}){
 const entries=readSafeProjectZipEntries(bytes);
 const manifest=entries.find(e=>e.name==='wset-project.json');if(!manifest)throw Error('Dette er ikke en WSET prosjekt- eller mal-ZIP. Publiserings-ZIP kan ikke brukes her.');
 let info;try{info=JSON.parse(manifest.bytes.toString('utf8'));}catch{throw Error('Ugyldig prosjektmanifest.');}
 if(info.format!==PROJECT_FORMAT||info.formatVersion!==1||info.engine!=='cbpm-astro-v1'||!['project','template'].includes(info.kind))throw Error('Prosjektformatet eller nettstedmotoren støttes ikke av denne WSET-versjonen.');
 if(catalogOnly&&info.kind!=='template')throw Error('Malbiblioteket krever en redigerbar mal-ZIP, ikke en prosjekt-ZIP.');
 const files=entries.filter(e=>e.name!=='wset-project.json');
 editableContract(files);
 const template=archiveTemplate(files,info,catalogOnly,registry);
 for(const expected of ['project/website.json','package.json','src/lib/render-site.mjs','public/site.js','scripts/package-manual-site.mjs'])if(!files.some(f=>f.name===expected))throw Error('Ufullstendig prosjektarkiv. Mangler '+expected);
 const base=resolve(projectsDir);await mkdir(base,{recursive:true});
 const dashboard=projectInfo===undefined?null:normalizeDashboardInfo(projectInfo);
 if(dashboard&&(!dashboard.name||info.kind!=='template'||catalogOnly))throw Error('Ugyldig prosjektopprettelse.');
 const safeLabel=String(dashboard?.name||info.name||'Nettsted').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55)||'Nettsted';
 const destination=join(base,safeLabel+'-'+randomUUID().slice(0,8));
 const staging=destination+'.importing';await mkdir(staging,{recursive:false});
 try{
  for(const {name,bytes} of files){
   if(info.kind==='template'&&(name.startsWith('project/property-feeds/')||name.startsWith('project/property-draft-images/')))throw Error('Malen inneholder private XML-importer.');
   const target=resolve(staging,...name.split('/'));
   if(!target.startsWith(staging+sep))throw Error('Ulovlig filbane i ZIP.');
   await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});
  }
  if(!files.some(f=>f.name===TEMPLATE_PATH))await writeFile(join(staging,TEMPLATE_PATH),JSON.stringify(template,null,2)+'\n',{flag:'wx'});
  const moduleFiles=files.filter(f=>f.name.startsWith('modules/'));
  if(moduleFiles.length){
   for(const id of new Set(moduleFiles.map(f=>f.name.split('/')[1]))){
    const manifestFile=moduleFiles.find(f=>f.name===`modules/${id}/module.json`);
    if(!manifestFile)throw Error('Modulen mangler module.json: '+id);
    let moduleManifest;try{moduleManifest=JSON.parse(manifestFile.bytes.toString('utf8'));}catch{throw Error('Ugyldig modulmanifest: '+id);}
    if(moduleManifest.schema!=='wset-website-module-v1'||moduleManifest.id!==id||moduleManifest.requiredProjectEngine!=='cbpm-astro-v1')throw Error('Ustøttet eller ugyldig modul: '+id);
   }
  }
  if(info.kind==='template'){const filename=join(staging,'project','website.json');const site=JSON.parse(await readFile(filename,'utf8'));if(site.propertyDrafts||site.propertyMarkings){delete site.propertyDrafts;delete site.propertyMarkings;await writeFile(filename,JSON.stringify(site,null,2)+'\n');}}
  if(catalogOnly)await readProjectData(staging);
  else await readDesignerProject(staging,{registry}); // validate data; do NOT execute the imported scripts
  if(dashboard)await writeFile(join(staging,'.wset-local-project.json'),JSON.stringify({schema:1,id:randomUUID(),createdAt:new Date().toISOString(),dashboard},null,2)+'\n',{flag:'wx'});
  await rename(staging,destination);
  return {root:destination,kind:info.kind,name:info.name,template};
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
export function inspectEditableArchive(bytes){
 const entries=readSafeProjectZipEntries(bytes);const manifest=entries.find(e=>e.name==='wset-project.json');
 if(!manifest)return null;return JSON.parse(manifest.bytes.toString('utf8'));
}
