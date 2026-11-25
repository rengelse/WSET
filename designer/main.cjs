'use strict';
const {app,BrowserWindow,dialog,ipcMain,session,shell,safeStorage}=require('electron');
const {join,resolve,dirname,basename}=require('node:path');
const {pathToFileURL}=require('node:url');
const {readFile,writeFile}=require('node:fs/promises');
const packaging=require('./core/app-packaging.cjs');
const editorRoot=resolve(__dirname,'..'); // WSET has no default website or active project
const packagedWindows=app.isPackaged&&process.platform==='win32';
const legacyDataRoots=packagedWindows?[join(app.getPath('appData'),'Electron'),join(app.getPath('appData'),'wset-editor')]:[];
const packagingSmoke=app.isPackaged&&process.argv.includes('--wset-packaging-smoke');
if(packagingSmoke){app.setPath('userData',require('node:fs').mkdtempSync(join(require('node:os').tmpdir(),'wset-packaging-smoke-')));}
else if(packagedWindows){const data=join(app.getPath('appData'),'WSET');require('node:fs').mkdirSync(data,{recursive:true});app.setPath('userData',data);app.setAppUserModelId(packaging.APP_ID);}
const reservedInstallRoots=process.platform==='win32'?packaging.reservedWindowsInstallRoots(process.env.LOCALAPPDATA):[];
const checkWorkspaceRoot=root=>packaging.assertWorkspaceOutsideInstall(root,[...reservedInstallRoots,app.isPackaged?dirname(process.execPath):null,app.isPackaged?app.getPath('userData'):null]);
let mainWindow,preview,storage,ops,validate,globalDefaults,loaded,snapshot,history,translationRuntime,serverManager,withTemplateRenderer,rendererHints;
let exportRunning=false,lastExport=null,lastExportInfo=null,propertyStore,recentProjectModule,activeAssistantModule=null;
let applicationUpdater,updateTimer,updateQuit=false,updatePreparing=false,translationWarmRunning=false;
let switchPlan=null,switchBusy=false,inFlight=0,switchCore,switchJournal;
let workspace,unifiedCore,folderTemplates,gallerySessions,libraryTimer,libraryScanning=false,galleryShutdown=false;
const moduleLibrary=()=>workspace.state().paths.modules;
const projectDirectory=()=>workspace.state().paths.projects;
const exportDirectory=()=>workspace.state().paths.exports;
async function syncLibrary(){if(libraryScanning)return;libraryScanning=true;try{await folderTemplates.list();}catch(error){console.warn('Template scan:',error.message);}finally{libraryScanning=false;}}
const recentFile=()=>join(workspace.state().paths.registry,'wset-recent-projects.json');
const backupRoot=()=>workspace.state().paths.backups;
const projectExport=async()=>{const {id}=await workspace.register(loaded.root);const dir=join(exportDirectory(),id);await require('node:fs/promises').mkdir(dir,{recursive:true});return dir;};
async function noteRecent(root){try{await recentProjectModule.rememberRecentProject(recentFile(),root)}catch(error){console.warn('Could not update local recent projects:',error.message)}}
async function switchToProject(folder){
 const next=await storage.readDesignerProject(folder); // Validate before modifying active state.
 if(dirname(next.root)!==projectDirectory())throw Error('Prosjektet må ligge i Projects. Gjenopprett arkiverte prosjekter eller importer en ekstern prosjektmappe først.');
 const identity=await workspace.register(next.root); 
 await (await import('./core/property-owned-feed.mjs')).syncOwnFeed(next.root,next.site);
 const {reconcileExistingImports}=await import('./core/property-publication.mjs');
 const reconciled=await reconcileExistingImports(next.root,next.site);
 await serverManager?.setScope(next.root,identity.id);
 loaded={...next,projectId:identity.id,site:reconciled.site};lastExport=null;lastExportInfo=null;propertyStore=new (await import('./core/property-remote.mjs')).RemotePropertyStore();
 snapshot=loaded.sourceSnapshot??JSON.stringify(loaded.site);history.reset();await noteRecent(loaded.root);
 return state();
}

async function confirmDiscard(){
 if(!loaded||JSON.stringify(loaded.site)===snapshot)return true;
 const result=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Avbryt','Lagre og fortsett','Forkast endringer'],defaultId:0,cancelId:0,title:'Ulagrede endringer',message:'Du har endringer som ikke er lagret.'});
 if(result.response===1){const saved=await storage.persistDesignerProject(loaded);loaded.revision=saved.revision;snapshot=JSON.stringify(loaded.site);return true;}
 return result.response===2;
}
const state=()=>!loaded?null:({root:loaded.root,projectId:loaded.projectId,site:loaded.site,template:loaded.template,rendererHints:rendererHints(loaded.template),globalDefaults:globalDefaults(loaded.site),previewBase:preview.url,draftImageToken:preview.draftImageToken,dirty:JSON.stringify(loaded.site)!==snapshot,canUndo:history?.canUndo||false,canRedo:history?.canRedo||false,report:validate(loaded.site,{root:loaded.root})});
async function healthState(){
 const {projectHealth}=await import('./core/project-health.mjs');
 const {listLocalFeeds,feedInventoryFingerprint}=await import('./core/local-property-feeds.mjs');
 const localFeeds=await listLocalFeeds(loaded.root);
 return projectHealth({site:loaded.site,report:validate(loaded.site,{root:loaded.root}),dirty:JSON.stringify(loaded.site)!==snapshot,
  mediaCount:loaded.site.media?.items?.length||0,localFeeds,remoteConnected:!!propertyStore?.connected,
  exportInfo:lastExportInfo?{...lastExportInfo,currentRoot:loaded.root,matchesCurrent:lastExportInfo.revision===JSON.stringify(loaded.site)&&lastExportInfo.feedFingerprint===feedInventoryFingerprint(localFeeds)}:null});
}
function authorizeSender(event){
 if(!mainWindow||event.sender.id!==mainWindow.webContents.id||event.senderFrame!==mainWindow.webContents.mainFrame)throw Error('Ugyldig avsender.');
}
function authorize(event){authorizeSender(event);if(applicationUpdater?.isLocked())throw Error('WSET oppdateres.');}
function withAuthorization(fn,{allowEmpty=false}={}){return async(event,...args)=>{authorize(event);if(switchBusy)throw Error('Maloperasjon pågår.');if(exportRunning)throw Error('Nettsiden genereres nå. Fullfør eksporten før du redigerer prosjektet.');if(!allowEmpty&&!loaded)throw Error('Åpne eller importer et nettsted først.');const template=loaded?.template;inFlight++;try{return await (template?withTemplateRenderer(template,()=>fn(...args)):fn(...args));}finally{inFlight--;}}}

