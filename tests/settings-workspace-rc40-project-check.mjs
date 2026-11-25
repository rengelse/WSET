import assert from 'node:assert/strict';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {exportEditableProject,importEditableProject} from '../designer/core/project-archive.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
import {listLocalFeeds} from '../designer/core/local-property-feeds.mjs';
const source=process.argv[2];if(!source)throw Error('Provide an extracted project folder.');
const temp=await mkdtemp(join(tmpdir(),'wset40-check-'));
try{
 const root=join(temp,'source');await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});
 const project=await readDesignerProject(root);const before=await listLocalFeeds(root);const render=s=>renderDynamicSite({site:s,locale:'no',page:'home'});
 let next=project.site;const update=command=>{next=applyEditorCommand(next,command).site;};
 const baseline=render(next);
 for(const [field,value] of Object.entries({registrationNumber:'B12345678',streetAddress:'Calle Mayor 1',postalCode:'03170',city:'Rojales',country:'España'}))update({action:'brand:update',field,value});
 assert.deepEqual(render(next),baseline,'Optional company details must not unexpectedly change existing template output');
 update({action:'page:update',id:'home',field:'seoTitle',locale:'no',value:'Test villa'});
 update({action:'page:update',id:'home',field:'seoDescription',locale:'no',value:'Test beskrivelse'});
 assert.match(render(next).title,/Test villa/);assert.equal(render(next).description,'Test beskrivelse');assert.equal(render(next).html,baseline.html);
 const res=await persistDesignerProject({...project,site:next});assert(res.backup);const reopened=await readDesignerProject(root);assert.deepEqual(reopened.site.brand,next.brand);assert.deepEqual(reopened.site.sitePages,next.sitePages);assert.deepEqual(await listLocalFeeds(root),before);
 const zip=join(temp,'project.zip');await exportEditableProject({root,destination:zip,kind:'project'});const imported=await importEditableProject({archive:zip,projectsDir:join(temp,'imports')});const after=(await readDesignerProject(imported.root)).site;assert.deepEqual(after.brand,next.brand);assert.deepEqual(after.sitePages,next.sitePages);assert.deepEqual(after.propertyModules,project.site.propertyModules);
 console.log('PASS: actual CBPM save/reopen, backup, full project ZIP, SEO renderer, unchanged template HTML and local XML inventory.');
}finally{await rm(temp,{recursive:true,force:true});}
