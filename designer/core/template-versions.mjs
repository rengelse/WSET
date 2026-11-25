/** Version precedence for the existing v1 descriptor grammar. No archive code is executed. */
import {validateTemplateDescriptor} from './template-contract.mjs';
const numeric=/^\d+$/;
function parse(version){
 const m=/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*))?$/.exec(version);
 if(!m||version.length>80)throw Error('Ugyldig malversjon.');
 return {core:m.slice(1,4).map(BigInt),pre:m[4]?.split(/[.-]/)||null};
}
const cmp=(a,b)=>a===b?0:a>b?1:-1;
export function compareTemplateVersions(a,b){
 const x=parse(a),y=parse(b);for(let i=0;i<3;i++){const c=cmp(x.core[i],y.core[i]);if(c)return c;}
 if(!x.pre||!y.pre)return cmp(Number(!x.pre),Number(!y.pre));
 for(let i=0;i<Math.min(x.pre.length,y.pre.length);i++){
  const p=x.pre[i],q=y.pre[i],pn=numeric.test(p),qn=numeric.test(q);
  const c=pn&&qn?cmp(BigInt(p),BigInt(q)):pn!==qn?(pn?-1:1):cmp(p,q);if(c)return c;
 }
 return cmp(x.pre.length,y.pre.length);
}
export function sortTemplateEntries(a,b){return a.template.category.localeCompare(b.template.category)||a.template.id.localeCompare(b.template.id)||compareTemplateVersions(b.template.templateVersion,a.template.templateVersion)||cmp(a.template.templateVersion,b.template.templateVersion);}
const summary=e=>e?{key:e.key,digest:e.digest,template:e.template,supported:e.supported}:null;
export function templateVersionStatus(template,catalogue){
 if(!template)return null;validateTemplateDescriptor(template);
 const same=e=>e.template.id===template.id&&e.template.engine===template.engine&&e.template.contractVersion===template.contractVersion;
 const entries=(catalogue.items||[]).filter(same).sort((a,b)=>compareTemplateVersions(b.template.templateVersion,a.template.templateVersion)||cmp(a.template.templateVersion,b.template.templateVersion));
 const conflicts=(catalogue.conflicts||[]).filter(same);
 const newer=e=>compareTemplateVersions(e.template.templateVersion,template.templateVersion)>0;
 const available=entries.filter(newer),blocked=conflicts.filter(newer),unsupported=available.filter(e=>!e.supported);
 // Equal precedence with a different version string is ambiguous: do not recommend either.
 const all=[...entries,...conflicts];const ambiguous=e=>all.some(x=>x.template.templateVersion!==e.template.templateVersion&&compareTemplateVersions(x.template.templateVersion,e.template.templateVersion)===0);
 const recommended=available.find(e=>e.supported&&!ambiguous(e));
 const exact=entries.some(e=>e.template.templateVersion===template.templateVersion);
 const exactConflict=conflicts.some(e=>compareTemplateVersions(e.template.templateVersion,template.templateVersion)===0)||entries.some(e=>e.template.templateVersion!==template.templateVersion&&compareTemplateVersions(e.template.templateVersion,template.templateVersion)===0);
 let status='current';
 if(catalogue.complete===false)status='unavailable';
 else if(recommended)status='available';
 else if(blocked.length||exactConflict||available.some(ambiguous))status='conflict';
 else if(unsupported.length)status='unsupported';
 else if(!exact)status=entries.length&&entries.every(e=>compareTemplateVersions(e.template.templateVersion,template.templateVersion)<0)?'ahead':'not-in-library';
 return {status,installed:template.templateVersion,latest:summary(entries[0]),recommended:catalogue.complete===false?null:summary(recommended),versions:entries.length,newerKeys:catalogue.complete===false?[]:available.filter(e=>e.supported&&!ambiguous(e)).map(e=>e.key),exact,exactConflict,newerConflicts:blocked.map(e=>e.template.templateVersion),newerUnsupported:unsupported.map(e=>e.template.templateVersion)};
}
export function assertTemplateUpdate(source,target){
 if(source.id!==target.id||source.engine!==target.engine||source.contractVersion!==target.contractVersion)throw Error('Oppdatering krever samme mal-ID, motor og kontrakt.');
 if(compareTemplateVersions(target.templateVersion,source.templateVersion)<=0)throw Error('Velg en nyere malversjon. Bruk Tilbakefør mal for tidligere versjoner.');
}
