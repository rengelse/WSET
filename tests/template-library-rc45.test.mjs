import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listTemplates,importLibraryTemplate,createProjectFromTemplate,removeLibraryTemplate,readTemplatePreviews} from '../designer/core/template-library.mjs';
import {writeZip,readSafeProjectZipEntries,importEditableProject} from '../designer/core/project-archive.mjs';
import {readDesignerProject} from '../designer/core/project-storage.mjs';
import {legacyTemplateDescriptor} from '../designer/core/template-contract.mjs';
const base=legacyTemplateDescriptor('1.4.4-rc.28');
const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lmP8AAAAASUVORK5CYII=','base64');
const seed=JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8'));
const actual=process.env.WSET_TEST_TEMPLATE_ZIP;
async function fixture(root,{template=base,kind='template',extra=[],legacy=false,conflict=false}={}){
 let files;
 if(actual)files=readSafeProjectZipEntries(await readFile(actual)).filter(f=>!['wset-project.json','project/template.json'].includes(f.name)&&!f.name.startsWith('project/template-previews/'));
 else {
  const serialized=JSON.stringify(seed);const refs=new Set([...serialized.matchAll(/(?:\/)?assets\/[a-zA-Z0-9_./-]+\.(?:webp|jpg|jpeg|png|svg)/g)].map(m=>m[0].replace(/^\//,'')));
  for(const item of [...seed.services,...seed.projects])if(item.img)refs.add('assets/'+item.img+'.webp');
  files=[{name:'project/website.json',bytes:Buffer.from(serialized)},{name:'package.json',bytes:Buffer.from(JSON.stringify({version:base.templateVersion}))},...['src/lib/render-site.mjs','public/site.js','scripts/package-manual-site.mjs'].map(name=>({name,bytes:Buffer.from('throw Error("Must never execute fixture code")')})),...[...refs].map(ref=>({name:'public/'+ref,bytes:tinyPNG}))];
 }
 const manifest={format:'wset-editable-project',formatVersion:1,engine:'cbpm-astro-v1',kind,name:'Fixture',...(legacy?{}:{template})};
 files.push({name:'wset-project.json',bytes:Buffer.from(JSON.stringify(manifest))});if(!legacy)files.push({name:'project/template.json',bytes:Buffer.from(JSON.stringify(conflict?{...template,name:'conflict'}:template))});
 const path=join(root,`fixture-${Math.random().toString(16).slice(2)}.zip`);await writeFile(path,writeZip([...files,...extra]));return path;
}
async function context(fn){const root=await mkdtemp(join(tmpdir(),'wset-tl-'));try{return await fn({root,libraryRoot:join(root,'templates'),projectsDir:join(root,'projects')});}finally{await rm(root,{recursive:true,force:true});}}
test('Library persists versions, imports legacy descriptors, handles duplicate and conflicting content',()=>context(async({root,libraryRoot})=>{
 assert.deepEqual(await listTemplates({libraryRoot}),{items:[],issues:[]});const archive=await fixture(root,{legacy:true});const first=await importLibraryTemplate({archive,libraryRoot});assert.equal(first.entry.template.id,base.id);assert.equal(first.alreadyInstalled,false);assert.equal((await importLibraryTemplate({archive,libraryRoot})).alreadyInstalled,true);
 const v2=await fixture(root,{template:{...base,templateVersion:'1.4.4-rc.29'}});await importLibraryTemplate({archive:v2,libraryRoot});assert.equal((await listTemplates({libraryRoot})).items.length,2);
 const changed=await fixture(root,{template:first.entry.template,extra:[{name:'project/note.txt',bytes:Buffer.from('different')} ]});await assert.rejects(importLibraryTemplate({archive:changed,libraryRoot}),/annet innhold/);assert.equal((await listTemplates({libraryRoot})).items.length,2);
}));
test('New project is a separate copy; removing a version does not affect projects',()=>context(async({root,libraryRoot,projectsDir})=>{
 const archive=await fixture(root);const {entry}=await importLibraryTemplate({archive,libraryRoot});const a=await createProjectFromTemplate({libraryRoot,key:entry.key,projectsDir});const b=await createProjectFromTemplate({libraryRoot,key:entry.key,projectsDir});assert.notEqual(a.root,b.root);assert.deepEqual((await readDesignerProject(a.root)).site,(await readDesignerProject(b.root)).site);await writeFile(join(a.root,'project/website.json'),'{}');assert.notEqual(await readFile(join(a.root,'project/website.json'),'utf8'),await readFile(join(b.root,'project/website.json'),'utf8'));await removeLibraryTemplate({libraryRoot,key:entry.key});assert.equal((await listTemplates({libraryRoot})).items.length,0);assert.equal((await readDesignerProject(b.root)).template.id,base.id);
}));
test('Future design and category can be catalogued without enabling unsupported runtime',()=>context(async({root,libraryRoot,projectsDir})=>{
 const template={...base,id:'restaurant.bistro',category:'restaurant',subcategory:'dining',name:'Bistro'};const archive=await fixture(root,{template});const {entry}=await importLibraryTemplate({archive,libraryRoot});assert.equal(entry.supported,false);assert.equal((await listTemplates({libraryRoot})).items[0].template.category,'restaurant');await assert.rejects(createProjectFromTemplate({libraryRoot,key:entry.key,projectsDir}),/støttes ikke/);await assert.rejects(importEditableProject({archive,projectsDir}),/støttes ikke/);await assert.rejects(readdir(projectsDir),{code:'ENOENT'});
}));
test('Only valid template archives; failed imports leave no library entries',()=>context(async({root,libraryRoot})=>{
 for(const options of [{kind:'project'},{conflict:true},{extra:[{name:'project/property-feeds/secret.xml',bytes:Buffer.from('private')}]},{extra:[{name:'project/template-previews/desktop.png',bytes:Buffer.from('not PNG')}]}]){const archive=await fixture(root,options);await assert.rejects(importLibraryTemplate({archive,libraryRoot}));}assert.deepEqual(await readdir(libraryRoot),[]);
}));
test('Static previews are optional and loaded only by valid library key',()=>context(async({root,libraryRoot})=>{
 const archive=await fixture(root,{extra:[{name:'project/template-previews/desktop.png',bytes:tinyPNG}]});const {entry}=await importLibraryTemplate({archive,libraryRoot});assert.deepEqual(entry.previews,['desktop']);assert.deepEqual(await readTemplatePreviews({libraryRoot,key:entry.key}),{desktop:'data:image/png;base64,'+tinyPNG.toString('base64')});await assert.rejects(readTemplatePreviews({libraryRoot,key:'../'}),/Ugyldig malnøkkel/);await assert.rejects(removeLibraryTemplate({libraryRoot,key:'../'}),/Ugyldig malnøkkel/);
}));
test('Corrupted archived content is rejected at project creation',()=>context(async({root,libraryRoot,projectsDir})=>{
 const {entry}=await importLibraryTemplate({archive:await fixture(root),libraryRoot});await writeFile(join(libraryRoot,entry.key,'template.zip'),'invalid');await assert.rejects(createProjectFromTemplate({libraryRoot,key:entry.key,projectsDir}),/endret eller skadet/);await assert.rejects(readdir(projectsDir),{code:'ENOENT'});
}));
