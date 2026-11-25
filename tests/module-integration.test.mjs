import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,rm,mkdtemp,access,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startDesignerPreview} from '../designer/core/preview-server.mjs';
import {exportEditableProject,importEditableProject,inspectEditableArchive} from '../designer/core/project-archive.mjs';
import {readDesignerProject} from '../designer/core/project-storage.mjs';
import {importAssistantModule,selectedAssistantModule,inspectAssistantModuleZip} from '../designer/core/module-library.mjs';

const source=resolve(process.env.WSET_TEST_WEBSITE||'../CBPM-Website');
const moduleZip=resolve(process.env.WSET_TEST_MODULE_ZIP||'../../CBPM-Smart-Assistant-v1.8.1-module.2-rc.16.zip');
const moduleOld=resolve(process.env.WSET_TEST_OLD_MODULE_ZIP||'../../CBPM-Smart-Assistant-v1.8.1-Module-rc.15.zip');
const present=async path=>{try{await access(path);return true;}catch{return false;}};
const haveSource=await present(join(source,'project/website.json')),haveModule=await present(moduleZip),haveOld=await present(moduleOld);
const required=process.env.WSET_REQUIRE_INTEGRATION==='1';
const availability=(ok,reason)=>({skip:!ok&&!required?reason:false});
const siteSource=()=>readDesignerProject(source);

test('Modul-ZIP importeres uavhengig av nettstedet; nyeste godkjente versjon velges',availability(haveModule&&haveOld,'Historiske modul-ZIP mangler'),async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-module-library-'));
 try{
  const original=await importAssistantModule({archive:moduleOld,libraryRoot:temp});
  assert.equal(original.version,'1.8.1-module.1');
  const imported=await importAssistantModule({archive:moduleZip,libraryRoot:temp});
  assert.equal(imported.version,'1.8.1-module.2');
  assert.match(imported.root,/smart-assistant/);
  assert.deepEqual(await selectedAssistantModule({libraryRoot:temp}),imported);
  assert.ok((await readFile(join(imported.root,'backend/src/Assistant.php'))).length>50);
  const changed=join(temp,'invalid.zip');await writeFile(changed,Buffer.from('not a zip'));
  await assert.rejects(importAssistantModule({archive:changed,libraryRoot:temp}));
  assert.equal((await selectedAssistantModule({libraryRoot:temp})).version,imported.version);
  // The selected version stays pinned to its contents; tampering disables it.
  await writeFile(join(imported.root,'frontend/smart-assistant.js'),'// changed outside module import');
  assert.equal(await selectedAssistantModule({libraryRoot:temp}),null);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('Forhåndsvisning henter widget fra modulbiblioteket og aldri prosjektkopier',availability(haveModule&&haveSource,'Modul-ZIP eller nettstedskilde mangler'),async(t)=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-preview-module-'));
 t.after(()=>rm(temp,{recursive:true,force:true}));
 const module=await importAssistantModule({archive:moduleZip,libraryRoot:temp});
 const site=(await siteSource()).site;site.smartAssistant={...site.smartAssistant,enabled:true};
 const server=await startDesignerPreview({getSite:()=>site,getRoot:()=>source,getModuleRoot:()=>module.root});
 t.after(()=>server.close());
 for(const [url,file] of [['/smart-assistant.js','frontend/smart-assistant.js'],['/smart-assistant.css','styles/smart-assistant.css']]){
  const response=await fetch(server.url+url);assert.equal(response.status,200);
  assert.equal(await response.text(),await readFile(join(module.root,file),'utf8'));
 }
 const noModule=await startDesignerPreview({getSite:()=>site,getRoot:()=>source});
 t.after(()=>noModule.close());
 assert.equal((await fetch(noModule.url+'/smart-assistant.js')).status,404);
});
test('Prosjekt-ZIP og mal-ZIP kan åpnes uten å ha Smart Assistant inne i nettstedet',availability(haveSource,'Nettstedskilde mangler'),async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'wset-module-independent-'));
 try{
  const archive=join(tmp,'source.zip');
  await exportEditableProject({root:source,destination:archive,kind:'project'});
  const inspection=inspectEditableArchive(await readFile(archive));
  assert.equal(inspection.format,'wset-editable-project');
  assert.equal((await import('../designer/core/project-archive.mjs')).readSafeProjectZipEntries(await readFile(archive)).some(e=>e.name.startsWith('modules/smart-assistant/')),false);
  const imported=await importEditableProject({archive,projectsDir:join(tmp,'imported')});
  await assert.rejects(access(join(imported.root,'modules/smart-assistant/module.json')));
  await access(join(imported.root,'src/lib/smart-assistant.mjs'));
  const template=join(tmp,'template.zip');await exportEditableProject({root:source,destination:template,kind:'template'});
  await importEditableProject({archive:template,projectsDir:join(tmp,'templates')});
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('Godkjent separat module ZIP har forventet manifest og kildefiler',availability(haveModule,'Historisk modul-ZIP mangler'),async()=>{
 const archive=inspectAssistantModuleZip(await readFile(moduleZip));
 assert.equal(archive.id,'smart-assistant');
 assert.equal(archive.version,'1.8.1-module.2');
 assert.ok(archive.files.has('frontend/smart-assistant.js'));
});
