import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {validateTemplateCreation} from '../designer/core/project-creation.mjs';
import {createFolderTemplateLibrary} from '../designer/core/folder-template-library.mjs';
import {createWorkspace} from '../designer/core/workspace.mjs';
import {exportEditableProject,readSafeProjectZipEntries} from '../designer/core/project-archive.mjs';
const valid={trusted:true,digest:'a'.repeat(64),info:{name:'  Kunde / Test  ',customer:'Firma',domain:'example.com'}};
test('Creation requires explicit trust, exact digest, valid name and bounded metadata',()=>{
 assert.equal(validateTemplateCreation(valid).info.name,'Kunde / Test');
 for(const input of [{...valid,trusted:false},{...valid,digest:'bad'},{...valid,info:{name:'  '}},{...valid,info:{name:'a\nb'}},{...valid,info:{name:'a',domain:'a'.repeat(254)}}])assert.throws(()=>validateTemplateCreation(input));
});
test('Actual template: named independent project with private metadata, stale digest blocked, original unchanged',{skip:!process.env.WSET_TEST_TEMPLATE_ZIP},async t=>{
 const base=await fs.mkdtemp(join(tmpdir(),'wset-create-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));
 const w=await createWorkspace({dataRoot:join(base,'data'),defaultRoot:join(base,'workspace'),recentFile:join(base,'recent.json')});const p=w.state().paths;
 const archive=process.env.WSET_TEST_TEMPLATE_ZIP,original=await fs.readFile(archive),lib=createFolderTemplateLibrary({getRoot:()=>p.templates,scratchRoot:join(base,'scratch')});const {entry}=await lib.import(archive);
 await assert.rejects(lib.create(entry.key,p.projects,validateTemplateCreation(valid)),/endret/);assert.deepEqual(await fs.readdir(p.projects),[]);
 const options=validateTemplateCreation({...valid,digest:entry.digest});const a=await lib.create(entry.key,p.projects,options),b=await lib.create(entry.key,p.projects,options);
 assert.match(basename(a.root),/^Kunde-Test-/);assert.notEqual(a.root,b.root);const projects=(await w.projects()).items;assert.equal(projects.length,2);assert.notEqual(projects[0].id,projects[1].id);for(const item of projects)assert.deepEqual(item.dashboard,options.info);
 const file=join(a.root,'project','website.json');assert.deepEqual(await fs.readFile(file),await fs.readFile(join(b.root,'project','website.json')));const out=join(base,'out.zip');await exportEditableProject({root:a.root,destination:out});assert.ok(!readSafeProjectZipEntries(await fs.readFile(out)).some(f=>f.name==='.wset-local-project.json'));assert.deepEqual(await fs.readFile(archive),original);
});
