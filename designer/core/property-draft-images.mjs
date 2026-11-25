import {randomUUID} from 'node:crypto';
import {mkdir,realpath,lstat,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {resolve,join,basename,extname} from 'node:path';
export const DRAFT_IMAGE_DIR='project/property-draft-images';
export const draftImageName=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
const formats=new Set(['jpeg','png','webp','heif','tiff','avif']);
const extensions=new Set(['.jpg','.jpeg','.png','.webp','.avif','.tif','.tiff']);
async function folder(root,create=false){const base=await realpath(root),project=join(base,'project');if(await realpath(project)!==project)throw Error('Utrygg prosjektmappe.');const dir=resolve(base,DRAFT_IMAGE_DIR);if(create)await mkdir(dir,{recursive:false}).catch(e=>{if(e.code!=='EEXIST')throw e;});if(await realpath(dir)!==dir||(await lstat(dir)).isSymbolicLink())throw Error('Utrygg bildemappe.');return dir;}
export async function readDraftImage(root,name){if(typeof name!=='string'||!draftImageName.test(name))throw Error('Ugyldig boligbilde.');const dir=await folder(root),file=join(dir,name);const meta=await lstat(file);if(!meta.isFile()||meta.isSymbolicLink()||meta.size>15*1024*1024)throw Error('Ugyldig boligbilde.');return readFile(file);}
export async function verifyDraftPhotos(root,photos=[]){for(const p of photos)await readDraftImage(root,p.file);}
export async function importDraftImages({root,sources,sharpModule}={}){
 if(!Array.isArray(sources)||!sources.length||sources.length>100)throw Error('Velg 1–100 bilder om gangen.');
 const sharp=(sharpModule||await import('sharp')).default||sharpModule;const dir=await folder(root,true),created=[],result=[];
 try{for(const source of sources){const st=await stat(source);if(!extensions.has(extname(source).toLowerCase())||!st.isFile()||st.size>30*1024*1024)throw Error('Velg et gyldig foto under 30 MB.');
 const img=sharp(source,{limitInputPixels:45_000_000,failOn:'error'});const meta=await img.metadata();if(!formats.has(meta.format)||!meta.width||!meta.height||meta.pages>1)throw Error('Ugyldig eller animert bilde.');
 const {data,info}=await img.rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});if(data.length>15*1024*1024)throw Error('Boligbildet er for stort.');
 const file=randomUUID()+'.webp',path=join(dir,file);await writeFile(path,data,{flag:'wx'});created.push(path);result.push({file,name:basename(source).replace(/[<>\x00-\x1f]/g,'_').slice(0,200),width:info.width,height:info.height,role:'photo'});
 }return result;}catch(e){await Promise.all(created.map(p=>rm(p,{force:true}).catch(()=>{})));throw e;}
}
