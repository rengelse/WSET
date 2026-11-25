import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {legacyRenderer,createRendererRegistry,withTemplateRenderer,activeRenderer,renderDynamicSite,propertyModulePreview} from '../designer/core/renderer-runtime.mjs';
import {legacyTemplateDescriptor,assertSupportedTemplate} from '../designer/core/template-contract.mjs';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {previewDocument,startDesignerPreview} from '../designer/core/preview-server.mjs';
import {inlineTargets} from '../designer/core/inline-editing.mjs';
import {preparePublicTextPage,pageDesignCss} from '../designer/core/design-styles.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {prepareTextPage} from '../designer/core/universal-text.mjs';
import {validateSiteProject} from '../designer/engines/cbpm-astro-v1/lib/site-project.mjs';
import {generateWebsite} from '../designer/core/website-generator.mjs';
import {mediaReferences} from '../designer/core/media-references.mjs';
const site=migrateProjectForDesigner(JSON.parse(await readFile(new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
const base=legacyTemplateDescriptor('1.4.4-rc.28');
const technical={...base,id:'property.technical-fixture',name:'Technical fixture'};
// Test-only adapter: different root classes, record element types and header markup.
// No new commercial template or executable archive entry is installed.
const adapt=r=>({...r,html:r.html.replace(/<header\b/,'<header data-technical-renderer="true"').replaceAll('class="page-hero"','class="technical-hero"').replaceAll('class="detail-card reveal"','class="technical-tile reveal"').replace(/<h3 (data-content-ref="services:[^"<>]+:title")>([\s\S]*?)<\/h3>/g,'<strong $1>$2</strong>')});
const alternative={...legacyRenderer,id:technical.id,renderPage:args=>adapt(legacyRenderer.renderPage(args)),renderSource:args=>adapt(legacyRenderer.renderSource(args))};
const registry=createRendererRegistry([legacyRenderer,alternative]);
const using=(fn)=>withTemplateRenderer(technical,fn,{registry});
const args={site,page:'rental',locale:'no',annotate:true};
const legacy=legacyRenderer.renderPage(args).html;
const getMap=html=>JSON.parse(html.match(/<script id="cbpm-editor-map" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('Renderer registration requires full contract and exact identity; no archive can opt into a test adapter',()=>{
 assert.throws(()=>createRendererRegistry([{...legacyRenderer,contractVersion:2}]),/rendererkontrakt/);
 assert.throws(()=>createRendererRegistry([{...legacyRenderer,renderSource:null}]),/rendererkontrakt/);
 assert.throws(()=>createRendererRegistry([legacyRenderer,legacyRenderer]),/Duplisert/);
 assert.throws(()=>withTemplateRenderer(technical,()=>assert.fail('must not execute')),/støttes ikke/);
 assert.throws(()=>assertSupportedTemplate(technical),/støttes ikke/);
 assert.throws(()=>withTemplateRenderer({...technical,engine:'wrong'},()=>assert.fail('must not execute'),{registry}),/støttes ikke/);
 assert.equal(withTemplateRenderer(base,()=>renderDynamicSite(args).html),legacy);
});
test('Adapter selection is isolated across async operations and restored even after an error',async()=>{
 const result=await Promise.all([using(async()=>{await delay(10);return renderDynamicSite(args).html;}),withTemplateRenderer(base,async()=>{await delay(20);return renderDynamicSite(args).html;},{registry})]);
 assert.match(result[0],/data-technical-renderer/);assert.doesNotMatch(result[1],/data-technical-renderer/);
 await assert.rejects(using(async()=>{throw Error('fixture error');}),/fixture error/);assert.equal(activeRenderer().id,base.id);assert.equal(renderDynamicSite(args).html,legacy);
});
test('Alternate HTML uses the same inline target, design rules and public structural verification',()=>using(()=>{
 const page='services',section='services-listing',locale='no',rec=site.services.find(r=>r.enabled!==false&&r.isVisible!==false),targetId=`record:services:${rec.id}:title`;
 const rendered=renderDynamicSite({site,page,locale,annotate:true}).html;
 assert.match(rendered,/technical-tile/);assert.match(rendered,/<strong data-content-ref="services:/);
 const binding=prepareTextPage(site,page,locale,rendered).map.get(section+'\0'+targetId);assert.ok(binding);assert.match(binding.path,/strong:nth-child/);
 const target=inlineTargets(site,page,locale)[section].find(t=>t.id===targetId);assert.ok(target);
 let next=applyEditorCommand(site,{action:'inline:text',pageId:page,sectionId:section,locale,targetId,expected:target.value,value:'Oppdatert teknisk tjeneste'}).site;
 assert.equal(next.services.find(r=>r.id===rec.id).title.no,'Oppdatert teknisk tjeneste');assert.notEqual(site.services.find(r=>r.id===rec.id).title.no,next.services.find(r=>r.id===rec.id).title.no);
 next=applyEditorCommand(next,{action:'design:update',scope:'element',role:'heading',pageId:page,sectionId:section,locale,targetId,property:'color',value:'#123456'}).site;
 const html=previewDocument(next,locale,page),map=getMap(html);assert.match(html,/Oppdatert teknisk tjeneste/);assert.ok(map.inline[section].some(t=>t.id===targetId&&t.styleable&&t.stylePath.includes('strong:nth-child')));
 const publicHtml=renderDynamicSite({site:next,page,locale}).html;assert.ok(preparePublicTextPage(next,page,locale,publicHtml).map.has(section+'\0'+targetId));
 assert.match(pageDesignCss(next,page,locale,{publicHtml}),/#123456/);
 const wrong=legacyRenderer.renderPage({site:next,page,locale}).html;assert.throws(()=>preparePublicTextPage(next,page,locale,wrong),/avviker/);
}));
test('Malformed renderer output and duplicate or foreign section identities fail without a legacy fallback',()=>{
 for(const change of [()=>({html:'bad'}),a=>({...legacyRenderer.renderPage(a),html:legacyRenderer.renderPage(a).html.replace('data-cbpm-section="rental-hero"','data-cbpm-section="unknown"')}),a=>({...legacyRenderer.renderPage(a),html:legacyRenderer.renderPage(a).html.replace('data-cbpm-section="rental-overview"','data-cbpm-section="rental-hero"')})]){
  const bad=createRendererRegistry([{...alternative,renderPage:change}]);assert.throws(()=>withTemplateRenderer(technical,()=>renderDynamicSite(args),{registry:bad}),/Rendereren returnerte ugyldig/);
 }
});
test('Image references follow the adapter image slots, not Mal 01 defaults',()=>{
 const custom=createRendererRegistry([{...alternative,imageSlots:{...legacyRenderer.imageSlots,hero:{...legacyRenderer.imageSlots.hero,rental:'technical-rental'}}}]);
 const fixture=structuredClone(site);if(fixture.pages.rental)delete fixture.pages.rental.heroImageUrl;delete fixture.sitePages.find(p=>p.id==='rental').sections.find(s=>s.id==='rental-hero').image;
 const getRef=()=>mediaReferences(fixture).find(r=>r.id==='section:rental:rental-hero:image').src;
 assert.notEqual(getRef(),'/assets/technical-rental.webp');assert.equal(withTemplateRenderer(technical,getRef,{registry:custom}),'/assets/technical-rental.webp');
});
test('Common property preview inherits the active template shell',()=>using(()=>{
 const html=propertyModulePreview(site,'no','all',{listings:[]});assert.match(html,/data-technical-renderer/);assert.match(html,/property-modules\.css/);
}));
async function makeRoot(){
 const root=await mkdtemp(join(tmpdir(),'wset46-'));await mkdir(join(root,'public','assets'),{recursive:true});await mkdir(join(root,'project'));
 const refs=new Set([...JSON.stringify(site).matchAll(/\/assets\/[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g|svg|avif)/g)].map(m=>m[0].slice(1)));
 for(const r of [...site.services,...site.projects])if(r.img)refs.add('assets/'+r.img+'.webp');
 for(const ref of refs)await writeFile(join(root,'public',ref),'test asset');
 await writeFile(join(root,'public','styles.css'),'/* project stylesheet */');await writeFile(join(root,'public','site.js'),'/* project script */');
 await writeFile(join(root,'project','template.json'),JSON.stringify(base));await writeFile(join(root,'project','website.json'),JSON.stringify(site));
 // Poison source confirms the live preview does not import project JS into Node.
 await mkdir(join(root,'src','lib'),{recursive:true});await writeFile(join(root,'src','lib','render-site.mjs'),'throw new Error("imported source must not execute");');
 assert.equal(validateSiteProject(site,{root}).ok,true);return root;
}
test('HTTP preview selects current adapter per request, handles draft pages and protects private files',async t=>{
 const root=await makeRoot();let descriptor=base,current=site;
 const server=await startDesignerPreview({getSite:()=>current,getRoot:()=>root,getTemplate:()=>descriptor,registry});t.after(async()=>{await server.close();await rm(root,{recursive:true,force:true});});
 const page=async path=>{const res=await fetch(server.url+path);return {status:res.status,body:await res.text(),csp:res.headers.get('content-security-policy')};};
 let p=await page('/no/rental/');assert.equal(p.status,200);assert.doesNotMatch(p.body,/data-technical-renderer/);
 descriptor=technical;p=await page('/no/rental/');assert.equal(p.status,200);assert.match(p.body,/data-technical-renderer/);assert.match(p.csp,/script-src 'self'/);
 current=structuredClone(site);current.sitePages.find(p=>p.id==='rental').enabled=false;
 p=await page('/__designer-preview/no/rental');assert.equal(p.status,200);assert.match(p.body,/data-technical-renderer/);
 assert.equal((await page('/no/rental/')).status,404);assert.equal((await page('/project/website.json')).status,404);assert.equal((await page('/src/lib/render-site.mjs')).status,404);assert.equal((await page('/styles.css')).body,'/* project stylesheet */');
 descriptor={...technical,id:'property.unknown'};p=await page('/no/');assert.equal(p.status,500);assert.match(p.body,/støttes ikke/);assert.doesNotMatch(p.body,/<main/);
});
test('Publication rejects changed or unsupported template identity before running build',async t=>{
 const root=await makeRoot();t.after(()=>rm(root,{recursive:true,force:true}));
 const runner=()=>assert.fail('build must not start');
 await assert.rejects(generateWebsite({root,destination:join(root,'exports'),expectedTemplate:{...base,templateVersion:'2.0.0'},runner}),/malidentitet er endret/);
 await writeFile(join(root,'project','template.json'),JSON.stringify(technical));await assert.rejects(generateWebsite({root,destination:join(root,'exports'),runner}),/støttes ikke/);
});
