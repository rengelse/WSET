import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join,dirname,win32} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import packaging from '../designer/core/app-packaging.cjs';
import build from '../electron-builder.cjs';
import {openUnifiedWorkspace} from '../designer/core/unified-workspace.mjs';
import {verifyRelease} from '../scripts/verify-release.mjs';
const {POINTER,APP_ID,overlaps,assertWorkspaceOutsideInstall,selectBootstrapRoot,rememberWorkspacePointer}=packaging;
async function ctx(fn){const base=await fs.mkdtemp(join(tmpdir(),'wset56-'));try{return await fn(base);}finally{await fs.rm(base,{recursive:true,force:true});}}
async function put(p,value){await fs.mkdir(dirname(p),{recursive:true});await fs.writeFile(p,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));}
test('Windows package identity, dedicated install policy, single latest channel',async()=>{const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url)));assert.equal(pkg.main,'designer/main.cjs');assert.equal(build.appId,APP_ID);assert.equal(build.productName,'WSET');assert.equal(build.nsis.oneClick,true);assert.equal(build.nsis.perMachine,false);assert.equal(build.nsis.allowToChangeInstallationDirectory,false);assert.equal(build.nsis.deleteAppDataOnUninstall,false);assert.equal(build.publish[0].owner,'rengelse');assert.equal(build.publish[0].repo,'WSET');assert.equal(build.publish[0].private,false);assert.equal(build.publish[0].channel,'latest');assert.equal(build.publish[0].releaseType,'release');assert.equal(build.directories.output,'dist');assert.equal(build.win.artifactName,'WSET-Setup-${version}.${ext}');assert.match(pkg.scripts.dist,/--publish never/);assert.match(pkg.scripts.dist,/verify-release/);assert.equal(pkg.scripts['dist:win'],'npm run dist');assert.equal(build.generateUpdatesFilesForAllChannels,false);assert.ok(build.files.every(x=>x.startsWith('!')||x.startsWith('designer/')||x==='package.json'));});
test('Reject Windows program paths, their parents and descendants, not siblings',()=>{const program='C:\\Users\\Demo\\AppData\\Local\\Programs\\WSET';assert.ok(overlaps(program,program.toLowerCase(),win32));assert.ok(overlaps(program,program+'\\projects',win32));assert.ok(overlaps(program,'C:\\Users\\Demo',win32));assert.ok(!overlaps(program,program+'-data',win32));assert.ok(!overlaps(program,'C:\\Users\\Demo\\Documents\\WSET',win32));});
test('Reject nonexistent children and aliases to program files',()=>ctx(async base=>{const install=join(base,'program','WSET');await fs.mkdir(install,{recursive:true});await assert.rejects(assertWorkspaceOutsideInstall(join(install,'workspace'),[install]),/utenfor/);await assert.rejects(assertWorkspaceOutsideInstall(base,[install]),/utenfor/);assert.equal(await assertWorkspaceOutsideInstall(join(base,'data'),[install]),join(base,'data'));if(process.platform!=='win32'){const link=join(base,'alias');await fs.symlink(install,link,'dir');await assert.rejects(assertWorkspaceOutsideInstall(join(link,'future'),[install]),/utenfor/);}}));
test('Preserve rc55 pointer byte-for-byte and never copy project content',()=>ctx(async base=>{const legacy=join(base,'Electron'),runtime=join(base,'WSET-runtime'),root=join(base,'workspace');const original=JSON.stringify({schema:1,root});await put(join(legacy,POINTER),original);await put(join(root,'Projects','client','data.txt'),'private');assert.equal(await selectBootstrapRoot(runtime,[legacy]),legacy);await rememberWorkspacePointer(runtime,root);assert.equal(await fs.readFile(join(legacy,POINTER),'utf8'),original);assert.deepEqual(await fs.readdir(runtime),[POINTER]);assert.equal(await fs.readFile(join(root,'Projects','client','data.txt'),'utf8'),'private');assert.equal(await selectBootstrapRoot(runtime,[legacy]),runtime);await assert.rejects(rememberWorkspacePointer(runtime,join(base,'other')),/endret/);}));
test('Ambiguous legacy roots and malformed pointers fail closed',()=>ctx(async base=>{const a=join(base,'Electron'),b=join(base,'wset-editor'),runtime=join(base,'WSET-runtime');await put(join(a,POINTER),{schema:1,root:join(base,'a')});await put(join(b,POINTER),{schema:1,root:join(base,'b')});await assert.rejects(selectBootstrapRoot(runtime,[a,b]),/Flere ulike/);await put(join(a,POINTER),'{bad');await assert.rejects(selectBootstrapRoot(runtime,[a]));await assert.rejects(fs.stat(runtime));}));
test('Reject forbidden workspace before any migration or pointer write',()=>ctx(async base=>{const dataRoot=join(base,'data'),defaultRoot=join(base,'program','WSET');let approval=false;await assert.rejects(openUnifiedWorkspace({dataRoot,defaultRoot,recentFile:join(dataRoot,'recent.json'),validateRoot:r=>assertWorkspaceOutsideInstall(r,[defaultRoot]),approve:async()=>{approval=true;return true;}}),/utenfor/);assert.equal(approval,false);await assert.rejects(fs.stat(dataRoot));await assert.rejects(fs.stat(defaultRoot));}));
test('Release verifier checks version, hash, size and rejects separate RC manifests',()=>ctx(async base=>{const version='1.4.4-rc.56.1',file=`WSET-Setup-${version}.exe`,bytes=Buffer.from('MZ fake test bytes'),hash=createHash('sha512').update(bytes).digest('base64');await put(join(base,file),bytes);await put(join(base,file+'.blockmap'),'fixture');await put(join(base,'latest.yml'),`version: ${version}\nfiles:\n  - url: ${file}\n    sha512: ${hash}\n    size: ${bytes.length}\npath: ${file}\nsha512: ${hash}\nreleaseDate: 2026-11-25\n`);assert.deepEqual(await verifyRelease(base,version),[file,file+'.blockmap','latest.yml']);assert.equal((await fs.readdir(base)).length,3);await put(join(base,'rc.yml'),'bad');await assert.rejects(verifyRelease(base,version),/Unexpected rc.yml/);await fs.rm(join(base,'rc.yml'));await put(join(base,file),'MZ tampered');await assert.rejects(verifyRelease(base,version));}));

