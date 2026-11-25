import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {languageEntries,languageReport,createLanguagePack,inspectLanguagePack} from '../designer/engines/cbpm-astro-v1/lib/i18n-core.mjs';
import {startDesignerPreview,previewDocument} from '../designer/core/preview-server.mjs';
import {workspaceLanguageData} from '../designer/core/language-workspace.mjs';
import {createEditorHistory} from '../designer/core/editor-history.mjs';
const seed=()=>migrateProjectForDesigner(JSON.parse(raw));
const raw=await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8');
const edit=(site,command)=>applyEditorCommand(site,command).site;
test('Language reorder and settings preserve source, active status, messages and undo',()=>{
 const s=seed();const order=s.languages.slice().sort((a,b)=>a.order-b.order).map(l=>l.code);let n=edit(s,{action:'language:reorder',code:'nl',target:'en',after:false});const now=n.languages.slice().sort((a,b)=>a.order-b.order).map(l=>l.code);assert.equal(now.indexOf('nl'),now.indexOf('en')-1);assert.deepEqual(new Set(now),new Set(order));assert.deepEqual(n.i18n,s.i18n);assert.equal(n.defaultLanguage,s.defaultLanguage);
 n=edit(n,{action:'language:settings',code:'nl',name:'Nederlands test',subtitle:'Test',flag:'🇳🇱'});assert.equal(n.languages.find(l=>l.code==='nl').name,'Nederlands test');assert.deepEqual(n.i18n,s.i18n);assert.throws(()=>edit(s,{action:'language:reorder',code:'no',target:'fake'}));assert.throws(()=>edit(s,{action:'language:settings',code:'nl',name:''}));const history=createEditorHistory();history.record(s,n);assert.deepEqual(history.undo(n),s);
});
test('Existing language catalog and JSON format round-trip; status is filled, not quality; update reaches renderer',()=>{
 const s=seed();const existing=languageEntries(s,'en');const e=existing.find(e=>e.key.startsWith('ui.')&&e.source.includes('Vi tar vare på'));const entry=e||existing.find(e=>e.key.startsWith('content.pages.home.title'));assert(entry);
 const text='RC32 translation test';const n=edit(s,{action:'language:translate',locale:'en',key:entry.key,value:text});assert.equal(languageEntries(n,'en').find(e=>e.key===entry.key).value,text);assert.equal(languageEntries(n,'no').find(e=>e.key===entry.key).value,entry.source);assert(previewDocument(n,'en','home').includes(text));const pack=createLanguagePack(n,'en');assert.equal(pack.format,'cbpm-language-v1');assert.equal(pack.messages[entry.key],text);assert(inspectLanguagePack(s,pack).ok);const round=edit(s,{action:'language:import',pack});assert.equal(languageEntries(round,'en').find(e=>e.key===entry.key).value,text);
 const blank=edit(n,{action:'language:translate',locale:'en',key:entry.key,value:''});assert(languageReport(blank,'en').missing.includes(entry.key));const draft=edit(s,{action:'language:add',code:'it',name:'Italiano',flag:'🇮🇹'});assert.equal(draft.languages.find(l=>l.code==='it').enabled,false);assert.throws(()=>edit(draft,{action:'language:update',code:'it',field:'enabled',value:true}));assert.throws(()=>edit(s,{action:'language:update',code:s.defaultLanguage,field:'enabled',value:false}));
});
test('Preview serves recognized language flags and refuses unknown/private and symlink paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset32-flags-'));let server;
 try{await mkdir(join(root,'public/assets/flags'),{recursive:true});const svg=await readFile(new URL('../designer/ui/flags/nl.svg',import.meta.url));await writeFile(join(root,'public/assets/flags/nl.svg'),svg);await writeFile(join(root,'private.svg'),'private');await writeFile(join(root,'public/assets/flags/secret.svg'),'hidden');await symlink(join(root,'private.svg'),join(root,'public/assets/flags/de.svg'));server=await startDesignerPreview({getSite:seed,getRoot:()=>root});const r=await fetch(server.url+'/assets/flags/nl.svg');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/svg/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),svg);for(const f of ['secret','de'])assert.notEqual((await fetch(server.url+'/assets/flags/'+f+'.svg')).status,200);
 }finally{await server?.close();await rm(root,{recursive:true,force:true});}
});

test('Workspace assigns rendered template texts to real pages without changing the JSON pack',()=>{const s=seed(),before=JSON.stringify(s);const w=workspaceLanguageData(s,'en'),base=languageEntries(s,'en');assert.equal(w.entries.length,base.length);assert.deepEqual(w.entries.map(({pageIds,translationStatus,...e})=>e),base);const contact=w.entries.find(e=>e.key==='ui.test-the-form.b328b3c1');assert(contact.pageIds.includes('contact'));assert(w.entries.some(e=>e.pageIds?.includes('home')));assert.equal(JSON.stringify(s),before);});
