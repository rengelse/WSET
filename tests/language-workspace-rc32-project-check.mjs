// Optional integration check using a temporary copy of an actual WSET project.
import assert from 'node:assert/strict';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {exportEditableProject,importEditableProject} from '../designer/core/project-archive.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {languageEntries,createLanguagePack} from '../designer/engines/cbpm-astro-v1/lib/i18n-core.mjs';
const source=process.argv[2];if(!source)throw Error('Provide an extracted WSET project folder.');
const temp=await mkdtemp(join(tmpdir(),'wset32-project-'));
try{const root=join(temp,'source');await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});const project=await readDesignerProject(root);const original=project.site;const code='nl',key='content.pages.home.title';assert(languageEntries(original,code).some(e=>e.key===key));
 const changed=applyEditorCommand(original,{action:'language:translate',locale:code,key,value:'RC32 test translation'}).site;
 const next=applyEditorCommand(changed,{action:'language:reorder',code:'nl',target:'en',after:false}).site;
 await persistDesignerProject({...project,site:next});const reopened=await readDesignerProject(root);assert.deepEqual(reopened.site,next);const zip=join(temp,'project.zip');await exportEditableProject({root,destination:zip});const imported=await importEditableProject({archive:zip,projectsDir:join(temp,'imports')});const after=(await readDesignerProject(imported.root)).site;assert.deepEqual(after.languages,next.languages);assert.deepEqual(createLanguagePack(after,code),createLanguagePack(next,code));assert.deepEqual(after.media,original.media);assert.deepEqual(after.propertyModules,original.propertyModules);console.log('PASS: save/reopen and actual editable project ZIP round-trip, translation, language order, media and property settings preserved.');
}finally{await rm(temp,{recursive:true,force:true});}
