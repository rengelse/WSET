import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {buildMediaCatalog} from '../designer/core/media-catalog.mjs';
import {mediaReferences,rebindWebsiteMedia} from '../designer/core/media-references.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
import {createEditorHistory} from '../designer/core/editor-history.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
const seed=()=>migrateProjectForDesigner(JSON.parse(raw));
const raw=await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8');
const asset={id:'photo-abc123',src:'/assets/photo-abc123.webp',original:'project/media/originals/photo-abc123.jpg',variants:{hero:['/assets/photo-abc123-hero-1920.webp'],portrait:['/assets/photo-abc123-portrait-1080.webp'],card:['/assets/photo-abc123-card-1260.webp'],gallery:['/assets/photo-abc123-gallery-1440.webp']}};
const legacy=(s,src)=>buildMediaCatalog(s,[src]).find(m=>m.src===src);
const get=(s,id)=>mediaReferences(s).find(r=>r.id===id)?.src;
const render=(site,page,locale='no')=>renderDynamicSite({site,page,locale}).html;
test('Single replacement of shared implicit template image only changes the selected section',()=>{
 const s=seed(),old=legacy(s,'/assets/hero-square.webp');assert(old.placements.length>=4);
 const next=rebindWebsiteMedia(s,{old,replacement:asset,referenceIds:['section:about:about-hero:image'],register:true});
 assert.equal(get(next,'section:about:about-hero:image'),asset.variants.hero[0]);
 assert.equal(get(next,'section:contact:contact-hero:image'),old.src);
 assert(render(next,'about').includes(asset.variants.hero[0]));assert(render(next,'contact').includes(old.src));assert.equal(s.media.items.length,0);
});
test('Shared employee photo: specific person, all placements, and existing library image',()=>{
 let s=seed();s.team[1].portrait=s.team[0].portrait;s.media.items.push(asset);const old=legacy(s,s.team[0].portrait);
 const first=`team:${s.team[0].id}:portrait`;
 let next=rebindWebsiteMedia(s,{old,replacement:asset,referenceIds:[first]});assert.equal(next.team[0].portrait,asset.variants.portrait[0]);assert.equal(next.team[1].portrait,s.team[1].portrait);assert.equal(next.media.items.length,1);
 next=rebindWebsiteMedia(s,{old,replacement:asset,all:true});assert.equal(next.team[1].portrait,asset.variants.portrait[0]);assert.equal(next.team[0].portrait,asset.variants.portrait[0]);
});
test('Multiple placements choose correct variants, preserve gallery captions, metadata and originals; one undo/redo',()=>{
 const s=seed(),old=legacy(s,'/assets/project-after.webp');s.media.workspace={categories:[{id:'custom-1',name:'Kampanje'}],assignments:{[old.id]:['custom-1']}};s.projects[0].gallery[1]={url:old.src,alt:'Kitchen'};
 const next=rebindWebsiteMedia(s,{old,replacement:asset,all:true,register:true});assert.equal(next.projects[0].afterUrl,asset.variants.gallery[0]);assert.equal(next.projects[0].gallery[1].url,asset.variants.gallery[0]);assert.equal(next.projects[0].gallery[1].alt,'Kitchen');assert.equal(next.brand.images[next.projects[0].img],asset.variants.card[0]);assert.deepEqual(next.media.workspace.assignments[asset.id],['custom-1']);assert.deepEqual(next.media.workspace.assignments[old.id],['custom-1']);
 const hist=createEditorHistory();hist.record(s,next);assert.deepEqual(hist.undo(next),s);assert.deepEqual(hist.redo(s),next);
});
test('All supported source images in actual seed are replaced in rendered static pages and project detail pages',()=>{
 const s=seed(),refs=mediaReferences(s),pages=[...s.sitePages.filter(p=>p.id!=='properties'&&p.enabled!==false).map(p=>p.id),...s.projects.filter(p=>p.enabled!==false&&p.isVisible!==false).map(p=>'project-'+p.id)];
 for(const src of new Set(refs.map(r=>r.src))){const old=legacy(s,src),next=rebindWebsiteMedia(s,{old,replacement:asset,all:true,register:true});for(const page of pages)assert(!render(next,page).includes(`src="${src}"`),`${page} still renders ${src}`);}
});
test('Rejected stale reference, unsafe URL, unrelated image and incorrect logo/photo type',()=>{
 const s=seed(),old=legacy(s,'/assets/hero.webp');assert.throws(()=>rebindWebsiteMedia(s,{old,replacement:asset,referenceIds:['not-real'],register:true}));assert.throws(()=>rebindWebsiteMedia(s,{old,replacement:{...asset,src:'https://example.com/a.jpg'},all:true,register:true}));assert.throws(()=>rebindWebsiteMedia(s,{old,replacement:{...asset,kind:'logo'},all:true,register:true}));assert.throws(()=>rebindWebsiteMedia(s,{old,replacement:old,all:true}));
});
test('Logo variants and non-WebP service images work without touching property data',()=>{
 let s=seed();s.brand.logoUrl='/assets/brand.png';s.brand.faviconUrl='/assets/brand.png';s.propertyPrivate={image:'/assets/brand.png'};
 const old=legacy(s,'/assets/brand.png'),logo={...asset,id:'logo-abc123',kind:'logo',variants:{logo:['/assets/logo-abc123.webp'],favicon:['/assets/logo-abc123.png']}};
 let next=rebindWebsiteMedia(s,{old,replacement:logo,all:true,register:true});assert.equal(next.brand.logoUrl,logo.variants.logo[0]);assert.equal(next.brand.faviconUrl,logo.variants.favicon[0]);assert.deepEqual(next.propertyPrivate,s.propertyPrivate);
 next=applyEditorCommand(s,{action:'media:assign',target:{kind:'service',id:s.services[0].id},field:'img',src:'/assets/MyPicture.jpg'}).site;assert.equal(next.brand.images[next.services[0].img],'/assets/MyPicture.jpg');
});
test('Sharp creates variants and preserves original, old files and project property images (optional dependency)',async t=>{
 let sharp;try{sharp=(await import('sharp')).default}catch{t.skip('Sharp not installed');return;}
 const {importProjectImage}=await import('../designer/core/media-library.mjs');const root=await mkdtemp(join(tmpdir(),'wset-media30-'));
 try{const source=join(root,'new.jpg');await sharp({create:{width:640,height:480,channels:3,background:'#618f91'}}).jpeg().toFile(source);const original=await readFile(source);const asset=await importProjectImage({root,source});assert.deepEqual(await readFile(join(root,asset.original)),original);assert.equal(Object.values(asset.variants).flat().length,12);const image=await sharp(join(root,'public',asset.variants.portrait.at(-1))).metadata();assert.equal(image.width/image.height,0.8);
 await mkdir(join(root,'project/property-feeds/Existing/images/x'),{recursive:true});const prop=join(root,'project/property-feeds/Existing/images/x/image.jpg');await writeFile(prop,original);const s=seed(),old=legacy(s,s.team[0].portrait);const next=rebindWebsiteMedia(s,{old,replacement:asset,all:true,register:true});assert.equal(next.team[0].portrait,asset.variants.portrait.at(-1));assert.deepEqual(await readFile(prop),original);
 }finally{await rm(root,{recursive:true,force:true});}
});