test('Installer path guard uses checked Win32 normalization and never accepts blank or arbitrary targets',async()=>{
 const nsis=await fs.readFile(new URL('../build/installer.nsh',import.meta.url),'utf8');
 assert.doesNotMatch(nsis,/^\s*GetFullPathName\s/m);
 assert.equal((nsis.match(/kernel32::GetFullPathNameW\(/g)||[]).length,3);
 assert.equal((nsis.match(/IntCmp \$0 \$\{NSIS_MAX_STRLEN\} wset_path_error 0 wset_path_error/g)||[]).length,3);
 for(const reg of ['1','3','6'])assert.ok(nsis.includes(`StrCmp $${reg} "" wset_path_error`));
 assert.ok(nsis.indexOf('StrCmp $1 $3 wset_check_dir')<nsis.indexOf('StrCpy $INSTDIR $3'));
 assert.ok(nsis.includes('Forventet: $1')&&nsis.includes('Valgt: $3'));
 for(const dir of ['Projects','Templates','Modules','Backups','Exports','Archive','Settings','System'])assert.ok(nsis.includes(`IfFileExists "$INSTDIR\\${dir}\\*.*" wset_unsafe`));
 assert.ok(nsis.includes('GetFileAttributesW')&&nsis.includes('wset-install-owner.txt'));
 const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
 const ui=await fs.readFile(new URL('../designer/ui/index.html',import.meta.url),'utf8');assert.ok(ui.includes(`WSET v${pkg.version} ·`));
});


test('Installer default agrees with package identity, old owned install can remain, both roots reserved',async()=>{
 const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
 const nsis=await fs.readFile(new URL('../build/installer.nsh',import.meta.url),'utf8');
 const main=await fs.readFile(new URL('../designer/main.cjs',import.meta.url),'utf8');
 const smoke=await fs.readFile(new URL('../scripts/smoke-install.ps1',import.meta.url),'utf8');
 assert.equal(pkg.name,packaging.INSTALL_DIRECTORY);
 assert.ok(nsis.includes(`$LOCALAPPDATA\\Programs\\${pkg.name}\\.`));
 assert.ok(nsis.includes('StrCmp $6 $3 0 wset_path_mismatch'));
 assert.ok(nsis.includes('IfFileExists "$3\\resources\\wset-install-owner.txt" wset_check_dir wset_path_mismatch'));
 assert.ok(nsis.includes('StrCpy $INSTDIR $3'));
 assert.ok(main.includes('...reservedInstallRoots'));
 assert.ok(main.includes('packaging.reservedWindowsInstallRoots(process.env.LOCALAPPDATA)'));
 assert.ok(smoke.includes(`Programs\\${pkg.name}`));
 const local='C:\\Users\\Demo\\AppData\\Local';
 const roots=packaging.reservedWindowsInstallRoots(local,win32);
 assert.deepEqual(roots,[win32.join(local,'Programs','wset-editor'),win32.join(local,'Programs','WSET')]);
 for(const root of roots){assert.ok(overlaps(root,win32.join(root,'Projects'),win32));assert.ok(!overlaps(root,'C:\\Users\\Demo\\Documents\\WSET',win32));}
});
