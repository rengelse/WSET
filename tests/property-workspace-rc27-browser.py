# Chromium integration harness with mocked IPC, actual WSET renderer and XML catalogue shape.
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os,subprocess
root=Path(__file__).resolve().parents[1]; ui=root/'designer/ui'
site=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {readFile} from 'node:fs/promises';import {migrateProjectForDesigner} from './designer/core/project-migrations.mjs';console.log(JSON.stringify(migrateProjectForDesigner(JSON.parse(await readFile('./designer/compat/website-seed.json','utf8')))));"],cwd=root,text=True))
html=(ui/'index.html').read_text();html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>','',html);html=re.sub(r'<script src="[^"]+" defer></script>','',html);html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ui/'style.css').read_text()+'</style>')
state={'root':'C:/Test/CBPM','site':site,'previewBase':'http://127.0.0.1:43210','dirty':False,'canUndo':False,'canRedo':False,'report':{'ok':True,'warnings':[],'errors':[]}}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM') or '/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1600,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html);pg.set_default_timeout(4000)
 pg.evaluate('''state=>{const storage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});window.catalogCalls=[];window.importCalls=[];window.openCount=0;window.remoteCalls=[];window.remoteStatusCalls=0;let connected=false;let all=Array.from({length:34},(_,i)=>({category:i<32?'New':'Existing',filename:i<32?'new.xml':'old.xml',identity:{sourceCode:i<32?'new--new':'existing--old',externalId:String(i%32),reference:'REF-'+(i%32)},listing:{type:i%2?'Villa':'Apartment',city:i%2?'Rojales':'Torrevieja',price:250000+i*1000,currency:'EUR',beds:3,baths:2,builtArea:120,plotArea:200},images:[],features:['Terrace'],descriptions:{no:'Beskrivelse av eiendom '+i}}));window.cbpm={state:async()=>state,onExportProgress:()=>{},recentProjects:async()=>[{root:state.root,name:state.site.brand.displayName}],mediaList:async()=>[],propertyRemoteStatus:async()=>{window.remoteStatusCalls++;return {connected,endpoint:''}},propertyLocalCatalog:async(o)=>{window.catalogCalls.push(o);const rows=all.filter(r=>r.category===o.category),f=rows.filter(r=>(!o.query||r.identity.reference.includes(o.query))&&(!o.type||r.listing.type===o.type)&&(!o.city||r.listing.city===o.city));return {records:f.slice((o.page-1)*o.pageSize,o.page*o.pageSize),files:[{category:'New',filename:'new.xml',originalFilename:'nybygg.xml',count:32},{category:'Existing',filename:'old.xml',count:2}],counts:{New:32,Existing:2},filters:{types:['Apartment','Villa'],cities:['Rojales','Torrevieja']},errors:[],page:o.page,total:f.length,pages:Math.max(1,Math.ceil(f.length/o.pageSize)),allTotal:34}},propertyLocalImport:async c=>{window.importCalls.push(c);return null},propertyOpenExistingImages:async()=>{},templateTexts:async()=>[],assistantModuleStatus:async()=>null,health:async()=>({metrics:{pages:{active:7,total:8,hidden:1},properties:{count:34,files:2},languages:{active:11,total:10,translated:10},media:{count:0}},issues:[{severity:'warning',title:'Eiendommer-siden er skjult',detail:'Aktiver siden under Nettsider',area:'website',tab:'property-settings'}],areas:[],languages:[],export:{status:'Ikke generert'},validity:{ok:true}}),languageEntries:async()=>({entries:[],report:{translated:0,total:0,missing:[],complete:true}}),propertyRemoteConnect:async()=>{connected=true},propertyRemoteDisconnect:async()=>{connected=false},propertySyncGet:async()=>({format:1,enabled:false,sources:[]}),propertyList:async()=>({records:[{id:5,reference:'SERVER-5',city:'Rojales',price:1,currency:'EUR',publication_status:'published'}],page:1,total:1}),propertyGet:async()=>({record:{id:5,reference:'SERVER-5',revision:1,publication_status:'published',images:[],features:[],descriptions:{}}}),change:async o=>{window.remoteCalls.push(o);const site=structuredClone(state.site);if(o.action==='page:update')site.sitePages.find(p=>p.id===o.id)[o.field]=o.value;if(o.action==='property-module:update'){const m=site.propertyModules[o.id];if(o.field==='label'){m.labels??={};m.labels[o.locale]=o.value}else{m[o.field]=o.value;if(o.field==='enabled')m.visibilityExplicit=true}}state={...state,site,dirty:true};return state}};const frame=document.getElementById('site-preview');window.previewUrls=[];Object.defineProperty(frame,'src',{set(v){window.previewUrls.push(v);queueMicrotask(()=>{frame.dispatchEvent(new Event('load'));window.dispatchEvent(new MessageEvent('message',{origin:state.previewBase,source:frame.contentWindow,data:{kind:'wset-preview-ready',href:v}}))})},get(){return ''}});}''',state)
 for name in ['app-i18n.js','property-drafts.js','property-manager.js','language-workspace.js','app.js']:pg.evaluate((ui/name).read_text())
 pg.locator('[data-area=properties]').click(timeout=5000);pg.locator('[data-local-category=New]').wait_for();pg.locator('.pm-register-table tbody tr').first.wait_for()
 assert pg.locator('.pm-register-table tbody tr').count()==25
 assert pg.locator('[data-local-category=New] strong').inner_text()=='32'
 assert pg.locator('[data-local-category=Existing] strong').inner_text()=='2'
 assert not pg.locator('.workspace>.sidebar').is_visible() and not pg.locator('.workspace>.inspector').is_visible()
 assert pg.locator('.pm-detail').count()==0
 pg.locator('[data-local-category=Existing]').click();pg.wait_for_function("document.querySelectorAll('.pm-register-table tbody tr').length===2")
 pg.locator('[data-local-import]').first.click();assert pg.evaluate('importCalls.at(-1)')=='Existing'
 pg.locator('.pm-row-select').first.click();assert pg.locator('.pm-detail').is_visible();assert 'Bruktboliger' in pg.locator('.pm-detail-heading').inner_text()
 pg.locator('[data-local-detail=description]').click();assert 'Beskrivelse av eiendom 32' in pg.locator('.pm-description').inner_text()
 pg.locator('[data-local-detail=images]').click();assert 'Ingen bilder' in pg.locator('.pm-detail-content').inner_text()
 pg.locator('[data-local-close]').click();assert pg.locator('.pm-detail').count()==0
 pg.locator('[data-local-category=New]').click();pg.wait_for_function("document.querySelectorAll('.pm-register-table tbody tr').length===25")
 pg.locator('#local-property-type').select_option('Villa');pg.wait_for_function("document.querySelectorAll('.pm-register-table tbody tr').length===16")
 pg.locator('#local-page-size').select_option('10');pg.wait_for_function("document.querySelectorAll('.pm-register-table tbody tr').length===10")
 pg.locator('[data-local-page=next]').click();pg.wait_for_function("document.querySelectorAll('.pm-register-table tbody tr').length===6")
 pg.locator('[data-local-view=grid]').click();assert pg.locator('.pm-property-card').count()==6
 pg.locator('[data-local-view=list]').click();pg.locator('.pm-row-select').first.click()
 for w in (1600,1200,1040):
  pg.set_viewport_size({'width':w,'height':950});pg.wait_for_timeout(50)
  assert pg.locator('#pm-workspace').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),w
  assert pg.locator('.pm-main-tabs').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),w
 pg.set_viewport_size({'width':1600,'height':950});pg.screenshot(path='/tmp/wset25-property-workspace.png')
 pg.locator('[data-property-mode=sources]').click();assert 'nybygg.xml' in pg.locator('.pm-settings-card').first.inner_text();pg.locator('[data-import-category=New]').click();assert pg.evaluate('importCalls.at(-1)')=='New'
 assert pg.locator('.pm-main-tabs button').count()==3
 assert pg.locator('[data-property-mode=connection],[data-property-mode=sync],[data-property-mode=categories]').count()==0
 assert pg.locator('[data-command="property-module:update"]').count()==0
 assert pg.evaluate('remoteStatusCalls')==0
 pg.locator('[data-area=overview]').click();pg.locator('[data-overview-tab=property-settings]').click()
 pg.locator('[data-command="property-module:update"][data-field="enabled"]').first.wait_for()
 assert pg.locator('[data-page=properties]').get_attribute('aria-current')=='page'
 assert pg.locator('[data-inspector-pane=advanced]').get_attribute('aria-selected')=='true'
 page_enabled=pg.locator('#inspector-body [data-command="page:update"][data-field="enabled"]')
 assert page_enabled.count()==1
 if not page_enabled.is_checked():page_enabled.check()
 new=pg.locator('[data-module-id=developments][data-field=enabled]');old=pg.locator('[data-module-id=properties][data-field=enabled]')
 new.check();old.check();assert new.is_checked() and old.is_checked()
 new.uncheck();assert not new.is_checked() and old.is_checked()
 assert pg.locator('[data-module-id=developments][data-field=showInNavigation]').is_disabled()
 new.check();menu=pg.locator('[data-module-id=developments][data-field=showInNavigation]');menu.uncheck();assert not menu.is_checked() and new.is_checked()
 page_enabled.uncheck();assert new.is_disabled() and new.is_checked();page_enabled.check();assert new.is_checked() and not menu.is_checked()
 pg.locator('[data-inspector-pane=content]').click();assert pg.locator('[data-inspector-lang]').count()==0
 label=pg.locator('[data-module-id=developments][data-field=label]');label.fill('Nye boliger');label.press('Tab')
 pg.wait_for_function("remoteCalls.some(x=>x.action==='property-module:update'&&x.field==='label'&&x.locale==='no'&&x.value==='Nye boliger')")
 pg.locator('#preview-lang').select_option('en');label.fill('New homes');label.press('Tab');pg.wait_for_function("remoteCalls.some(x=>x.field==='label'&&x.locale==='en'&&x.value==='New homes')")
 pg.locator('#preview-lang').select_option('no');assert label.input_value()=='Nye boliger'
 pg.locator('[data-page=properties]').click();pg.locator('[data-toggle-property=developments]').wait_for()
 tree_new=pg.locator('[data-toggle-property=developments]');tree_old=pg.locator('[data-toggle-property=properties]');tree_page=pg.locator('[data-toggle-page=properties]')
 assert tree_new.is_checked() and tree_old.is_checked()
 tree_new.uncheck();assert not tree_new.is_checked() and tree_old.is_checked()
 page_row=pg.locator('.sidebar-page-wrap[data-tree-drag-page=properties] .page-row')
 assert page_row.locator(':scope > input[type=checkbox]').count()==0
 assert page_row.locator('.page-action-menu [data-toggle-page=properties]').count()==1
 assert not tree_page.is_visible()
 page_row.locator('summary').click();assert tree_page.is_visible();tree_page.uncheck();assert tree_new.is_disabled() and tree_old.is_disabled()
 if not tree_page.is_visible():page_row.locator('summary').click()
 tree_page.check();assert not tree_new.is_checked() and tree_old.is_checked()
 pg.locator('[data-tree-property=developments]').click();assert pg.locator('#inspector-title').inner_text()=='Nybygg';assert 'category=developments' in pg.evaluate('previewUrls.at(-1)')
 pg.locator('[data-inspector-pane=advanced]').click();pg.locator('[data-module-id=developments][data-field=enabled]').check();assert tree_new.is_checked()
 pg.locator('[data-tree-property=properties]').click();assert pg.locator('#inspector-title').inner_text()=='Bruktboliger';assert 'category=properties' in pg.evaluate('previewUrls.at(-1)')
 pg.locator('[data-area=overview]').click();pg.locator('[data-area=website]').click();assert pg.locator('#inspector-title').inner_text()=='Bruktboliger'
 pg.locator('[data-area=properties]').click();assert pg.locator('.pm-main-tabs button').count()==3
 pg.locator('[data-property-mode=local]').click();pg.locator('.pm-register-table').wait_for();assert pg.locator('[data-local-category=New]').count()==1
 assert not errors,errors
 print('PASS: local register, XML sources, no server calls, moved settings, health shortcut, language-specific menu labels, independent visibility and navigation, navigation and responsive layout. Mock IPC.');b.close()
