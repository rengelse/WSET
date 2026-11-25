import {cp,mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {verifyPropertyPublication,zipFiles} from '../designer/core/website-generator.mjs';
import {exampleOwnXML} from '../designer/core/property-xml.mjs';
const [legacy,updated]=process.argv.slice(2);if(!legacy||!updated)throw Error('Usage: node tests/property-export-rc27-check.mjs <legacy website folder> <updated website folder>');
const parent=await mkdtemp(join(tmpdir(),'wset27-export-'));
try{
for(const [name,source] of [['legacy',legacy],['updated',updated]]){
 const root=join(parent,name);await cp(source,root,{recursive:true});
 const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,encoding:'utf8'});
 const file=join(root,'project/website.json'),site=migrateProjectForDesigner(JSON.parse(await readFile(file,'utf8')));site.smartAssistant.enabled=false;
 site.sitePages.find(p=>p.id==='properties').enabled=true;
 const mapDir=join(root,'node_modules/maplibre-gl/dist');await mkdir(mapDir,{recursive:true});for(const ext of ['js','css'])await writeFile(join(mapDir,'maplibre-gl.'+ext),'/* test stub: not deployed */');
 for(const [label,expected] of [['both',[true,true]],['new-off',[false,true]],['page-off',[false,false]],['restored',[true,true]]]){
  site.sitePages.find(p=>p.id==='properties').enabled=label!=='page-off';site.propertyModules.developments={...site.propertyModules.developments,enabled:expected[0],visibilityExplicit:true};site.propertyModules.properties={...site.propertyModules.properties,enabled:expected[1],visibilityExplicit:true};
  if(label==='both'){for(const m of Object.values(site.propertyModules))delete m.visibilityExplicit;}
  await writeFile(file,JSON.stringify(site));
  run('node',['scripts/generate-offline-preview.mjs']);await rm(join(root,'dist'),{recursive:true,force:true});await cp(join(root,'preview-offline'),join(root,'dist'),{recursive:true});
  run('node',['scripts/stage-contact-backend.mjs']);run('node',['scripts/stage-property-backend.mjs']);run('node',['scripts/package-manual-site.mjs']);
  const pub=zipFiles(await readFile(join(root,'exports/01-WWW.zip'))),priv=zipFiles(await readFile(join(root,'exports/02-UTENFOR-WWW.zip')));verifyPropertyPublication(pub,site);
  assert.ok(![...priv.keys()].some(k=>k.endsWith('.xml')));assert.ok(priv.has('storage/imports/New/')&&priv.has('storage/imports/Existing/'));
  if(label==='both'){
   const host=join(root,'host');await mkdir(join(host,'www'),{recursive:true});run('unzip',['-q',join(root,'exports/01-WWW.zip'),'-d',join(host,'www')]);run('unzip',['-q',join(root,'exports/02-UTENFOR-WWW.zip'),'-d',host]);
   const php=join(host,'www','no','eiendommer','index.php');assert.match(run('php',['-l',php]),/No syntax errors/);
   const discover=()=>JSON.parse(run('php',['-r',`require ${JSON.stringify(join(host,'app/properties/cbpm-sync-lib.php'))};require ${JSON.stringify(join(host,'app/properties/cbpm-xml-folders.php'))};echo json_encode(cbpmXmlDiscoverSources(${JSON.stringify(join(host,'www'))}));`]));
   assert.equal(discover().length,0);await writeFile(join(host,'storage/imports/New','new-test.xml'),exampleOwnXML());await writeFile(join(host,'storage/imports/Existing','existing-test.xml'),exampleOwnXML());assert.deepEqual(discover().map(s=>s.folder),['New','Existing']);await rm(join(host,'storage/imports/New','new-test.xml'));assert.deepEqual(discover().map(s=>s.folder),['Existing']);
  }
  console.log(name,label,'OK',site.languages.filter(x=>x.enabled!==false).length,'languages',pub.size,'public files');
 }
}
}finally{await rm(parent,{recursive:true,force:true});}
