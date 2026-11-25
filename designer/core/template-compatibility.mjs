/** rc.51: read-only mapping plan. Stable identities, never demo-content merge.
 * No archive code is executed. A report is advisory, not a switch authorization. */
import {createHash} from 'node:crypto';
import {lstat,realpath,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {validateTemplateDescriptor} from './template-contract.mjs';
import {installedRenderers,withTemplateRenderer,renderDynamicSite,renderSite,splitMainSections,legacySectionMap,templateTextEntries,propertyModulePreview} from './renderer-runtime.mjs';
import {prepareTextPage} from './universal-text.mjs';
import {mediaReferences} from './media-references.mjs';
import {publishedContent,routeMap,activePages,validateSiteProject} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {enabledPropertyModules} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashSite=site=>sha(JSON.stringify(site));
const entries=o=>Object.entries(o&&typeof o==='object'&&!Array.isArray(o)?o:{});
const label=(p,s)=>p.id+(s?'/'+s.id:'');
const groups=['brand','languages','pages','sitePages','services','categories','projects','reviews','team','media','features','i18n','contactForm','globalContent','propertyModules','smartAssistant','propertyDrafts','propertyMarkings','templateTexts','wsetTextOverrides','wsetDesign'];
const known=new Set([...groups,'schemaVersion','defaultLanguage','redspLanguageRosterInstalled','websiteLocaleBasicsInstalled','websiteLocaleFullTextsInstalled']);
const assetPattern=/^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:webp|png|jpe?g|avif|svg|ico|woff2?)$/i;
const originalPattern=/^project\/media\/originals\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|avif|tiff?|svg)$/i;
function assetPaths(site){const out=new Set();function walk(v){if(typeof v==='string'){if(assetPattern.test(v))out.add('public'+v);else if(originalPattern.test(v))out.add(v);}else if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);}walk(site);return out;}
async function fileDigest(root,name){const path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('Ugyldig filbane.');const actual=await realpath(path);if(!actual.startsWith(root+sep))throw Error('Fil utenfor prosjektmappen.');const st=await lstat(path);if(!st.isFile()||st.size>65*1024*1024)throw Error('Ugyldig eller for stor prosjektfil.');return sha(await readFile(path));}
export async function analyzeTemplateCompatibility({source,target,registry=installedRenderers}){
 const sourceTemplate=validateTemplateDescriptor(source.template),targetTemplate=validateTemplateDescriptor(target.template);
 const site=structuredClone(source.site),fingerprint=hashSite(site),root=await realpath(source.root),rows=[];
 const add=(group,id,status,detail)=>rows.push({group,id,status,detail});
 const same=sourceTemplate.id===targetTemplate.id&&sourceTemplate.engine===targetTemplate.engine;
 const targetFiles=target.files||new Map();
 const recordGroups=['services','categories','projects','reviews','team'];
 const dataPlan={strategy:'preserve-source',fields:Object.keys(site).sort(),pages:site.sitePages.map(p=>({id:p.id,slug:p.slug,enabled:p.enabled!==false,showInNavigation:p.showInNavigation!==false,sections:p.sections.map(s=>({id:s.id,type:s.type,source:s.source||null,slot:s.slot||null,enabled:s.enabled!==false}))})),languages:site.languages.map(l=>({code:l.code,enabled:l.enabled!==false})),records:Object.fromEntries(recordGroups.map(g=>[g,(site[g]||[]).map(r=>r.id)])),media:(site.media?.items||[]).map(m=>m.id)};
 const report=validateSiteProject(site,{root});
 for(const error of report.errors)add('Validering','Prosjektdata','blocked',error);
 for(const group of groups){if(!Object.hasOwn(site,group))continue;const value=site[group];add('Prosjektdata',group,'preserve',Array.isArray(value)?`${value.length} poster · beholdes med eksisterende ID-er.`:'Behold hele prosjektets verdi; ingen erstatning fra malens eksempeldata.');}
 for(const group of recordGroups)for(const r of site[group]||[])add('Innhold',`${group}/${r.id||'(mangler ID)'}`,r.id?'preserve':'review',r.id?'Behold hele posten, alle språk og eksisterende ID.':'Post uten stabil ID; behold verdien og avklar identitet før malbytte.');
 for(const k of Object.keys(site).filter(k=>!known.has(k)))add('Prosjektdata',k,'review','Ukjent felt. Behold uendret; funksjonell støtte må avklares.');
 if(sourceTemplate.category!==targetTemplate.category)add('Kontrakt','Kategori','blocked','Ulik bransjekategori. Det finnes ingen godkjent migrering mellom disse kategoriene.');
 let adapter;try{adapter=registry.resolve(targetTemplate);}catch{add('Kontrakt','Renderer','blocked','Må ha en godkjent renderer før innhold kan verifiseres.');}
 // Data model is kept wholesale, including disabled pages, languages and modules.
 const draft=structuredClone(site);for(const p of draft.sitePages)p.enabled=true;for(const l of draft.languages)l.enabled=true;
 const locales=draft.languages.map(l=>l.code),pages=draft.sitePages.filter(p=>p.id!=='properties');
 for(const l of site.languages)add('Språk',l.code,'preserve',l.enabled===false?'Deaktivert språk og oversettelser beholdes.':'Språk og oversettelser beholdes.');
 const refs=assetPaths(site),targetRefs=new Set();
 try{withTemplateRenderer(sourceTemplate,()=>{for(const ref of mediaReferences(site))if(assetPattern.test(ref.src))refs.add('public'+ref.src);},{registry});}catch{add('Medier','Kildens bildeplasseringer','blocked','Kildens renderer kunne ikke kartlegge bilder.');}
 if(adapter){withTemplateRenderer(targetTemplate,()=>{
  // Check actual rendered graph, not the target template's demo page IDs.
  const seen=new Map(),bound=new Map(),sourceFragments=new Map();
  const fragmentFor=(source,slot,locale)=>{const key=JSON.stringify([source,locale]);if(!sourceFragments.has(key)){const data={...publishedContent(draft),routeMap:routeMap(draft),siteNavigation:activePages(draft).filter(p=>p.showInNavigation!==false)};sourceFragments.set(key,legacySectionMap(source,renderSite({locale,page:source,data}).html));}return sourceFragments.get(key)?.[slot]||'';};
  for(const p of pages){const original=site.sitePages.find(x=>x.id===p.id);const issues=[];for(const s of p.sections)s.enabled=true;
   for(const locale of locales){try{const html=renderDynamicSite({site:draft,locale,page:p.id,annotate:true}).html;const ids=splitMainSections(html).sections.map(f=>f.match(/^\s*<[^>]*\bdata-cbpm-section="([^"]+)"/)?.[1]);seen.set(JSON.stringify([p.id,locale]),new Set(ids));
    if(Object.keys(site.wsetTextOverrides?.[p.id]||{}).length||Object.keys(site.wsetDesign?.sections?.[p.id]||{}).length)bound.set(JSON.stringify([p.id,locale]),prepareTextPage(draft,p.id,locale,html).map);
   }catch(e){issues.push(locale);add('Rendering',`${p.id}/${locale}`,'blocked',String(e.message||e).slice(0,300));}}
   add('Sider',p.id,issues.length?'blocked':'mapped',`${original.enabled===false?'Skjult side; ':''}Behold ID og URL /${p.slug}/. ${issues.length?'Rendering feilet.':`${locales.length} språk kontrollert.`}`);
   for(const s of p.sections){const missing=locales.filter(l=>!seen.get(JSON.stringify([p.id,l]))?.has(s.id));const hidden=original.sections.find(x=>x.id===s.id)?.enabled===false;add('Seksjoner',label(p,s),missing.length?'blocked':'mapped',`${s.type==='template'?s.source+'/'+s.slot:s.type}${hidden?' · skjult':''}. ${missing.length?'Mangler i renderer: '+missing.join(', '):'Samme side- og seksjons-ID.'}`);}
  }
  // Literal legacy overrides are text keys, not portable semantic IDs. Cross-design
  // matches are review-only, even if a new renderer happens to emit the same text.
  for(const [source,slots] of entries(site.templateTexts))for(const [slot,langs] of entries(slots))for(const [locale,changes] of entries(langs))for(const [key] of entries(changes)){
   let match=false,unique=false;try{const fragment=fragmentFor(source,slot,locale);match=templateTextEntries(fragment).includes(key);unique=[...fragment.matchAll(/>([^<>]+)</g)].filter(m=>m[1].trim()===key).length===1;}catch{}
   add('Direkte tekst',`${source}/${slot}/${locale} · ${key.slice(0,100)}`,!match?'blocked':same&&unique?'mapped':'review',!match?'Tekstnøkkelen finnes ikke i målrendereren. Behold overstyringen, ikke gjett ny plassering.':!unique?'Flere eller tvetydige tekstforekomster; må avklares.':same?'Eksakt tekstnøkkel funnet.':'Eksakt tekstnøkkel funnet, men må bekreftes ved designbytte.');
  }
  for(const [page,sections] of entries(site.wsetTextOverrides))for(const [section,langs] of entries(sections))for(const [locale,changes] of entries(langs))for(const [id] of entries(changes)){
   const hit=bound.get(JSON.stringify([page,locale]))?.has(section+'\0'+id);
   add('Direkte tekst',`${page}/${section}/${locale} · ${id}`,!hit?'blocked':same?'mapped':'review',hit?(same?'Eksakt tekstbinding funnet.':'Eksakt binding funnet; bekreft semantisk plassering i nytt design.'):'Tekstbinding mangler. Behold originalverdien.');}
  for(const [page,sections] of entries(site.wsetDesign?.sections))for(const [section,style] of entries(sections)){
   const sectionExists=site.sitePages.some(p=>p.id===page&&p.sections.some(s=>s.id===section));
   if(Object.keys(style?.roles||{}).length)add('Typografi',`${page}/${section} · tekstroller`,sectionExists?'review':'blocked','Behold innstillingene; velg eksplisitt om de skal brukes i nytt design.');
   for(const [locale,targets] of entries(style?.elements))for(const [id] of entries(targets)){const hit=bound.get(JSON.stringify([page,locale]))?.has(section+'\0'+id);add('Typografi',`${page}/${section}/${locale} · ${id}`,hit?'review':'blocked',hit?'Binding finnes. Bruk av individuell stil må bekreftes.':'Stilbinding mangler; behold innstillingen uten å bruke den.');}
  }
  if(Object.keys(site.wsetDesign?.global||{}).length)add('Typografi','Globale stiler','review','Velg senere mellom egne stilinnstillinger og malens standard.');
  const modules=enabledPropertyModules(draft);if(site.sitePages.some(p=>p.id==='properties'))add('Sider','properties','preserve','Behold eiendomssidens ID, URL og synlighet. Modulvisninger kontrolleres separat.');for(const m of modules){const issues=[];for(const locale of locales)try{propertyModulePreview(draft,locale,m.id,{});}catch{issues.push(locale);}add('Moduler',m.id,issues.length?'blocked':'mapped',issues.length?'Modulvisning feilet: '+issues.join(', '):'Rendererens modulvisning kontrollert; backend og data beholdes separat.');}
  if(site.smartAssistant?.enabled)add('Moduler','Smart Assistant','review','Konfigurasjon beholdes. Modulens installasjon, plassering og serverfunksjon må verifiseres separat.');
  if(site.contactForm?.mode==='smtp')add('Moduler','Kontaktskjema','review','Konfigurasjon beholdes; serverfunksjon må verifiseres separat.');
  // Target image slots may be different; never overwrite an existing image by name.
  for(const ref of mediaReferences(draft))if(assetPattern.test(ref.src))targetRefs.add('public'+ref.src);
 },{registry});}else{
  for(const p of site.sitePages){add('Sider',p.id,'blocked','Ikke verifisert uten renderer. Behold ID og URL.');for(const s of p.sections)add('Seksjoner',label(p,s),'blocked','Ikke verifisert uten renderer. Behold innhold og ID.');}
 }
 // A target asset with the same case-insensitive path is not necessarily the same file.
 for(const name of [...refs].sort()){
  let digest;try{digest=await fileDigest(root,name);}catch(e){add('Medier',name,'blocked','Kildens bildefil er utilgjengelig; må avklares før kopiering.');continue;}
  const dest=targetFiles.get(name.toLowerCase());
  if(!dest)add('Medier',name,'preserve','Kopier prosjektets fil uendret; finnes ikke i målmalen.');
  else if(dest.name===name&&dest.digest===digest)add('Medier',name,'mapped','Identisk fil i begge arkiver.');
  else add('Medier',name,'review','Navnekonflikt eller ulikt innhold. Prosjektets fil må beskyttes; ingen automatisk overskriving.');
 }
 for(const name of [...targetRefs].filter(n=>!refs.has(n)).sort()){const dest=targetFiles.get(name.toLowerCase());add('Medier',name,dest?.name===name?'review':'blocked',dest?.name===name?'Ny bildeplassering i målmalen. Kontroller før aktivering.':'Målrendererens nye bildefil mangler i malarkivet.');}
 add('Filpolicy','Prosjektdata og private filer','preserve','Behold lokale metadata, brukerbilder, XML, boligbilder, moduler, serverprofiler, historikk og sikkerhetskopier. Ingen filer kopieres i rc.51.');
 add('Filpolicy','Nettsidekode og publisering','review','Målmalens faktiske HTML/CSS/bygg og modulkontrakter må verifiseres i isolert kandidat før et malbytte.');
 const counts={mapped:0,preserve:0,review:0,blocked:0};for(const row of rows)counts[row.status]++;
 return {version:1,source:sourceTemplate,target:targetTemplate,sourceFingerprint:fingerprint,sourceRevision:source.revision||null,targetDigest:target.digest,dataPlan,dirty:!!source.dirty,status:counts.blocked?'blocked':counts.review?'review':'mapped',counts,rows,canSwitch:false};
}
