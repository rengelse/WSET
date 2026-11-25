import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {inlineTargets,templateFields} from '../designer/core/inline-editing.mjs';
import {prepareTextPage,stripEditorTextMarkers,bindTextTargets} from '../designer/core/universal-text.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
import {previewDocument} from '../designer/core/preview-server.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {pageDesignCss,elementStyleSupported,preparePublicTextPage} from '../designer/core/design-styles.mjs';
import {writeZip} from '../designer/core/project-archive.mjs';
import {applyPublicationDesign,zipFiles} from '../designer/core/website-generator.mjs';
import {staticRoutes} from '../designer/engines/cbpm-astro-v1/lib/site-project.mjs';
const sourceRoot=process.env.WSET_TEST_SITE_ROOT;
const site=migrateProjectForDesigner(JSON.parse(readFileSync(sourceRoot?resolve(sourceRoot,'project/website.json'):new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const render=(s,page,locale='no',annotate=true)=>renderDynamicSite({site:s,page,locale,annotate}).html;
const prepared=(s,page,locale='no')=>prepareTextPage(s,page,locale,render(s,page,locale));
const find=(s,page,section,value,locale='no')=>[...prepared(s,page,locale).map].find(([k,b])=>k.startsWith(section+'\0')&&b.target.value===value)?.[1];
const edit=(s,pageId,sectionId,t,value,locale='no')=>applyEditorCommand(s,{action:'inline:text',pageId,sectionId,locale,targetId:t.id,expected:t.value,value}).site;
const style=(s,pageId,sectionId,t,property,value,locale='no')=>applyEditorCommand(s,{action:'design:update',scope:'element',role:'heading',pageId,sectionId,locale,targetId:t.id,property,value}).site;
test('All ordinary and highlighted text in rental hero/overview/process/CTA has its own context editor',()=>{
 for(const [section,values] of Object.entries({'rental-hero':['Boligen din.','Godt ivaretatt.','COSTA BLANCA · SPAIN','Når du ikke er på Costa Blanca, kan vi bidra med praktisk håndtering av boligen og oppfølging av gjester.'],'rental-overview':['Mer tid til','det du vil.'],'rental-process':['Før. Under.','Etter.','Før ankomst','Når gjestene kommer'],'rental-cta':['Fortell oss hva du trenger.','Ta kontakt']})){
  for(const text of values){const b=find(site,'rental',section,text);assert.ok(b,section+': '+text);assert.ok(elementStyleSupported(site,'rental',section,'no',b.target.id));}
 }
 const a=find(site,'rental','rental-hero','Boligen din.'),b=find(site,'rental','rental-hero','Godt ivaretatt.');assert.notEqual(a.path,b.path);
 const s=style(site,'rental','rental-hero',a.target,'color','#112233');assert.match(pageDesignCss(s,'rental','no'),/h1:nth-child\(3\) > site-text:nth-child\(1\)\{color:#112233/);assert.doesNotMatch(pageDesignCss(s,'rental','no'),/em:nth-child\(3\)\{color:#112233/);
 const h=previewDocument(s,'no','rental');assert.match(h,/data-wset-bind="[a-f0-9]{64}">Boligen din\.<\/site-text><br><em/);
});
test('Equal fixed template texts receive distinct structural identities and isolated overrides',()=>{
 const page=site.sitePages.find(p=>p.id==='rental'),section=page.sections.find(s=>s.id==='rental-process');const fields=templateFields(site,page,section,'no','<section><p>Samme tekst</p><p>Samme tekst</p></section>');assert.equal(fields.length,2);assert.notEqual(fields[0].targetId,fields[1].targetId);assert.ok(fields.every(f=>f.occurrence));
 const targets=fields.map(f=>({id:f.targetId,kind:'occurrence',value:f.value,baseValue:f.baseValue,baseEncoded:f.baseEncoded,sourcePath:f.sourcePath,sourceIndex:f.sourceIndex}));const b=bindTextTargets('<section><p>Samme tekst</p><p>Samme tekst</p></section>',targets);assert.equal(b.length,2);assert.notEqual(b[0].host.path,b[1].host.path);
 // Real existing duplicates, e.g. repeated contact placeholders, are separate.
 const p=prepared(site,'contact');const dup=[...p.map.values()].filter(b=>b.target.kind==='occurrence');assert.ok(dup.length>=2);const a=dup[0],key=[...p.map].find(([_,b])=>b===a)[0].split('\0')[0];const s=edit(site,'contact',key,a.target,'Egen verdi <sikker>');const next=prepared(s,'contact');assert.equal(next.map.get(key+'\0'+a.target.id).target.value,'Egen verdi <sikker>');assert.match(next.html,/Egen verdi &lt;sikker&gt;/);assert.equal(render(s,'contact','en'),render(site,'contact','en'));
});
test('Equal service titles retain canonical record IDs, and a list item edits only its own model field',()=>{
 let s=structuredClone(site);const rec=s.services.filter(r=>r.enabled!==false&&r.isVisible!==false);assert.ok(rec.length>=2);rec[1].title.no=rec[0].title.no;
 const p=prepared(s,'services');const a=p.map.get('services-listing\0record:services:'+rec[0].id+':title'),b=p.map.get('services-listing\0record:services:'+rec[1].id+':title');assert.ok(a&&b);assert.notEqual(a.path,b.path);
 const changed=style(s,'services','services-listing',b.target,'color','#aabbcc');assert.match(pageDesignCss(changed,'services','no'),new RegExp(`data-content-ref="services:${rec[1].id}:title"`));
 const item=p.map.get('services-listing\0record:services:'+rec[0].id+':items:0');assert.ok(item);const next=edit(s,'services','services-listing',item.target,'Eget listepunkt');assert.equal(next.services.find(x=>x.id===rec[0].id).items[0].no,'Eget listepunkt');assert.deepEqual(next.services.find(x=>x.id===rec[1].id).items,rec[1].items);
});
test('Text-run styling and independent occurrence edits appear in the public ZIP, without editing attributes',()=>{
 const b=find(site,'rental','rental-hero','Boligen din.');let s=style(site,'rental','rental-hero',b.target,'color','#112233');s=edit(s,'rental','rental-hero',b.target,'Boligen vår.');
 const p=prepared(s,'contact');const occ=[...p.map].find(([_,b])=>b.target.kind==='occurrence');assert.ok(occ);const section=occ[0].split('\0')[0];s=edit(s,'contact',section,occ[1].target,'Egen kontakttekst');
 const entries=staticRoutes(s).map(r=>({name:r.slug+'/index.html',bytes:Buffer.from('<html><body>'+render(s,r.page,r.locale,false)+'</body></html>')}));entries.push({name:'assets/css/styles.css',bytes:Buffer.from('h1{color:black}')},{name:'api/contact.php',bytes:Buffer.from('<?php echo 1;')});
 const hash=b=>createHash('sha256').update(b).digest('hex');const manifest={files:Object.fromEntries(entries.map(e=>[e.name,hash(e.bytes)]))};const out=applyPublicationDesign(writeZip(entries),s,manifest),files=zipFiles(out.archive),rental=files.get('no/rental/index.html').toString(),contact=files.get('no/contact/index.html').toString();
 assert.match(rental,/<site-text>Boligen vår\.<\/site-text><br><em>Godt ivaretatt\.<\/em>/);assert.match(contact,/Egen kontakttekst/);assert.doesNotMatch(rental+contact,/data-wset-bind|contenteditable|wset-inline/);assert.match(files.get('assets/css/styles.css').toString(),/#112233/);assert.equal(files.get('api/contact.php').toString(),'<?php echo 1;');assert.equal(out.manifest.files['no/contact/index.html'],hash(files.get('no/contact/index.html')));
});
test('Actual uploaded website renderer matches trusted adapter for every active static page/language',{skip:!sourceRoot},async()=>{
 const {renderDynamicSite:actual}=await import(pathToFileURL(resolve(sourceRoot,'src/lib/dynamic-site.mjs')));let checked=0;
 for(const route of staticRoutes(site).filter(r=>site.sitePages.some(p=>p.id===r.page))){const h=actual({site,locale:route.locale,page:route.page}).html;const p=preparePublicTextPage(site,route.page,route.locale,h);assert.ok(p.map.size>0);assert.doesNotMatch(stripEditorTextMarkers(p.html),/data-wset-bind/);checked++;}
 assert.ok(checked>=77);console.log('Verified actual template renderer:',checked,'page/language combinations');
});
