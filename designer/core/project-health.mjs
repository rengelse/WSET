/** Project Health Check — read-only interpretation of the canonical site validator.
 * Never treats exported ZIPs as live deployments or local counts as server data. */
import {languageReport} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
import {enabledPropertyModules,propertyPageEnabled,propertyModuleSettings} from '../engines/cbpm-astro-v1/lib/property-modules.mjs';

function targetFor(message){
 const m=String(message).toLowerCase();
 if(/oversett|translation|locale|language|språk|defaultlanguage|i18n/.test(m))return 'languages';
 if(/media|asset|image|bilde|logo|favicon|portrait/.test(m))return 'media';
 if(/property|module|xml|eiendom|hosting|php/.test(m))return 'properties';
 if(/contact|smtp|privacy|e-post|brand/.test(m))return 'settings';
 return 'website';
}
export function projectHealth({site,report,dirty=false,mediaCount=0,localFeeds=null,remoteConnected=false,exportInfo=null}={}){
 if(!site||!report)throw Error('Project Health Check requires a loaded site and its canonical validation report.');
 const pages=site.sitePages||[],langs=site.languages||[],activePages=pages.filter(p=>p.enabled!==false);
 const publishedLanguages=langs.filter(l=>l.enabled!==false);
 const translation=publishedLanguages.map(l=>({code:l.code,name:l.name,...languageReport(site,l.code)}));
 const languageRequired=translation.reduce((n,l)=>n+l.total,0);
 const languageTranslated=translation.reduce((n,l)=>n+l.translated,0);
 const modules=enabledPropertyModules(site);
 const issues=[];
 const push=(severity,title,detail,area,tab=null)=>issues.push({severity,title,detail,area,tab});
 for(const message of report.errors||[])push('error','Prosjektvalidering',message,targetFor(message));
 for(const message of report.warnings||[])push('warning','Kontrollpunkt',message,targetFor(message));
 if(dirty)push('warning','Ulagrede endringer','Lagre prosjektet før du genererer nettstedet.','settings');
 if(site.contactForm?.mode!=='smtp')push('info','Kontaktskjema i demomodus','Skjemaet sender ikke e-post. Aktiver SMTP når reell levering er konfigurert.','settings');
 const propertyEnabled=modules.length>0;
 const propertyStatus=propertyEnabled?(localFeeds?.files?.length?`${localFeeds.total} eiendommer i ${localFeeds.files.length} lokal(e) XML-fil(er)`:(remoteConnected?'Server tilkoblet · serverdata ikke kontrollert · ingen lokale XML-filer':'Ingen lokal XML-fil · serverdata ikke kontrollert')):(localFeeds?.total?`${localFeeds.total} eiendommer importert, men ingen kategori er aktiv`:'Ingen aktive eiendomskategorier');
 if(propertyEnabled&&!localFeeds?.files?.length&&!remoteConnected)push('info','Eiendomsregister ikke kontrollert','Ingen lokal XML-fil. Serverdata er ikke kontrollert.','properties');
 // Imported data that cannot appear on the site is a publication warning, not a server error.
 for(const [category,id,label] of [['New','developments','Nybygg'],['Existing','properties','Boliger til salgs']]){
  const count=(localFeeds?.files||[]).filter(f=>f.category===category).reduce((n,f)=>n+f.count,0);
  if(count>0&&!propertyPageEnabled(site))push('warning','Eiendommer-siden er skjult',`${count} ${label.toLowerCase()} fra XML vil ikke vises. Aktiver Eiendommer-siden under Nettsider → Eiendommer før eksport.`,'website','property-settings');
  else if(count>0&&!propertyModuleSettings(site,id).enabled)push('warning',`${label} er ikke publisert`,`${count} eiendommer finnes i XML, men kategorien er skjult. Aktiver kategorien under Nettsider → Eiendommer.`,'website','property-settings');
 }
 for(const issue of localFeeds?.errors||[])push('error','Lokal XML er ugyldig',issue,'properties');
 for(const f of localFeeds?.files||[]){if(f.missingImage)push('warning','Eiendommer uten bilder',`${f.filename}: ${f.missingImage} eiendommer mangler bilder.`,'properties');if(f.missingPrice)push('warning','Eiendommer uten pris',`${f.filename}: ${f.missingPrice} eiendommer mangler pris.`,'properties');}
 const exportStatus=exportInfo?.root&&exportInfo.root===exportInfo.currentRoot ? (exportInfo?.matchesCurrent?'Eksportert i denne økten · ingen endringer etter eksport':'Endret siden siste eksport i denne økten'):'Ingen verifisert eksport i denne økten';
 if(exportInfo?.root&&exportInfo.root===exportInfo.currentRoot&&!exportInfo.matchesCurrent)push('info','Endringer etter eksport','Nettstedet er endret siden sist genererte ZIP i denne økten.','publishing');
 const rank={error:0,warning:1,info:2};issues.sort((a,b)=>rank[a.severity]-rank[b.severity]);
 return {
  metrics:{pages:{total:pages.length,active:activePages.length,hidden:pages.length-activePages.length},
   languages:{active:publishedLanguages.length,total:languageRequired,translated:languageTranslated,percent:languageRequired?Math.round(languageTranslated/languageRequired*100):100},
   media:{count:mediaCount},properties:{count:localFeeds?.total||0,files:localFeeds?.files?.length||0,inspected:!!localFeeds},issues:{errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,infos:issues.filter(i=>i.severity==='info').length}},
  languages:translation.map(({code,name,total,translated,missing})=>({code,name,total,translated,missing:missing.length})),
  areas:[
   {id:'website',title:'Nettsider',detail:`${activePages.length} aktive · ${pages.length-activePages.length} skjulte`},
   {id:'properties',title:'Eiendommer',detail:propertyStatus},
   {id:'media',title:'Medier',detail:`${mediaCount} bilder i lokalt mediebibliotek`},
   {id:'languages',title:'Språk',detail:`${publishedLanguages.length} aktive · ${languageTranslated}/${languageRequired} nødvendige tekster`},
   {id:'settings',title:'Kontakt',detail:site.contactForm?.mode==='smtp'?'SMTP valgt · kontroller faktisk levering':'Demomodus · ingen reell e-postlevering'}
  ],
  localFeeds:localFeeds?.files||[],issues,export:{status:exportStatus,liveVerified:false},
  validity:{ok:report.ok,errors:(report.errors||[]).length,warnings:(report.warnings||[]).length}
 };
}
