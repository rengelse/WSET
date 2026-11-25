import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {enabledPropertyModules,propertyModuleSettings,moduleRoute} from '../designer/engines/cbpm-astro-v1/lib/property-modules.mjs';
import {verifyPropertyPublication} from '../designer/core/website-generator.mjs';
const seed=JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8'));
const setPage=(s,v)=>applyEditorCommand(s,{action:'page:update',id:'properties',field:'enabled',value:v}).site;
const setModule=(s,id,v)=>applyEditorCommand(s,{action:'property-module:update',id,field:'enabled',value:v}).site;
test('legacy implicit OFF migrates to ON, but explicit OFF and page visibility persist',()=>{
 let legacy=migrateProjectForDesigner(seed);legacy.propertyModules={properties:{enabled:false,labels:{no:'Egne boliger'},showInNavigation:false},developments:{enabled:false,visibilityExplicit:true}};legacy.sitePages.find(p=>p.id==='properties').enabled=false;
 const s=migrateProjectForDesigner(legacy);assert.equal(s.sitePages.find(p=>p.id==='properties').enabled,false);assert.equal(s.propertyModules.properties.enabled,true);assert.equal(s.propertyModules.properties.labels.no,'Egne boliger');assert.equal(s.propertyModules.properties.showInNavigation,false);assert.equal(s.propertyModules.developments.enabled,false);assert.deepEqual(migrateProjectForDesigner(s),s);assert.equal(propertyModuleSettings(legacy,'properties').enabled,true);
});
test('server-only XML: enabled page enables both categories even with no local XML; independent explicit toggles',()=>{
 let s=setPage(migrateProjectForDesigner(seed),true);assert.equal(enabledPropertyModules(s).length,2);
 s=setModule(s,'developments',false);assert.deepEqual(enabledPropertyModules(s).map(x=>x.id),['properties']);s=setPage(s,false);assert.equal(enabledPropertyModules(s).length,0);s=setPage(s,true);assert.deepEqual(enabledPropertyModules(s).map(x=>x.id),['properties']);s=setModule(s,'developments',true);assert.equal(enabledPropertyModules(s).length,2);
});
test('export verifier rejects missing routes and legacy locked false flags',()=>{
 let s=setPage(migrateProjectForDesigner(seed),true);const pub=new Map();const config={modules:{all:{enabled:true},properties:{enabled:true},developments:{enabled:true}}};const setConfig=()=>pub.set('api/property/public-config.php',Buffer.from(`<?php return json_decode(base64_decode('${Buffer.from(JSON.stringify(config)).toString('base64')}'),true);`));setConfig();
 for(const name of ['listing.php','json-catalogue.php','image.php'])pub.set('api/property/'+name,Buffer.alloc(1));
 for(const {code} of s.languages.filter(l=>l.enabled!==false))for(const file of ['index.php','bolig.php'])for(const base of [`${code}/eiendommer/`,moduleRoute(code,'properties').slice(1),moduleRoute(code,'developments').slice(1)])pub.set(base+file,Buffer.alloc(1));
 assert.doesNotThrow(()=>verifyPropertyPublication(pub,s));config.modules.developments.enabled=false;setConfig();assert.throws(()=>verifyPropertyPublication(pub,s),/Kategori developments/);config.modules.developments.enabled=true;setConfig();pub.delete('no/eiendommer/nybygg/index.php');assert.throws(()=>verifyPropertyPublication(pub,s),/Feil kategorirute/);assert.throws(()=>verifyPropertyPublication(pub,setPage(s,false)),/skjult/);
});
