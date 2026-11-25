import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {legacyTemplateDescriptor,validateTemplateDescriptor,resolveTemplateDescriptor,readProjectTemplate,TEMPLATE_PATH} from '../designer/core/template-contract.mjs';
import {importEditableProject,exportEditableProject,readSafeProjectZipEntries,writeZip,inspectEditableArchive} from '../designer/core/project-archive.mjs';
import {readDesignerProject,saveDesignerProjectAs} from '../designer/core/project-storage.mjs';
const base=legacyTemplateDescriptor('1.4.4-rc.28');
test('Legacy identity is deterministic and distinct from engine',()=>{assert.equal(base.id,'property.mediterranean-premium');assert.equal(base.engine,'cbpm-astro-v1');assert.equal(base.templateVersion,'1.4.4-rc.28');assert.equal(legacyTemplateDescriptor().templateVersion,'0.0.0');});
test('Versioned metadata rejects malformed descriptors',()=>{for(const patch of [{contractVersion:2},{schema:'unknown'},{engine:'other'},{category:'../bad'},{id:'restaurant.other'},{name:''},{templateVersion:'latest'},{name:'bad\nname'}])assert.throws(()=>validateTemplateDescriptor({...base,...patch}),/malkontrakt/);assert.throws(()=>resolveTemplateDescriptor({descriptor:null}),/malkontrakt/);});
test('New identities can be validated but are not falsely advertised as renderable',()=>{const next={...base,id:'property.nordic-modern',name:'Nordic Modern'};assert.equal(validateTemplateDescriptor(next).id,next.id);assert.throws(()=>resolveTemplateDescriptor({descriptor:next}),/støttes ikke/);const future={...base,id:'restaurant.bistro',category:'restaurant',subcategory:'dining'};assert.equal(validateTemplateDescriptor(future).category,'restaurant');});
test('Conflicting manifest and sidecar rejected',()=>{assert.throws(()=>resolveTemplateDescriptor({descriptor:base,manifest:{...base,name:'Different'}}),/Motstridende/);assert.deepEqual(resolveTemplateDescriptor({descriptor:base,manifest:base}),base);});
for(const [kind,env] of [['project','WSET_TEST_PROJECT_ZIP'],['template','WSET_TEST_TEMPLATE_ZIP']])test(`Actual legacy ${kind}: import, reopen, save as and export preserve identity and data`,{skip:!process.env[env]},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-template-'));try{
 const archive=process.env[env];const original=readSafeProjectZipEntries(await readFile(archive));const desc=original.find(f=>f.name===TEMPLATE_PATH);const manifest=JSON.parse(original.find(f=>f.name==='wset-project.json').bytes);const expected=resolveTemplateDescriptor({descriptor:desc?JSON.parse(desc.bytes):undefined,manifest:manifest.template,packageVersion:JSON.parse(original.find(f=>f.name==='package.json').bytes).version});const imported=await importEditableProject({archive,projectsDir:join(temp,'projects')});assert.equal(imported.kind,kind);assert.deepEqual(imported.template,expected);
 for(const f of original.filter(f=>f.name!=='wset-project.json'))assert.deepEqual(await readFile(join(imported.root,f.name)),f.bytes,f.name);
 assert.deepEqual(await readProjectTemplate(imported.root),expected);const loaded=await readDesignerProject(imported.root);assert.deepEqual(loaded.template,expected);
 const copy=await saveDesignerProjectAs({root:loaded.root,site:loaded.site,destination:join(temp,'copy')});assert.deepEqual(copy.template,expected);
 const out=join(temp,'roundtrip.zip');await exportEditableProject({root:imported.root,destination:out,kind});const bytes=await readFile(out);assert.deepEqual(inspectEditableArchive(bytes).template,expected);assert.deepEqual(JSON.parse(readSafeProjectZipEntries(bytes).find(f=>f.name===TEMPLATE_PATH).bytes),expected);
 const reopened=await importEditableProject({archive:out,projectsDir:join(temp,'reopened')});assert.deepEqual((await readDesignerProject(reopened.root)).site,loaded.site);
 const entries=readSafeProjectZipEntries(bytes);const meta=entries.find(f=>f.name==='wset-project.json');const info=JSON.parse(meta.bytes);info.template.name='Conflicting';meta.bytes=Buffer.from(JSON.stringify(info));const bad=join(temp,'bad.zip');await writeFile(bad,writeZip(entries));const target=join(temp,'rejected');await assert.rejects(importEditableProject({archive:bad,projectsDir:target}),/Motstridende/);await assert.rejects(readdir(target),{code:'ENOENT'});
 }finally{await rm(temp,{recursive:true,force:true});}
});
