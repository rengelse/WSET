import {hasGlobalContent} from '../engines/cbpm-astro-v1/lib/global-content.mjs';
import {applyGlobalPublication} from './global-content-publication.mjs';
import {applyAssistantPublication,supportsIdentity} from './assistant-publication.mjs';
import {publicIdentity} from '../engines/cbpm-astro-v1/lib/assistant-identity.mjs';
import {markingRuntimePaths,patchPropertyRuntime,markingPublicationFiles} from './property-marking-publication.mjs';
/**
 * WSET manual layout pilot: two ZIPs – one for webroot and one for the parent folder.
 * There are no PHP installers or server-side bootstrap scripts in either ZIP.
 * The host MUST configure its Document Root to the selected www/, public/ or public_html/ directory.
 * Project JSON, source code, backups and uploaded originals never enter the ZIP.
 */
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,copyFile,mkdir,rename,rm,realpath,stat} from 'node:fs/promises';
import {join,resolve,dirname,extname,relative,isAbsolute,basename} from 'node:path';
import {platform} from 'node:os';
import {inflateRawSync} from 'node:zlib';
import {validateSiteProject,staticRoutes} from '../engines/cbpm-astro-v1/lib/site-project.mjs';
import {propertyPageEnabled,propertyModuleSettings,propertyModuleIds,moduleRoute} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';
import {migrateLegacyLocales} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';

import {hasOccurrenceText,stripEditorTextMarkers} from './universal-text.mjs';
import {hasDesign,pageDesignCss,preparePublicTextPage} from './design-styles.mjs';
import {writeZip} from './project-archive.mjs';
import {readProjectTemplate} from './template-contract.mjs';
import {withTemplateRenderer} from './renderer-runtime.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(parent,child)=>{
 const rel=relative(parent,child);
 return rel===''||(!rel.startsWith('..'+(platform()==='win32'?'\\':'/'))&&rel!=='..'&&!isAbsolute(rel));
};
const tell=(onProgress,stage,message)=>onProgress?.({stage,message});

/** Run a fixed, known npm command without interpolating any project-supplied strings. */
export function runExportCommand({root,onProgress,webRoot="www",moduleRoot=null,timeoutMs=300000}){
 return new Promise((resolve,reject)=>{
  const win=platform()==='win32';
  const child=spawn(win?(process.env.ComSpec||'cmd.exe'):'npm',win?['/d','/s','/c','npm run export:site']:['run','export:site'],{
   cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WSET_WEB_ROOT:webRoot,...(moduleRoot?{WSET_ASSISTANT_MODULE_ROOT:moduleRoot}:{WSET_ASSISTANT_MODULE_ROOT:''})}
  });
  let lastOutput='';let settled=false;
  const done=(err)=>{if(settled)return;settled=true;clearTimeout(timeout);if(err)reject(err);else resolve()};
  const consume=(chunk)=>{
   const text=String(chunk);
   lastOutput=(lastOutput+text).slice(-7000);
   for(const line of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(-12))tell(onProgress,'build',line.slice(0,240));
  };
  child.stdout.on('data',consume);child.stderr.on('data',consume);
  child.on('error',error=>done(new Error('Kunne ikke starte nettsidebyggeren: '+error.message)));
  child.on('close',code=>done(code===0?null:new Error('Nettsidebygging feilet (kode '+code+').\n'+lastOutput.slice(-2400))));
  const timeout=setTimeout(()=>{child.kill();done(new Error('Nettsidebyggingen ble avbrutt etter tidsgrensen. Kontroller prosjektet og prøv på nytt.'))},timeoutMs);
 });
}
/** Prepare npm packages on the local PC only – never on the webhost.
 * Do not execute npm lifecycle scripts during the dependency install.
 * The later website build executes project code only after explicit approval.
 */
