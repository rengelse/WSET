import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compareTemplateVersions as compare,templateVersionStatus as status,assertTemplateUpdate,sortTemplateEntries} from '../designer/core/template-versions.mjs';
import {legacyTemplateDescriptor} from '../designer/core/template-contract.mjs';
import {createFolderTemplateLibrary} from '../designer/core/folder-template-library.mjs';
import {writeZip,readSafeProjectZipEntries} from '../designer/core/project-archive.mjs';
import {readDesignerProject} from '../designer/core/project-storage.mjs';
import {prepareTemplateSwitch,commitTemplateSwitch,listTemplateBackups,rollbackTemplateSwitch} from '../designer/core/template-switching.mjs';
const base=legacyTemplateDescriptor('1.4.4-rc.28.1');
const entry=(v,options={})=>({key:v,digest:'digest-'+v,supported:true,template:{...base,templateVersion:v},...options});
test('Version precedence: numeric rc, nested rc, release, major/minor, no lexical trap',()=>{
 const versions=['2.0.0','1.4.4-rc.28.1','1.4.4-rc.9','1.4.4','1.4.4-rc.28','1.4.4-rc.100','1.10.0','1.4.4-rc.28.10'];
 assert.deepEqual(versions.sort(compare),['1.4.4-rc.9','1.4.4-rc.28','1.4.4-rc.28.1','1.4.4-rc.28.10','1.4.4-rc.100','1.4.4','1.10.0','2.0.0']);assert.equal(compare('1.4.4-rc.28.01','1.4.4-rc.28.1'),0);assert.throws(()=>compare('latest','1.0.0'));
});
test('Recommend newest supported same-ID version; name changes cannot affect order',()=>{
 const other={...entry('99.0.0'),template:{...base,id:'property.nordic-modern',templateVersion:'99.0.0'}};const newest=entry('1.4.4-rc.100');newest.template.name='A new name';const items=[entry('1.4.4-rc.29'),entry('1.4.4-rc.9'),entry('1.4.4-rc.28.1'),newest,other];
 const r=status(base,{items});assert.equal(r.status,'available');assert.equal(r.recommended.key,newest.key);assert.deepEqual(r.newerKeys,['1.4.4-rc.100','1.4.4-rc.29']);assert.equal(r.versions,4);assert.equal(items.filter(x=>x.template.id===base.id).sort(sortTemplateEntries)[0].key,newest.key);
});
test('Missing current archive, project ahead, unsupported and incomplete catalogue are distinguished',()=>{
 assert.equal(status(base,{items:[entry(base.templateVersion)]}).status,'current');assert.equal(status(base,{items:[]}).status,'not-in-library');assert.equal(status(base,{items:[entry('1.4.4-rc.28')]}).status,'ahead');assert.equal(status(base,{items:[entry('1.4.4-rc.29',{supported:false})]}).status,'unsupported');assert.equal(status(base,{items:[entry('1.4.4-rc.29')],complete:false}).recommended,null);assert.equal(status(base,{items:[entry('1.4.4-rc.29')],complete:false}).status,'unavailable');
});
test('Conflicting or equal-precedence alias versions are not suggested',()=>{
 const conflict=entry('1.4.4-rc.30');assert.equal(status(base,{items:[],conflicts:[conflict]}).status,'conflict');assert.equal(status(base,{items:[entry('1.4.4-rc.29')],conflicts:[conflict]}).recommended.key,'1.4.4-rc.29');assert.equal(status(base,{items:[entry('1.4.4-rc.29'),entry('1.4.4-rc.029')]}).status,'conflict');assert.equal(status(base,{items:[],conflicts:[entry(base.templateVersion)]}).exactConflict,true);
});
test('Update guard rejects same version, downgrade and different identity',()=>{
 assert.doesNotThrow(()=>assertTemplateUpdate(base,entry('1.4.4-rc.29').template));assert.throws(()=>assertTemplateUpdate(base,base),/nyere/);assert.throws(()=>assertTemplateUpdate(base,entry('1.4.4-rc.28').template),/nyere/);assert.throws(()=>assertTemplateUpdate(base,{...base,id:'property.nordic-modern',templateVersion:'2.0.0'}),/samme mal-ID/);
});
const actual=process.env.WSET_TEST_SWITCH_TEMPLATE_ZIP||process.env.WSET_TEST_TEMPLATE_ZIP;
async function makeArchive(dest,version,suffix=''){
 const files=readSafeProjectZipEntries(await readFile(actual));for(const f of files){if(f.name==='project/template.json'||f.name==='wset-project.json'){const json=JSON.parse(f.bytes);const t=f.name==='project/template.json'?json:json.template;t.templateVersion=version;f.bytes=Buffer.from(JSON.stringify(json));}if(f.name==='public/styles.css')f.bytes=Buffer.concat([f.bytes,Buffer.from('\n/* rc53 '+version+' '+suffix+' */')]);}await writeFile(dest,writeZip(files));
}
test('Real folder sync: new archive, removal, version conflict, unchanged projects and original ZIP', {skip:!actual},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wset53-sync-'));try{const root=join(dir,'templates');await mkdir(root);const lib=createFolderTemplateLibrary({getRoot:()=>root,scratchRoot:join(dir,'scratch')});const old=join(root,'original.zip');await copyFile(actual,old);const list=await lib.list();const orig=list.items[0];const project=await lib.create(orig.key,join(dir,'projects'));const saved=await readDesignerProject(project.root);const bytes=await readFile(old);const v=join(root,'arbitrary-name.zip');await makeArchive(v,'1.4.4-rc.100');assert.equal(status(saved.template,await lib.list()).recommended.template.templateVersion,'1.4.4-rc.100');const copy=join(root,'conflict.zip');await makeArchive(copy,'1.4.4-rc.100','conflicting');assert.equal(status(saved.template,await lib.list()).status,'conflict');await rm(copy);assert.equal(status(saved.template,await lib.list()).status,'available');await rm(v);assert.equal(status(saved.template,await lib.list()).status,'current');assert.deepEqual(await readFile(old),bytes);assert.deepEqual((await readDesignerProject(project.root)).template,saved.template);await rm(root,{recursive:true});assert.equal(status(saved.template,await lib.list()).status,'unavailable');}finally{await rm(dir,{recursive:true,force:true});}
});
test('Real template update uses existing staged transaction, records update, rollback restores version', {skip:!actual},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wset53-update-'));try{const root=join(dir,'templates');await mkdir(root);const lib=createFolderTemplateLibrary({getRoot:()=>root,scratchRoot:join(dir,'scratch')});await copyFile(actual,join(root,'original.zip'));const orig=(await lib.list()).items[0];const {root:project}=await lib.create(orig.key,join(dir,'projects'));const source=await readDesignerProject(project);const before=await readFile(join(project,'project/website.json'));await makeArchive(join(root,'new.zip'),'1.4.4-rc.100');const next=status(source.template,await lib.list()).recommended;const target=await lib.mappingTarget(next.key,next.digest),staged=await lib.stagePreview(next.key,next.digest);try{await assert.rejects(prepareTemplateSwitch({source,target:{...target,template:{...target.template,id:'property.nordic-modern'}},staged,intent:'update'}),/samme mal-ID/);const plan=await prepareTemplateSwitch({source,target,staged,intent:'update'});assert.equal(plan.kind,'update');const journal=join(dir,'journal.json');await commitTemplateSwitch({plan,journal,approved:true,checkTarget:()=>lib.mappingTarget(next.key,next.digest),verifyBuild:async()=>{}});assert.deepEqual(await readFile(join(project,'project/website.json')),before);const current=await readDesignerProject(project);assert.equal(current.template.templateVersion,'1.4.4-rc.100');assert.equal(status(current.template,await lib.list()).status,'current');const backup=(await listTemplateBackups(project))[0];assert.equal(backup.kind,'update');await rollbackTemplateSwitch({root:project,id:backup.id,journal,approved:true});assert.deepEqual((await readDesignerProject(project)).template,source.template);assert.equal(status(source.template,await lib.list()).status,'available');}finally{await staged.dispose();}}finally{await rm(dir,{recursive:true,force:true});}
});
