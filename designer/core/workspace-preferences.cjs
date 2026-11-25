'use strict';
// Small UI settings and task lists. No website data, passwords or arbitrary filesystem access.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const allowed=k=>typeof k==='string'&&k.length<=4200&&(k==='cbpm-designer-ui-language'||/^wset-(?:width-[\w-]+|navigation-mode-rc18|tree-visible|inspector-visible|project-dashboard-view)$/.test(k)||/^wset-(?:tasks|workspace)-v1:[a-f0-9-]{36}$/i.test(k));
function createWorkspacePreferences(file,legacyIds={}){
 let state={schema:1,imported:false,values:{}};
 try{state=JSON.parse(fs.readFileSync(file,'utf8'));if(state.schema!==1||!state.values||typeof state.values!=='object')throw Error('Ugyldige WSET-innstillinger.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const save=next=>{const bytes=JSON.stringify(next,null,2)+'\n';if(Buffer.byteLength(bytes)>4*1024*1024)throw Error('WSET-innstillingene er for store.');fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+randomUUID();try{fs.writeFileSync(tmp,bytes,{flag:'wx',mode:0o600});fs.renameSync(tmp,file);state=next;}finally{fs.rmSync(tmp,{force:true});}};
 return {get:k=>allowed(k)?state.values[k]??null:null,set(k,v){if(!allowed(k)||typeof v!=='string'||v.length>200000)throw Error('Ugyldig WSET-innstilling.');if(state.values[k]!==v)save({...state,values:{...state.values,[k]:v}});return true;},importLegacy(values){if(state.imported)return true;const next={...state.values};if(values&&typeof values==='object')for(const [key,v] of Object.entries(values)){if(typeof v!=='string'||v.length>200000)continue;let k=key;const m=key.match(/^(wset-(?:tasks|workspace)-v1:)(.*)$/);if(m&&!allowed(k)){const id=Object.hasOwn(legacyIds,m[2])?legacyIds[m[2]]:null;if(!id)continue;k=m[1]+id;}if(allowed(k)&&!Object.hasOwn(next,k))next[k]=v;}save({schema:1,imported:true,values:next});return true;}};
}
module.exports={createWorkspacePreferences};
