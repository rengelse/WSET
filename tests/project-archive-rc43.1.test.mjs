import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeZip,readSafeProjectZipEntries,importEditableProject,exportEditableProject} from '../designer/core/project-archive.mjs';
import {readDesignerProject} from '../designer/core/project-storage.mjs';
const zip=(...names)=>writeZip(names.map(name=>({name,bytes:Buffer.from(name.endsWith('/')?'':'test')})));
test('Explicit empty directories, including tests and module parents, are ignored',()=>{
 const files=readSafeProjectZipEntries(zip('tests/','tests/fixtures/','project/','public/assets/a.txt','public/','public/assets/','modules/','modules/smart-assistant/','modules/smart-assistant/backend/','project/website.json'));
 assert.deepEqual(files.map(f=>f.name),['public/assets/a.txt','project/website.json']);
});
test('Disallowed and private directory names remain rejected',()=>{
 for(const name of ['node_modules/','project/.env/','project/backups/','tests/other/','modules/Bad/','unknown/'])assert.throws(()=>readSafeProjectZipEntries(zip(name)),/Ikke tillatt fil/);
});
test('Nonempty directory records and symlink directory records are rejected',()=>{
 assert.throws(()=>readSafeProjectZipEntries(writeZip([{name:'project/',bytes:Buffer.from('bad')}])) ,/inneholder fildata/);
 const b=zip('project/');const central=b.readUInt32LE(b.length-22+16);b.writeUInt32LE((0o120777<<16)>>>0,central+38);
 assert.throws(()=>readSafeProjectZipEntries(b),/Symbolske lenker/);
});
test('Explicit and implicit file/directory conflicts and case collisions fail',()=>{
 for(const names of [['project/a','project/a/'],['project/a/b','project/a'],['project/A/','project/a/b']]) assert.throws(()=>readSafeProjectZipEntries(zip(...names)),/Motstridende/);
});
test('Traversal directory and inconsistent local header are rejected',()=>{
 const b=zip('project/ok/');const old=Buffer.from('project/ok/'),replacement=Buffer.from('project/../');assert.equal(old.length,replacement.length);
 for(let i=0;i<b.length-old.length;i++)if(b.subarray(i,i+old.length).equals(old))replacement.copy(b,i);
 assert.throws(()=>readSafeProjectZipEntries(b),/Ikke tillatt fil/);
 const mismatch=zip('project/');mismatch[30]=0x78;assert.throws(()=>readSafeProjectZipEntries(mismatch),/Motstridende lokal/);
});
test('Actual supplied project ZIP imports and re-exports without losing files',{skip:!process.env.WSET_TEST_PROJECT_ZIP},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'wset-archive-hotfix-'));
 try{
  const archive=process.env.WSET_TEST_PROJECT_ZIP,entries=readSafeProjectZipEntries(await readFile(archive));
  const imported=await importEditableProject({archive,projectsDir:join(temp,'projects')});
  for(const f of entries.filter(f=>f.name!=='wset-project.json'))assert.deepEqual(await readFile(join(imported.root,f.name)),f.bytes,f.name);
  const original=await readDesignerProject(imported.root);assert.equal(original.site.languages.length,11);
  const destination=join(temp,'roundtrip.zip');await exportEditableProject({root:imported.root,destination});
  const reopened=await importEditableProject({archive:destination,projectsDir:join(temp,'reopened')});
  assert.deepEqual((await readDesignerProject(reopened.root)).site,original.site);
 }finally{await rm(temp,{recursive:true,force:true});}
});
