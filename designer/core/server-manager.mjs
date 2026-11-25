import {publicationOutcome} from './project-lifecycle.mjs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {openServerTransport} from './server-transports.mjs';
const posix=path.posix;
const noControl=s=>typeof s==='string'&&!/[\x00-\x1f\x7f]/.test(s);
export function safeName(name){if(!noControl(name)||!name||name==='.'||name==='..'||/[\\/]/.test(name))throw Error('Ugyldig filnavn.');return name;}
export function remotePath(value){if(!noControl(value)||!value.startsWith('/')||value.includes('\\'))throw Error('Bruk en absolutt serversti, for eksempel /www.');return posix.normalize(value);}
const localPath=value=>{if(!noControl(value)||!path.isAbsolute(value))throw Error('Bruk en absolutt lokal sti.');return path.resolve(value);};
function localName(value){safeName(value);if(process.platform==='win32'&&(/[<>:"|?*]|[. ]$/.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)))throw Error('Filnavnet kan ikke lagres i Windows: '+value);return value;}
const join=(side,base,name)=>side==='local'?path.join(base,localName(name)):posix.join(base,safeName(name));
const validSide=side=>{if(!['local','remote'].includes(side))throw Error('Ugyldig filpanel.');return side;};
const safeError=(e,secrets={})=>{let msg=String(e?.message||e||'Ukjent feil');for(const v of Object.values(secrets))if(v)msg=msg.split(v).join('***');return msg.slice(0,1000);};
const publicProfile=({secret,...p})=>({...p,hasSecret:!!secret});
export function normalizeProfile(input,old={}){
 const protocol=input.protocol;if(!['sftp','ftps','ftp'].includes(protocol))throw Error('Ugyldig protokoll.');
 const host=String(input.host||'').trim();if(!/^[a-zA-Z0-9.:-]+$/.test(host)||host.startsWith('-'))throw Error('Oppgi kun vertsnavn eller IP-adresse.');
 const port=Number(input.port);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ugyldig port.');
 const username=String(input.username||'').trim(),name=String(input.name||'').trim();if(!name||!username||!noControl(name)||!noControl(username)||name.length>120||username.length>256)throw Error('Profilnavn og brukernavn må fylles ut.');
 const keyFile=protocol==='sftp'&&input.keyFile?localPath(input.keyFile):'';
 const same=old.host===host&&old.port===port&&old.protocol===protocol;
 return {id:old.id||randomUUID(),name,protocol,host,port,username,keyFile,tlsMode:protocol==='ftps'&&input.tlsMode==='implicit'?'implicit':'explicit',remoteRoot:remotePath(input.remoteRoot||'/'),localRoot:input.localRoot?localPath(input.localRoot):'',fingerprint:same?old.fingerprint||'':'',secret:same&&old.username===username&&old.keyFile===keyFile?old.secret||'':''};
}
async function localEntries(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){try{const s=await fs.lstat(path.join(dir,e.name));result.push({name:e.name,type:s.isSymbolicLink()?'link':s.isDirectory()?'directory':s.isFile()?'file':'link',size:s.size,modified:s.mtime.toISOString()});}catch(e){if(e.code!=='ENOENT')throw e;}}return result;}
const sorted=rows=>rows.filter(e=>{try{safeName(e.name);return true;}catch{return false;}}).sort((a,b)=>(b.type==='directory')-(a.type==='directory')||a.name.localeCompare(b.name,undefined,{numeric:true}));
async function saveAtomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true}).catch(()=>{});}}
export function createServerManager({dataRoot,home,crypt,confirm,transportFactory=openServerTransport,clock=()=>Date.now(),onPublicationComplete=async()=>{},tempRoot=os.tmpdir()}){
 let scope=null,store={profiles:[],history:[]},file='',session=null,profileId=null,job=null,busy=false,closed=false;const transient=new Map();let queue=[],lastRequest=null;
 const getProfile=id=>{const p=store.profiles.find(x=>x.id===id);if(!p)throw Error('Tilkoblingsprofilen finnes ikke.');return p;};
 const save=()=>saveAtomic(file,store);
 const decode=p=>transient.get(p.id)||(p.secret?crypt.decrypt(p.secret):{});
 const end=()=>{try{session?.close();}finally{session=null;profileId=null;}};
 const check=()=>{if(closed)throw Error('Servermodulen er avsluttet.');if(busy||job)throw Error('En serveroperasjon pågår.');};
 const lock=async fn=>{check();busy=true;try{return await fn();}finally{busy=false;}};
 const connected=()=>{if(!session)throw Error('Koble til serveren først.');return session;};
 const listRaw=async(side,base)=>validSide(side)==='local'?localEntries(localPath(base)):connected().list(remotePath(base));
 const stat=async(side,base,name)=>(await listRaw(side,base)).find(x=>x.name===name);
 const makeDir=async(side,base,name)=>{const dest=join(side,base,name);if(side==='local')await fs.mkdir(dest);else await connected().mkdir(dest);};
 const remove=async(side,base,entry)=>{const dest=join(side,base,entry.name);if(side==='local'){if(entry.type==='directory')await fs.rmdir(dest);else await fs.unlink(dest);}else if(entry.type==='directory')await connected().rmdir(dest);else await connected().unlink(dest);};
 const snapshot=()=>{if(session?.isOpen?.()===false&&!job)end();return {profiles:store.profiles.map(publicProfile),connected:!!session,profileId,busy:busy||!!job,active:!!job,queue:queue.map(({source,dest,base,...r})=>({...r})),history:structuredClone(store.history),defaultLocal:scope||home,canRetry:!!lastRequest&&queue.some(r=>['failed','cancelled','skipped'].includes(r.status))};};
 async function setScope(root,projectId=null){const key=root||'';if(scope===key)return;return lock(async()=>{end();const newFile=path.join(dataRoot,createHash('sha256').update(projectId||key||'standalone').digest('hex')+'.json');let next;try{next=JSON.parse(await fs.readFile(newFile,'utf8'));if(!Array.isArray(next.profiles)||!Array.isArray(next.history))throw Error('Ugyldige serverinnstillinger.');}catch(e){if(e.code!=='ENOENT')throw e;next={profiles:[],history:[]};}scope=key;file=newFile;store=next;transient.clear();queue=[];lastRequest=null;});}
 async function connectProfile(p){const secrets=decode(p);if(p.protocol==='ftp'&&!await confirm('ftp',{profile:publicProfile(p)}))throw Error('Ukryptert FTP ble avbrutt.');try{const s=await transportFactory(p,secrets,{trust:fp=>confirm('host',{profile:publicProfile(p),fingerprint:fp})});if(s.fingerprint&&p.fingerprint!==s.fingerprint){p.fingerprint=s.fingerprint;try{await save();}catch(e){s.close();throw e;}}return s;}catch(e){throw Error(safeError(e,secrets));}}
 async function saveProfile(input){return lock(async()=>{const old=input.id?getProfile(input.id):{};if(old.id===profileId)throw Error('Koble fra før profilen endres.');const p=normalizeProfile(input,old);const retained=p.secret||((old.id&&p.host===old.host&&p.port===old.port&&p.protocol===old.protocol&&p.username===old.username&&p.keyFile===old.keyFile)&&transient.get(old.id));const previous=retained?decode(old):{};
  const secrets={password:input.password!==undefined&&input.password!==''?String(input.password):previous.password||'',passphrase:input.passphrase!==undefined&&input.passphrase!==''?String(input.passphrase):previous.passphrase||''};if(input.clearSecret){secrets.password='';secrets.passphrase='';}if(Object.values(secrets).some(v=>!noControl(v)))throw Error('Passord og passordfrase kan ikke inneholde kontrolltegn.');
  if(input.remember&&(secrets.password||secrets.passphrase))p.secret=crypt.encrypt(secrets);else p.secret='';
  const backup=store.profiles;store.profiles=[...backup.filter(x=>x.id!==p.id),p];try{await save();}catch(e){store.profiles=backup;throw e;}if(p.secret)transient.delete(p.id);else transient.set(p.id,secrets);return publicProfile(p);
 });}
 async function connect(id,test=false){return lock(async()=>{const p=getProfile(id);if(!test)end();const s=await connectProfile(p);try{const rows=sorted(await s.list(p.remoteRoot));if(test){s.close();return {ok:true,count:rows.length};}session=s;profileId=id;return {path:p.remoteRoot,entries:rows,localRoot:p.localRoot||scope||home};}catch(e){s.close();throw Error(safeError(e,decode(p)));}});}
 async function list(side,base){return lock(async()=>({path:side==='local'?localPath(base):remotePath(base),entries:sorted(await listRaw(side,base))}));}
 async function operation({side,base,action,names=[],name}){return lock(async()=>{validSide(side);base=side==='local'?localPath(base):remotePath(base);if(action==='mkdir'){await makeDir(side,base,safeName(name));return;}const entries=await listRaw(side,base),selected=[...new Set(names.map(safeName))].map(n=>{const e=entries.find(x=>x.name===n);if(!e)throw Error('Filen finnes ikke: '+n);return e;});if(!selected.length)throw Error('Velg filer først.');
  if(action==='rename'){if(selected.length!==1)throw Error('Velg én fil.');if(entries.some(e=>e.name===name))throw Error('Navnet finnes allerede.');await (side==='local'?fs.rename(join(side,base,selected[0].name),join(side,base,name)):connected().rename(join(side,base,selected[0].name),join(side,base,name)));return;}
  if(action!=='delete')throw Error('Ukjent filoperasjon.');if(!await confirm('delete',{side,base,names:selected.map(e=>e.name)}))return;for(const e of selected)await remove(side,base,e);
 });}
 async function startTransfer({direction,local,remote,names,overwrite=false}){return lock(async()=>{
  if(!['upload','download'].includes(direction))throw Error('Ugyldig retning.');const s=connected(),sourceSide=direction==='upload'?'local':'remote',destSide=direction==='upload'?'remote':'local';local=localPath(local);remote=remotePath(remote);const sourceBase=sourceSide==='local'?local:remote,destBase=destSide==='local'?local:remote;
  const selected=[...new Set((names||[]).map(safeName))];if(!selected.length)throw Error('Velg filer først.');
  if(!await confirm('transfer',{direction,sourceBase,destBase,names:selected,overwrite:!!overwrite}))return {started:false};
  const rows=await listRaw(sourceSide,sourceBase),planned=[];
  async function walk(entry,srcBase,dstBase){const source=join(sourceSide,srcBase,entry.name),dest=join(destSide,dstBase,entry.name);const row={id:randomUUID(),name:entry.name,direction,source,dest,base:dstBase,size:entry.type==='file'?entry.size:0,bytes:0,status:'waiting',type:entry.type,speed:0,eta:null,error:''};planned.push(row);if(entry.type==='directory'){for(const child of sorted(await listRaw(sourceSide,source)))await walk(child,source,dest);}}
  for(const name of selected){const entry=rows.find(e=>e.name===name);if(!entry)throw Error('Kilden finnes ikke: '+name);await walk(entry,sourceBase,destBase);}
  queue=planned;lastRequest={direction,local,remote,names:selected,overwrite:!!overwrite,profileId};const task={cancelled:false,session:s,profile:publicProfile(getProfile(profileId)),secrets:decode(getProfile(profileId)),overwrite:!!overwrite,blocked:new Set()};job=task;
  // Defer until lock has returned; browse commands stay disabled while job exists.
  task.done=Promise.resolve().then(()=>run(task)).catch(e=>{console.warn('WSET overføringslogg:',e.message);}).finally(()=>{job=null;});return {started:true,count:planned.length};
 });}
 /** Internal publication entrypoint: never exposed as arbitrary renderer paths. */
 async function startPublication(plan,expectedProfile,context={}){return lock(async()=>{
  const s=connected(),p=getProfile(profileId);if(profileId!==expectedProfile)throw Error('Aktiv servertilkobling er endret.');
  if(!plan.rows.length)throw Error('Ingen filer å overføre.');
  const directories=new Map(),files=new Set(),planned=[],dirChecks=new Map();
  const account=remotePath(plan.account),web=remotePath(plan.web);
  async function existingDir(dir){if(dir==='/')return true;if(dirChecks.has(dir))return dirChecks.get(dir);const parent=posix.dirname(dir);if(!await existingDir(parent)){dirChecks.set(dir,false);return false;}const e=(await s.list(parent)).find(x=>x.name===posix.basename(dir));if(e&&e.type!=='directory')throw Error('Serversti er ikke en vanlig mappe: '+dir);dirChecks.set(dir,!!e);return !!e;}
  if(!await existingDir(account)||!await existingDir(web))throw Error('Kontomappen og webroten må finnes på serveren. Kontroller tilkoblingens stier.');
  async function addDir(dir){if(dir===account||dir===web||directories.has(dir))return;if(!dir.startsWith(account==='/'?'/':account+'/'))throw Error('Ugyldig publiseringssti.');await addDir(posix.dirname(dir));const exists=await existingDir(dir);directories.set(dir,{exists});if(!exists)planned.push({dest:dir,type:'directory',policy:'preserve'});}
  // First collect directory rows, then ordered files. No write occurs during planning.
  for(const item of plan.rows){const dest=remotePath(item.dest);if(!dest.startsWith(account==='/'?'/':account+'/')||dest===web||dest===account)throw Error('Ugyldig publiseringssti.');if(item.type==='directory'){await addDir(dest);continue;}if(files.has(dest))throw Error('Duplisert publiseringssti: '+dest);files.add(dest);await addDir(posix.dirname(dest));}
  for(const item of plan.rows){if(item.type==='directory')continue;planned.push(item);}
  const fileCount=planned.filter(x=>x.type==='file').length,removeCount=planned.filter(x=>x.type==='delete').length;
  const preserved=planned.filter(x=>x.policy==='preserve'&&x.type==='file').length;
  if(!await confirm('publication',{profile:publicProfile(p),account,web,kind:plan.kind,fileCount,removeCount,preserved,pendingRemoval:plan.pendingRemoval,replaceSupplier:plan.replaceSupplier}))return {started:false};
  await fs.mkdir(tempRoot,{recursive:true});const staging=await fs.mkdtemp(path.join(tempRoot,'wset-publish-'));
  try{queue=[];for(const item of planned){const id=randomUUID(),source=path.join(staging,id),name=posix.basename(item.dest);if(item.type==='file')await fs.writeFile(source,item.bytes,{flag:'wx',mode:0o600});queue.push({id,name,direction:'upload',source,dest:item.dest,base:posix.dirname(item.dest),size:item.type==='file'?item.bytes.length:0,bytes:0,status:'waiting',type:item.type,policy:item.policy,private:!!item.private,displayPath:item.dest,speed:0,eta:null,error:''});}
   lastRequest=null;const task={cancelled:false,session:s,profile:publicProfile(p),secrets:decode(p),overwrite:true,blocked:new Set(),publication:true,staging,account};job=task;
   const publicationRoot=scope;let unexpectedFailure=false;
   task.done=Promise.resolve().then(()=>run(task)).catch(e=>{unexpectedFailure=true;console.warn('WSET publiseringslogg:',e.message);}).finally(async()=>{try{await onPublicationComplete({root:publicationRoot,kind:plan.kind,digest:context.digest,...publicationOutcome(queue,{cancelled:task.cancelled,unexpectedFailure})});}catch(e){console.warn('WSET prosjektlogg:',e.message);}finally{await fs.rm(staging,{recursive:true,force:true}).catch(()=>{});job=null;}});return {started:true,count:queue.length,pendingRemoval:!!plan.pendingRemoval};
  }catch(e){queue=[];await fs.rm(staging,{recursive:true,force:true});throw e;}
 });}
 async function run(task){const s=task.session;const blocked=task.blocked;let publicationFailed=false;for(const row of queue){const sourceSide=row.direction==='upload'?'local':'remote',destSide=row.direction==='upload'?'remote':'local';const sep=destSide==='local'?path.sep:'/';let tmp=null;try{
   if(task.cancelled){row.status='cancelled';continue;}if(task.publication&&publicationFailed){row.status='skipped';row.error='Publiseringen stoppet etter en feil. Start en ny publisering etter kontroll.';continue;}if([...blocked].some(b=>row.dest===b||row.dest.startsWith(b+sep))){row.status='skipped';row.error='Overordnet mappe kunne ikke overføres.';continue;}
   if(row.type==='link'){row.status='skipped';row.error='Symbolske lenker og spesialfiler overføres ikke.';continue;}
   row.status='running';
   if(task.publication){ // Refuse symlink / path substitutions for every destination parent, not just during planning.
    let dir=row.base;while(dir!=='/'){const e=(await s.list(posix.dirname(dir))).find(x=>x.name===posix.basename(dir));if(e?.type!=='directory')throw Error('Utrygg eller manglende servermappe: '+dir);dir=posix.dirname(dir);}
   }
   const existing=await stat(destSide,row.base,row.name);
   if(task.publication&&existing&&existing.type!=='file'&&row.type!=='directory')throw Error('Serverfil er ikke en vanlig fil: '+row.dest);
   if(task.publication&&row.policy==='owned'&&existing){if(existing.size>25*1024*1024)throw Error('Egen XML er for stor til identitetskontroll.');const checkFile=path.join(task.staging,row.id+'.check');try{await s.download(row.dest,checkFile,()=>{});const data=await fs.readFile(checkFile,'utf8');if(!data.includes('<!-- WSET managed own-property feed v1 -->'))throw Error('Serverens XML er ikke identifisert som WSET-generert.');}finally{await fs.rm(checkFile,{force:true});}}
   if(task.publication&&row.type==='delete'){if(existing)await s.unlink(row.dest);row.status='done';continue;}
   if(task.publication&&row.policy==='immutable'&&existing){if(existing.size!==row.size)throw Error('Eksisterende boligbilde har annet innhold: '+row.dest);const checkFile=path.join(task.staging,row.id+'.image');try{await s.download(row.dest,checkFile,()=>{});const [a,b]=await Promise.all([fs.readFile(checkFile),fs.readFile(row.source)]);if(!a.equals(b))throw Error('Eksisterende boligbilde har annet innhold: '+row.dest);}finally{await fs.rm(checkFile,{force:true});}row.status='skipped';row.error='Identisk boligbilde beholdt.';continue;}
   if(task.publication&&row.policy==='preserve'&&existing&&row.type==='file'){row.status='skipped';row.error='Eksisterende serverfil beholdt.';continue;}
   if(row.type==='directory'){if(existing&&existing.type!=='directory')throw Error('Destinasjonen er ikke en mappe.');if(!existing)await makeDir(destSide,row.base,row.name);row.status='done';continue;}
   if(existing&&(!task.overwrite||existing.type!=='file')){row.status='skipped';row.error='Filen finnes allerede.';continue;}
   const parent=sourceSide==='local'?path.dirname(row.source):posix.dirname(row.source);const source=await stat(sourceSide,parent,task.publication?path.basename(row.source):row.name);if(!source||source.type!=='file'||source.size!==row.size)throw Error('Kildefilen er endret siden overføringen ble planlagt.');
   const name='.wset-transfer-'+randomUUID()+'.part';const tempBase=task.publication?task.account:row.base;tmp=join(destSide,tempBase,name);const start=clock();const report=bytes=>{row.bytes=Math.min(row.size,Math.max(0,bytes));const secs=(clock()-start)/1000;row.speed=secs>0?row.bytes/secs:0;row.eta=row.speed>0?(row.size-row.bytes)/row.speed:null;};
   if(row.direction==='upload')await s.upload(row.source,tmp,report,{private:row.private});else await s.download(row.source,tmp,report);
   if(task.cancelled)throw Error('Avbrutt.');const staged=await stat(destSide,tempBase,name);if(!staged||staged.type!=='file'||staged.size!==row.size)throw Error('Størrelseskontrollen av overført fil feilet.');
   const now=await stat(destSide,row.base,row.name);if(task.publication&&now&&(now.type!=='file'||(row.policy==='owned'&&(!existing||now.size!==existing.size))))throw Error('Destinasjonen endret seg under overføringen: '+row.dest);if(task.publication&&row.policy==='immutable'&&now)throw Error('Boligbildet ble opprettet under overføringen. Start på nytt.');if(now&&(!task.overwrite||now.type!=='file'||(task.publication&&['preserve','immutable'].includes(row.policy)))){row.status='skipped';row.error='Destinasjonen finnes allerede.';continue;}
   if(destSide==='local'){if(task.overwrite&&now)await fs.rename(tmp,row.dest);else{await fs.link(tmp,row.dest);await fs.unlink(tmp);}}else if(now)await s.replace(tmp,row.dest);else await s.rename(tmp,row.dest);
   tmp=null;const final=await stat(destSide,row.base,row.name);if(!final||final.type!=='file'||final.size!==row.size)throw Error('Størrelseskontroll etter overføring feilet.');row.bytes=row.size;row.status='done';row.eta=0;
  }catch(e){row.status=task.cancelled?'cancelled':'failed';if(task.publication)publicationFailed=true;row.error=safeError(e,task.secrets);if(row.type==='directory')blocked.add(row.dest);}
  finally{if(tmp){try{if(destSide==='local')await fs.rm(tmp,{force:true});else await s.unlink(tmp);}catch{row.error+=(row.error?' · ':'')+'Midlertidig fil kan ligge igjen: '+tmp;}}
   store.history.unshift({id:row.id,name:row.displayPath||row.name,direction:row.direction,source:task.publication?'WSET publisering':row.source,dest:row.dest,size:row.size,status:row.status,error:row.error,profile:task.profile.name,at:new Date(clock()).toISOString()});}
 }
 await save();}
 function cancel(){if(!job)return false;job.cancelled=true;end();return true;}
 async function retry(){if(!lastRequest||lastRequest.profileId!==profileId)throw Error('Koble til den opprinnelige serverprofilen før nytt forsøk.');return startTransfer(lastRequest);}
 return {setScope,snapshot,startPublication,saveProfile,connect,test:id=>connect(id,true),list,operation,startTransfer,retry,cancel,wait:()=>job?.done||Promise.resolve(),disconnect:()=>lock(async()=>end()),removeProfile:id=>lock(async()=>{if(id===profileId)throw Error('Koble fra før profilen slettes.');const p=getProfile(id);if(!await confirm('profile',{profile:publicProfile(p)}))return;const old=store.profiles;store.profiles=old.filter(x=>x.id!==id);try{await save();}catch(e){store.profiles=old;throw e;}transient.delete(id);}),close:()=>{closed=true;if(job)cancel();else end();}};
}
