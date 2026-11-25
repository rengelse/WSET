import {publicIdentity,validateIdentity} from './assistant-identity.mjs';
/** Smart Assistant: one public on/off toggle and optional display name. */
export const assistantDefaults=Object.freeze({enabled:false,displayName:'Smart Assistant'});
export function assistantConfig(site){return {...assistantDefaults,...(site?.smartAssistant||{})};}
export function assistantPublicReady(site){return assistantConfig(site).enabled===true;}
export function assistantVisible(site,{preview=false}={}){return assistantPublicReady(site);}
export function validateAssistant(site){const c=assistantConfig(site),errors=[];
 if(typeof c.enabled!=='boolean')errors.push('Smart Assistant enabled flag must be boolean.');
 if(typeof c.displayName!=='string'||!c.displayName.trim()||c.displayName.length>70||/[<>]/.test(c.displayName))errors.push('Invalid Smart Assistant name.');
 return [...errors,...validateIdentity(c.identity)];}
export function assistantMarkup(site,locale,{preview=false}={}){
 if(!assistantVisible(site,{preview}))return '';
 const c=assistantConfig(site);
 // Public exports always use the site-local PHP endpoint. Offline designer preview stays offline.
 const identity=publicIdentity(site);
 const json=JSON.stringify({...(identity?{identity}:{}),name:c.displayName,locale,defaultLocale:site.defaultLanguage||'no',welcome:'',preview:preview===true,live:preview===false,endpoint:preview?'':'/api/assistant/api.php'}).replace(/</g,'\\u003c');
 return `<link rel="stylesheet" href="/smart-assistant.css"><script type="application/json" id="wset-smart-assistant-config">${json}</script><script src="/smart-assistant.js" defer></script>${preview?'':'<script src="/smart-assistant-live.js" defer></script>'}`;
}
