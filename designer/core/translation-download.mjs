// Ollama's pull endpoint returns newline-delimited JSON, one event per layer.
export function createPullProgress(now=()=>Date.now()){
 const layers=new Map();let lastTime=now(),lastBytes=0,speed=0;
 return event=>{
  if(event.error)throw Error(String(event.error));
  if(typeof event.digest==='string'&&Number.isSafeInteger(event.total)&&event.total>0&&Number.isSafeInteger(event.completed)&&event.completed>=0){layers.set(event.digest,{total:event.total,completed:Math.min(event.total,event.completed)});}
  const total=[...layers.values()].reduce((n,l)=>n+l.total,0),completed=[...layers.values()].reduce((n,l)=>n+l.completed,0),time=now();
  if(time-lastTime>=500){const rate=(completed-lastBytes)*1000/(time-lastTime);speed=Math.max(0,speed?speed*.65+rate*.35:rate);lastTime=time;lastBytes=completed;}
  const downloading=String(event.status||'').startsWith('pulling')&&!!event.digest;
  return {phase:String(event.status||''),total,completed,percent:downloading&&total?Math.min(99,Math.floor(completed/total*100)):null,speed:downloading?speed:0,eta:downloading&&speed>0?Math.ceil((total-completed)/speed):null};
 };
}
export async function readPullStream(response,onProgress){
 if(!response.ok)throw Error('Ollama: HTTP '+response.status);
 if(!response.body)throw Error('Ollama returnerte ingen nedlastingsstrøm.');
 const decode=new TextDecoder(),reader=response.body.getReader(),progress=createPullProgress();let pending='',success=false;
 function line(s){if(!s.trim())return;const event=JSON.parse(s);onProgress(progress(event));if(event.status==='success')success=true;}
 try{while(true){const {done,value}=await reader.read();if(done)break;pending+=decode.decode(value,{stream:true});let i;while((i=pending.indexOf('\n'))>=0){line(pending.slice(0,i));pending=pending.slice(i+1);}if(pending.length>1000000)throw Error('Ugyldig nedlastingsstrøm.');}line(pending+decode.decode());if(!success)throw Error('Nedlastingen ble avsluttet før modellen var ferdig.');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
