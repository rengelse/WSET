import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildMediaCatalog,readMediaCatalog,replaceRegisteredMedia} from '../designer/core/media-catalog.mjs';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
const seed=migrateProjectForDesigner(JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const asset={id:'photo-12345678-abc',src:'/assets/photo-12345678-abc.webp',original:'project/media/originals/photo-12345678-abc.jpg',originalName:'Villa.jpg',variants:{hero:['/assets/photo-12345678-abc-hero-640.webp','/assets/photo-12345678-abc-hero-1280.webp','/assets/photo-12345678-abc-hero-1920.webp']}};
const update=(s,command)=>applyEditorCommand(s,command).site;
const registered=()=>update(seed,{action:'media:register',media:asset});
test('Dynamic catalog detects actual files, excludes derivative duplicates, assigns categories from references',()=>{
 let s=registered();s=update(s,{action:'media:slot',key:'hero',src:asset.variants.hero[0]});s=update(s,{action:'media:assign',target:{kind:'team',id:s.team[0].id},field:'portrait',src:asset.src});
 const m=buildMediaCatalog(s,[asset.src,...asset.variants.hero,'/assets/hero.webp','/assets/unlisted.webp','/assets/flags/no.svg','/storage/imports/Existing/images/x.webp']);assert.equal(m.length,3);const chosen=m.find(x=>x.id===asset.id);assert(chosen.categories.includes('team'));assert(chosen.categories.includes('background'));assert(chosen.used);assert(!chosen.removable);assert.equal(m.find(x=>x.src==='/assets/unlisted.webp').categories.length,0);
});
test('Custom categories persist, support many-to-many and can be renamed or removed without changing images',()=>{
 let s=registered();s=update(s,{action:'media:category-add',name:'Kampanje'});s=update(s,{action:'media:categorize',id:asset.id,categories:['background','custom-1']});assert.deepEqual(buildMediaCatalog(s)[0].categories.sort(),['background','custom-1']);s=update(s,{action:'media:category-rename',id:'custom-1',name:'Sommer'});assert.equal(s.media.workspace.categories[0].name,'Sommer');s=update(s,{action:'media:category-remove',id:'custom-1'});assert.deepEqual(s.media.items,[asset]);assert.deepEqual(buildMediaCatalog(s)[0].categories,['background']);assert.throws(()=>update(s,{action:'media:category-add',name:'Ansatte'}));
});
test('Only unused registered entries can be removed, without touching other content',()=>{
 let s=registered();assert.equal(buildMediaCatalog(s)[0].used,false);assert.equal(buildMediaCatalog(s)[0].removable,true);const linked=update(s,{action:'media:slot',key:'hero',src:asset.src});assert.throws(()=>update(linked,{action:'media:remove',id:asset.id}));s=update(s,{action:'media:remove',id:asset.id});assert.equal(s.media.items.length,0);assert.equal(buildMediaCatalog(s,[asset.src,...asset.variants.hero]).length,0);assert.deepEqual(s.team,seed.team);assert.throws(()=>update(s,{action:'media:remove',id:'asset-hero-webp'}));
});
test('Catalog scans only flat website assets; private XML files, property images and nested media are excluded',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset-media29-'));try{for(const d of ['public/assets','public/assets/flags','project/property-feeds/Existing/images/CB-1','storage/imports/Existing/images/CB-1'])await mkdir(join(root,d),{recursive:true});for(const p of ['public/assets/new.webp','public/assets/flags/no.svg','project/property-feeds/Existing/images/CB-1/house.webp','storage/imports/Existing/images/CB-1/house.webp'])await writeFile(join(root,p),'fake');const m=await readMediaCatalog(seed,root);assert.equal(m.length,1);assert.equal(m[0].src,'/assets/new.webp');assert.equal(m[0].bytes,4);}finally{await rm(root,{recursive:true,force:true});}
});
test('Replacement preserves ID and manual categories, rebinds variants without mutating original state',()=>{
 let s=registered();s=update(s,{action:'media:slot',key:'hero',src:asset.variants.hero[1]});s=update(s,{action:'media:categorize',id:asset.id,categories:['team']});const newAsset=JSON.parse(JSON.stringify(asset).replaceAll('12345678-abc','abcdef12-345'));const next=replaceRegisteredMedia(s,asset.id,newAsset);assert.equal(next.media.items[0].id,asset.id);assert.equal(next.brand.images.hero,newAsset.variants.hero[1]);assert.equal(next.brand.images[asset.id],newAsset.src);assert.equal(s.brand.images.hero,asset.variants.hero[1]);assert.deepEqual(next.media.workspace,s.media.workspace);
});