export function installProjectDependencies({root,onProgress,timeoutMs=300000}={}){
 return new Promise((resolve,reject)=>{
  const win=platform()==='win32';
  const cmd=win?(process.env.ComSpec||'cmd.exe'):'npm';
  const args=win?['/d','/s','/c','npm install --ignore-scripts --no-audit --no-fund']:['install','--ignore-scripts','--no-audit','--no-fund'];
  const child=spawn(cmd,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let last='',finished=false;
  const done=error=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve();};
  const capture=chunk=>{last=(last+String(chunk)).slice(-6000);for(const line of String(chunk).split(/\r?\n/).filter(Boolean).slice(-8))tell(onProgress,'dependencies',line.slice(0,200));};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.on('error',error=>done(new Error('Kunne ikke starte lokal npm-installasjon: '+error.message)));
  child.on('close',code=>done(code===0?null:new Error('Kunne ikke klargjøre lokal nettsidemotor (npm kode '+code+').\n'+last.slice(-1800))));
  const timer=setTimeout(()=>{child.kill();done(new Error('Lokal npm-klargjøring ble avbrutt. Kontroller nettverk og Node.js-versjon.'))},timeoutMs);
 });
}

/** Inspect nested ZIP files without extracting arbitrary filesystem paths. */
export function zipFiles(bytes){
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('Ugyldig ZIP-indeks.');
 const count=bytes.readUInt16LE(end+10),files=new Map();let at=bytes.readUInt32LE(end+16);
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50)throw Error('Ugyldig ZIP-filindeks.');
  const method=bytes.readUInt16LE(at+10),compressed=bytes.readUInt32LE(at+20),filenameLen=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42);
  const name=bytes.toString('utf8',at+46,at+46+filenameLen);
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||files.has(name))throw Error('Utrygt filnavn i eksportarkiv.');
  if(offset+30>bytes.length||bytes.readUInt32LE(offset)!==0x04034b50)throw Error('Ugyldig ZIP-filplassering.');
  const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
  if(start+compressed>bytes.length)throw Error('Avbrutt ZIP-innhold.');
  let content;
  if(name.endsWith('/'))content=Buffer.alloc(0);
  else if(method===8)content=inflateRawSync(bytes.subarray(start,start+compressed));
  else if(method===0)content=bytes.subarray(start,start+compressed);
  else throw Error('Ukjent ZIP-komprimering.');
  files.set(name,content);at+=46+filenameLen+extra+comment;
 }
 return files;
}
/** There must be NO generated www/ folder: public files are relative to existing document root. */
export function verifyManualZips(publicArchive,privateArchive,site){
 const pub=zipFiles(publicArchive),priv=zipFiles(privateArchive);
 for(const path of ['index.html','assets/css/styles.css','assets/js/site.js'])if(!pub.has(path))throw Error('Offentlig arkiv mangler: '+path);
 if(![...pub.keys()].some(n=>n.startsWith('assets/images/')&&n.endsWith('.webp')))
  throw Error('Offentlig arkiv mangler bilder i assets/images/.');
 for(const name of pub.keys())if(/(^|\/)(?:www|public|public_html|storage|app|config|vendor|uploads|cbpm-private|project|server|src|designer|node_modules|\.git)(?:\/|$)/i.test(name)||/cbpm-private-init|private-payload|(^|\/)\.env(?:\.|$)/i.test(name))
  throw Error('Ulovlig privat fil eller unødvendig mappe i offentlig ZIP: '+name);
 for(const name of priv.keys())if(!/^(?:app|config|storage|vendor)\//.test(name)||/cbpm-private-init|private-payload/i.test(name))
  throw Error('Ulovlig filsti i privat ZIP: '+name);
 for(const path of ['app/properties/cbpm-repository.php','storage/imports/New/','storage/imports/Existing/','storage/imports/Existing/images/'])if(!priv.has(path))
  throw Error('Privat arkiv mangler: '+path);
 verifyPropertyPublication(pub,site);
 const assistantEnabled=site?.smartAssistant?.enabled===true;
 const endpoint=['api/assistant/api.php','api/assistant/session.php'];
 if(assistantEnabled&&(!endpoint.every(n=>pub.has(n))||!priv.has('app/assistant/entry-api.php')))
  throw Error('Smart Assistant mangler offentlig eller privat komponent.');
 if(!assistantEnabled&&([...pub.keys()].some(n=>n.startsWith('api/assistant/')||/^assets\/(?:css|js)\/smart-assistant(?:-live)?\.(?:css|js)$/.test(n))||[...priv.keys()].some(n=>n.startsWith('app/assistant/')&&!['app/assistant/','app/assistant/status.php'].includes(n))))throw Error('Deaktivert assistent ble eksportert.');
 return {publicCount:pub.size,privateCount:priv.size};
}

/** rc.54: check the real output, not just the presence of a root index.
 * Property catalogue routes are PHP after backend staging, not Astro HTML. */
export function verifyPublicationRoutes(pub,site,{structure=true}={}){
 const expected=new Set(['index.html']);
 if(!pub.get('index.html')?.length)throw Error('Eksport mangler publiserbar side: index.html');
 if(propertyPageEnabled(site)){for(const {code} of site.languages.filter(l=>l.enabled!==false)){const slug=code+'/eiendommer';if(pub.has(slug+'/index.html'))throw Error('Statisk HTML skygger for PHP: '+slug);if(!pub.get(slug+'/index.php')?.length)throw Error('Eksport mangler publiserbar side: '+slug+'/index.php');expected.add(slug+'/index.php');}}
 for(const route of staticRoutes(site)){
  const path=route.slug+'/index.html';expected.add(path);
  const bytes=pub.get(path);if(!bytes?.length)throw Error('Eksport mangler publiserbar side: '+path);
  const html=bytes.toString('utf8');
  if(!/<main\b[^>]*\bid=["']main["']/i.test(html)||!/<html\b[^>]*\blang=["']([^"']+)["']/i.test(html)||html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1]!==route.locale)throw Error('Ugyldig publisert side eller språk: '+path);
  if(structure&&site.sitePages.some(p=>p.id===route.page))preparePublicTextPage(site,route.page,route.locale,html);
 }
 for(const path of pub.keys())if(path.endsWith('/index.html')&&!expected.has(path))throw Error('Uventet eller skjult side i eksport: '+path);
 return expected.size;
}
/** The sidecar and embedded manifest must describe exactly the published bytes. */
export function verifyPublicationManifest(pub,manifest){
 const path='cbpm-publication-manifest.json';
 const files=manifest?.files;if(!files||typeof files!=='object'||Array.isArray(files))throw Error('Ugyldig publiseringsmanifest.');
 for(const [name,bytes] of pub){if(name===path||name.endsWith('/'))continue;if(files[name]!==digest(bytes))throw Error('Publiseringsmanifest: feil eller manglende filhash: '+name);}
 for(const name of Object.keys(files))if(name===path||!pub.has(name))throw Error('Publiseringsmanifest: ukjent fil: '+name);
 let embedded;try{embedded=JSON.parse(pub.get(path).toString('utf8'));}catch{throw Error('Publiseringsmanifest mangler i offentlig ZIP.');}
 if(JSON.stringify(embedded)!==JSON.stringify(manifest))throw Error('Publiseringsmanifest i ZIP avviker fra sidefilen.');
}

/** Verify the actual PHP catalogue configuration/routes, independently of local feeds. */
export function verifyPropertyPublication(pub,site){
 const enabled=propertyPageEnabled(site),path='api/property/public-config.php';
 const fail=message=>{throw Error('Eiendomseksport: '+message);};
 if(!enabled){if(pub.has(path)||[...pub.keys()].some(n=>/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})?\/eiendommer\/.*\.php$/i.test(n)))fail('Eiendommer er skjult, men offentlige katalogruter eller konfigurasjon finnes.');return;}
 const raw=pub.get(path)?.toString('utf8')||'';
 const encoded=raw.match(/base64_decode\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 if(!encoded)fail('Offentlig PHP-konfigurasjon mangler eller har ukjent format.');
 let config;try{config=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));}catch{fail('Ugyldig PHP-konfigurasjon.');}
 if(config?.modules?.all?.enabled!==true)fail('Eiendommer-siden er ikke aktiv i eksporten.');
 for(const file of ['listing.php','json-catalogue.php','image.php'])if(!pub.has('api/property/'+file))fail('Mangler '+file);
 for(const id of propertyModuleIds){const wanted=propertyModuleSettings(site,id).enabled;if(config.modules?.[id]?.enabled!==wanted)fail('Kategori '+id+' avviker fra prosjektets synlighetsvalg. Lagre prosjektet og bruk oppdatert nettsidemal.');}
 for(const {code} of site.languages.filter(l=>l.enabled!==false)){
  for(const f of ['index.php','bolig.php'])if(!pub.has(`${code}/eiendommer/${f}`))fail('Mangler hovedrute for '+code);
  for(const id of propertyModuleIds){const wanted=propertyModuleSettings(site,id).enabled;for(const f of ['index.php','bolig.php'])if(pub.has(moduleRoute(code,id).slice(1)+f)!==wanted)fail('Feil kategorirute '+id+' / '+code);}
 }
}

/** Adapt only the generated public archive. The imported source, private ZIP,
 * website runtime and editor bridge are not modified or deployed. */
export function applyPublicationDesign(archive,site,manifest){
 if(!hasDesign(site)&&!hasOccurrenceText(site))return {archive,manifest};
 const files=zipFiles(archive),next=structuredClone(manifest);let css='',changed=false;
 const cssPath='assets/css/styles.css';
 if(!files.has(cssPath))throw Error('Design: mangler nettstedets stilark.');
 function replace(path,bytes){
  const previous=files.get(path),entry=next.files[path];if(!previous||entry===undefined)throw Error('Design: publiseringsmanifestet mangler '+path);
  const hash=digest(bytes),oldHash=digest(previous);
  if(typeof entry==='string'&&/^[a-f0-9]{64}$/i.test(entry)){if(entry.toLowerCase()!==oldHash)throw Error('Design: filhash avviker for '+path);next.files[path]=hash;}
  else if(entry&&typeof entry==='object'&&!Array.isArray(entry)){
   for(const key of ['sha256','hash','digest','checksum'])if(typeof entry[key]==='string'&&/^[a-f0-9]{64}$/i.test(entry[key])){if(entry[key].toLowerCase()!==oldHash)throw Error('Design: filhash avviker for '+path);entry[key]=hash;}
   for(const key of ['size','bytes','length','sizeBytes'])if(typeof entry[key]==='number')entry[key]=bytes.length;
  }else if(typeof entry==='number')next.files[path]=bytes.length;
  else throw Error('Design: ukjent format i publiseringsmanifestet for '+path);
  files.set(path,bytes);
 }
 for(const route of staticRoutes(site)){
  const path=route.slug+'/index.html';const old=files.get(path);if(!old)throw Error('Design: mangler generert side '+path);
  const html=old.toString('utf8');const scope='p-'+digest(Buffer.from(path)).slice(0,20);
  const rules=pageDesignCss(site,route.page,route.locale,{publicHtml:html,prefix:`html[data-wset-design-page="${scope}"] `});
  const occurrence=Object.values(site.wsetTextOverrides?.[route.page]||{}).some(s=>Object.keys(s?.[route.locale]||{}).length);
  if(!rules&&!occurrence)continue;
  const prepared=stripEditorTextMarkers(preparePublicTextPage(site,route.page,route.locale,html).html);
  if(!/<html\b[^>]*>/i.test(html)||/data-wset-design-page=/i.test(html))throw Error('Design: uventet HTML-dokument '+path);
  replace(path,Buffer.from(rules?prepared.replace(/<html\b/i,`<html data-wset-design-page="${scope}"`):prepared));css+=rules;changed=true;
 }
 if(!changed)return {archive,manifest};
 if(css)replace(cssPath,Buffer.concat([files.get(cssPath),Buffer.from('\n/* WSET project typography */\n'+css)]));
 if(files.has('cbpm-publication-manifest.json'))files.set('cbpm-publication-manifest.json',Buffer.from(JSON.stringify(next,null,2)+'\n'));
 return {archive:writeZip([...files].map(([name,bytes])=>({name,bytes}))),manifest:next};
}
async function atomicWrite(dest,bytes){
 await mkdir(dirname(dest),{recursive:true});const tmp=join(dirname(dest),'.wset-style-'+randomUUID()+'.tmp');
 try{await writeFile(tmp,bytes);await rename(tmp,dest);}finally{await rm(tmp,{force:true}).catch(()=>{});}
}
async function atomicCopy(src,dest){
 await mkdir(dirname(dest),{recursive:true});
 const tmp=join(dirname(dest),'.cbpm-export-'+randomUUID()+'.tmp');
 try{await copyFile(src,tmp);await rename(tmp,dest)}
 finally{await rm(tmp,{force:true}).catch(()=>{})}
}

/**
 * Verify a saved project, run the Astro generator, and copy deliverables to a
 * user-selected path. Build failures never report success or copy a stale ZIP.
 * `runner` is injected only by tests; the app uses runExportCommand.
 */
export async function generateWebsite(options){
 const {root,expectedTemplate,registry}=options;
 if(typeof root!=='string'||!root)throw Error('Prosjekt og målmappe må være angitt.');
 const template=await readProjectTemplate(root,{registry});
 if(expectedTemplate&&JSON.stringify(template)!==JSON.stringify(expectedTemplate))throw Error('Prosjektets malidentitet er endret. Åpne prosjektet på nytt før publisering.');
 return withTemplateRenderer(template,()=>generateWithRenderer({...options,expectedTemplate:template}),{registry});
}
async function generateWithRenderer({root,destination,expectedRevision,expectedTemplate,registry,onProgress,webRoot="www",runner=runExportCommand,moduleRoot=null}){
 if(!["www","public","public_html"].includes(webRoot))throw Error('Ugyldig offentlig webrot.');
 if(typeof root!=='string'||!root||typeof destination!=='string'||!destination)throw Error('Prosjekt og målmappe må være angitt.');
 const folder=await realpath(resolve(root));
 const outputDir=resolve(destination);
 for(const privateDir of ['public','project','src','designer','dist']){
  if(inside(join(folder,privateDir),outputDir))throw Error('Velg eksportmappe utenfor kildemappene.');
 }
 const output=join(outputDir,'01-WWW.zip');
 const privateOutput=join(outputDir,'02-UTENFOR-WWW.zip');
 tell(onProgress,'validate','Kontrollerer lagret prosjekt …');
 const bytes=await readFile(join(folder,'project','website.json'));
 if(expectedRevision && digest(bytes)!==expectedRevision)throw Error('Prosjektet er endret siden sist lagring. Lagre/åpne prosjektet på nytt.');
 let site;
 try{site=migrateLegacyLocales(JSON.parse(bytes))}catch{throw Error('Prosjektfilen er ikke gyldig JSON.');}
 const report=validateSiteProject(site,{root:folder});
 if(!report.ok)throw Error('Kan ikke generere ugyldig prosjekt:\n'+report.errors.slice(0,8).join('\n'));
 let pkg;
 try{pkg=JSON.parse(await readFile(join(folder,'package.json'),'utf8'))}catch{throw Error('Fant ikke package.json i prosjektmappen.');}
 // Only use CBPM's expected generator, not arbitrary user-defined npm scripts.
 if(pkg?.scripts?.['export:site']!=='npm run build && node scripts/stage-contact-backend.mjs && node scripts/stage-property-backend.mjs && node scripts/package-manual-site.mjs'||!['npm run validate && astro build','npm run module:prepare && npm run validate && astro build'].includes(pkg?.scripts?.build)|| (pkg.scripts.build.startsWith('npm run module:prepare')&&pkg.scripts['module:prepare']!=='node scripts/prepare-modules.mjs')){
  throw Error('Prosjektet bruker ikke den godkjente CBPM-eksportmotoren. Bruk en oppdatert prosjektpakke.');
 }
 // Independent modules are resolved by WSET, not trusted npm scripts from an archive.
 if(site.smartAssistant?.enabled===true){
  if(!moduleRoot)throw Error('Smart Assistant er PÅ, men ingen modul er importert. Bruk «Oppdater modul fra ZIP» før publisering.');
  const resolver=await readFile(join(folder,'scripts/resolve-assistant-module.mjs'),'utf8').catch(()=>null);
  if(!resolver||!resolver.includes('WSET_ASSISTANT_MODULE_ROOT'))throw Error('Dette nettstedprosjektet bruker gammel innebygd AI-modul. Oppgrader prosjektets eksportadapter til rc.16 før publisering med separat modul-ZIP.');
  const manifest=JSON.parse(await readFile(join(moduleRoot,'module.json'),'utf8').catch(()=>{throw Error('Smart Assistant mangler module.json.');}));
  if(manifest.id!=='smart-assistant'||manifest.schema!=='wset-website-module-v1'||manifest.requiredProjectEngine!=='cbpm-astro-v1'||manifest.deployment!=='manual-two-zip')throw Error('Smart Assistant-modulen er ikke kompatibel med nettstedet.');
  if(publicIdentity(site)&&!supportsIdentity(manifest.version))throw Error('Identitetsprofil krever Smart Assistant v1.9.10-module.24 eller nyere.');
  tell(onProgress,'module',`Inkluderer Smart Assistant ${manifest.version} i nettstedseksporten …`);
 }
 // Astro 7 installs the CLI under bin/astro.mjs, not astro.js.
 // Read the installed package's own bin mapping to avoid hardcoding a stale path.
 const astroPackagePath=join(folder,'node_modules','astro','package.json');
 let astroPackage;
 try{astroPackage=JSON.parse(await readFile(astroPackagePath,'utf8'));}
 catch{throw Error('Astro mangler i prosjektmappen. Kjør npm install her, og prøv eksport igjen.');}
 const cliEntry=typeof astroPackage?.bin==='string'?astroPackage.bin:astroPackage?.bin?.astro;
 if(typeof cliEntry!=='string'||!/^\.\/[a-zA-Z0-9._/-]+$/.test(cliEntry)||cliEntry.includes('..'))
  throw Error('Astro-installasjonen har et ugyldig CLI-oppsett. Kjør npm install på nytt.');
 try{await stat(join(folder,'node_modules','astro',cliEntry));}
 catch{throw Error('Astro er ikke installert fullstendig. Kjør npm install i prosjektmappen før du genererer nettsiden.');}
 tell(onProgress,'build','Bygger aktive sider og språk med Astro …');
 await runner({root:folder,onProgress,webRoot,moduleRoot:site.smartAssistant?.enabled===true?moduleRoot:null});
 if(digest(await readFile(join(folder,'project','website.json')))!==digest(bytes))throw Error('Prosjektdata ble endret under bygging. Generer på nytt.');
 if(expectedTemplate&&JSON.stringify(await readProjectTemplate(folder,{registry}))!==JSON.stringify(expectedTemplate))throw Error('Prosjektets malidentitet ble endret under bygging. Generer på nytt.');
 const zip=join(folder,'exports','01-WWW.zip');
 const privateZip=join(folder,'exports','02-UTENFOR-WWW.zip');
 const removals=join(folder,'exports','CBPM-files-to-remove.txt');
 const manifestPath=join(folder,'exports','CBPM-publication-manifest.json');
 let archive=await readFile(zip).catch(()=>{throw Error('Mangler offentlig ZIP-fil fra bygget.');});
 let privateArchive=await readFile(privateZip).catch(()=>{throw Error('Mangler privat ZIP-fil fra bygget.');});
 if(archive.length<100||privateArchive.length<100||archive.readUInt32LE(0)!==0x04034b50||privateArchive.readUInt32LE(0)!==0x04034b50)
  throw Error('En eksportert ZIP-fil er ugyldig.');
 verifyManualZips(archive,privateArchive,site);
 let manifest;
 try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}
 catch{throw Error('Publiseringsmanifest mangler eller er ugyldig.');}
 if(!manifest.files||typeof manifest.files!=='object'||!Object.keys(manifest.files).some(p=>p.endsWith('index.html')))
  throw Error('Eksportmanifestet mangler genererte HTML-sider.');
 verifyPublicationManifest(zipFiles(archive),manifest);
 verifyPublicationRoutes(zipFiles(archive),site);
 if(hasDesign(site)||hasOccurrenceText(site)){
  tell(onProgress,'design','Tilpasser typografi og farger i offentlige sider …');
  const styled=applyPublicationDesign(archive,site,manifest);
  if(styled.archive!==archive){verifyManualZips(styled.archive,privateArchive,site);archive=styled.archive;manifest=styled.manifest;await atomicWrite(zip,archive);await atomicWrite(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));}
 }
 if(site.smartAssistant?.enabled===true&&publicIdentity(site)){
  tell(onProgress,'assistant','Eksporterer valgt assistentidentitet …');
  const result=applyAssistantPublication(zipFiles(archive),site,manifest);
  archive=writeZip([...result.files].map(([name,bytes])=>({name,bytes})));manifest=result.manifest;
  verifyManualZips(archive,privateArchive,site);await atomicWrite(zip,archive);await atomicWrite(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 }
 if(hasGlobalContent(site)){
  tell(onProgress,'global-content','Oppdaterer juridiske dokumenter, topptekst og bunntekst …');
  const result=applyGlobalPublication(zipFiles(archive),site,manifest);archive=writeZip([...result.files].map(([name,bytes])=>({name,bytes})));manifest=result.manifest;
  verifyManualZips(archive,privateArchive,site);await atomicWrite(zip,archive);await atomicWrite(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 }
 // The runtime is installed even before any markings exist, to support later XML-only updates.
 if(propertyPageEnabled(site)){
  const files=zipFiles(archive),priv=zipFiles(privateArchive);
  for(const path of markingRuntimePaths){const previous=files.get(path);if(!previous)throw Error('Eiendomsmerking: mangler '+path);const bytes=Buffer.from(patchPropertyRuntime(path,previous.toString('utf8')));files.set(path,bytes);manifest.files[path]=digest(bytes);}
  if(files.has('cbpm-publication-manifest.json'))files.set('cbpm-publication-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  const markingFiles=markingPublicationFiles(site);
  for(const entry of markingFiles)priv.set(entry.name,entry.bytes);
  archive=writeZip([...files].map(([name,bytes])=>({name,bytes})));if(markingFiles.length)privateArchive=writeZip([...priv].map(([name,bytes])=>({name,bytes})),{privateFiles:true});
  verifyManualZips(archive,privateArchive,site);await atomicWrite(zip,archive);await atomicWrite(privateZip,privateArchive);await atomicWrite(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 }
 verifyPublicationManifest(zipFiles(archive),manifest);
 verifyPublicationRoutes(zipFiles(archive),site,{structure:false});
 await mkdir(outputDir,{recursive:true});
 const sidecar=join(outputDir,'CBPM-filer-som-skal-fjernes.txt');
 tell(onProgress,'package','Eksporterer separate ZIP-filer for www/ og kontomappen utenfor www/ …');
 if(output!==zip)await atomicCopy(zip,output);
 if(privateOutput!==privateZip)await atomicCopy(privateZip,privateOutput);
 if(sidecar!==removals)await atomicCopy(removals,sidecar);
 tell(onProgress,'complete',`To ZIP-filer klare: pakk 02-UTENFOR-WWW.zip ut i kontomappen og 01-WWW.zip direkte i ${webRoot}/.`);
 return {webRoot,zipPath:output,privateZipPath:privateOutput,removalListPath:sidecar,
  pageCount:Object.keys(manifest.files).filter(p=>p.endsWith('index.html')).length,
  fileCount:Object.keys(manifest.files).length,bytes:archive.length+privateArchive.length,
  publicBytes:archive.length,privateBytes:privateArchive.length,warnings:report.warnings};
}
