import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localPropertyCatalog} from '../designer/core/local-property-catalog.mjs';
import {exampleOwnXML} from '../designer/core/property-xml.mjs';

test('Property workspace counts categories globally and filters full XML catalogue before pagination',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wset25-catalog-'));
 try{
  const base=join(root,'project','property-feeds');
  for(const cat of ['New','Existing'])await mkdir(join(base,cat),{recursive:true});
  const example=exampleOwnXML();const entry=example.match(/<property>[\s\S]*?<\/property>/)[0];
  const make=(n,city,type)=>entry.replaceAll('egen-001','id-'+n).replaceAll('CBPM-001','REF-'+n).replaceAll('Torrevieja',city).replaceAll('Apartment',type).replace(/<images>[\s\S]*?<\/images>/,'');
  const wrap=entries=>`<root><kyero><feed_version>3</feed_version></kyero>${entries.join('')}</root>`;
  await writeFile(join(base,'New','new.xml'),wrap(Array.from({length:32},(_,i)=>make(i,i%2?'Rojales':'Torrevieja',i%2?'Villa':'Apartment'))));
  await writeFile(join(base,'Existing','old.xml'),wrap([make(0,'Rojales','Villa'),make(1,'Guardamar','Apartment')]));
  const p=await localPropertyCatalog(root,{category:'New',pageSize:10,page:2});
  assert.deepEqual(p.counts,{New:32,Existing:2});assert.equal(p.total,32);assert.equal(p.allTotal,34);assert.equal(p.pages,4);assert.equal(p.records.length,10);assert.ok(p.records.every(r=>r.category==='New'));assert.deepEqual(p.filters.types,['Apartment','Villa']);
  const f=await localPropertyCatalog(root,{category:'New',city:'Rojales',type:'Villa',pageSize:10,page:2});assert.equal(f.total,16);assert.equal(f.records.length,6);assert.deepEqual(f.counts,p.counts);assert.ok(f.records.every(r=>r.listing.city==='Rojales'&&r.listing.type==='Villa'));
  const q=await localPropertyCatalog(root,{category:'Existing',query:'REF-0'});assert.equal(q.total,1);assert.equal(q.records[0].identity.sourceCode,'existing--old');
  const empty=await localPropertyCatalog(root,{category:'Existing',city:'Torrevieja'});assert.equal(empty.total,0);assert.equal(empty.page,1);assert.deepEqual(empty.counts,p.counts);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('Private local image preview serves the approved path and rejects paths outside the property image folder',async()=>{
 const {startDesignerPreview}=await import('../designer/core/preview-server.mjs');
 const root=await mkdtemp(join(tmpdir(),'wset25-images-'));
 const image=Buffer.from('test-image-bytes');
 const dir=join(root,'project','property-feeds','Existing','images','CBPM-001');
 await mkdir(dir,{recursive:true});await writeFile(join(dir,'01.webp'),image);
 const server=await startDesignerPreview({getSite:()=>({}),getRoot:()=>root});
 try{
  const response=await fetch(server.url+'/__wset-property-image/CBPM-001/01.webp');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  assert.equal((await fetch(server.url+'/__wset-property-image/CBPM-001/missing.webp')).status,404);
  assert.equal((await fetch(server.url+'/__wset-property-image/CBPM-001/..%2F..%2Fwebsite.json')).status,404);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
