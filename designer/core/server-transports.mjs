import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export function fingerprint(key){return 'SHA256:'+createHash('sha256').update(key).digest('base64').replace(/=+$/,'');}
const meter=report=>{let bytes=0;return new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;report(bytes);done(null,chunk);}});};
const sftpEntry=e=>({name:e.filename,type:e.attrs.isDirectory()?'directory':e.attrs.isFile()?'file':'link',size:e.attrs.size||0,modified:e.attrs.mtime?new Date(e.attrs.mtime*1000).toISOString():null});
export async function openSftp(profile,secrets,{trust,load=()=>import('ssh2')}={}){
 const imported=await load();const Client=imported.Client||imported.default.Client;
 const privateKey=profile.keyFile?await readFile(profile.keyFile):undefined;
 let expected=profile.fingerprint||'', observed='';
 async function attempt(){
  const conn=new Client();let channel,open=true;conn.on('close',()=>{open=false;});
  try{await new Promise((resolve,reject)=>{
   conn.on('error',reject);conn.once('ready',resolve);conn.once('close',()=>reject(new Error('SFTP-tilkoblingen ble lukket.')));
   conn.connect({host:profile.host,port:profile.port,username:profile.username,password:secrets.password||undefined,privateKey,passphrase:secrets.passphrase||undefined,readyTimeout:20000,keepaliveInterval:15000,hostVerifier:key=>{observed=fingerprint(key);return !!expected&&observed===expected;}});
  });channel=await new Promise((resolve,reject)=>conn.sftp((err,s)=>err?reject(err):resolve(s)));}
  catch(error){conn.end();throw error;}
  const call=(method,...args)=>new Promise((resolve,reject)=>channel[method](...args,(err,data)=>err?reject(err):resolve(data)));
  return {fingerprint:expected,isOpen:()=>open,list:async p=>(await call('readdir',p)).map(sftpEntry),mkdir:p=>call('mkdir',p),rename:(a,b)=>call('rename',a,b),
   replace:async(a,b)=>{if(typeof channel.ext_openssh_rename!=='function')throw Error('Serveren støtter ikke sikker erstatning.');return call('ext_openssh_rename',a,b);},unlink:p=>call('unlink',p),rmdir:p=>call('rmdir',p),
   upload:(local,remote,report,options={})=>pipeline(createReadStream(local),meter(report),channel.createWriteStream(remote,{flags:'wx',...(options.private?{mode:0o640}:{})})),
   download:(remote,local,report)=>pipeline(channel.createReadStream(remote),meter(report),createWriteStream(local,{flags:'wx'})),close:()=>{open=false;try{channel.end();}finally{conn.end();}}};
 }
 try{return await attempt();}catch(error){
  if(expected&&observed&&observed!==expected)throw Error('SFTP-vertsnøkkelen har endret seg. Avbrutt. Verifiser serverens fingeravtrykk med administratoren før ny profil opprettes.');
  if(expected||!observed)throw error;
  if(!await trust(observed))throw Error('SFTP-vertsnøkkelen ble ikke godkjent.');
  expected=observed;return attempt();
 }
}
export async function openFtp(profile,secrets,{load=()=>import('basic-ftp')}={}){
 const imported=await load();const Client=imported.Client||imported.default.Client;const client=new Client(30000);
 try{await client.access({host:profile.host,port:profile.port,user:profile.username,password:secrets.password||'',secure:profile.protocol==='ftps'?(profile.tlsMode==='implicit'?'implicit':true):false,secureOptions:{rejectUnauthorized:true,servername:profile.host,minVersion:'TLSv1.2'}});}catch(error){client.close();throw error;}
 const transfer=async(fn,report)=>{client.trackProgress(info=>report(info.bytes));try{return await fn();}finally{client.trackProgress();}};
 return {isOpen:()=>!client.closed,list:async p=>(await client.list(p)).map(e=>({name:e.name,type:e.isDirectory?'directory':e.isFile?'file':'link',size:e.size||0,modified:e.modifiedAt?.toISOString()||null})),
  mkdir:async p=>{await client.send('MKD '+p);},rename:(a,b)=>client.rename(a,b),replace:(a,b)=>client.rename(a,b),unlink:p=>client.remove(p),rmdir:async p=>{await client.send('RMD '+p);},
  upload:(local,remote,report)=>transfer(()=>client.uploadFrom(local,remote),report),download:(remote,local,report)=>transfer(()=>client.downloadTo(createWriteStream(local,{flags:'wx'}),remote),report),close:()=>client.close()};
}
export async function openServerTransport(profile,secrets,options){return profile.protocol==='sftp'?openSftp(profile,secrets,options):openFtp(profile,secrets,options);}
