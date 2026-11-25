// Public, optional identity contract shared by the editor and preview renderer.
export const identitySchema='wset-assistant-identity-v1';
export const profiles=Object.freeze({standard:'',alba:'Alba',luna:'Luna',clara:'Clara',custom:''});
const plain=(v,max)=>typeof v==='string'&&v.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(v);
const locale=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
export const avatarPath=v=>typeof v==='string'&&/^\/assets\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(v);
export function validateIdentity(v){
 if(v==null||v.schema!==identitySchema||!Object.hasOwn(profiles,v.profile))return [];
 const errors=[];const bad=k=>errors.push('Ugyldig assistentidentitet: '+k);
 for(const [k,max] of [['name',70]])if(v[k]!==undefined&&!plain(v[k],max))bad(k);
 if(v.tone!==undefined&&!['neutral','warm','casual','professional'].includes(v.tone))bad('tone');
 if(v.avatar!==undefined&&v.avatar!==''&&!avatarPath(v.avatar))bad('avatar');
 if(v.accent!==undefined&&v.accent!==''&&!/^#[0-9a-f]{6}$/i.test(v.accent))bad('accent');
 if(v.typing!==undefined&&typeof v.typing!=='boolean')bad('typing');
 if(v.minResponseMs!==undefined&&(!Number.isInteger(v.minResponseMs)||v.minResponseMs<0||v.minResponseMs>1500))bad('minResponseMs');
 for(const [k,max] of [['subtitle',100],['welcome',500]])if(v[k]!==undefined&&(!v[k]||typeof v[k]!=='object'||Array.isArray(v[k])||Object.entries(v[k]).some(([l,t])=>!locale.test(l)||!plain(t,max))))bad(k);
 if(v.shortcuts!==undefined&&(!v.shortcuts||typeof v.shortcuts!=='object'||Array.isArray(v.shortcuts)||Object.entries(v.shortcuts).some(([l,rows])=>!locale.test(l)||!Array.isArray(rows)||rows.length>4||rows.some(r=>!plain(r?.label,80)||!plain(r?.message,200)||!r.label.trim()||!r.message.trim()))))bad('shortcuts');
 return errors;
}
export function publicIdentity(site){const v=site?.smartAssistant?.identity;if(!v||v.schema!==identitySchema||!Object.hasOwn(profiles,v.profile))return null;const errors=validateIdentity(v);if(errors.length)throw Error(errors.join('\n'));const result={schema:identitySchema,profile:v.profile};for(const k of ['name','tone','avatar','accent','subtitle','welcome','shortcuts','typing','minResponseMs'])if(v[k]!==undefined)result[k]=structuredClone(v[k]);if(result.shortcuts)for(const [lang,rows] of Object.entries(result.shortcuts))result.shortcuts[lang]=rows.map(({label,message})=>({label,message}));return result;}
export function editIdentity(site,{field,value,locale:lang}){
 const a=site.smartAssistant??={enabled:false,displayName:'Smart Assistant'};
 if(field==='profile'&&value==='legacy'){delete a.identity;return;}
 const v=publicIdentity(site)||{schema:identitySchema,profile:'standard'};
 if(field==='translateMissing'){
  if(!site.languages.some(l=>l.code===lang)||lang===site.defaultLanguage||!value||typeof value!=='object'||!publicIdentity(site))throw Error('Ugyldig oversettelsesjobb.');
  const source=site.defaultLanguage;
  for(const k of ['subtitle','welcome','shortcuts']){
   const row=value[k];if(!row)continue;
   const actual=v[k]?.[source];if(JSON.stringify(actual)!==JSON.stringify(row.source)||Object.hasOwn(v[k]||{},lang))throw Error('Assistentteksten er endret. Oversett på nytt.');
   v[k]??={};v[k][lang]=structuredClone(row.value);
  }
 }else if(field==='profile'){if(!Object.hasOwn(profiles,value))throw Error('Ukjent profil.');v.profile=value;delete v.name;delete v.tone;delete v.accent;}
 else if(['name','tone','avatar','accent','typing','minResponseMs'].includes(field)){
  if(field==='minResponseMs'){if(String(value).trim()==='')delete v[field];else {if(!/^\d{1,4}$/.test(String(value)))throw Error('Angi hele millisekunder fra 0 til 1500.');v[field]=Number(value);}}else if(value===''&&field!=='typing')delete v[field];else v[field]=value;
 }else if(['subtitle','welcome','shortcuts','shortcutMode'].includes(field)){
  if(!site.languages.some(l=>l.code===lang))throw Error('Ukjent språk.');
  const key=field==='shortcutMode'?'shortcuts':field;v[key]??={};
  if(field==='shortcutMode'){if(value==='default')delete v[key][lang];else if(value==='hidden')v[key][lang]=[];else throw Error('Ukjent hurtigvalgmodus.');}
  else if(field==='shortcuts'){const rows=Array.isArray(value)?value.map(r=>({label:r?.label,message:r?.message})):String(value).split('\n').filter(s=>s.trim()).map(s=>{const i=s.indexOf('|');if(i<1)throw Error('Bruk formatet knappetekst | melding.');return {label:s.slice(0,i).trim(),message:s.slice(i+1).trim()};});v[key][lang]=rows;}
  else if(value==='')delete v[key][lang];else v[key][lang]=typeof value==='string'?value.replace(/\r?\n/g,' '):value;
 }else throw Error('Ukjent identitetsfelt.');
 const errors=validateIdentity(v);if(errors.length)throw Error(errors.join('\n'));a.identity=v;
}
