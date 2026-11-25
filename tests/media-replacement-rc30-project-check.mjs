// Optional integration check against an extracted CBPM WSET project; modifies only a temporary copy.
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {exportEditableProject,importEditableProject} from '../designer/core/project-archive.mjs';
import {readMediaCatalog} from '../designer/core/media-catalog.mjs';
import {importProjectImage} from '../designer/core/media-library.mjs';
import {rebindWebsiteMedia} from '../designer/core/media-references.mjs';
const source=process.argv[2];if(!source)throw Error('Provide an extracted CBPM project folder.');
const temp=await mkdtemp(join(tmpdir(),'wset-rc30-project-'));const root=join(temp,'project');
try{
 await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});const project=await readDesignerProject(root);
 const old=(await readMediaCatalog(project.site,root)).find(m=>m.src==='/assets/hero-square.webp');assert(old&&old.placements.length>1);
 const original=await readFile(join(root,'public',old.src));const newImage=await importProjectImage({root,source:join(root,'public/assets/hero-terrace.webp')});
 const next=rebindWebsiteMedia(project.site,{old,replacement:newImage,all:true,register:true});
 await persistDesignerProject({...project,site:next});const reopened=await readDesignerProject(root);assert.deepEqual(reopened.site,next);assert.deepEqual(await readFile(join(root,'public',old.src)),original);
 const archive=join(temp,'roundtrip.zip');await exportEditableProject({root,destination:archive});const imported=await importEditableProject({archive,projectsDir:join(temp,'imports')});assert.deepEqual((await readDesignerProject(imported.root)).site.media,next.media);
 const {renderDynamicSite}=await import(pathToFileURL(join(root,'src/lib/dynamic-site.mjs')).href);let count=0;
 for(const locale of next.languages.filter(l=>l.enabled!==false).map(l=>l.code))for(const page of next.sitePages.filter(p=>p.enabled!==false&&p.id!=='properties')){const html=renderDynamicSite({site:next,locale,page:page.id}).html;assert(!html.includes(`src="${old.src}"`));count++;}
 assert.deepEqual(await readFile(join(imported.root,newImage.original)),await readFile(join(root,newImage.original)));
 console.log(`PASS: save/reopen, editable ZIP round-trip, preserved originals and ${count} static page/language combinations using the website project's own renderer.`);
}finally{await rm(temp,{recursive:true,force:true});}
