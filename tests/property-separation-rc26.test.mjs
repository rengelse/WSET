import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {activateImportedCategory} from '../designer/core/property-publication.mjs';
import {enabledPropertyModules,moduleLabel} from '../designer/engines/cbpm-astro-v1/lib/property-modules.mjs';
import {projectHealth} from '../designer/core/project-health.mjs';
import {importLocalFeed,listLocalFeeds} from '../designer/core/local-property-feeds.mjs';
import {exampleOwnXML} from '../designer/core/property-xml.mjs';
import {writeFile} from 'node:fs/promises';
const seed=migrateProjectForDesigner(JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const update=(site,id,field,value,locale)=>applyEditorCommand(site,{action:'property-module:update',id,field,value,locale}).site;
const pageEnabled=(site,value)=>applyEditorCommand(site,{action:'page:update',id:'properties',field:'enabled',value}).site;

test('Website category settings use existing data model; navigation is independent and localized labels persist',()=>{
 let s=pageEnabled(seed,true);s=update(s,'developments','enabled',true);s=update(s,'properties','enabled',true);
 s=update(s,'developments','showInNavigation',false);s=update(s,'developments','label','Nye boliger','no');s=update(s,'developments','label','New homes','en');
 assert.equal(enabledPropertyModules(s).length,2);assert.equal(s.propertyModules.developments.showInNavigation,false);assert.equal(moduleLabel(s,'developments','no'),'Nye boliger');assert.equal(moduleLabel(s,'developments','en'),'New homes');
 const before=structuredClone(s.propertyModules);s=pageEnabled(s,false);assert.deepEqual(s.propertyModules,before);assert.equal(enabledPropertyModules(s).length,0);s=pageEnabled(s,true);assert.deepEqual(s.propertyModules,before);
 s=update(s,'developments','enabled',false);assert.equal(s.propertyModules.properties.enabled,true);assert.equal(s.propertyModules.developments.visibilityExplicit,true);assert.equal(activateImportedCategory(s,'New',10).site.propertyModules.developments.enabled,false);
 assert.deepEqual(s.services,seed.services);assert.deepEqual(s.languages,seed.languages);
});

test('Local XML import preserves category separation and explicit editorial choices; health opens website settings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset26-local-'));
 try{
  const file=join(root,'test.xml');await writeFile(file,exampleOwnXML());
  const a=await importLocalFeed({root,source:file,category:'New'}),b=await importLocalFeed({root,source:file,category:'Existing'});
  assert.equal(a.count,1);assert.equal(b.count,1);const inventory=await listLocalFeeds(root);assert.equal(inventory.total,2);assert.deepEqual(inventory.files.map(f=>f.category).sort(),['Existing','New']);
  let site=pageEnabled(seed,true);site=update(site,'developments','enabled',false);site=update(site,'properties','enabled',true);
  const next=activateImportedCategory(site,'New',a.count);assert.deepEqual(next.site.propertyModules,site.propertyModules);
  const h=projectHealth({site,report:{ok:true,errors:[],warnings:[]},localFeeds:inventory});const issue=h.issues.find(i=>i.title==='Nybygg er ikke publisert');assert.equal(issue.area,'website');assert.equal(issue.tab,'property-settings');
  const hidden=projectHealth({site:pageEnabled(site,false),report:{ok:true,errors:[],warnings:[]},localFeeds:inventory});assert.ok(hidden.issues.filter(i=>i.title==='Eiendommer-siden er skjult').every(i=>i.area==='website'&&i.tab==='property-settings'));
  assert.deepEqual((await listLocalFeeds(root)).files.map(f=>f.sha256),inventory.files.map(f=>f.sha256));
 }finally{await rm(root,{recursive:true,force:true});}
});
