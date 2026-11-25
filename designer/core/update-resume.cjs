'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const filename='wset-update-resume.json';
async function remember(dir,value){await fs.mkdir(dir,{recursive:true});const file=path.join(dir,filename),tmp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
async function clear(dir){await fs.rm(path.join(dir,filename),{force:true});}
async function consume(dir,version,workspace){let r;try{r=JSON.parse(await fs.readFile(path.join(dir,filename),'utf8'));}catch(e){if(e.code==='ENOENT')return null;await clear(dir);return null;}await clear(dir);if(r?.version!==version||r.workspace!==workspace.root||!r.projectId||!r.projectRoot)return null;const root=await fs.realpath(r.projectRoot);if(path.dirname(root)!==await fs.realpath(workspace.paths.projects))return null;const meta=JSON.parse(await fs.readFile(path.join(root,'.wset-local-project.json'),'utf8'));if(meta.id!==r.projectId)return null;return {root,id:meta.id};}
module.exports={remember,clear,consume};
