import {createHash} from 'node:crypto';
import {publicIdentity} from '../engines/cbpm-astro-v1/lib/assistant-identity.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Apply the optional identity to generated HTML and PHP page shells, regardless
// of the version of the imported Astro project. No source mutation or API change.
export function applyAssistantPublication(files,site,manifest){
 const identity=site.smartAssistant?.enabled===true?publicIdentity(site):null;if(!identity)return null;
 if(identity.avatar){const original=identity.avatar.slice(1),organized='assets/images/'+original.slice('assets/'.length);const path=files.has(organized)?organized:files.has(original)?original:null;if(!path)throw Error('Assistentens avatar mangler i offentlig eksport.');identity.avatar='/'+path;}
 const next=structuredClone(manifest),updated=new Map(files);let count=0;
 for(const [path,bytes] of files){if(!/\.html$|^api\/property\/shell\/[^/]+\/[^/]+\.php$/i.test(path))continue;
  const html=bytes.toString('utf8');const re=/(<script\b[^>]*\bid=["']wset-smart-assistant-config["'][^>]*>)([\s\S]*?)(<\/script>)/gi;
  const result=html.replace(re,(_all,open,raw,close)=>{const config=JSON.parse(raw);if(config.preview!==false||config.live!==true||config.endpoint!=='/api/assistant/api.php')throw Error('Uventet AI-konfigurasjon i '+path);config.identity=identity;count++;return open+JSON.stringify(config).replace(/</g,'\\u003c')+close;});
  if(result!==html){if(next.files[path]!==hash(bytes))throw Error('Assistent: filhash avviker for '+path);const b=Buffer.from(result);updated.set(path,b);next.files[path]=hash(b);}
 }
 if(!count)throw Error('Nettstedet har ingen publisert AI-konfigurasjon som kan oppdateres.');
 if(updated.has('cbpm-publication-manifest.json'))updated.set('cbpm-publication-manifest.json',Buffer.from(JSON.stringify(next,null,2)+'\n'));
 return {files:updated,manifest:next,count};
}
export function supportsIdentity(version){const m=/^(\d+)\.(\d+)\.(\d+)(?:-module\.(\d+))?$/.exec(version||'');if(!m)return false;const [a,b,c,n]=m.slice(1).map(Number);return a>1||(a===1&&(b>9||(b===9&&(c>10||(c===10&&(!m[4]||n>=24))))));}
