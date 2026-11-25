import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {validateSiteProject} from '../designer/engines/cbpm-astro-v1/lib/site-project.mjs';
const seed=migrateProjectForDesigner(JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const save=(site,data,id)=>applyEditorCommand(site,{action:'property-draft:save',id,data}).site;
const data={type:'Villa',town:'Rojales',country:'Spain',price:'449000',currency:'EUR',price_freq:'sale',built:'142',beds:'3',latitude:'38.05',longitude:'-0.72',desc:{no:'En bolig & terrasse.',en:'A home.'},features:'Terrace\nGarage',pool:true};
test('RC33 creates stable unique local draft IDs, edits and deletes without changing website content',()=>{
 const a=save(seed,data),first=a.propertyDrafts.items[0],b=save(a,data),second=b.propertyDrafts.items[1];assert.notEqual(first.id,second.id);assert.notEqual(first.reference,second.reference);
 const c=save(b,{...data,price:'450000'},first.id);assert.equal(c.propertyDrafts.items[0].reference,first.reference);assert.equal(c.propertyDrafts.items[0].data.price,'450000');assert.equal(c.propertyDrafts.items[1].data.price,'449000');assert.equal(c.propertyDrafts.items[0].data.desc.en,'A home.');
 const d=applyEditorCommand(c,{action:'property-draft:delete',id:first.id}).site;assert.equal(d.propertyDrafts.items.length,1);delete d.propertyDrafts;assert.deepEqual(d,seed);
 assert.equal(validateSiteProject(c,{checkAssets:false}).ok,true);
});
test('RC33 accepts incomplete draft and rejects unsafe/invalid values, arbitrary publication fields and unrecognized IDs',()=>{
 const a=save(seed,{});assert.equal(a.propertyDrafts.items[0].data.price,'');
 for(const bad of [{latitude:'91'},{longitude:'-181'},{price:'-1'},{beds:'2.5'},{currency:'<x>'},{desc:{no:'<script>x</script>'}}])assert.throws(()=>save(seed,{...data,...bad}));
 assert.throws(()=>save(seed,data,'missing'));
 const b=save(seed,{...data,publicationStatus:'published',new_build:'1',images:['../x']});assert.equal(b.propertyDrafts.items[0].data.publicationStatus,undefined);assert.equal(b.propertyDrafts.items[0].data.images,undefined);assert.equal(b.propertyDrafts.items[0].data.new_build,undefined);
});
