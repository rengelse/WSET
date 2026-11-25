/** Local, project-owned XML feed inventory; never writes to the public website tree. */
import {readFile,writeFile,mkdir,readdir,stat,realpath,rename,rm} from 'node:fs/promises';
import {join,resolve,basename,extname} from 'node:path';
import {isLocalPropertyImagePath} from '../engines/cbpm-astro-v1/lib/property-image-path.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {parseKyeroXML} from './property-xml.mjs';
const BASE='project/property-feeds',MAX_BYTES=25*1024*1024;
const metadataFile=root=>resolve(root,BASE,'.source-names.json');
async function sourceNames(root){try{const parsed=JSON.parse(await readFile(metadataFile(root),'utf8'));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return {};}}
export const FEED_FOLDERS=['New','Existing'];
function folder(root,category){if(!FEED_FOLDERS.includes(category))throw Error('Ugyldig XML-kategori.');return resolve(root,BASE,category);}
export function safeFeedName(name){if(typeof name!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,49}\.xml$/i.test(name)||name.includes('..'))throw Error('Ugyldig XML-filnavn.');return name;}
export async function inspectFeed(bytes,category,name){
 if(!Buffer.isBuffer(bytes)||bytes.length<10||bytes.length>MAX_BYTES)throw Error('XML må være 10 bytes til 25 MB.');
 safeFeedName(name);if(!FEED_FOLDERS.includes(category))throw Error('Ugyldig XML-kategori.');
 const records=parseKyeroXML(bytes.toString('utf8'),{sourceCode:(category==='New'?'new':'existing')+'--'+name.toLowerCase().replace(/\.xml$/,'')});
 let missingImage=0,missingPrice=0,missingDescription=0;
 for(const r of records){if(!r.images?.length)missingImage++;if(!(r.listing?.price>0))missingPrice++;if(!Object.keys(r.descriptions||{}).length&&!Object.keys(r.description||{}).length)missingDescription++;}
 return {category,filename:name,count:records.length,missingImage,missingPrice,missingDescription,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function importLocalFeed({root,source,category}){
 const originalName=basename(source);if(extname(originalName).toLowerCase()!=='.xml')throw Error('Velg en XML-fil.');
 const stem=originalName.slice(0,-4).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,25)||'feed';
 // Include the original absolute source identity, not just basename: two vendors
 // may both export properties.xml. Re-import from the same path replaces only itself.
 const suffix=createHash('sha256').update(resolve(source)).digest('hex').slice(0,8);
 const name=safeFeedName(`feed-${stem}-${suffix}.xml`),data=await readFile(source);const details=await inspectFeed(data,category,name);
 const dest=folder(root,category);await mkdir(dest,{recursive:true});
 const temp=join(dest,'.upload-'+randomUUID());const target=join(dest,name);
 try{await writeFile(temp,data,{flag:'wx',mode:0o600});await rename(temp,target)}finally{await rm(temp,{force:true})}
 const names=await sourceNames(root),key=category+'/'+name;names[key]={originalFilename:originalName,importedAt:new Date().toISOString()};
 const metaTemp=resolve(root,BASE,'.sources-'+randomUUID());
 try{await writeFile(metaTemp,JSON.stringify(names,null,2),{flag:'wx',mode:0o600});await rename(metaTemp,metadataFile(root));}finally{await rm(metaTemp,{force:true});}
 return {...details,originalFilename:originalName};
}
export async function listLocalFeeds(root){
 const files=[],errors=[],images=[],sourceMetadata=await sourceNames(root);
 for(const category of FEED_FOLDERS){const dir=folder(root,category);let names=[];
  try{names=await readdir(dir,{withFileTypes:true})}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const item of names){if(item.name.startsWith('.'))continue;
   if(category==='Existing'&&item.name==='images'&&item.isDirectory())continue;
   if(!item.isFile()||!/^[a-zA-Z][a-zA-Z0-9_-]{0,49}\.xml$/i.test(item.name)){errors.push(`${category}/${item.name}: ugyldig filtype.`);continue;}
   try{const file=join(dir,item.name),l=await stat(file);if(!l.isFile()||l.size>MAX_BYTES)throw Error('For stor fil');const d=await inspectFeed(await readFile(file),category,item.name);files.push({...d,originalFilename:sourceMetadata[category+'/'+item.name]?.originalFilename||item.name,modifiedAt:l.mtime.toISOString()})}
   catch(e){errors.push(`${category}/${item.name}: ${e.message}`)}
  }
 }
 // Inventory images separately; valid images are private input assets, not XML sources.
 const imageRoot=folder(root,'Existing')+'/images';
 try{
  for(const entry of await readdir(imageRoot,{withFileTypes:true})){
   if(!entry.isDirectory()||!isLocalPropertyImagePath(`images/${entry.name}/01.webp`)){errors.push(`Existing/images/${entry.name}: ugyldig boligmappe.`);continue;}
   for(const photo of await readdir(join(imageRoot,entry.name),{withFileTypes:true})){
    const relative=`images/${entry.name}/${photo.name}`;
    if(!photo.isFile()||!isLocalPropertyImagePath(relative)){errors.push(`Existing/${relative}: ugyldig bilde eller filtype.`);continue;}
    const file=join(imageRoot,entry.name,photo.name),meta=await stat(file);
    if(meta.size<=0||meta.size>15*1024*1024){errors.push(`Existing/${relative}: bildet må være 1 byte til 15 MB.`);continue;}
    images.push({path:relative,size:meta.size,modifiedAt:meta.mtime.toISOString()});
   }
  }
 }catch(e){if(e.code!=='ENOENT')throw e;}
 return {files,images,errors,total:files.reduce((n,f)=>n+f.count,0)};
}

/** Stable content fingerprint for publish status; no timestamps or private paths. */
export function feedInventoryFingerprint(inventory){
 if(!inventory)return null;
 const files=(inventory.files||[]).map(({category,filename,sha256})=>[category,filename,sha256]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const errors=[...(inventory.errors||[])].sort();
 const images=(inventory.images||[]).map(({path,size,modifiedAt})=>[path,size,modifiedAt]).sort((a,b)=>a[0].localeCompare(b[0]));
 return createHash('sha256').update(JSON.stringify({files,images,errors})).digest('hex');
}
