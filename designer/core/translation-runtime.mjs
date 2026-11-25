import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
export const HARDWARE=['auto','cuda','vulkan','cpu'];
export function runtimeEnv(mode,port,base=process.env){
 const env={...base,OLLAMA_HOST:`127.0.0.1:${port}`,OLLAMA_NO_CLOUD:'1'};
 if(mode!=='auto')for(const k of ['CUDA_VISIBLE_DEVICES','GGML_VK_VISIBLE_DEVICES','HIP_VISIBLE_DEVICES','ROCR_VISIBLE_DEVICES','GPU_DEVICE_ORDINAL','OLLAMA_LLM_LIBRARY'])delete env[k];
 if(mode==='cuda'){env.OLLAMA_VULKAN='0';env.HIP_VISIBLE_DEVICES='-1';env.ROCR_VISIBLE_DEVICES='-1';}
 if(mode==='vulkan'||mode==='cpu'){env.CUDA_VISIBLE_DEVICES='-1';env.HIP_VISIBLE_DEVICES='-1';env.ROCR_VISIBLE_DEVICES='-1';env.OLLAMA_VULKAN=mode==='vulkan'?'1':'0';}
 if(mode==='cpu')env.GGML_VK_VISIBLE_DEVICES='-1';
 return env;
}
async function freePort(){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
function executable(){const local=process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Programs','Ollama','ollama.exe');return process.platform==='win32'&&local&&existsSync(local)?local:'ollama';}
export function createManagedRuntime({fetcher=fetch,spawnProcess=spawn,allocatePort=freePort,wait=delay}={}){
 let child=null,endpoint=null,mode=null,starting=null,closed=false;
 async function stop(){const p=child;child=null;endpoint=null;mode=null;if(p&&p.exitCode==null&&p.signalCode==null){const exited=new Promise(r=>p.once('exit',r));p.kill();await Promise.race([exited,wait(3000)]);}}
 async function start(wanted){if(closed)throw Error('Ollama-kjøring er avsluttet.');if(!HARDWARE.includes(wanted))throw Error('Ugyldig kjøremodus.');if(child&&mode===wanted&&endpoint)return endpoint;if(starting){await starting;return start(wanted);}starting=(async()=>{await stop();const port=await allocatePort();if(closed)throw Error('Oppstart avbrutt.');const url=`http://127.0.0.1:${port}`;const p=spawnProcess(executable(),['serve'],{env:runtimeEnv(wanted,port),windowsHide:true,stdio:['ignore','ignore','pipe']});child=p;let detail='',failure='';p.stderr?.on('data',b=>{detail=(detail+String(b)).slice(-1500);});p.on('error',e=>{failure=e.message;});p.on('exit',()=>{if(child===p){child=null;endpoint=null;mode=null;}failure||='Ollama-prosessen avsluttet.';});try{for(let i=0;i<80;i++){if(closed||failure||child!==p)throw Error(failure||'Oppstart avbrutt.');try{const r=await fetcher(url+'/api/version',{signal:AbortSignal.timeout(500),redirect:'error'});if(r.ok&&typeof (await r.json()).version==='string'&&child===p&&!closed){endpoint=url;mode=wanted;return url;}}catch{}await wait(250);}throw Error('Tidsavbrudd ved oppstart av lokal Ollama.');}catch(e){await stop();throw Error(e.message+(detail?' – '+detail.slice(-600):''));}})();try{return await starting;}finally{starting=null;}}
 return {start,stop,close(){closed=true;void stop();},state:()=>({endpoint,mode})};
}
export const hardwareFailure=e=>/CUDA|Vulkan|GPU|kernel image|llama-server process has terminated|out of memory|requires more memory|failed to load model/i.test(e?.message||'');
