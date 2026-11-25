import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {normalizePropertyDraft,applyPropertyDraftCommand} from '../designer/core/property-drafts.mjs';
import {importDraftImages,readDraftImage,verifyDraftPhotos,DRAFT_IMAGE_DIR} from '../designer/core/property-draft-images.mjs';
import {startDesignerPreview} from '../designer/core/preview-server.mjs';
const a={file:'a1234567-abcd-1234-abcd-123456789abc.webp',name:'one.jpg',width:100,height:100,role:'photo'},b={...a,file:'b1234567-abcd-1234-abcd-123456789abc.webp',role:'floorplan'};
const seed={languages:[{code:'no'},{code:'en'}]};
test('RC34 validates photo identities, ordering, roles and keeps legacy drafts compatible',()=>{
 const save=(s,data,id)=>applyPropertyDraftCommand(s,{action:'property-draft:save',data,id});
 const s=save(seed,{photos:[a,b],latitude:'38.1',longitude:'-0.7',desc:{no:'Bolig'}});const r=s.propertyDrafts.items[0];assert.deepEqual(r.data.photos,[a,b]);assert.deepEqual(save(s,{photos:[b,a],desc:{en:'Home'}},r.id).propertyDrafts.items[0].data.photos,[b,a]);assert.deepEqual(save(s,{desc:{en:'Home'}},r.id).propertyDrafts.items[0].data.photos,[a,b]);assert.deepEqual(save(s,{photos:[]},r.id).propertyDrafts.items[0].data.photos,[]);
 for(const photos of [[a,a],[{...a,file:'../../x.webp'}],[{...a,role:'script'}],[{...a,width:2000}]])assert.throws(()=>normalizePropertyDraft({photos},seed.languages));assert.throws(()=>normalizePropertyDraft({latitude:'90.01'},seed.languages));
});
test('RC34 draft photo route uses random capability, rejects unsafe paths and symlinks; map assets from editor only',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset34-'));let server;try{await mkdir(join(root,DRAFT_IMAGE_DIR),{recursive:true});await writeFile(join(root,DRAFT_IMAGE_DIR,a.file),Buffer.from('test image'));await verifyDraftPhotos(root,[a]);await assert.rejects(()=>readDraftImage(root,'../website.json'));await symlink(join(root,DRAFT_IMAGE_DIR,a.file),join(root,DRAFT_IMAGE_DIR,b.file));await assert.rejects(()=>readDraftImage(root,b.file));
 server=await startDesignerPreview({getSite:()=>seed,getRoot:()=>root});const url=server.url+'/__wset-draft-image/';assert.equal((await fetch(url+'wrong/'+a.file)).status,404);assert.equal(await (await fetch(url+server.draftImageToken+'/'+a.file)).text(),'test image');assert.equal((await fetch(url+server.draftImageToken+'/'+b.file)).status,404);const map=await fetch(server.url+'/__wset-draft-map');assert.equal(map.status,200);assert.match(await map.text(),/__wset-draft-maplibre.js/);assert.match(await (await fetch(server.url+'/__wset-draft-map.js')).text(),/wset-draft-map-position/);
 }finally{if(server)await server.close();await rm(root,{recursive:true,force:true});}
});
let sharp;try{sharp=(await import('sharp')).default;}catch{}
test('RC34 real image conversion, private storage and unchanged original',{skip:!sharp},async()=>{const root=await mkdtemp(join(tmpdir(),'wset34-img-'));try{await mkdir(join(root,'project'));const source=join(root,'source.png');await sharp({create:{width:2200,height:1100,channels:3,background:'#abc'}}).png().toFile(source);const original=await readFile(source);const [p]=await importDraftImages({root,sources:[source],sharpModule:sharp});assert.equal(p.width,1920);assert.equal(p.height,960);assert.equal((await sharp(await readDraftImage(root,p.file)).metadata()).format,'webp');assert.deepEqual(await readFile(source),original);}finally{await rm(root,{recursive:true,force:true});}});
