import assert from 'node:assert/strict';
import {cp,mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {exportEditableProject,importEditableProject} from '../designer/core/project-archive.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {importDraftImages,DRAFT_IMAGE_DIR} from '../designer/core/property-draft-images.mjs';
import {listLocalFeeds} from '../designer/core/local-property-feeds.mjs';
const source=process.argv[2];if(!source)throw Error('Provide an extracted project folder.');
const temp=await mkdtemp(join(tmpdir(),'wset33-check-'));
try{const root=join(temp,'source');await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});const project=await readDesignerProject(root);const before=await listLocalFeeds(root);const sharp=(await import('sharp')).default;const sourceImage=join(temp,'source.png');await sharp({create:{width:400,height:300,channels:3,background:'#bbc'}}).png().toFile(sourceImage);const photos=await importDraftImages({root,sources:[sourceImage]});const next=applyEditorCommand(project.site,{action:'property-draft:save',data:{photos,type:'Villa',town:'Rojales',currency:'EUR',price:'449000',desc:{no:'Privat kladd, skal ikke i mal.'}}}).site;await persistDesignerProject({...project,site:next});assert.deepEqual((await readDesignerProject(root)).site.propertyDrafts,next.propertyDrafts);assert.deepEqual(await listLocalFeeds(root),before);
 for(const kind of ['project','template']){const zip=join(temp,kind+'.zip');await exportEditableProject({root,destination:zip,kind});const imported=await importEditableProject({archive:zip,projectsDir:join(temp,'imports')});const after=(await readDesignerProject(imported.root)).site;assert.deepEqual(after.propertyDrafts,kind==='project'?next.propertyDrafts:undefined);assert.deepEqual(after.propertyModules,project.site.propertyModules);if(kind==='project')assert.deepEqual(await readFile(join(imported.root,DRAFT_IMAGE_DIR,photos[0].file)),await readFile(join(root,DRAFT_IMAGE_DIR,photos[0].file)));else await assert.rejects(()=>readFile(join(imported.root,DRAFT_IMAGE_DIR,photos[0].file)),{code:'ENOENT'});}
 console.log('PASS: actual CBPM project save/reopen, project ZIP preserves draft and photo, template ZIP excludes both, local feed inventory unchanged.');
}finally{await rm(temp,{recursive:true,force:true});}
