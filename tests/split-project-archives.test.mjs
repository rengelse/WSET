import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {exportEditableProject,importEditableProject,inspectEditableArchive} from '../designer/core/project-archive.mjs';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {startDesignerPreview} from '../designer/core/preview-server.mjs';
const source=resolve(process.env.WSET_TEST_WEBSITE||'../CBPM-Website');
const hash=b=>createHash('sha256').update(b).digest('hex');
const fixture=async()=>{
 try{await readFile(join(source,'project/website.json'));return true;}catch{return false;}
};
const exists=await fixture();
test('WSET starter uten å åpne CBPM eller kreve en prosjektmappe',async()=>{
 const main=await readFile('designer/main.cjs','utf8');
 assert.match(main,/loaded=null;snapshot=null;/);
 assert.doesNotMatch(main,/loaded=await storage\.readDesignerProject\(projectRoot\)/);
 const ui=await readFile('designer/ui/index.html','utf8');
 assert.match(ui,/id="welcome-workspace"/);
 assert.match(ui,/id="import-project-btn"/);
 assert.match(ui,/id="save-template-btn"/);
});
test('Tom forhåndsvisning er sikker og viser ikke et standardnettsted',async()=>{
 const s=await startDesignerPreview({getSite:()=>null,getRoot:()=>null});
 try{const r=await fetch(s.url+'/no/');assert.equal(r.status,404);assert.match(await r.text(),/Ingen nettside åpnet/);}
 finally{await s.close();}
});
test('Komplett prosjekt-ZIP kan eksporteres, importeres, redigeres, lagres og eksporteres igjen', {skip:!exists&&process.env.WSET_REQUIRE_INTEGRATION!=='1'},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-roundtrip-'));
 try{
  const zip=join(temp,'arbeid.zip');const out=await exportEditableProject({root:source,destination:zip,name:'CBPM'});
  assert.ok(out.files>100);assert.equal(inspectEditableArchive(await readFile(zip)).kind,'project');
  const imported=await importEditableProject({archive:zip,projectsDir:join(temp,'projects')});
  const site=await readDesignerProject(imported.root);
  assert.equal(site.site.languages.length,11);
  assert.equal(site.site.team.length,4);
  assert.equal(hash(await readFile(join(source,'public/site.js'))),hash(await readFile(join(imported.root,'public/site.js'))));
  const revision=site.revision;
  const edited=structuredClone(site.site);edited.brand.area='TEST: Prosjektarkiv roundtrip';
  const saved=await persistDesignerProject({...site,site:edited,revision});assert.ok(saved.revision);
  const second=join(temp,'videreutviklet.zip');await exportEditableProject({root:imported.root,destination:second,name:'CBPM videreutviklet'});
  const secondImport=await importEditableProject({archive:second,projectsDir:join(temp,'restored')});
  const reopened=await readDesignerProject(secondImport.root);
  assert.equal(reopened.site.brand.area,'TEST: Prosjektarkiv roundtrip');
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('Mal-ZIP utelater XML og lokale eiendomsbilder; prosjekt-ZIP beholder dem', {skip:!exists&&process.env.WSET_REQUIRE_INTEGRATION!=='1'},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-template-'));
 try{
  // Controlled copy: archive the source project with a temporary Existing feed/image.
  const {saveDesignerProjectAs}=await import('../designer/core/project-storage.mjs');
  const site=await readDesignerProject(source);
  const copy=await saveDesignerProjectAs({root:source,site:site.site,destination:join(temp,'working')});
  const images=join(copy.root,'project/property-feeds/Existing/images/CBPM-9001');await mkdir(images,{recursive:true});
  await writeFile(join(images,'01.webp'),Buffer.from('fake image used for archive-preservation test'));
  await mkdir(join(copy.root,'project/property-feeds/New'),{recursive:true});
  await writeFile(join(copy.root,'project/property-feeds/New','trial.xml'),'<root>reference test source</root>');
  const pr=join(temp,'project.zip'),ma=join(temp,'template.zip');
  await exportEditableProject({root:copy.root,destination:pr});await exportEditableProject({root:copy.root,destination:ma,kind:'template'});
  const ip=await importEditableProject({archive:pr,projectsDir:join(temp,'restore-project')});
  assert.equal((await readFile(join(ip.root,'project/property-feeds/Existing/images/CBPM-9001/01.webp'))).toString(),'fake image used for archive-preservation test');
  const im=await importEditableProject({archive:ma,projectsDir:join(temp,'restore-template')});
  await assert.rejects(readFile(join(im.root,'project/property-feeds/Existing/images/CBPM-9001/01.webp')),e=>e.code==='ENOENT');
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('Forhåndsvisning med importert prosjekt viser ansatte og bildefiler uten å kjøre Astro', {skip:!exists&&process.env.WSET_REQUIRE_INTEGRATION!=='1'},async()=>{
 const site=await readDesignerProject(source);
 const prev=await startDesignerPreview({getSite:()=>site.site,getRoot:()=>site.root});
 try{
  const r=await fetch(prev.url+'/no/about/');const html=await r.text();assert.equal(r.status,200);
  assert.match(html,/Magnus Berg/);
  assert.match(html,/demo-team-magnus-berg\.webp/);
  const js=await fetch(prev.url+'/site.js');assert.equal(js.status,200);
  const image=await fetch(prev.url+'/assets/demo-team-magnus-berg.webp');assert.equal(image.status,200);
  const secret=await fetch(prev.url+'/project/website.json');assert.equal(secret.status,404);
 }finally{await prev.close();}
});
test('Utrygg ZIP-sti blir avvist uten filutpakking', {skip:!exists&&process.env.WSET_REQUIRE_INTEGRATION!=='1'},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-reject-'));
 try{
  const zip=join(temp,'valid.zip');await exportEditableProject({root:source,destination:zip});
  const b=await readFile(zip);const old=Buffer.from('wset-project.json'),replacement=Buffer.from('../secrets.txt___');assert.equal(old.length,replacement.length);
  let matches=0;for(let at=0;at<=b.length-old.length;at++)if(b.subarray(at,at+old.length).equals(old)){replacement.copy(b,at);matches++;at+=old.length-1;}
  assert.ok(matches>=2);
  const evil=join(temp,'evil.zip');await writeFile(evil,b);
  await assert.rejects(importEditableProject({archive:evil,projectsDir:join(temp,'project-library')}),/Ikke tillatt fil/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
