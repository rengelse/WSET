/** Versioned, data-only style overrides for the CBPM static-page adapter.
 * No user-supplied selectors, CSS, URLs, HTML or executable code.
 * Individual text styles are scoped to a language and stable inline target.
 */
import {inlineTargets} from './inline-editing.mjs';
import {prepareTextPage} from './universal-text.mjs';
import {renderDynamicSite} from './renderer-runtime.mjs';
import {splitMainSections} from './renderer-runtime.mjs';
const own=(o,k)=>o&&Object.hasOwn(o,k)?o[k]:undefined;
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
export const roles={heading:'h1,h2,h3,h4,h5,h6',body:'p,li,figcaption',button:'a.btn,button',accent:'h1 em,h2 em,h3 em,h4 em'};
export const fonts={system:'system-ui, sans-serif',arial:'Arial, sans-serif',georgia:'Georgia, serif',verdana:'Verdana, sans-serif',times:'"Times New Roman", serif',tahoma:'Tahoma, sans-serif'};
const properties={font:'font-family',size:'font-size',color:'color',weight:'font-weight',italic:'font-style',align:'text-align',lineHeight:'line-height',background:'background-color',radius:'border-radius',decoration:'text-decoration-line'};
function valid(k,v){switch(k){case 'font':return typeof v==='string'&&Object.hasOwn(fonts,v);case 'color':case 'background':return typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);case 'size':return typeof v==='number'&&Number.isFinite(v)&&v>=10&&v<=96;case 'weight':return ['400','500','600','700','800'].includes(v);case 'italic':return ['normal','italic'].includes(v);case 'decoration':return ['none','underline'].includes(v);case 'align':return ['left','center','right'].includes(v);case 'lineHeight':return typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=2.5;case 'radius':return Number.isInteger(v)&&v>=0&&v<=40;default:return false;}}
function declarations(style){if(!plain(style))return '';return Object.keys(properties).filter(k=>valid(k,own(style,k))).map(k=>`${properties[k]}:${k==='font'?fonts[style[k]]:style[k]+(['size','radius'].includes(k)?'px':'')} !important`).join(';');}
const roleSelector=(prefix,role)=>roles[role].split(',').map(s=>`${prefix} ${s}`).join(',');
const cssRule=(selector,style)=>{const decl=declarations(style);return decl?`${selector}{${decl}}\n`:'';};
const safeKey=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,119}$/i.test(s)&&!['constructor','prototype','__proto__'].includes(s);
const safeTarget=s=>typeof s==='string'&&s.length<=300&&/^(?:(?:template|occurrence):[a-f0-9]{64}|hero:(?:heroTitle|heroIntro):\d+|section:[a-zA-Z]+|record:[a-z]+:[a-z0-9-]+:[a-zA-Z]+(?::\d+)?)$/.test(s);
export const hasDesign=site=>site?.wsetDesign?.version===1&&(Object.values(site.wsetDesign.global||{}).some(declarations)||Object.values(site.wsetDesign.sections||{}).some(p=>plain(p)&&Object.values(p).some(s=>plain(s)&&(Object.values(s.roles||{}).some(declarations)||Object.values(s.elements||{}).some(l=>plain(l)&&Object.values(l).some(declarations))))));
export function styleableTargets(html,targets){
 const prepared=prepareTextPage(null,null,null,html,{targets});return new Map([...prepared.map].map(([k,b])=>[k,b.path]));
}
function rootSignature(fragment){const tag=fragment.match(/^\s*<([\w-]+)\b([^>]*)>/);return tag?`${tag[1].toLowerCase()}:${(tag[2].match(/\bclass\s*=\s*["']([^"']*)["']/)?.[1]||'').split(/\s+/).filter(Boolean).sort().join(' ')}`:'';}
function layout(site,pageId,locale){const draft=structuredClone(site);const page=draft.sitePages.find(p=>p.id===pageId);if(!page||pageId==='properties')return null;page.enabled=true;const html=renderDynamicSite({site:draft,locale,page:pageId,annotate:true}).html;return {draft,html,fragments:splitMainSections(html).sections,prepared:prepareTextPage(draft,pageId,locale,html)};}
function sectionIdOf(fragment){return fragment.match(/^\s*<[^>]*\bdata-cbpm-section="([^"]+)"/)?.[1];}
export function elementStyleSupported(site,pageId,sectionId,locale,targetId,buttonOnly=false){if(!safeTarget(targetId))return false;const l=layout(site,pageId,locale),b=l?.prepared.map.get(sectionId+'\0'+targetId);return !!(b&&(!buttonOnly||b.button));}
// Public HTML is checked against the trusted preview graph before applying text overrides or CSS.
export function preparePublicTextPage(site,pageId,locale,publicHtml){
 const l=layout(site,pageId,locale);if(!l)return {html:publicHtml,map:new Map()};
 const mainTag=publicHtml.match(/<main\b(?=[^>]*\bid\s*=\s*(['"])main\1)[^>]*>/i)?.[0];
 const normalized=mainTag?publicHtml.replace(mainTag,'<main id="main">'):publicHtml;
 const parts=splitMainSections(normalized).sections;
 if(parts.length!==l.fragments.length||parts.some((f,i)=>rootSignature(f)!==rootSignature(l.fragments[i])))throw Error(`Design: eksportmotorens seksjoner avviker på ${pageId}/${locale}.`);
 const actual=prepareTextPage(l.draft,pageId,locale,normalized,{sectionIds:l.prepared.ids});
 for(const [key,b] of l.prepared.map){const a=actual.map.get(key);if(!a||a.path!==b.path)throw Error(`Design: tekstelementet avviker i eksport på ${pageId}/${locale}.`);if(a.button!==b.button)throw Error(`Design: knappen avviker i eksport på ${pageId}/${locale}.`);}
 // Never silently lose saved occurrence edits if the template changed under them.
 for(const sectionId of actual.ids.filter(Boolean))for(const id of Object.keys(site.wsetTextOverrides?.[pageId]?.[sectionId]?.[locale]||{})){
  if(!actual.map.has(sectionId+'\0'+id))throw Error(`Tekst: et lagret tekstfelt kan ikke kobles til ${pageId}/${sectionId}/${locale}. Kontroller prosjektet før publisering.`);
 }
 if(mainTag)actual.html=actual.html.replace('<main id="main">',()=>mainTag);
 return actual;
}
export function applyDesignCommand(source,cmd){
 const site=structuredClone(source);if(!['global','section','element'].includes(cmd.scope))throw Error('Ugyldig designområde.');
 if(cmd.property!=='reset'&&!Object.hasOwn(properties,cmd.property))throw Error('Ukjent designegenskap.');
 if(cmd.property!=='reset'&&cmd.value!==null&&!valid(cmd.property,cmd.value))throw Error('Ugyldig designverdi.');
 if(['background','radius'].includes(cmd.property)&&cmd.scope!=='element'&&cmd.role!=='button')throw Error('Denne egenskapen er bare tilgjengelig for knapper.');
 if(cmd.scope!=='element'&&!Object.hasOwn(roles,cmd.role))throw Error('Ukjent teksttype.');
 site.wsetDesign??={version:1,global:{},sections:{}};const d=site.wsetDesign;if(d.version!==1||!plain(d.global)||!plain(d.sections))throw Error('Ukjent designformat.');
 let parent,key;
 if(cmd.scope==='global'){parent=d.global;key=cmd.role;}else{
  const {pageId,sectionId,locale,targetId}=cmd;
  if(!safeKey(pageId)||!safeKey(sectionId)||!site.sitePages.find(p=>p.id===pageId)?.sections.some(s=>s.id===sectionId))throw Error('Fant ikke seksjonen.');
  const p=d.sections[pageId]??={};const s=p[sectionId]??={roles:{},elements:{}};
  if(cmd.scope==='section'){parent=s.roles;key=cmd.role;}else{
   if(!safeKey(locale)||!site.languages.some(l=>l.code===locale)||!safeTarget(targetId))throw Error('Ugyldig tekstelement.');
   if(['background','radius'].includes(cmd.property)&&cmd.value!==null&&!elementStyleSupported(site,pageId,sectionId,locale,targetId,true))throw Error('Denne egenskapen er bare tilgjengelig for knapper.');
   if(cmd.property!=='reset'&&cmd.value!==null&&!elementStyleSupported(site,pageId,sectionId,locale,targetId))throw Error('Denne teksten kan ikke formateres entydig. Bruk seksjonens teksttype.');
   parent=s.elements[locale]??={};key=targetId;
  }
 }
 if(cmd.property==='reset')delete parent[key];else{const style=parent[key]??={};if(cmd.value===null)delete style[cmd.property];else style[cmd.property]=cmd.value;if(!Object.keys(style).length)delete parent[key];}
 return site;
}
/** CSS generated for both preview and publication. Export verifies the section
 * graph and each resolved individual target against the actual built HTML. */
export function pageDesignCss(site,pageId,locale,{publicHtml,prefix=''}={}){
 if(!hasDesign(site))return '';const d=site.wsetDesign;const base=`${prefix}main#main`;let css='';
 for(const role of Object.keys(roles))css+=cssRule(roleSelector(base,role),own(d.global,role));
 const sectionStyles=own(d.sections,pageId);if(!plain(sectionStyles)||!Object.keys(sectionStyles).length)return css;
 const l=layout(site,pageId,locale);if(!l)return css;
 const actual=publicHtml===undefined?l.prepared:preparePublicTextPage(site,pageId,locale,publicHtml);
 l.fragments.forEach((fragment,i)=>{
  const id=sectionIdOf(fragment),s=own(sectionStyles,id);if(!plain(s))return;const section=`${base} > :nth-child(${i+1})`;
  for(const role of Object.keys(roles))css+=cssRule(roleSelector(section,role),own(s.roles,role));
  const elements=own(s.elements,locale);if(!plain(elements))return;
  for(const [targetId,style] of Object.entries(elements)){
   if(!declarations(style)||!safeTarget(targetId))continue;
   const binding=actual.map.get(id+'\0'+targetId);if(!binding)continue;
   const filtered={...style};if(!binding.button){delete filtered.background;delete filtered.radius;}
   const selector=binding.recordRef&&/^[a-z0-9:-]+$/i.test(binding.recordRef)?`${section} [data-content-ref="${binding.recordRef}"]`:section+binding.path;
   css+=cssRule(selector,filtered);
  }
 });
return css;
}
