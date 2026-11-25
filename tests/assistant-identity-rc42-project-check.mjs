// Optional integration check against an actual editable website and module ZIP.
// Uses the project's original offline renderer/staging/packaging scripts, not Astro.
// MapLibre and Astro placeholders are isolated test fixtures; do not deploy output.
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readDesignerProject,persistDesignerProject} from '../designer/core/project-storage.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {generateWebsite,zipFiles} from '../designer/core/website-generator.mjs';
import {importAssistantModule} from '../designer/core/module-library.mjs';
const [source,archive]=process.argv.slice(2);if(!source||!archive)throw Error('Provide extracted CBPM project and Smart Assistant ZIP.');
const base=await mkdtemp(join(tmpdir(),'wset42-export-'));
try{
 const root=join(base,'project');await cp(resolve(source),root,{recursive:true,filter:p=>!p.includes('/node_modules')});
 const loaded=await readDesignerProject(root);let site=loaded.site;
 const edit=(field,value,locale='no')=>{site=applyEditorCommand(site,{action:'assistant:identity',field,value,locale}).site;};
 site=applyEditorCommand(site,{action:'assistant:update',field:'enabled',value:true}).site;
 site.sitePages.find(p=>p.id==='properties').enabled=true;
 edit('profile','alba');edit('avatar','/assets/hero.webp');edit('welcome','Hei, jeg er {name}.');edit('welcome','Hi, I am {name}.','en');edit('shortcuts','Boliger | Vis boliger nå');
 const saved=await persistDesignerProject({...loaded,site});
 const module=await importAssistantModule({archive:resolve(archive),libraryRoot:join(base,'modules')});
 const astro=join(root,'node_modules/astro'),maps=join(root,'node_modules/maplibre-gl/dist');await mkdir(join(astro,'bin'),{recursive:true});await mkdir(maps,{recursive:true});
 await writeFile(join(astro,'package.json'),JSON.stringify({bin:{astro:'./bin/astro.mjs'}}));await writeFile(join(astro,'bin/astro.mjs'),'// test only');for(const ext of ['js','css'])await writeFile(join(maps,'maplibre-gl.'+ext),'/* test only */');
 const env={...process.env,WSET_ASSISTANT_MODULE_ROOT:module.root,WSET_WEB_ROOT:'www'};
 const run=(script)=>execFileSync('node',['scripts/'+script+'.mjs'],{cwd:root,encoding:'utf8',env});
 const destination=join(base,'export');
 await generateWebsite({root,destination,moduleRoot:module.root,expectedRevision:saved.revision,runner:async()=>{
  run('generate-offline-preview');await cp(join(root,'preview-offline'),join(root,'dist'),{recursive:true});
  // Offline preview uses offline configuration; switch it to the exact original live JSON fields for this test runner.
  async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await walk(path);else if(e.name.endsWith('.html')){const raw=await readFile(path,'utf8'),html=raw.replace(/(<script\b[^>]*id="wset-smart-assistant-config"[^>]*>)([\s\S]*?)(<\/script>)/g,(_,a,j,z)=>{const c=JSON.parse(j);c.preview=false;c.live=true;c.endpoint='/api/assistant/api.php';return a+JSON.stringify(c)+z;});await writeFile(path,html);}}}
  await walk(join(root,'dist'));await cp(join(module.root,'frontend/smart-assistant-live.js'),join(root,'dist/smart-assistant-live.js'));
  for(const script of ['stage-contact-backend','stage-property-backend','package-manual-site'])run(script);
 }});
 const pub=zipFiles(await readFile(join(destination,'01-WWW.zip'))),priv=zipFiles(await readFile(join(destination,'02-UTENFOR-WWW.zip'))),manifest=JSON.parse(pub.get('cbpm-publication-manifest.json'));
 let scripts=0;for(const [p,b] of pub){if(!/\.html$|^api\/property\/shell\/[^/]+\/[^/]+\.php$/.test(p))continue;const m=b.toString().match(/<script\b[^>]*id="wset-smart-assistant-config"[^>]*>([\s\S]*?)<\/script>/);if(!m)continue;const c=JSON.parse(m[1]);assert.equal(c.identity.profile,'alba');assert.equal(c.identity.avatar,'/assets/images/hero.webp');assert.equal(c.preview,false);assert.equal(c.endpoint,'/api/assistant/api.php');assert.equal(manifest.files[p],createHash('sha256').update(b).digest('hex'));scripts++;}
 assert.ok(scripts>20);assert.ok(pub.has('assets/images/hero.webp'));assert.ok(priv.has('app/assistant/entry-api.php'));assert.ok(pub.has('api/assistant/api.php'));
 const knowledge=JSON.parse(priv.get('app/assistant/snapshot/website.json'));console.log(JSON.stringify({configs:scripts,publicFiles:pub.size,privateFiles:priv.size,services:knowledge.services.length,staff:knowledge.staff.length,pages:knowledge.pages.length,module:manifest.modules},null,2));
 console.log('PASS: actual CBPM staging, two ZIPs, identity configuration, avatar, hashes and private/public separation. Offline renderer and test-only dependency stubs; not Astro/browser/live.');
}finally{await rm(base,{recursive:true,force:true});}
