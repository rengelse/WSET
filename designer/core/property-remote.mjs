/** CBPM 1.2.9 – remote-only property administration. Token is never persisted. */
import {assertFeedUrl} from './property-sync.mjs';
export function validatePropertyEndpoint(value){
 const url=new URL(String(value||''));
 const isLoopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname.toLowerCase());
 if(url.protocol==='http:' && isLoopback){
  if(url.username||url.password||url.hash||url.search)throw Error('Lokal administratoradresse kan ikke ha innlogging, fragment eller parametere.');
 }else{
  assertFeedUrl(value); // Strict HTTPS and public-host validation for remote connections.
 }
 if(!url.pathname.endsWith('/api/property/cbpm-admin.php'))throw Error('Bruk adressen til /api/property/cbpm-admin.php på nettstedet.');
 return url.origin+url.pathname;
}
export class RemotePropertyStore {
 constructor(){this.endpoint=null;this.token=null;this.staging=null;}
 get connected(){return Boolean(this.endpoint&&this.token);}
 async connect({endpoint,token}){
  const target=validatePropertyEndpoint(String(endpoint||''));
  if(typeof token!=='string'||token.length<40||token.length>256)throw Error('Oppgi administratortoken fra serverinstallasjonen.');
  const former={endpoint:this.endpoint,token:this.token};this.endpoint=target;this.token=token;
  try{const response=await this.request('connect');if(!response.ok||response.storage!=='server-xml')throw Error('Serveren har feil versjon eller er ikke et XML-arkiv.');return response;}
  catch(e){this.endpoint=former.endpoint;this.token=former.token;throw e;}
 }
 disconnect(){this.endpoint=null;this.token=null;this.staging=null;}
 async request(op,payload={},xml=null){
  if(!this.connected)throw Error('Koble Eiendomsregister til XML-arkivet på webhotellet først.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{
   const url=this.endpoint+'?op='+encodeURIComponent(op);
   const headers={'Authorization':'Bearer '+this.token,'Accept':'application/json'};
   if(xml){headers['Content-Type']='application/xml';headers['X-CBPM-Source-Meta']=Buffer.from(JSON.stringify({folder:payload.folder,filename:payload.filename})).toString('base64url');}
   else headers['Content-Type']='application/json';
   const response=await fetch(url,{method:'POST',headers,body:xml||JSON.stringify(payload),redirect:'error',signal:controller.signal,cache:'no-store'});
   const bytes=await response.text();if(bytes.length>8*1024*1024)throw Error('For stort svar fra XML-arkivet.');
   let data;try{data=JSON.parse(bytes);}catch{throw Error('Ugyldig svar fra webhotellet. Kontroller PHP-konfigurasjonen.');}
   if(!response.ok||data.error)throw Error(data.error||'Webhotellet avviste forespørselen ('+response.status+').');
   return data;
  }catch(e){if(e.name==='AbortError')throw Error('Tidsavbrudd ved tilkobling til XML-arkivet.');throw e;}
  finally{clearTimeout(timeout);}
 }
 list(filter){return this.request('list',filter);}
 get({id}){return this.request('get',{id});}
 save(record){return this.request('save',{record});}
 status(data){return this.request('status',data);}
 async stage({folder,filename,bytes}){
  if(!['New','Existing'].includes(folder))throw Error('Velg New eller Existing.');
  if(typeof filename!=='string'||!/^([a-z][a-z0-9 _-]{0,63})\.xml$/i.test(filename))throw Error('Ugyldig XML-filnavn.');
  if(!Buffer.isBuffer(bytes)||bytes.length<10||bytes.length>25*1024*1024)throw Error('XML-fil må være mellom 10 byte og 25 MB.');
  const result=await this.request('upload',{folder,filename},bytes);
  this.staging=result.run.id;return result;
 }
 preview({page=1}={}){if(!this.staging)throw Error('Ingen import venter.');return this.request('preview',{id:this.staging,page});}
 async approve({checksum}){
  if(!this.staging||checksum!==this.staging)throw Error('Import-ID er ikke gyldig.');
  const result=await this.request('approve',{id:this.staging});this.staging=null;return result;
 }
 async discard(){if(!this.staging)return {ok:true};const result=await this.request('discard',{id:this.staging});this.staging=null;return result;}
 settings(){return this.request('settings-get');}
 saveSettings(settings,policy){return this.request('settings-save',{settings,policy});}
 savePolicy(policy){return this.request('policy-save',{policy});}
}
