'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const POINTER='wset-workspace-location.json';
const APP_ID='no.rengelse.wset';
const INSTALL_DIRECTORY='wset-editor';
const LEGACY_INSTALL_DIRECTORY='WSET';
function reservedWindowsInstallRoots(localAppData,p=path){return localAppData?[INSTALL_DIRECTORY,LEGACY_INSTALL_DIRECTORY].map(name=>p.join(localAppData,'Programs',name)):[];}
function overlaps(a,b,p=path){const under=(root,target)=>{const r=p.relative(p.resolve(root),p.resolve(target));return !r||(!p.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+p.sep));};return under(a,b)||under(b,a);}
// Resolve existing ancestors too, so nonexistent child paths through a junction are rejected.
async function canonical(p){let current=path.resolve(p),tail=[];for(;;){try{return path.join(await fs.realpath(current),...tail);}catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(current);if(parent===current)throw e;tail.unshift(path.basename(current));current=parent;}}}
async function assertWorkspaceOutsideInstall(root,installRoots){const target=await canonical(root);for(const r of installRoots.filter(Boolean)){if(overlaps(target,await canonical(r)))throw Error('Arbeidsområdet må ligge utenfor WSETs programmappe: '+r);}return target;}
async function readPointer(dir){try{const x=JSON.parse(await fs.readFile(path.join(dir,POINTER),'utf8'));if(x.schema!==1||typeof x.root!=='string'||!path.isAbsolute(x.root))throw Error('Ugyldig arbeidsområdepeker i '+dir);return x;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function hasLegacy(dir){for(const name of ['wset-workspace.json','wset-project-registry.json','wset-recent-projects.json','modules','templates','projects','server-profiles']){try{await fs.access(path.join(dir,name));return true;}catch(e){if(e.code!=='ENOENT')throw e;}}return false;}
// Prefer the application's own pointer; older Electron directories are read only on first packaged launch.
async function selectBootstrapRoot(dataRoot,legacyRoots=[]){if(await readPointer(dataRoot))return dataRoot;const candidates=[...new Set(legacyRoots.map(p=>path.resolve(p)))].filter(p=>path.relative(p,dataRoot)!=='');const found=[];for(const dir of candidates){if(path.relative(dir,dataRoot)==='')continue;const value=await readPointer(dir);if(value)found.push({dir,root:await canonical(value.root)});}if(found.length){if(found.some(x=>path.relative(x.root,found[0].root)!==''))throw Error('Flere ulike WSET-arbeidsområder funnet. Avklar arbeidsområde før installert WSET startes.');return found[0].dir;}const old=[];for(const dir of candidates)if(await hasLegacy(dir))old.push(dir);if(old.length>1)throw Error('Flere eldre WSET-datakataloger funnet. Åpne rc.55 først og fullfør migreringen.');return old[0]||dataRoot;}
async function rememberWorkspacePointer(dataRoot,root){const old=await readPointer(dataRoot);if(old){if(path.relative(await canonical(old.root),await canonical(root))!=='')throw Error('Arbeidsområdepekeren ble endret.');return;}await fs.mkdir(dataRoot,{recursive:true});const target=path.join(dataRoot,POINTER),tmp=target+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify({schema:1,root},null,2)+'\n',{flag:'wx',mode:0o600});await fs.copyFile(tmp,target,require('node:fs').constants.COPYFILE_EXCL);}finally{await fs.rm(tmp,{force:true});}}
module.exports={APP_ID,POINTER,INSTALL_DIRECTORY,LEGACY_INSTALL_DIRECTORY,reservedWindowsInstallRoots,overlaps,assertWorkspaceOutsideInstall,selectBootstrapRoot,rememberWorkspacePointer};
