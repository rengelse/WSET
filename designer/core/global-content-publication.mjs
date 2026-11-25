import {createHash} from 'node:crypto';
import {applyGlobalMarkup,hasGlobalContent,hasLegalContent,globalLegalCss,globalLegalJs} from '../engines/cbpm-astro-v1/lib/global-content.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function applyGlobalPublication(files,site,manifest){
 if(!hasGlobalContent(site))return {files,manifest,count:0};
 const updated=new Map(files),next=structuredClone(manifest);let count=0,matched=0;
 function set(path,bytes){const old=files.get(path);if(!old||next.files[path]!==hash(old))throw Error('Globalt innhold: filhash avviker for '+path);updated.set(path,bytes);next.files[path]=hash(bytes);}
 for(const [path,bytes] of files){
  const shell=path.match(/^api\/property\/shell\/([^/]+)\/[^/]+\.php$/i);
  if(!shell&&!/\.html$/i.test(path))continue;
  const html=bytes.toString('utf8'),hasFooter=/<footer\b[^>]*class="[^"]*\bfooter\b/i.test(html),hasHeader=/<header\b[^>]*class="[^"]*\bsite-header\b/i.test(html);
  if(!hasFooter&&!hasHeader)continue;
  const lang=html.match(/<html\b[^>]*\blang="([a-zA-Z0-9-]+)"/)?.[1],locale=shell?.[1]||lang;
  if((lang&&lang!==locale)||!site.languages.some(l=>l.code===locale))throw Error('Globalt innhold: ukjent sidespråk '+path);
  if(hasFooter)matched++;
  const result=applyGlobalMarkup(html,site,locale,{strict:hasFooter});if(result!==html){set(path,Buffer.from(result));count++;}
 }
 if(!matched)throw Error('Globalt innhold: ingen kompatible nettsider kunne oppdateres.');
 if(hasLegalContent(site)){for(const [path,suffix] of [['assets/js/site.js',globalLegalJs],['assets/css/styles.css',globalLegalCss]]){const old=files.get(path);if(!old)throw Error('Globalt innhold: mangler '+path);set(path,Buffer.concat([old,Buffer.from(suffix)]));}}
 if(updated.has('cbpm-publication-manifest.json'))updated.set('cbpm-publication-manifest.json',Buffer.from(JSON.stringify(next,null,2)+'\n'));
 return {files:updated,manifest:next,count};
}
