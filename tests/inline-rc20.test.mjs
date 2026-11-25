import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {inlineTargets,templateFields} from '../designer/core/inline-editing.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {previewDocument} from '../designer/core/preview-server.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
const site=migrateProjectForDesigner(JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const edit=(s,pageId,sectionId,locale,target,value)=>applyEditorCommand(s,{action:'inline:text',pageId,sectionId,locale,targetId:target.id,expected:target.value,value}).site;
const pick=(s,p,l,section,fn)=>inlineTargets(s,p,l)[section].find(fn);
test('Edit highlighted hero text without losing markup or other languages; safe literal input',()=>{
 const t=pick(site,'home','no','home-hero',t=>t.kind==='hero'&&t.value==='Hele året.');assert.ok(t);
 const next=edit(site,'home','home-hero','no',t,'Hele sesongen <trygt>.');
 assert.equal(next.pages.home.heroTitle.no,site.pages.home.heroTitle.no.replace('Hele året.','Hele sesongen &lt;trygt&gt;.'));
 assert.equal(next.pages.home.heroTitle.en,site.pages.home.heroTitle.en);
 assert.match(renderDynamicSite({site:next,locale:'no',page:'home'}).html,/<em>Hele sesongen &lt;trygt&gt;\.<\/em>/);
 assert.throws(()=>edit(next,'home','home-hero','no',t,'Stale'),/endret/);
});
test('Rental template card is canonical, translated independently, safe, and keeps stable target ID',()=>{
 const t=pick(site,'rental','no','rental-process',t=>t.kind==='template'&&t.value==='Før ankomst');assert.ok(t);
 const next=edit(site,'rental','rental-process','no',t,'Før innsjekk & kontroll');
 const actual=renderDynamicSite({site:next,locale:'no',page:'rental'}).html;
 assert.match(actual,/<h3>Før innsjekk &amp; kontroll<\/h3>/);assert.match(actual,/<h3>Når gjestene kommer<\/h3>/);
 assert.equal(renderDynamicSite({site:next,locale:'en',page:'rental'}).html,renderDynamicSite({site,locale:'en',page:'rental'}).html);
 const same=pick(next,'rental','no','rental-process',x=>x.id===t.id);assert.equal(same.value,'Før innsjekk & kontroll');
 const p=site.sitePages.find(p=>p.id==='rental'),fields=templateFields(next,p,p.sections.find(s=>s.id==='rental-process'),'no');assert.equal(fields.find(x=>x.targetId===t.id).group,'Kort 01');assert.equal(fields.find(x=>x.targetId===t.id).label,'Overskrift');
});
test('Custom button and text update actual fields, not HTML overrides',()=>{
 const s=structuredClone(site);s.sitePages.find(p=>p.id==='home').sections.push({id:'test-cta',type:'cta',enabled:true,title:{no:'Test'},text:{no:'Tekst'},buttonText:{no:'Kontakt nå'},target:'contact'});
 const t=pick(s,'home','no','test-cta',x=>x.field==='buttonText');const next=edit(s,'home','test-cta','no',t,'Send oss en melding');assert.match(renderDynamicSite({site:next,locale:'no',page:'home'}).html,/>Send oss en melding /);assert.equal(next.sitePages.find(p=>p.id==='home').sections.at(-1).buttonText.no,'Send oss en melding');
});
test('Service edit updates record, never template override; forged target and wrong locale rejected',()=>{
 const t=pick(site,'services','no','services-listing',x=>x.kind==='record'&&x.field==='title');assert.ok(t);
 const next=edit(site,'services','services-listing','no',t,'Ny tjeneste');assert.equal(next.services.find(r=>r.id===t.recordId).title.no,'Ny tjeneste');assert.deepEqual(next.templateTexts,site.templateTexts);
 assert.throws(()=>edit(site,'services','services-listing','xx',t,'Wrong'),/endret/);assert.throws(()=>edit(site,'services','services-listing','no',{...t,id:'record:services:fake:title'},'Wrong'),/endret/);
});
test('Duplicate template text not offered as direct edit; public renderer has no inline metadata',()=>{
 const p=site.sitePages.find(p=>p.id==='rental'),s=p.sections.find(s=>s.id==='rental-process');const entries=templateFields(site,p,s,'no','<section><p>Samme tekst</p><p>Samme tekst</p></section>');assert.equal(entries[0].unique,false);
 const preview=previewDocument(site,'no','home');assert.match(preview,/"inline":/);const pub=renderDynamicSite({site,locale:'no',page:'home'}).html;assert.doesNotMatch(pub,/wset-inline|"inline":|contenteditable/);
});