async function start(){
 storage=await import('./core/project-storage.mjs');
 switchCore=await import('./core/template-switching.mjs');
 const bootstrapRoot=await packaging.selectBootstrapRoot(app.getPath('userData'),legacyDataRoots);
 await switchCore.recoverTemplateSwitch(join(bootstrapRoot,'wset-switch-journal.json'));  
 ({withTemplateRenderer,rendererHints}=await import('./core/renderer-runtime.mjs'));
 recentProjectModule=await import('./core/recent-projects.mjs');
 unifiedCore=await import('./core/unified-workspace.mjs');
 const unified=await unifiedCore.openUnifiedWorkspace({dataRoot:bootstrapRoot,defaultRoot:join(app.getPath('documents'),'WSET'),recentFile:join(bootstrapRoot,'wset-recent-projects.json'),validateRoot:checkWorkspaceRoot,approve:async root=>{const a=await dialog.showMessageBox({type:'question',title:'Samlet WSET-arbeidsområde',message:'Samle WSET-data i '+root+'?',detail:'Eksisterende prosjekter, maler, moduler og innstillinger kopieres og kontrolleres. Originalene beholdes. Byggecache kan genereres på nytt. Konflikter stopper migreringen.',buttons:['Avbryt','Kopier og fortsett'],defaultId:0,cancelId:0});return a.response===1;}});
 await packaging.rememberWorkspacePointer(app.getPath('userData'),unified.root);
 workspace=await (await import('./core/workspace.mjs')).createWorkspace({dataRoot:unified.paths.registry,defaultRoot:unified.root,recentFile:join(unified.paths.registry,'wset-recent-projects.json'),unified});
 switchJournal=join(unified.paths.registry,'wset-switch-journal.json');await switchCore.recoverTemplateSwitch(switchJournal,backupRoot());storage.setProjectBackupRoot(backupRoot());
 folderTemplates=(await import('./core/folder-template-library.mjs')).createFolderTemplateLibrary({getRoot:()=>workspace.state().paths.templates,scratchRoot:join(workspace.state().paths.temp,'template-validation')});
 gallerySessions=(await import('./core/template-gallery-preview.mjs')).createTemplateGallerySessions({library:folderTemplates});
 ops=await import('./core/editor-operations.mjs');
 ({globalDefaults}=await import('./engines/cbpm-astro-v1/lib/global-content.mjs'));
 history=(await import('./core/editor-history.mjs')).createEditorHistory();
 ({validateSiteProject:validate}=await import('./engines/cbpm-astro-v1/lib/site-project.mjs'));
 // Empty launch: no bundled CBPM website is opened automatically.
 loaded=null;snapshot=null;propertyStore=null;
 activeAssistantModule=await (await import('./core/module-library.mjs')).selectedAssistantModule({libraryRoot:moduleLibrary()});
 preview=await (await import('./core/preview-server.mjs')).startDesignerPreview({getSite:()=>loaded?.site,getRoot:()=>loaded?.root,getTemplate:()=>loaded?.template,getModuleRoot:()=>activeAssistantModule?.root});
 session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 mainWindow=new BrowserWindow({
  width:1500,height:940,minWidth:1040,minHeight:660,backgroundColor:'#f4f7fc',title:'WSET – WebSite Editing Tool',show:false,
  webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}
 });
 mainWindow.setAutoHideMenuBar(true); // Native File/Edit/View menus remain accessible with Alt on Windows/Linux.
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==pathToFileURL(join(__dirname,'ui/index.html')).href)event.preventDefault()});
 // Gallery frame may navigate only within its own loopback preview origin.
 mainWindow.webContents.on('will-frame-navigate',(event,details)=>{
  const info=typeof details==='object'?details:event;const origin=gallerySessions?.origin();
  if(!origin||info.isMainFrame)return;
  const target=info.url||typeof details==='string'&&details||'';
  if(target==='about:blank')return;
  if(target.startsWith(origin+'/'))return;
  // Only a known editor preview frame may stay on the regular editor origin.
  if(info.frame?.url?.startsWith(preview.url+'/')&&target.startsWith(preview.url+'/'))return;
  event.preventDefault();
 });
 mainWindow.once('ready-to-show',()=>mainWindow.show());

 // Server connections are local application data, not project content or export data.
 const {createServerManager}=await import('./core/server-manager.mjs');
 const secureAvailable=()=>safeStorage.isEncryptionAvailable()&&!(process.platform==='linux'&&safeStorage.getSelectedStorageBackend?.()==='basic_text');
 serverManager=createServerManager({dataRoot:join(workspace.state().paths.settings,'server-profiles'),tempRoot:workspace.state().paths.temp,home:app.getPath('home'),onPublicationComplete:async ({root,...event})=>{if(!root)return;try{await workspace.recordPublication(root,event);}catch(error){console.warn('Project publication history:',error.message);if(mainWindow&&!mainWindow.isDestroyed())void dialog.showMessageBox(mainWindow,{type:'warning',title:'Publiseringshistorikk',message:'Overføringen er avsluttet, men lokal publiseringshistorikk kunne ikke lagres.',detail:error.message});}},crypt:{
  encrypt:value=>{if(!secureAvailable())throw Error('Sikker passordlagring er ikke tilgjengelig. Fjern avhukingen for lagring av passord.');return safeStorage.encryptString(JSON.stringify(value)).toString('base64');},
  decrypt:value=>{if(!secureAvailable())throw Error('Sikker passordlagring er ikke tilgjengelig.');return JSON.parse(safeStorage.decryptString(Buffer.from(value,'base64')));}
 },confirm:async(kind,data)=>{
  const p=data.profile;const names=(data.names||[]).slice(0,12).join('\n')+((data.names||[]).length>12?'\n…':'');
  const texts={host:['Verifiser SSH-vertsnøkkel',`${p?.host||''}:${p?.port||''}\n${data.fingerprint||''}\n\nSammenlign fingeravtrykket med informasjon fra webhotellet før du godkjenner.`,`Godkjenn nøkkel`],ftp:['Ukryptert FTP','Brukernavn, passord og filer kan sendes i klartekst. Bruk SFTP eller FTPS hvis mulig.','Fortsett med FTP'],delete:['Slett filer eller tomme mapper',`${data.base||''}\n${names}\n\nSletting kan ikke angres. Mapper må være tomme.`,`Slett`],profile:['Slett tilkoblingsprofil',`${p?.name||''}\nDette sletter kun den lokale profilen.`,`Slett profil`],transfer:['Bekreft filoverføring',`${data.sourceBase||''} → ${data.destBase||''}\n${names}\n\n${data.overwrite?'Eksisterende filer kan bli erstattet.':'Eksisterende filer hoppes over.'}\nPrivate konfigurasjonsfiler, boligbilder og 02-UTENFOR-WWW må aldri ligge i offentlig webrot.`,`Start overføring`]};
  texts.publication=['Bekreft direkte publisering',`${p?.name||''} · ${p?.host||''}:${p?.port||''}\nKontomappe: ${data.account||''}\nOffentlig webrot: ${data.web||''}\n\n${data.fileCount||0} filer · ${data.preserved||0} filer med behold-policy · ${data.removeCount||0} eksplisitte fjerninger.\n${data.kind==='website'?'Eksisterende config/ og storage/ beholdes. Offentlige filer og programfiler kan erstattes.':data.replaceSupplier?'Eksisterende leverandør-XML kan erstattes på serveren.':'Eksisterende leverandør-XML beholdes. Egne annonser og status kan oppdateres.'}\n${data.pendingRemoval?'Tidligere egen XML fjernes ikke i denne jobben.\n':''}Ingen automatisk speiling. Kontroller at kontomappen faktisk ligger utenfor webroten.`, 'Start publisering'];
  const [title,detail,label]=texts[kind];const result=await dialog.showMessageBox(mainWindow,{type:'warning',title,message:title,detail,buttons:['Avbryt',label],defaultId:0,cancelId:0,noLink:true});return result.response===1;
 }});
 await serverManager.setScope(null);
 const serverActions={status:()=>serverManager.snapshot(),save:input=>serverManager.saveProfile(input),remove:id=>serverManager.removeProfile(id),test:id=>serverManager.test(id),connect:id=>serverManager.connect(id),disconnect:()=>serverManager.disconnect(),list:(side,base)=>serverManager.list(side,base),operation:input=>serverManager.operation(input),transfer:input=>serverManager.startTransfer(input),cancel:()=>serverManager.cancel(),retry:()=>serverManager.retry(),chooseLocal:async()=>{const result=await dialog.showOpenDialog(mainWindow,{title:'Velg lokal mappe',properties:['openDirectory']});return result.canceled?null:result.filePaths[0];},chooseKey:async()=>{const result=await dialog.showOpenDialog(mainWindow,{title:'Velg privat SSH-nøkkel',properties:['openFile']});return result.canceled?null:result.filePaths[0];}};
 for(const [action,handler] of Object.entries(serverActions))ipcMain.handle('wset:server:'+action,async(event,...args)=>{authorize(event);if(switchBusy)throw Error('Maloperasjon pågår.');inFlight++;try{return await handler(...args);}finally{inFlight--;}});
 translationRuntime=(await import('./core/translation-runtime.mjs')).createManagedRuntime();
 const translation=(await import('./core/translation-engine.mjs')).createTranslationEngine({settingsFile:join(workspace.state().paths.settings,'wset-translation.json'),runtime:translationRuntime});
 if((await translation.settings()).preload){translationWarmRunning=true;void translation.warm().catch(e=>console.warn('Oversettelse: '+e.message)).finally(()=>{translationWarmRunning=false;});}
 ipcMain.handle('wset:translation:warm',withAuthorization(()=>translation.warm(),{allowEmpty:true}));
 ipcMain.handle('wset:translation:status',withAuthorization(()=>translation.status(),{allowEmpty:true}));
 ipcMain.handle('wset:translation:configure',withAuthorization(model=>translation.configure(model),{allowEmpty:true}));
 ipcMain.handle('wset:translation:install',withAuthorization(async()=>{
  const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'Installer lokal oversettelsesmodell',message:'Last ned valgt TranslateGemma-modell via Ollama?',detail:'Nedlastingen kan kreve 3–17 GB. Modellen lagres av Ollama på denne PC-en, ikke i nettstedprosjektet. Gemma-vilkår: https://ai.google.dev/gemma/terms',buttons:['Avbryt','Last ned'],defaultId:0,cancelId:0});
  if(answer.response!==1)return null;return translation.install();
 },{allowEmpty:true}));
 ipcMain.handle('wset:translation:download-status',event=>{authorize(event);return translation.downloadStatus();});
 ipcMain.handle('wset:translation:cancel-install',event=>{authorize(event);return translation.cancelInstall();});
 ipcMain.handle('wset:translation:download-ollama',withAuthorization(()=>shell.openExternal('https://ollama.com/download/windows'),{allowEmpty:true}));
 ipcMain.handle('wset:translation:content',withAuthorization(async input=>{const {translateContent}=await import('./core/translation-content.mjs');return {text:await translateContent(translation,input)};}));
 ipcMain.handle('wset:translation:translate',withAuthorization(input=>translation.translate(input),{allowEmpty:true}));
 ipcMain.handle('wset:assistant:status',withAuthorization(async()=>{
  const {selectedAssistantModule}=await import('./core/module-library.mjs');
  activeAssistantModule=await selectedAssistantModule({libraryRoot:moduleLibrary()});
  return activeAssistantModule?{id:activeAssistantModule.id,version:activeAssistantModule.version,checksum:activeAssistantModule.checksum}:null;
 },{allowEmpty:true}));
 ipcMain.handle('wset:assistant:import',withAuthorization(async()=>{
  const chosen=await dialog.showOpenDialog(mainWindow,{title:'Importer ny Smart Assistant-modul (ZIP)',properties:['openFile'],filters:[{name:'Smart Assistant modul ZIP',extensions:['zip']}]});
  if(chosen.canceled||!chosen.filePaths?.length)return null;
  const answer=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Godkjenn modulimport',message:'Importer bare moduler fra en kilde du stoler på.',detail:'Modulen inneholder JavaScript og PHP som publiseres sammen med nettstedet. WSET kjører ikke modulens egne installasjons- eller byggeskript. Den tidligere versjonen beholdes ved ugyldig ZIP.',buttons:['Avbryt','Importer modul'],defaultId:0,cancelId:0});
  if(answer.response!==1)return null;
  const {importAssistantModule}=await import('./core/module-library.mjs');
  activeAssistantModule=await importAssistantModule({archive:chosen.filePaths[0],libraryRoot:moduleLibrary()});
  return {id:activeAssistantModule.id,version:activeAssistantModule.version,checksum:activeAssistantModule.checksum};
 },{allowEmpty:true}));
 ipcMain.handle('cbpm:state',withAuthorization(async()=>state(),{allowEmpty:true}));
 ipcMain.handle('cbpm:health',withAuthorization(async()=>healthState()));
 ipcMain.handle('cbpm:projects:recent',withAuthorization(async()=>{const active=(await workspace.projects()).items.filter(p=>!p.archived),known=new Set(active.map(p=>p.root));return recentProjectModule.describeRecentProjects((await recentProjectModule.readRecentProjects(recentFile())).filter(p=>known.has(p)));},{allowEmpty:true}));
 ipcMain.handle('cbpm:projects:open-recent',withAuthorization(async root=>{
  const known=(await workspace.projects()).items;
  if(typeof root!=='string'||!known.some(p=>p.root===root&&!p.archived))throw Error('Prosjektet finnes ikke i prosjektregisteret.');
  if(!await confirmDiscard())return null;return switchToProject(root);
 },{allowEmpty:true}));
 ipcMain.handle('wset:workspace:status',withAuthorization(()=>workspace.state(),{allowEmpty:true}));
 ipcMain.handle('wset:workspace:projects',withAuthorization(()=>workspace.projects(),{allowEmpty:true}));
 ipcMain.handle('wset:dashboard:list',withAuthorization(async()=>{
  const {dashboardSummary}=await import('./core/project-dashboard.mjs');const result=await workspace.projects();
  const catalogue=await folderTemplates.list();const {templateVersionStatus}=await import('./core/template-versions.mjs');
  const items=await Promise.all(result.items.map(async p=>{const item=await dashboardSummary(p);return {...item,templateUpdate:item.archived?null:templateVersionStatus(item.template,catalogue)};}));return {...result,items,activeRoot:loaded?.root||'',dirty:!!loaded&&JSON.stringify(loaded.site)!==snapshot};
 },{allowEmpty:true}));
 ipcMain.handle('wset:dashboard:covers',withAuthorization(async ids=>{
  if(!Array.isArray(ids)||ids.length>12||ids.some(id=>typeof id!=='string'||id.length>40))throw Error('Ugyldig bildeforespørsel.');
  const {dashboardCover}=await import('./core/project-dashboard.mjs');const {items}=await workspace.projects();
  return Object.fromEntries(await Promise.all(items.filter(p=>ids.includes(p.id)).map(async p=>[p.id,await dashboardCover(p)])));
 },{allowEmpty:true}));
 ipcMain.handle('wset:dashboard:update',withAuthorization((id,input)=>workspace.updateDashboard(id,input),{allowEmpty:true}));
 ipcMain.handle('wset:lifecycle:update',withAuthorization((id,input)=>workspace.updateLifecycle(id,input),{allowEmpty:true}));
 ipcMain.handle('wset:lifecycle:validate',withAuthorization(id=>workspace.validateLifecycle(id),{allowEmpty:true}));
 ipcMain.handle('wset:lifecycle:history',withAuthorization(id=>workspace.publicationHistory(id),{allowEmpty:true}));
 ipcMain.handle('wset:dashboard:reveal',withAuthorization(async id=>{
  const item=(await workspace.projects()).items.find(p=>p.id===id);if(!item)throw Error('Prosjektet finnes ikke i prosjektregisteret.');
  const error=await shell.openPath(item.root);if(error)throw Error(error);return true;
 },{allowEmpty:true}));
 ipcMain.handle('wset:workspace:check',withAuthorization(async()=>{const result=await unifiedCore.checkWorkspace(workspace.state().root),projects=await workspace.projects(),templates=await folderTemplates.list();return {...result,projects:projects.items.length,templates:templates.items.length,issues:[...projects.issues,...templates.issues]};},{allowEmpty:true}));
 ipcMain.handle('wset:workspace:overview',withAuthorization(()=>unifiedCore.storageOverview(workspace.state().root),{allowEmpty:true}));
 ipcMain.handle('wset:dashboard:archive',withAuthorization(async(id,restore=false)=>exclusiveSwitch(async()=>{
  const item=(await workspace.projects()).items.find(p=>p.id===id);if(!item)throw Error('Prosjektet finnes ikke.');if(loaded?.root===item.root)throw Error('Åpne et annet prosjekt eller start WSET på nytt før arkivering.');
  const a=await dialog.showMessageBox(mainWindow,{type:'question',title:restore?'Gjenopprett prosjekt':'Arkiver prosjekt',message:(restore?'Flytt til Projects: ':'Flytt til Archive: ')+item.name,detail:'Prosjekt-ID, innhold og sikkerhetskopier beholdes. Ingen endring på webhotellet.',buttons:['Avbryt','Fortsett'],defaultId:0,cancelId:0});if(a.response!==1)return null;
  return workspace.archiveProject(id,restore);
 }),{allowEmpty:true}));
 ipcMain.handle('wset:workspace:choose',withAuthorization(async (key,mode='copy')=>exclusiveSwitch(async()=>{
  if(key!=='root')throw Error('Alle undermapper følger hovedmappen.');if(switchPlan||serverManager.snapshot().connected||propertyStore?.connected)throw Error('Avslutt maloperasjonen og koble fra serveren først.');
  if(loaded&&JSON.stringify(loaded.site)!==snapshot)throw Error('Lagre prosjektet før arbeidsområdet endres.');
  const current=workspace.state();const chosen=await dialog.showOpenDialog(mainWindow,{title:mode==='attach'?'Koble til eksisterende WSET-arbeidsområde':'Velg tom mappe for arbeidsområdet',defaultPath:current.root,properties:['openDirectory','createDirectory']});
  if(chosen.canceled||!chosen.filePaths.length||resolve(chosen.filePaths[0])===current.root)return null;
  await checkWorkspaceRoot(chosen.filePaths[0]);
  const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'Endre arbeidsområde',message:mode==='attach'?'Koble til det valgte arbeidsområdet?':'Kopier hele arbeidsområdet til valgt mappe?',detail:'Gamle filer beholdes. WSET startes på nytt etter vellykket kontroll. Ved bytte av PC kan serverpassord måtte registreres på nytt.',buttons:['Avbryt','Fortsett'],defaultId:0,cancelId:0});if(answer.response!==1)return null;
  clearInterval(libraryTimer);try{await gallerySessions.close();while(libraryScanning)await new Promise(r=>setTimeout(r,50));await unifiedCore.relocateWorkspace({dataRoot:app.getPath('userData'),root:current.root,destination:chosen.filePaths[0],mode});}catch(e){libraryTimer=setInterval(()=>void syncLibrary(),5000);libraryTimer.unref?.();throw e;}
  app.relaunch();setImmediate(()=>app.quit());return {restarting:true};
 }),{allowEmpty:true}));
 ipcMain.handle('wset:workspace:reveal',withAuthorization(async key=>{const w=workspace.state();if(key!=='root'&&!Object.hasOwn(w.paths,key))throw Error('Ugyldig mappevalg.');const error=await shell.openPath(key==='root'?w.root:w.paths[key]);if(error)throw Error(error);return true;},{allowEmpty:true}));
 ipcMain.handle('wset:templates:list',withAuthorization(async()=>{const catalogue=await folderTemplates.list();const {templateVersionStatus}=await import('./core/template-versions.mjs');return {...catalogue,activeTemplate:loaded?.template||null,activeUpdate:templateVersionStatus(loaded?.template,catalogue)};},{allowEmpty:true}));
 ipcMain.handle('wset:templates:compatibility',withAuthorization(async(key,digest)=>{
  const active=loaded,source={root:active.root,site:structuredClone(active.site),template:active.template,revision:active.revision,dirty:JSON.stringify(active.site)!==snapshot};
  const target=await folderTemplates.mappingTarget(key,digest);
  const {analyzeTemplateCompatibility}=await import('./core/template-compatibility.mjs');
  const report=await analyzeTemplateCompatibility({source,target});
  if(loaded!==active||JSON.stringify(loaded.site)!==JSON.stringify(source.site))throw Error('Prosjektet er endret under kartleggingen. Kjør kontrollen på nytt.');
  return report;
 }));
 async function exclusiveSwitch(fn){if(inFlight!==1||serverManager.snapshot().busy||propertyStore?.connected)throw Error('Fullfør pågående operasjoner og koble fra eiendomsserveren først.');switchBusy=true;try{return await fn();}finally{switchBusy=false;}}
 async function clearSwitch(){await gallerySessions.close();if(switchPlan){await switchCore.disposeTemplateSwitch(switchPlan);switchPlan=null;}}
 function savedSwitchSource(){if(JSON.stringify(loaded.site)!==snapshot)throw Error('Lagre prosjektet før malbytte eller tilbakeføring.');return {...loaded,site:structuredClone(loaded.site),dirty:false};}
 async function reloadSwitched(root){const next=await storage.readDesignerProject(root);loaded={...next,projectId:loaded.projectId};snapshot=next.sourceSnapshot??JSON.stringify(next.site);history.reset();lastExport=null;lastExportInfo=null;propertyStore=new (await import('./core/property-remote.mjs')).RemotePropertyStore();return state();}
 ipcMain.handle('wset:templates:switch-prepare',withAuthorization((key,digest,intent='switch')=>exclusiveSwitch(async()=>{
  const source=savedSwitchSource();await clearSwitch();const target=await folderTemplates.mappingTarget(key,digest),staged=await folderTemplates.stagePreview(key,digest);
  try{switchPlan=await switchCore.prepareTemplateSwitch({source,target,staged,intent,backupRoot:backupRoot()});switchPlan.key=key;const preview=await gallerySessions.openCandidate({root:switchPlan.candidate,site:switchPlan.site,template:switchPlan.targetTemplate});return {id:require('node:path').basename(switchPlan.dir),preview,report:switchPlan.report,replaced:switchPlan.replaced,added:switchPlan.added,preserved:switchPlan.preserved};}catch(e){await clearSwitch();throw e;}finally{await staged.dispose();}
 })));
 ipcMain.handle('wset:templates:switch-cancel',withAuthorization(clearSwitch,{allowEmpty:true}));
 ipcMain.handle('wset:templates:switch-commit',withAuthorization(id=>exclusiveSwitch(async()=>{
  const source=savedSwitchSource(),p=switchPlan;if(!p||id!==require('node:path').basename(p.dir)||p.root!==source.root||p.revision!==source.revision)throw Error('Klargjør malbyttet på nytt.');
  const approved=await dialog.showMessageBox(mainWindow,{type:'warning',title:p.kind==='update'?'Oppdater nettsidemal':'Bytt nettsidemal',message:p.kind==='update'?'Godkjenn oppdatering til '+p.targetTemplate.templateVersion+' og bygg lokalt?':'Godkjenn kontrollpunktene og bygg ny mal lokalt?',detail:'WSET installerer npm-avhengigheter og kjører valgt mals byggeskripter på PC-en. Bruk bare kode du stoler på. Alle eksisterende tekster og egne stiler beholdes. Original prosjektmappe beholdes som full lokal sikkerhetskopi. Ingen opplasting til webhotellet.',buttons:['Avbryt','Godkjenn, bygg og bytt'],defaultId:0,cancelId:0});if(approved.response!==1)return null;
  await gallerySessions.close();
  try{await switchCore.commitTemplateSwitch({plan:p,journal:switchJournal,approved:true,checkTarget:()=>folderTemplates.mappingTarget(p.key,p.targetDigest),verifyBuild:async plan=>{
   const generator=await import('./core/website-generator.mjs');const module=await (await import('./core/module-library.mjs')).selectedAssistantModule({libraryRoot:moduleLibrary()});
   const progress=x=>mainWindow?.webContents.send('cbpm:export-progress',x);
   await generator.installProjectDependencies({root:plan.candidate,onProgress:progress});
   await generator.generateWebsite({root:plan.candidate,destination:join(plan.candidate,'exports'),expectedRevision:plan.revision,expectedTemplate:plan.targetTemplate,moduleRoot:module?.root||null,onProgress:progress});
  }});switchPlan=null;return reloadSwitched(p.root);}catch(e){await clearSwitch();throw e;}
 })));
 ipcMain.handle('wset:templates:backups',withAuthorization(()=>switchCore.listTemplateBackups(loaded.root,backupRoot())));
 ipcMain.handle('wset:templates:rollback',withAuthorization(id=>exclusiveSwitch(async()=>{
  const source=savedSwitchSource();const b=(await switchCore.listTemplateBackups(source.root,backupRoot())).find(x=>x.id===id);if(!b)throw Error('Sikkerhetskopien finnes ikke.');
  const approved=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Tilbakefør nettsidemal',message:'Gjenopprett prosjektversjonen fra '+b.at+'?',detail:'Dette gjenoppretter tidligere nettsideinnhold og design. Dagens komplette prosjekt beholdes som en ny sikkerhetskopi. Lokal prosjektadministrasjon og serverprofiler beholdes. Ingen endring på webhotellet.',buttons:['Avbryt','Tilbakefør'],defaultId:0,cancelId:0});if(approved.response!==1)return null;
  await clearSwitch();await switchCore.rollbackTemplateSwitch({root:source.root,id,journal:switchJournal,expectedRevision:source.revision,approved:true,backupRoot:backupRoot()});return reloadSwitched(source.root);
 })));
 ipcMain.handle('wset:templates:preview-open',withAuthorization(key=>gallerySessions.open(key),{allowEmpty:true}));
 ipcMain.handle('wset:templates:preview-close',event=>{authorize(event);return gallerySessions.close();});
 ipcMain.handle('wset:templates:previews',withAuthorization(key=>folderTemplates.previews(key),{allowEmpty:true}));
 ipcMain.handle('wset:templates:import',withAuthorization(async()=>{
  const chosen=await dialog.showOpenDialog(mainWindow,{title:'Importer mal til biblioteket',properties:['openFile'],filters:[{name:'WSET mal-ZIP',extensions:['zip']}]});
  if(chosen.canceled||!chosen.filePaths.length)return null;
  const approved=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Importer nettsidemal',message:'Importer bare maler fra kilder du stoler på.',detail:'Importen kjører ikke kildekode. Ved senere bygging av et prosjekt fra malen kan byggeskriptene kjøres.',buttons:['Avbryt','Importer mal'],defaultId:0,cancelId:0});
  if(approved.response!==1)return null;
  return folderTemplates.import(chosen.filePaths[0]);
 },{allowEmpty:true}));
 ipcMain.handle('wset:templates:create',withAuthorization((key,input)=>exclusiveSwitch(async()=>{
  const options=(await import('./core/project-creation.mjs')).validateTemplateCreation(input);
  if(!await confirmDiscard())return null;
  const imported=await folderTemplates.create(key,projectDirectory(),options);
  return switchToProject(imported.root);
 }),{allowEmpty:true}));
 ipcMain.handle('wset:templates:reveal',withAuthorization(async key=>{shell.showItemInFolder(await folderTemplates.source(key));return true;},{allowEmpty:true}));
 ipcMain.handle('wset:project:import-zip',withAuthorization(async()=>{
  if(!await confirmDiscard())return null;
  const selected=await dialog.showOpenDialog(mainWindow,{title:'Importer redigerbart WSET-prosjekt eller mal',properties:['openFile'],filters:[{name:'WSET prosjekt / mal ZIP',extensions:['zip']}]});
  if(selected.canceled||!selected.filePaths.length)return null;
  const approved=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Importer prosjektkilde',message:'Importer bare prosjekt-ZIP fra kilder du stoler på.',detail:'Prosjektet inneholder nettstedskildekode og byggeskripter. Import leser og validerer filene, men senere bygging kan kjøre prosjektkode. Server-publiserings-ZIP er ikke et gyldig prosjekt.',buttons:['Avbryt','Importer prosjekt'],defaultId:0,cancelId:0});
  if(approved.response!==1)return null;
  const {importEditableProject}=await import('./core/project-archive.mjs');
  const imported=await importEditableProject({archive:selected.filePaths[0],projectsDir:projectDirectory()});
  return switchToProject(imported.root);
 },{allowEmpty:true}));
 ipcMain.handle('wset:project:export-zip',withAuthorization(async kind=>{
  if(!['project','template'].includes(kind))throw Error('Velg prosjekt eller mal.');
  const label=loaded.site.brand?.displayName||require('node:path').basename(loaded.root);
  const safe=String(label).replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,55)||'Nettsted';
  const chosen=await dialog.showSaveDialog(mainWindow,{title:kind==='template'?'Lagre redigerbar mal som ZIP':'Lagre komplett redigerbart prosjekt som ZIP',defaultPath:join(kind==='template'?workspace.state().paths.templates:await projectExport(),`${safe}-${kind==='template'?'MAL':'WSET-PROSJEKT'}.zip`),filters:[{name:'WSET redigerbart prosjekt',extensions:['zip']}]});
  if(chosen.canceled||!chosen.filePath)return null;
  if(JSON.stringify(loaded.site)!==snapshot){
   const saved=await storage.persistDesignerProject(loaded);loaded.revision=saved.revision;snapshot=JSON.stringify(loaded.site);
  }
  const {exportEditableProject}=await import('./core/project-archive.mjs');
  return exportEditableProject({root:loaded.root,destination:chosen.filePath,kind,name:label});
 }));
 ipcMain.handle('cbpm:property:remote:connect',withAuthorization(async details=>propertyStore.connect(details)));
 ipcMain.handle('cbpm:property:remote:disconnect',withAuthorization(async()=>{propertyStore.disconnect();return {ok:true};}));
 ipcMain.handle('cbpm:property:remote:status',withAuthorization(async()=>({connected:propertyStore.connected,endpoint:propertyStore.endpoint||''})));
 ipcMain.handle('cbpm:property:list',withAuthorization(async filters=>propertyStore.list(filters||{})));
 ipcMain.handle('cbpm:property:get',withAuthorization(async payload=>propertyStore.get(payload||{})));
 ipcMain.handle('cbpm:property:save',withAuthorization(async payload=>propertyStore.save(payload)));
 ipcMain.handle('cbpm:property:status-change',withAuthorization(async payload=>propertyStore.status(payload)));
 ipcMain.handle('cbpm:property:sync:get',withAuthorization(async()=>propertyStore.settings()));
 ipcMain.handle('cbpm:property:sync:save',withAuthorization(async settings=>{const {syncPolicy}=await import('./core/property-sync.mjs');return propertyStore.saveSettings(settings,syncPolicy(loaded.site));}));
 ipcMain.handle('cbpm:property:sync:overrides',withAuthorization(async()=>{throw Error('Publiseringsvalg lagres direkte på XML-serveren. Eksport er ikke lenger nødvendig.');}));
 ipcMain.handle('cbpm:property:sync:export',withAuthorization(async()=>{
  const chosen=await dialog.showOpenDialog(mainWindow,{title:'Opprett NY privat XML-serverinstallasjon (aldri overskriv eksisterende)',defaultPath:await projectExport(),properties:['openDirectory','createDirectory']});
  if(chosen.canceled||!chosen.filePaths.length)return null;
  const {exportPrivateSyncKit}=await import('./core/property-sync.mjs');
  return exportPrivateSyncKit({root:loaded.root,destination:chosen.filePaths[0],site:loaded.site});
 }));
 ipcMain.handle('cbpm:property:import-preview',withAuthorization(async payload=>propertyStore.preview(payload)));
 ipcMain.handle('cbpm:property:import-approve',withAuthorization(async payload=>propertyStore.approve(payload)));
 ipcMain.handle('cbpm:property:import-discard',withAuthorization(async()=>propertyStore.discard()));
 const geocoder=(await import('./core/property-geocoding.mjs')).createGeocoder();
 ipcMain.handle('wset:property:address-search',withAuthorization(async request=>geocoder.search(request)));
 ipcMain.handle('wset:property:address-select',withAuthorization(async index=>geocoder.select(index)));
 ipcMain.handle('cbpm:property:local-catalog',withAuthorization(async options=>{
  const {localPropertyCatalog}=await import('./core/local-property-catalog.mjs');
  return localPropertyCatalog(loaded.root,{...(options||{}),site:loaded.site});
 }));
 ipcMain.handle('wset:property:export-category',withAuthorization(async category=>{
  if(!['New','Existing'].includes(category))throw Error('Ugyldig kategori.');
  const project=loaded;
  const chosen=await dialog.showSaveDialog(mainWindow,{title:'Eksporter '+(category==='New'?'nybygg':'bruktboliger'),defaultPath:join(await projectExport(),category==='New'?'WSET-Nybygg.zip':'WSET-Bruktboliger.zip'),filters:[{name:'Boligeksport ZIP',extensions:['zip']}]});
  if(chosen.canceled||!chosen.filePath)return null;
  if(loaded!==project)throw Error('Prosjektet er endret.');
  exportRunning=true;
  try{
   if(JSON.stringify(project.site)!==snapshot){const answer=await dialog.showMessageBox(mainWindow,{type:'question',message:'Lagre prosjektet før boligeksport?',buttons:['Avbryt','Lagre og eksporter'],defaultId:1,cancelId:0});if(answer.response!==1)return null;}
   const saved=await storage.persistDesignerProject(project);project.revision=saved.revision;snapshot=JSON.stringify(project.site);
   const result=await (await import('./core/property-owned-feed.mjs')).exportPropertyCategory({root:project.root,site:project.site,category,destination:chosen.filePath});
   return {...result,projectState:state()};
  }finally{exportRunning=false;}
 }));
 ipcMain.handle('cbpm:property:local-import',withAuthorization(async({category})=>{
  if(!['New','Existing'].includes(category))throw Error('Velg nybygg eller eksisterende.');
  const selected=await dialog.showOpenDialog(mainWindow,{title:'Importer XML til WSET-prosjektet',properties:['openFile'],filters:[{name:'Kyero XML',extensions:['xml']}]});
  if(selected.canceled||!selected.filePaths.length)return null;
  const {importLocalFeed}=await import('./core/local-property-feeds.mjs');
  const imported=await importLocalFeed({root:loaded.root,source:selected.filePaths[0],category});
  const {activateImportedCategory}=await import('./core/property-publication.mjs');
  const publication=activateImportedCategory(loaded.site,category,imported.count);
  if(publication.activated.length){history.record(loaded.site,publication.site);loaded.site=publication.site;}
  return {...imported,publicationActivated:publication.activated,projectState:state()};
 }));
 ipcMain.handle('cbpm:property:open-existing-images',withAuthorization(async()=>{
  const dir=join(loaded.root,'project/property-feeds/Existing/images');
  await (await import('node:fs/promises')).mkdir(dir,{recursive:true});
  const error=await shell.openPath(dir);
  if(error)throw Error('Kunne ikke åpne bildemappen: '+error);
  return dir;
 }));
 ipcMain.handle('cbpm:property:xml-template',withAuthorization(async()=>{
  const {exampleOwnXML}=await import('./core/property-xml.mjs');
  const choice=await dialog.showSaveDialog(mainWindow,{title:'Lagre Kyero v3 XML-mal for egne eiendommer',defaultPath:join(await projectExport(),'CBPM-egne-eiendommer-mal.xml'),filters:[{name:'Kyero XML',extensions:['xml']}]});
  if(choice.canceled||!choice.filePath)return null;
  await writeFile(choice.filePath,exampleOwnXML(),'utf8');return choice.filePath;
 }));
 ipcMain.handle('cbpm:property:import-upload',withAuthorization(async({folder})=>{
  if(!['New','Existing'].includes(String(folder)))throw Error('Velg New eller Existing som XML-mappe.');
  const chosen=await dialog.showOpenDialog(mainWindow,{title:'Velg Kyero v3/XML-fil for import',properties:['openFile'],filters:[{name:'Kyero/XML',extensions:['xml']}]});
  if(chosen.canceled||!chosen.filePaths.length)return null;
  const {basename}=require('node:path');const {stat}=require('node:fs/promises');
  const file=chosen.filePaths[0],metadata=await stat(file);
  if(!metadata.isFile()||metadata.size<10||metadata.size>25*1024*1024||!file.toLowerCase().endsWith('.xml'))throw Error('Velg en XML-fil på maks 25 MB.');
  return propertyStore.stage({folder,filename:basename(file),bytes:await readFile(file)});
 }));
 ipcMain.handle('wset:property-draft:images',withAuthorization(async({remaining=100}={})=>{
  if(!Number.isInteger(remaining)||remaining<1||remaining>250)throw Error('Ugyldig antall bilder.');
  const project=loaded;const chosen=await dialog.showOpenDialog(mainWindow,{title:'Importer boligbilder',properties:['openFile','multiSelections'],filters:[{name:'Bilder',extensions:['jpg','jpeg','png','webp','avif','tif','tiff']}]});
  if(chosen.canceled||!chosen.filePaths.length)return [];
  if(chosen.filePaths.length>Math.min(100,remaining))throw Error('For mange valgte bilder.');
  if(project!==loaded)throw Error('Prosjektet er endret.');
  const photos=await (await import('./core/property-draft-images.mjs')).importDraftImages({root:project.root,sources:chosen.filePaths});
  if(project!==loaded)throw Error('Prosjektet er endret.');return photos;
 }));
 ipcMain.handle('cbpm:change',withAuthorization(async command=>{
  if(JSON.stringify(command).length>(['language:import','language:auto-translate'].includes(command.action)?800000:['property-draft:save','property-draft:prepare'].includes(command.action)?200000:40000))throw Error('For stor endring.');
  if(command.action==='team:add-samples'){
   const {installDemoTeam}=await import('./core/demo-team.mjs');
   const installed=await installDemoTeam({root:loaded.root,templateRoot:loaded.root,site:loaded.site});
   if(installed.added){history.record(loaded.site,installed.site);loaded.site=installed.site;}
   return {...state(),demoTeamAdded:installed.added};
  }
  if(command.action==='media:remove'&&!loaded.site.media?.items?.some(m=>m.id===command.id)){
   const project=loaded,site=loaded.site;await (await import('./core/media-catalog.mjs')).verifyLegacyRemoval(project.root,site,command.id,command.src);
   if(loaded!==project||loaded.site!==site)throw Error('Prosjektet er endret. Prøv på nytt.');
  }
  if(command.action==='property-marking:set'){
   const project=loaded,old=loaded.site;const {localPropertyCatalog}=await import('./core/local-property-catalog.mjs');
   const category=String(command.source).startsWith('new--')?'New':'Existing';
   const result=await localPropertyCatalog(project.root,{category,identity:{source:command.source,id:command.id},pageSize:1});
   if(!result.records.some(r=>r.identity.sourceCode===command.source&&r.identity.externalId===command.id))throw Error('Fant ikke boligen i XML-registeret.');
   if(project!==loaded||old!==loaded.site)throw Error('Prosjektet er endret.');
  }
  const result=ops.applyEditorCommand(loaded.site,command);
  if(['property-draft:save','property-draft:prepare'].includes(command.action)){
   const project=loaded,old=loaded.site;const rec=result.site.propertyDrafts.items.find(x=>x.id===command.id)||result.site.propertyDrafts.items.at(-1);
   await (await import('./core/property-draft-images.mjs')).verifyDraftPhotos(project.root,rec.data.photos);
   if(project!==loaded||old!==loaded.site)throw Error('Prosjektet er endret. Prøv igjen.');
  }
  history.record(loaded.site,result.site);
  loaded.site=result.site;
  return {...state(),selection:result.selection};
 }));
 ipcMain.handle('cbpm:undo',withAuthorization(async()=>{const previous=history.undo(loaded.site);if(previous){if(loaded.site.propertyDrafts?.publicationManaged){previous.propertyDrafts??={version:1,items:[]};previous.propertyDrafts.publicationManaged=true;}if(loaded.site.propertyMarkings?.managed?.length){previous.propertyMarkings??={version:1,managed:[],items:[]};previous.propertyMarkings.managed=[...new Set([...previous.propertyMarkings.managed,...loaded.site.propertyMarkings.managed])];}loaded.site=previous;}return state()}));
 ipcMain.handle('cbpm:redo',withAuthorization(async()=>{const next=history.redo(loaded.site);if(next){if(loaded.site.propertyMarkings?.managed?.length){next.propertyMarkings??={version:1,managed:[],items:[]};next.propertyMarkings.managed=[...new Set([...next.propertyMarkings.managed,...loaded.site.propertyMarkings.managed])];}loaded.site=next;}return state()}));
 ipcMain.handle('cbpm:language:entries',withAuthorization(async(locale)=>{
  const {workspaceLanguageData}=await import('./core/language-workspace.mjs');
  return workspaceLanguageData(loaded.site,locale);
 }));
 ipcMain.handle('cbpm:language:choose-import',withAuthorization(async()=>{
  const file=await dialog.showOpenDialog(mainWindow,{title:'Importer CBPM-språkfil (JSON)',properties:['openFile'],filters:[{name:'CBPM JSON-språkfil',extensions:['json']}]});
  if(file.canceled||!file.filePaths.length)return null;
  const bytes=await readFile(file.filePaths[0]);if(bytes.length>1000000)throw Error('Språkfilen er for stor (maks 1 MB).');
  let pack;try{pack=JSON.parse(bytes.toString('utf8'));}catch{throw Error('Språkfilen inneholder ugyldig JSON.');}
  const {inspectLanguagePack}=await import('./engines/cbpm-astro-v1/lib/i18n-core.mjs');
  const inspection=inspectLanguagePack(loaded.site,pack);
  return {file:file.filePaths[0],pack,inspection};
 }));
 ipcMain.handle('cbpm:language:export',withAuthorization(async(locale)=>{
  const {createLanguagePack}=await import('./engines/cbpm-astro-v1/lib/i18n-core.mjs');
  const pack=createLanguagePack(loaded.site,locale);
  const answer=await dialog.showSaveDialog(mainWindow,{title:'Eksporter språkfil',defaultPath:join(await projectExport(),`CBPM-${locale}.json`),filters:[{name:'JSON-språkfil',extensions:['json']}]});
  if(answer.canceled||!answer.filePath)return null;
  await writeFile(answer.filePath,JSON.stringify(pack,null,2)+'\n','utf8');return answer.filePath;
 }));
 ipcMain.handle('cbpm:validate',withAuthorization(async()=>validate(loaded.site,{root:loaded.root})));
 ipcMain.handle('cbpm:media:list',withAuthorization(async()=>{
  const {readMediaCatalog}=await import('./core/media-catalog.mjs');
  return readMediaCatalog(loaded.site,loaded.root);
 }));
 ipcMain.handle('cbpm:media:upload',withAuthorization(async()=>{
  const files=await dialog.showOpenDialog(mainWindow,{title:'Importer foto til CBPM',properties:['openFile'],filters:[{name:'Bilder (JPG, PNG, WebP, AVIF, TIFF)',extensions:['jpg','jpeg','png','webp','avif','tif','tiff']} ]});
  if(files.canceled||!files.filePaths.length)return null;
  const {importProjectImage}=await import('./core/media-library.mjs');
  const asset=await importProjectImage({root:loaded.root,source:files.filePaths[0]});
  const next=ops.applyEditorCommand(loaded.site,{action:'media:register',media:asset}).site;
  history.record(loaded.site,next);loaded.site=next;
  return {...state(),uploaded:asset};
 }));
 ipcMain.handle('cbpm:media:batch',withAuthorization(async({logo=false}={})=>{
  const project=loaded,files=await dialog.showOpenDialog(mainWindow,{title:'Importer medier',properties:['openFile','multiSelections'],filters:[{name:'Bilder',extensions:logo?['svg','png','jpg','jpeg','webp','avif']:['jpg','jpeg','png','webp','avif','tif','tiff']}]});
  if(files.canceled||!files.filePaths.length||loaded!==project)return null;
  const {importProjectImage,importProjectLogo}=await import('./core/media-library.mjs');const uploaded=[],errors=[];
  for(const source of files.filePaths){if(loaded!==project)break;try{const asset=await (logo?importProjectLogo:importProjectImage)({root:project.root,source});if(loaded!==project)break;const next=ops.applyEditorCommand(project.site,{action:'media:register',media:asset}).site;history.record(project.site,next);project.site=next;uploaded.push(asset);}catch(e){errors.push(require('node:path').basename(source)+': '+e.message);}}
  if(loaded!==project)return null;return {...state(),uploaded,errors};
 }));
 ipcMain.handle('cbpm:media:replace',withAuthorization(async request=>{
  const project=loaded,sourceSite=project.site;
  const {readMediaCatalog,replaceRegisteredMedia}=await import('./core/media-catalog.mjs');
  const {replacementReferences,replacementKind,compatibleReplacement,rebindWebsiteMedia}=await import('./core/media-references.mjs');
  const catalog=await readMediaCatalog(sourceSite,project.root);
  const old=catalog.find(m=>m.id===request?.id);if(!old)throw Error('Bildet finnes ikke i prosjektet.');
  const refs=replacementReferences(sourceSite,old),chosen=request.all?refs:refs.filter(r=>request.referenceIds?.includes(r.id));
  const unused=!refs.length&&!old.used&&!old.legacy&&request.source==='file';
  if(!unused&&(!chosen.length||(!request.all&&(!Array.isArray(request.referenceIds)||new Set(request.referenceIds).size!==chosen.length))))throw Error('Velg en gyldig bildeplassering.');
  if(loaded!==project||project.site!==sourceSite)return null;
  const logo=unused?old.kind==='logo':replacementKind(chosen)==='logo';let asset,register=false;
  if(request.source==='library'){
   asset=catalog.find(m=>m.id===request.replacementId);if(!asset||asset.id===old.id||!compatibleReplacement(chosen,asset))throw Error('Velg et annet kompatibelt bilde.');
  }else if(request.source==='file'){
   if(!unused&&!compatibleReplacement(chosen,{kind:logo?'logo':'photo'}))throw Error('Foto og logo må erstattes separat.');
   const files=await dialog.showOpenDialog(mainWindow,{title:'Bytt bilde',properties:['openFile'],filters:[{name:'Bilder',extensions:logo?['svg','png','jpg','jpeg','webp','avif']:['jpg','jpeg','png','webp','avif','tif','tiff']}]});
   if(files.canceled||!files.filePaths.length||loaded!==project||project.site!==sourceSite)return null;
   const {importProjectImage,importProjectLogo}=await import('./core/media-library.mjs');
   asset=await (logo?importProjectLogo:importProjectImage)({root:project.root,source:files.filePaths[0],focusX:old.focusX,focusY:old.focusY});register=true;
  }else throw Error('Ukjent bildekilde.');
  if(loaded!==project||project.site!==sourceSite)return null;
  const next=unused?replaceRegisteredMedia(sourceSite,old.id,asset):rebindWebsiteMedia(sourceSite,{old,replacement:asset,referenceIds:request.referenceIds,all:request.all===true,register});
  history.record(sourceSite,next);project.site=next;return {...state(),replacementId:unused?old.id:asset.id,replacedCount:chosen.length};
 }));
 ipcMain.handle('cbpm:media:download',withAuthorization(async id=>{
  const project=loaded,item=project.site.media?.items?.find(m=>m.id===id);if(!item||!/^project\/media\/originals\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|tif|tiff|svg)$/.test(item.original||''))throw Error('Ingen lagret original.');
  const dest=await dialog.showSaveDialog(mainWindow,{defaultPath:require('node:path').basename(item.originalName||item.original)});if(dest.canceled||!dest.filePath||loaded!==project)return false;await require('node:fs/promises').copyFile(join(project.root,item.original),dest.filePath);return true;
 }));
 ipcMain.handle('cbpm:logo:upload',withAuthorization(async()=>{
  const files=await dialog.showOpenDialog(mainWindow,{title:'Importer logo uten beskjæring',properties:['openFile'],filters:[{name:'Logo (SVG, PNG, JPG, WebP, AVIF)',extensions:['svg','png','jpg','jpeg','webp','avif']}]});
  if(files.canceled||!files.filePaths.length)return null;
  const {importProjectLogo}=await import('./core/media-library.mjs');
  const asset=await importProjectLogo({root:loaded.root,source:files.filePaths[0]});
  const next=ops.applyEditorCommand(loaded.site,{action:'media:register',media:asset}).site;
  history.record(loaded.site,next);loaded.site=next;
  return {...state(),uploaded:asset};
 }));
 ipcMain.handle('cbpm:media:reframe',withAuthorization(async({id,focusX,focusY})=>{
  if(typeof id!=='string'||id.length>80||![focusX,focusY].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('Ugyldig fokuspunkt.');
  const item=loaded.site.media?.items?.find(x=>x.id===id);
  if(!item)throw Error('Fant ikke bildet.');
  const {reframeProjectImage}=await import('./core/media-library.mjs');
  const updated=await reframeProjectImage({root:loaded.root,item,focusX,focusY});
  const previous=structuredClone(loaded.site);
  loaded.site.media.items=loaded.site.media.items.map(x=>x.id===id?updated:x);
  history.record(previous,loaded.site);return state();
 }));
 ipcMain.handle('cbpm:template:texts',withAuthorization(async({pageId,sectionId,locale})=>{
  const page=loaded.site.sitePages.find(p=>p.id===pageId),section=page?.sections.find(s=>s.id===sectionId);
  if(section?.type!=='template'||!loaded.site.languages.some(l=>l.code===locale))return [];
  const {templateFields}=await import('./core/inline-editing.mjs');
  return templateFields(loaded.site,page,section,locale);
 }));
 ipcMain.handle('cbpm:save',withAuthorization(async()=>{
  const result=await storage.persistDesignerProject(loaded);
  loaded.revision=result.revision;snapshot=JSON.stringify(loaded.site);
  return {...state(),backup:result.backup};
 }));
 ipcMain.handle('cbpm:open',withAuthorization(async()=>{
  if(!await confirmDiscard())return null;
  const selected=await dialog.showOpenDialog(mainWindow,{title:'Åpne WSET-prosjektmappe',properties:['openDirectory']});
  if(selected.canceled||!selected.filePaths.length)return null;
  const source=await require('node:fs/promises').realpath(selected.filePaths[0]);if(dirname(source)===projectDirectory())return switchToProject(source);if(dirname(source)===workspace.state().paths.archive)throw Error('Gjenopprett prosjektet fra Arkiv under Mine nettsteder.');const a=await dialog.showMessageBox(mainWindow,{type:'question',message:'Kopier eksternt prosjekt til arbeidsområdet?',detail:'Originalen beholdes. Den nye kopien får egen prosjekt-ID. Lokale passordfiler, byggecache og gamle sikkerhetskopier kopieres ikke i denne operasjonen.',buttons:['Avbryt','Kopier'],defaultId:0,cancelId:0});if(a.response!==1)return null;const dest=join(projectDirectory(),basename(source)+'-'+require('node:crypto').randomUUID().slice(0,8));const original=await storage.readDesignerProject(source);const copied=await storage.saveDesignerProjectAs({root:source,site:original.site,destination:dest});return switchToProject(copied.root);
 },{allowEmpty:true}));
 ipcMain.handle('cbpm:saveAs',withAuthorization(async()=>{
  const result=await dialog.showOpenDialog(mainWindow,{title:'Velg tom mappe for en prosjektkopi',defaultPath:projectDirectory(),properties:['openDirectory','createDirectory']});
  if(result.canceled||!result.filePaths.length)return null;
  if(dirname(resolve(result.filePaths[0]))!==projectDirectory())throw Error('Velg en ny mappe direkte under Projects.');
  const newProject=await storage.saveDesignerProjectAs({root:loaded.root,projectId:loaded.projectId,site:loaded.site,destination:result.filePaths[0]});
  return switchToProject(newProject.root);
 }));
 ipcMain.handle('cbpm:export',withAuthorization(async(webRoot='www')=>{
  if(!['www','public','public_html'].includes(webRoot))throw Error('Ugyldig webrot.');
  if(loaded.site.smartAssistant?.enabled===true){
   activeAssistantModule=await (await import('./core/module-library.mjs')).selectedAssistantModule({libraryRoot:moduleLibrary()});
   if(!activeAssistantModule)throw Error('Smart Assistant er aktivert. Importer en Smart Assistant modul-ZIP i publiseringsdialogen før eksport.');
  }
  const target=await dialog.showOpenDialog(mainWindow,{
   title:'Generer nettside – velg mappe for de to ZIP-filene',
   defaultPath:await projectExport(),
   properties:['openDirectory','createDirectory']
  });
  if(target.canceled||!target.filePaths?.length)return null;
  if(JSON.stringify(loaded.site)!==snapshot){
   const answer=await dialog.showMessageBox(mainWindow,{
    type:'question',title:'Lagre prosjektet først?',
    message:'Du har ulagrede endringer.',
    detail:'For å generere riktig nettside må prosjektet lagres før bygging.',
    buttons:['Lagre og generer','Avbryt'],defaultId:0,cancelId:1
   });
   if(answer.response!==0)return null;
   const saved=await storage.persistDesignerProject(loaded);
   loaded.revision=saved.revision;
   snapshot=JSON.stringify(loaded.site);
  }
  const rootAtStart=loaded.root;
  exportRunning=true;
  try{
   if(propertyStore.connected){const {syncPolicy}=await import('./core/property-sync.mjs');await propertyStore.savePolicy(syncPolicy(loaded.site));}
   const generator=await import('./core/website-generator.mjs');
   const {generateWebsite}=generator;
   const astroReady=await (async()=>{try{await (await import('node:fs/promises')).stat(join(rootAtStart,'node_modules/astro/package.json'));return true;}catch{return false;}})();
   if(!astroReady){
    const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'Forbered nettstedet lokalt',message:'Denne prosjektkopien mangler lokale byggeavhengigheter.',detail:'WSET kan hente de nødvendige npm-pakkene til prosjektmappen på PC-en. Ingen filer installeres på webhotellet. Nedlasting krever internett. Bare gjør dette for et prosjekt du stoler på.',buttons:['Avbryt','Installer lokalt og fortsett'],defaultId:0,cancelId:0});
    if(answer.response!==1)return null;
    await generator.installProjectDependencies({root:rootAtStart,onProgress:progress=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('cbpm:export-progress',progress);}});
   }

   const {listLocalFeeds,feedInventoryFingerprint}=await import('./core/local-property-feeds.mjs');
   await (await import('./core/property-owned-feed.mjs')).syncOwnFeed(rootAtStart,loaded.site);
   const feedBefore=feedInventoryFingerprint(await listLocalFeeds(rootAtStart));
   const generated=await generateWebsite({
    root:rootAtStart,destination:target.filePaths[0],expectedRevision:loaded.revision,expectedTemplate:loaded.template,webRoot,moduleRoot:activeAssistantModule?.root||null,
    onProgress:progress=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('cbpm:export-progress',progress);}
   });
   const feedAfter=feedInventoryFingerprint(await listLocalFeeds(rootAtStart));
   lastExport=generated.zipPath;lastExportInfo={root:rootAtStart,revision:JSON.stringify(loaded.site),savedDigest:loaded.revision,feedFingerprint:feedBefore,publicZip:generated.zipPath,privateZip:generated.privateZipPath,webRoot:generated.webRoot,moduleRoot:activeAssistantModule?.root||null,digests:await (await import('./core/server-publication.mjs')).archiveDigests(generated.zipPath,generated.privateZipPath)};
   if(feedAfter!==feedBefore)generated.warnings=[...(generated.warnings||[]),'XML-kildene ble endret under eksport. Generer nettsiden på nytt.'];
   if(loaded.site.propertyDrafts?.publicationManaged&&!loaded.site.propertyDrafts.items.some(r=>r.publication?.data))generated.warnings=[...(generated.warnings||[]),'Ingen egne boliger er klargjort. Fjern tidligere storage/imports/Existing/wset-egne-boliger.xml manuelt på serveren.'];
   try{await workspace.recordPublication(rootAtStart,{kind:'export',outcome:'completed',digest:loaded.revision});}catch(error){generated.warnings=[...(generated.warnings||[]),'Eksporten er ferdig, men lokal publiseringshistorikk kunne ikke lagres: '+error.message];}
   return {...generated,project:state()};
  }finally{exportRunning=false;}
 }));
 ipcMain.handle('wset:publication:status',withAuthorization(async()=>{
  const {listLocalFeeds,feedInventoryFingerprint}=await import('./core/local-property-feeds.mjs');
  const ready=!!lastExportInfo&&lastExportInfo.root===loaded.root&&lastExportInfo.revision===JSON.stringify(loaded.site)&&lastExportInfo.moduleRoot===(activeAssistantModule?.root||null)&&lastExportInfo.feedFingerprint===feedInventoryFingerprint(await listLocalFeeds(loaded.root));
  return {ready,webRoot:lastExportInfo?.webRoot||'www',server:serverManager.snapshot()};
 }));
 ipcMain.handle('wset:publication:start',withAuthorization(async input=>{
  const kind=input?.kind;if(!['website','New','Existing'].includes(kind))throw Error('Ugyldig publiseringstype.');
  const status=serverManager.snapshot();if(!status.connected||status.busy||status.profileId!==input.profileId)throw Error('Koble til riktig serverprofil først.');
  const project=loaded;exportRunning=true;
  try{
   const {websitePlan,propertyPlan}=await import('./core/server-publication.mjs');let plan;
   if(kind==='website'){
    const {listLocalFeeds,feedInventoryFingerprint}=await import('./core/local-property-feeds.mjs');
    if(!lastExportInfo||lastExportInfo.root!==project.root||lastExportInfo.revision!==JSON.stringify(project.site)||lastExportInfo.moduleRoot!==(activeAssistantModule?.root||null)||lastExportInfo.feedFingerprint!==feedInventoryFingerprint(await listLocalFeeds(project.root)))throw Error('Nettstedseksporten mangler eller er utdatert. Generer nettsiden på nytt.');
    plan=await websitePlan({...lastExportInfo,accountRoot:input.accountRoot});
   }else{
    if(JSON.stringify(project.site)!==snapshot){const answer=await dialog.showMessageBox(mainWindow,{type:'question',message:'Lagre prosjektet før boligoverføring?',buttons:['Avbryt','Lagre og fortsett'],defaultId:0,cancelId:0});if(answer.response!==1)return {started:false};}
    const saved=await storage.persistDesignerProject(project);project.revision=saved.revision;snapshot=JSON.stringify(project.site);
    const {syncOwnFeed,propertyExportEntries}=await import('./core/property-owned-feed.mjs');await syncOwnFeed(project.root,project.site);
    const result=await propertyExportEntries(project.root,kind,project.site);
    plan=propertyPlan({result,category:kind,accountRoot:input.accountRoot,webRoot:input.webRoot,replaceSupplier:input.replaceSupplier===true,removeOwn:input.removeOwn===true});
   }
   return {...await serverManager.startPublication(plan,input.profileId,{digest:kind==='website'?lastExportInfo.savedDigest:undefined}),project:state()};
  }finally{exportRunning=false;}
 }));
 ipcMain.handle('cbpm:reveal-export',withAuthorization(async()=>{
  if(!lastExport)throw Error('Ingen eksport er generert ennå.');
  shell.showItemInFolder(lastExport);
  return true;
 }));
 const preferences=require('./core/workspace-preferences.cjs').createWorkspacePreferences(join(unified.paths.settings,'ui-preferences.json'),unified.legacyProjectIds);
 ipcMain.on('wset:workspace:preference',(event,action,key,value)=>{try{authorize(event);if(action==='get')event.returnValue={value:preferences.get(key)};else if(switchBusy||exportRunning)throw Error('Arbeidsområdet er opptatt.');else if(action==='set')event.returnValue={value:preferences.set(key,value)};else if(action==='import')event.returnValue={value:preferences.importLegacy(key)};else throw Error('Ugyldig innstillingsoperasjon.');}catch(e){event.returnValue={error:e.message};}});
 const resume=require('./core/update-resume.cjs');
 const runtimeDir=app.getPath('userData');
 if(packagedWindows){try{const previous=await resume.consume(runtimeDir,app.getVersion(),workspace.state());if(previous){const next=await storage.readDesignerProject(previous.root);await serverManager.setScope(next.root,previous.id);loaded={...next,projectId:previous.id};snapshot=next.sourceSnapshot??JSON.stringify(next.site);history.reset();propertyStore=new (await import('./core/property-remote.mjs')).RemotePropertyStore();}}catch(e){console.warn('Gjenåpning etter oppdatering:',e.message);}}
 const {createApplicationUpdater}=require('./core/application-updater.cjs');
 let updater=null,updateEnabled=packagedWindows;
 if(updateEnabled){try{updater=new (require('electron-updater').NsisUpdater)();}catch(e){console.warn('Oppdateringsmotor:',e.message);updateEnabled=false;}}
 applicationUpdater=createApplicationUpdater({current:app.getVersion(),enabled:updateEnabled,updater,
  onState:value=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('wset:update:state',value);},
  guard:async()=>{if(inFlight||exportRunning||switchBusy||switchPlan||translationWarmRunning||serverManager.snapshot().busy||propertyStore?.connected)throw Error('Fullfør pågående operasjoner, malbytte og koble fra eiendomsserveren før oppdatering.');await checkWorkspaceRoot(workspace.state().root);},
  confirm:async c=>{const dirty=loaded&&JSON.stringify(loaded.site)!==snapshot;const a=await dialog.showMessageBox(mainWindow,{type:'question',title:'Oppdater WSET',message:dirty?'Du har ulagrede endringer. Lagre før oppdatering til '+c.version+'?':'Installer WSET '+c.version+'?',detail:'Kun programmet oppdateres. WSET startes på nytt. Arbeidsområdet og publiserte nettsteder endres ikke av installasjonsprogrammet.',buttons:dirty?['Avbryt','Lagre og oppdater','Ikke lagre']:['Avbryt','Oppdater nå'],defaultId:0,cancelId:0,noLink:true});if(a.response===0)return false;if(dirty&&a.response===1){const saved=await storage.persistDesignerProject(loaded);loaded.revision=saved.revision;snapshot=JSON.stringify(loaded.site);}return true;},
  beforeInstall:async c=>{updatePreparing=true;clearInterval(libraryTimer);while(libraryScanning)await new Promise(r=>setTimeout(r,50));await gallerySessions.close();await resume.remember(runtimeDir,{version:c.version,workspace:workspace.state().root,projectId:loaded?.projectId||null,projectRoot:loaded?.root||null});galleryShutdown=true;updateQuit=true;},
  recover:async()=>{if(!updatePreparing)return;updatePreparing=false;updateQuit=false;galleryShutdown=false;await resume.clear(runtimeDir);libraryTimer=setInterval(()=>void syncLibrary(),5000);libraryTimer.unref?.();}
 });
 ipcMain.handle('wset:update:status',event=>{authorizeSender(event);return applicationUpdater.status();});
 ipcMain.handle('wset:update:check',event=>{authorizeSender(event);return applicationUpdater.check();});
 ipcMain.handle('wset:update:install',event=>{authorizeSender(event);return applicationUpdater.install();});
 await mainWindow.loadFile(join(__dirname,'ui/index.html'));
 void syncLibrary();void workspace.projects().catch(error=>console.warn('Project registry:',error.message));libraryTimer=setInterval(()=>void syncLibrary(),5000);libraryTimer.unref?.();
 if(updateEnabled){setTimeout(()=>void applicationUpdater.check(),2500).unref?.();updateTimer=setInterval(()=>void applicationUpdater.check(),30*60*1000);updateTimer.unref?.();}
 mainWindow.on('close',event=>{
  if(updateQuit)return;
  if(applicationUpdater?.isLocked()){event.preventDefault();return;}
  if(switchBusy){event.preventDefault();return;}
  if(serverManager?.snapshot().busy){event.preventDefault();dialog.showMessageBoxSync(mainWindow,{type:'info',message:'En serveroperasjon pågår.',detail:'Fullfør eller avbryt overføringen før du avslutter WSET.',buttons:['OK']});return;}
  if(!loaded||JSON.stringify(loaded.site)===snapshot)return;
  const option=dialog.showMessageBoxSync(mainWindow,{type:'warning',buttons:['Avbryt','Forkast endringer'],defaultId:0,cancelId:0,title:'Ulagrede endringer',message:'Du har ulagrede endringer. Avslutte uten å lagre?'});
  if(option!==1)event.preventDefault();
 });
}
async function smokePackagedApp(){
 try{
  await require('sharp')({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
  if(typeof require('electron-updater').NsisUpdater!=='function')throw Error('Updater library missing');
  if(typeof require('ssh2').Client!=='function'||typeof require('basic-ftp').Client!=='function')throw Error('Server libraries missing');
  for(const name of ['js','css'])await readFile(join(editorRoot,'node_modules','maplibre-gl','dist','maplibre-gl.'+name));
  await import('./core/renderer-runtime.mjs');await readFile(join(__dirname,'ui/index.html'));
  if(packagedWindows){const config=await readFile(join(process.resourcesPath,'app-update.yml'),'utf8');for(const [key,value] of Object.entries({provider:'github',owner:'rengelse',repo:'WSET',channel:'latest'}))if(!new RegExp('^'+key+':\\s*'+value+'\\s*$', 'm').test(config))throw Error('Invalid packaged update feed: '+key);if((await readFile(join(process.resourcesPath,'wset-install-owner.txt'),'utf8')).trim()!==packaging.APP_ID)throw Error('Missing installation marker');}
  app.exit(0);
 }catch(error){console.error('Packaged WSET smoke:',error);app.exit(1);}
}
if(packagingSmoke)app.whenReady().then(smokePackagedApp);else if(!app.requestSingleInstanceLock())app.exit(0);else app.whenReady().then(start).catch(error=>{dialog.showErrorBox('WSET kunne ikke starte',String(error.stack||error));app.quit()});
app.on('window-all-closed',()=>{app.quit()});
app.on('before-quit',event=>{if(applicationUpdater?.isLocked()&&!updateQuit){event.preventDefault();return;}if(switchBusy){event.preventDefault();return;}clearInterval(updateTimer);clearInterval(libraryTimer);if(gallerySessions&&!galleryShutdown){event.preventDefault();galleryShutdown=true;gallerySessions.close().then(()=>switchCore.disposeTemplateSwitch(switchPlan)).catch(e=>console.warn('Gallery cleanup:',e.message)).finally(()=>app.quit());return;}serverManager?.close();translationRuntime?.close();preview?.close().catch(()=>{})});
