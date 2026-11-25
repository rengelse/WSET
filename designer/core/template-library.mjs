/** Local template catalogue. ZIPs are immutable; projects are independent copies.
 * Cataloguing never executes imported code and never grants renderer support.
 */
import {readFile,writeFile,mkdir,mkdtemp,rename,rm,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {sortTemplateEntries} from './template-versions.mjs';
import {validateTemplateDescriptor,assertSupportedTemplate} from './template-contract.mjs';
import {validateTemplateArchive,readSafeProjectZipEntries,importEditableProject} from './project-archive.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const keyFor=t=>hash(t.id+'\n'+t.templateVersion);
const validKey=k=>typeof k==='string'&&/^[a-f0-9]{64}$/.test(k);
const MAX_ZIP=512*1024*1024,MAX_IMAGE=2*1024*1024;
export const previewDevices=['desktop','tablet','mobile','homepage-full'];
const devices=previewDevices;
function supported(t){try{assertSupportedTemplate(t);return true;}catch{return false;}}
async function readBounded(path,max){const st=await lstat(path);if(!st.isFile()||st.size>max)throw Error('Ugyldig eller for stor biblioteksfil.');return readFile(path);}
export function previewImage(bytes){
 if(bytes.length<33||bytes.length>MAX_IMAGE||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Malens forhåndsvisning må være en PNG-fil på maks 2 MB.');
 const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>3000||h>16000||w*h>24000000)throw Error('Ugyldige bildedimensjoner i malens forhåndsvisning. Maks 3000 × 16000 og 24 megapiksler.');
 return bytes;
}
function entryPath(root,key){if(!validKey(key))throw Error('Ugyldig malnøkkel.');return join(resolve(root),key);}
async function readEntry(root,key){
 const dir=entryPath(root,key);if(!(await lstat(dir)).isDirectory())throw Error('Ugyldig bibliotekoppføring.');
 const meta=JSON.parse(await readBounded(join(dir,'entry.json'),16384));
 const template=validateTemplateDescriptor(meta.template);
 if(keyFor(template)!==key||!validKey(meta.digest)||!Array.isArray(meta.previews)||meta.previews.some(x=>!devices.includes(x))||typeof meta.importedAt!=='string')throw Error('Ugyldig bibliotekmetadata.');
 return {key,template,digest:meta.digest,importedAt:meta.importedAt,previews:[...new Set(meta.previews)],supported:supported(template)};
}
export async function listTemplates({libraryRoot}){
 await mkdir(libraryRoot,{recursive:true});const items=[],issues=[];
 for(const dir of await readdir(libraryRoot,{withFileTypes:true})){
  if(!validKey(dir.name))continue;
  try{items.push(await readEntry(libraryRoot,dir.name));}catch{issues.push(dir.name);}
 }
 items.sort(sortTemplateEntries);
 return {items,issues};
}
export async function importLibraryTemplate({archive,libraryRoot}){
 const bytes=await readBounded(archive,MAX_ZIP);const digest=hash(bytes);
 await mkdir(libraryRoot,{recursive:true});const stage=await mkdtemp(join(resolve(libraryRoot),'.import-'));
 try{
  const {template}=await validateTemplateArchive({bytes,scratchDir:join(stage,'validation')});
  await rm(join(stage,'validation'),{recursive:true,force:true});
  const key=keyFor(template),dest=entryPath(libraryRoot,key);
  let existing;try{existing=await readEntry(libraryRoot,key);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing){if(existing.digest!==digest)throw Error('Denne mal-ID-en og versjonen finnes allerede med annet innhold. Bruk et nytt versjonsnummer.');
   if(hash(await readBounded(join(dest,'template.zip'),MAX_ZIP))!==digest)throw Error('Den installerte malen er skadet. Fjern versjonen og importer på nytt.');
   return {entry:existing,alreadyInstalled:true};}
  const previews=[];const entries=readSafeProjectZipEntries(bytes);
  for(const device of devices){const image=entries.find(e=>e.name===`project/template-previews/${device}.png`);if(image){await writeFile(join(stage,device+'.png'),previewImage(image.bytes),{flag:'wx'});previews.push(device);}}
  await writeFile(join(stage,'template.zip'),bytes,{flag:'wx'});
  await writeFile(join(stage,'entry.json'),JSON.stringify({template,digest,importedAt:new Date().toISOString(),previews},null,2)+'\n',{flag:'wx'});
  await rename(stage,dest);return {entry:await readEntry(libraryRoot,key),alreadyInstalled:false};
 }finally{await rm(stage,{recursive:true,force:true});}
}
export async function readTemplatePreviews({libraryRoot,key}){
 const entry=await readEntry(libraryRoot,key);const result={};
 for(const device of entry.previews){const bytes=previewImage(await readBounded(join(entryPath(libraryRoot,key),device+'.png'),MAX_IMAGE));result[device]='data:image/png;base64,'+bytes.toString('base64');}
 return result;
}
export async function createProjectFromTemplate({libraryRoot,key,projectsDir}){
 const entry=await readEntry(libraryRoot,key);assertSupportedTemplate(entry.template);
 const bytes=await readBounded(join(entryPath(libraryRoot,key),'template.zip'),MAX_ZIP);
 if(hash(bytes)!==entry.digest)throw Error('Malarkivet er endret eller skadet. Importer en gyldig kopi.');
 // Copy exact verified bytes before opening, avoiding a check/use race.
 const stage=await mkdtemp(join(resolve(libraryRoot),'.create-'));
 try{const archive=join(stage,'template.zip');await writeFile(archive,bytes,{flag:'wx'});return await importEditableProject({archive,projectsDir});}
 finally{await rm(stage,{recursive:true,force:true});}
}
export async function removeLibraryTemplate({libraryRoot,key}){
 await readEntry(libraryRoot,key);const dir=entryPath(libraryRoot,key),trash=join(resolve(libraryRoot),'.removed-'+randomUUID());
 await rename(dir,trash);await rm(trash,{recursive:true,force:true});return {ok:true};
}
