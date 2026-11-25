/** Explicit, opt-in demo employee installer for existing WSET projects. */
import {copyFile,mkdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import seed from '../compat/website-seed.json' with {type:'json'};

const demos=seed.team.filter(member=>member.isSample===true);
const assetName=portrait=>{
 const match=/^\/assets\/(demo-team-[a-z0-9-]+\.webp)$/.exec(portrait||'');
 if(!match)throw Error('Ukjent demobilde.');
 return match[1];
};
const checksum=b=>createHash('sha256').update(b).digest('hex');

export async function installDemoTeam({root,templateRoot,site}={}){
 if(!root||!templateRoot||!site)throw Error('Mangler prosjekt eller mal.');
 const next=structuredClone(site);
 next.team??=[];
 const additions=demos.filter(demo=>!next.team.some(record=>record.id===demo.id));
 if(!additions.length)return {site:next,added:0};
 const targetDir=resolve(root,'public','assets');
 const sources=[];
 for(const demo of additions){
  const filename=assetName(demo.portrait);
  const source=join(templateRoot,'public','assets',filename),destination=join(targetDir,filename);
  const data=await readFile(source);
  sources.push({data,destination});
 }
 await mkdir(targetDir,{recursive:true});
 for(const {data,destination} of sources){
  let existing=null;
  try{existing=await readFile(destination)}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing&&checksum(existing)!==checksum(data))throw Error('Prosjektet har et annet bilde med samme navn som demobildet. Ingen filer overskrevet.');
 }
 for(const {data,destination} of sources){
  try{await readFile(destination)}catch(error){if(error.code!=='ENOENT')throw error;await import('node:fs/promises').then(fs=>fs.writeFile(destination,data,{flag:'wx'}));}
 }
 let order=Math.max(0,...next.team.map(item=>Number(item.order)||0));
 for(const demo of additions){order+=10;next.team.push({...structuredClone(demo),order});}
 return {site:next,added:additions.length};
}
