import assert from 'node:assert/strict';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {exportEditableProject,importEditableProject} from '../designer/core/project-archive.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {listLocalFeeds} from '../designer/core/local-property-feeds.mjs';
const source=process.argv[2];if(!source)throw Error('Provide an extracted project folder.');
const temp=await mkdtemp(join(tmpdir(),'wset33-check-'));
try{const root=join(temp,'source');await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});const project=await readDesignerProject(root);const before=await listLocalFeeds(root);const next=applyEditorCommand(project.site,{action:'property-draft:save',data:{type:'Villa',town:'Rojales',currency:'EUR',price:'449000',desc:{no:'Privat kladd, skal ikke i mal.'}}}).site;await persistDesignerProject({...project,site:next});assert.deepEqual((await readDesignerProject(root)).site.propertyDrafts,next.propertyDrafts);assert.deepEqual(await listLocalFeeds(root),before);
 for(const kind of ['project','template']){const zip=join(temp,kind+'.zip');await exportEditableProject({root,destination:zip,kind});const imported=await importEditableProject({archive:zip,projectsDir:join(temp,'imports')});const after=(await readDesignerProject(imported.root)).site;assert.deepEqual(after.propertyDrafts,kind==='project'?next.propertyDrafts:undefined);assert.deepEqual(after.propertyModules,project.site.propertyModules);}
 console.log('PASS: actual project save/reopen, project ZIP preserves draft, template ZIP excludes draft, local feed inventory unchanged.');
}finally{await rm(temp,{recursive:true,force:true});}
