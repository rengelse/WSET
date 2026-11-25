import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {buildMediaCatalog,verifyLegacyRemoval} from '../designer/core/media-catalog.mjs';
import {mediaReferences} from '../designer/core/media-references.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {createEditorHistory} from '../designer/core/editor-history.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
const raw=await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8');
const seed=()=>migrateProjectForDesigner(JSON.parse(raw));
const edit=(s,c)=>applyEditorCommand(s,c).site;
test('Detach shared portrait only from selected employee, preserve source, undo/redo',()=>{
 const s=seed();s.team[1].portrait=s.team[0].portrait;const src=s.team[0].portrait;
 const m=buildMediaCatalog(s,[src]).find(m=>m.src===src);const ref=m.placements.find(r=>r.recordId===s.team[0].id);assert(ref.detachable);
 const next=edit(s,{action:'media:detach',referenceId:ref.id,src});assert.equal(next.team[0].portrait,'');assert.equal(next.team[1].portrait,src);assert.equal(buildMediaCatalog(next,[src]).find(m=>m.src===src).placements.length,1);
 const history=createEditorHistory();history.record(s,next);assert.deepEqual(history.undo(next),s);assert.deepEqual(history.redo(s),next);
 assert.throws(()=>edit(next,{action:'media:detach',referenceId:ref.id,src}));
});
test('Required hero cannot be detached; optional before image and explicit gallery can',()=>{
 const s=seed();const hero=mediaReferences(s).find(r=>r.id==='section:home:home-hero:image');assert.throws(()=>edit(s,{action:'media:detach',referenceId:hero.id,src:hero.src}));
 const before=mediaReferences(s).find(r=>r.field==='beforeUrl');const next=edit(s,{action:'media:detach',referenceId:before.id,src:before.src});assert.equal(next.projects.find(p=>p.id===before.recordId).beforeUrl,'');assert(renderDynamicSite({site:next,page:'home',locale:'no'}).html.includes('project-big'));
 const p=s.projects[0];p.gallery=['/assets/a.webp','/assets/b.webp'];const ref=mediaReferences(s).find(r=>r.id===`projects:${p.id}:gallery:0`);const n=edit(s,{action:'media:detach',referenceId:ref.id,src:ref.src});assert.deepEqual(n.projects[0].gallery,['/assets/b.webp']);assert.throws(()=>edit(n,{action:'media:detach',referenceId:ref.id,src:'/assets/b.webp'}));
});
test('Unused legacy image hidden from catalog, file remains, undo restores, source guard protects hard-coded assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset31-'));try{
  const s=seed(),src='/assets/unused-extra.webp',id='asset-unused-extra-webp';await mkdir(join(root,'public/assets'),{recursive:true});await mkdir(join(root,'src'));await writeFile(join(root,'public/assets/unused-extra.webp'),'original');assert(await verifyLegacyRemoval(root,s,id,src));
  const n=edit(s,{action:'media:remove',id,src});assert(!buildMediaCatalog(n,[src]).some(m=>m.id===id));assert.equal(await readFile(join(root,'public/assets/unused-extra.webp'),'utf8'),'original');const history=createEditorHistory();history.record(s,n);assert(buildMediaCatalog(history.undo(n),[src]).some(m=>m.id===id));
  await writeFile(join(root,'src/page.astro'),`<img src="${src}">`);await assert.rejects(verifyLegacyRemoval(root,s,id,src),/avhengighet/);assert.throws(()=>edit(s,{action:'media:remove',id:'asset-hero-webp',src:'/assets/hero.webp'}));assert.throws(()=>edit(s,{action:'media:remove',id:'asset-foo-webp',src:'/storage/imports/Existing/images/foo.webp'}));
 }finally{await rm(root,{recursive:true,force:true});}
});
