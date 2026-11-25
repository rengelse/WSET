import {readFile,writeFile,rename,mkdir,copyFile,readdir,cp,realpath} from 'node:fs/promises';
import {resolve,join,relative,dirname,isAbsolute,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateSiteProject} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {syncOwnFeed} from './property-owned-feed.mjs';
import {readProjectTemplate} from './template-contract.mjs';
import {migrateProjectForDesigner} from './project-migrations.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const projectFile=root=>resolve(root,'project','website.json');
let centralBackupRoot=null;
export function setProjectBackupRoot(root){centralBackupRoot=root;}
const skipped=new Set(['node_modules','dist','exports','.astro','.git','preview-offline','_migration-backup-v101']);
export async function readProjectData(root){
 const folder=await realpath(resolve(root));
 const file=projectFile(folder);
 const bytes=await readFile(file);
 const rawSite=JSON.parse(bytes.toString('utf8'));
 const sourceSnapshot=JSON.stringify(rawSite);
 const site=migrateProjectForDesigner(rawSite);
 const report=validateSiteProject(site,{root:folder});
 if(!report.ok)throw Error('Prosjektet kan ikke åpnes:\n'+report.errors.join('\n'));
 return {root:folder,site,revision:sha(bytes),report,sourceSnapshot};
}
export async function readDesignerProject(root,options){
 const data=await readProjectData(root);
 return {...data,template:await readProjectTemplate(data.root,options)};
}
export async function persistDesignerProject({root,site,revision}){
 const folder=await realpath(resolve(root));
 const report=validateSiteProject(site,{root:folder});
 if(!report.ok)throw Error('Kan ikke lagre ugyldig prosjekt:\n'+report.errors.join('\n'));
 const filename=projectFile(folder);
 const existing=await readFile(filename);
 if(sha(existing)!==revision)throw Error('Prosjektfilen ble endret av et annet program etter åpning. Last inn prosjektet på nytt før du lagrer.');
 const fresh=Buffer.from(JSON.stringify(site,null,2)+'\n');
 if(sha(fresh)===revision){await syncOwnFeed(folder,site);return {revision,backup:null,report};}
 let backups=join(folder,'project','backups');if(centralBackupRoot){const meta=JSON.parse(await readFile(join(folder,'.wset-local-project.json'),'utf8'));if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meta.id))throw Error('Ugyldig prosjekt-ID.');backups=join(centralBackupRoot,meta.id,'Content');}
 await mkdir(backups,{recursive:true});
 if(centralBackupRoot&&relative(resolve(backups),await realpath(backups))!=='')throw Error('Sikkerhetskopimappen kan ikke være en lenke.');
 const timestamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
 const backup=join(backups,`website-${timestamp}-${randomUUID().slice(0,8)}.json`);
 await copyFile(filename,backup);
 const temp=join(dirname(filename),`.website-${randomUUID()}.tmp`);
 let own;
 try{
  await writeFile(temp,fresh,{flag:'wx'});
  own=await syncOwnFeed(folder,site);
  await rename(temp,filename);
 }catch(error){
  const {rm}=await import('node:fs/promises');
  await rm(temp,{force:true}).catch(()=>{});
  if(own?.rollback)await own.rollback();
  throw error;
 }
 return {revision:sha(fresh),backup,report};
}
export async function saveDesignerProjectAs({root,site,destination,registry}){
 const src=await realpath(resolve(root)),dest=resolve(destination);
 const relativeToSrc=relative(src,dest),relativeToDest=relative(dest,src);
 if(!relativeToSrc||(!relativeToSrc.startsWith('..'+sep)&&relativeToSrc!=='..'&&!isAbsolute(relativeToSrc)))throw Error('Velg en ny prosjektmappe utenfor den opprinnelige.');
 if(!relativeToDest.startsWith('..'+sep)&&relativeToDest!=='..'&&!isAbsolute(relativeToDest))throw Error('Velg en annen prosjektmappe enn overordnet prosjektmappe.');
 let existing=[];
 try{existing=await readdir(dest);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing.length)throw Error('Målmappen må være tom.');
 const report=validateSiteProject(site,{root:src});
 if(!report.ok)throw Error('Prosjektet har ugyldig innhold. Lagre som er avbrutt.');
 await cp(src,dest,{recursive:true,filter:path=>{
  const rel=relative(src,path);
  if(!rel)return true;
  return !rel.split(sep).some(part=>skipped.has(part)||part==='.wset-local-project.json'||part==='.env'||part.startsWith('.env.'));
 }});
 await writeFile(projectFile(dest),JSON.stringify(site,null,2)+'\n');
 await syncOwnFeed(dest,site);
 return readDesignerProject(dest,{registry});
}
