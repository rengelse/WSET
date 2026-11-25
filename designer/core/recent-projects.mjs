import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {dirname,basename,resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';

// Local UI history only: never expose credentials or project contents.
export function normalizeRecentProjects(items){
 if(!Array.isArray(items))return [];
 const seen=new Set(),result=[];
 for(const entry of items){
  if(typeof entry!=='string'||!entry.trim()||entry.length>4096||entry.includes('\0'))continue;
  const root=resolve(entry);if(seen.has(root))continue;
  seen.add(root);result.push(root);
 }
 return result;
}
export async function readRecentProjects(filename){
 try{return normalizeRecentProjects(JSON.parse(await readFile(filename,'utf8')))}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return [];throw error}
}
export async function rememberRecentProject(filename,root){
 const next=normalizeRecentProjects([root,...await readRecentProjects(filename)]);
 await mkdir(dirname(filename),{recursive:true});const temp=filename+'.tmp-'+randomUUID();
 try{await writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});await rename(temp,filename)}
 catch(error){const {rm}=await import('node:fs/promises');await rm(temp,{force:true}).catch(()=>{});throw error}
 return next;
}
export const recentProjectLabels=roots=>roots.map(root=>({root,name:basename(root)}));

// Read only local saved project metadata, never execute imported code.
export async function describeRecentProjects(roots){
 return Promise.all(recentProjectLabels(roots).map(async item=>{
  try{const file=join(item.root,'project','website.json');const info=await stat(file);if(!info.isFile()||info.size>20*1024*1024)return item;const site=JSON.parse(await readFile(file,'utf8'));const name=site.brand?.displayName;return {...item,name:typeof name==='string'&&name.trim()?name.trim().slice(0,200):item.name,updatedLabel:info.mtime.toLocaleString('nb-NO')};}catch{return item;}
 }));
}
