# Optional Chromium renderer regression harness (requires Python Playwright and Chromium).
# CSP is removed only in this harness; IPC, localStorage and iframe transport are mocked.
# This is not an Electron or real preview-server integration test.
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os,subprocess
root=Path(__file__).resolve().parents[1]; ui=root/'designer/ui'
site=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {readFile} from 'node:fs/promises';import {migrateProjectForDesigner} from './designer/core/project-migrations.mjs';console.log(JSON.stringify(migrateProjectForDesigner(JSON.parse(await readFile('./designer/compat/website-seed.json','utf8')))));"],cwd=root,text=True))
html=(ui/'index.html').read_text();html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>','',html);html=re.sub(r'<script src="[^"]+" defer></script>','',html);html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ui/'style.css').read_text()+'</style>')
state={'root':'C:/Test/CBPM','site':site,'previewBase':'http://127.0.0.1:43210','dirty':True,'canUndo':True,'canRedo':False,'report':{'ok':True,'warnings':[],'errors':[]}}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox']);pg=b.new_page(viewport={'width':1600,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
 pg.evaluate('''state=>{const storage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});window.previewLoads=[];window.openCount=0;let opened=false;window.cbpm={state:async()=>opened?state:null,onExportProgress:()=>{},recentProjects:async()=>[{root:state.root,name:state.site.brand.displayName}],openRecent:async()=>{opened=true;window.openCount++;return state},mediaList:async()=>[],propertyRemoteStatus:async()=>({connected:false}),propertyLocalCatalog:async()=>({records:[],files:[],errors:[],page:1,total:0,pages:1,allTotal:0}),templateTexts:async()=>[],assistantModuleStatus:async()=>({version:'1.8.1'}),health:async()=>({metrics:{pages:{active:7,total:8,hidden:1},properties:{count:0,files:0},languages:{active:11,total:10,translated:10},media:{count:0}},issues:[],areas:[],languages:[],export:{status:'Ikke generert'},validity:{ok:true}}),languageEntries:async()=>({entries:[],report:{translated:0,total:0,missing:[],complete:true}})};const frame=document.getElementById('site-preview');Object.defineProperty(frame,'src',{set(v){window.previewLoads.push(v);queueMicrotask(()=>{frame.dispatchEvent(new Event('load'));window.dispatchEvent(new MessageEvent('message',{origin:state.previewBase,source:frame.contentWindow,data:{kind:'wset-preview-ready',href:v}}))})},get(){return window.previewLoads.at(-1)||''}});}''',state)
 for name in ['app-i18n.js','property-drafts.js','property-manager.js','language-workspace.js','app.js']:pg.evaluate((ui/name).read_text())
 pg.get_by_role('button',name='Fortsett redigering').wait_for(timeout=3000)
 pg.locator('[data-area=library]').click();pg.locator('[data-library-root]').click();pg.locator('[data-sidebar-section=home-hero]').wait_for(timeout=3000)
 pg.locator('[data-page=services]').click();pg.locator('[data-sidebar-section]').first.click();pg.locator('[data-device=tablet]').click();pg.locator('#preview-lang').select_option('en');pg.wait_for_timeout(100)
 pg.evaluate("window.dispatchEvent(new MessageEvent('message',{origin:'http://127.0.0.1:43210',source:document.getElementById('site-preview').contentWindow,data:{kind:'cbpm-preview-scroll',y:480}}))");pg.wait_for_timeout(250)
 expected=pg.evaluate("JSON.parse(localStorage.getItem('wset-workspace-v1:C:/Test/CBPM'))")
 assert expected['pageId']=='services' and expected['sectionId'] and expected['locale']=='en' and expected['device']=='tablet' and expected['scroll']==480,expected
 n=pg.evaluate('previewLoads.length')
 for a in ['overview','library','server','publishing','properties','media','languages']:
  pg.locator(f'[data-area={a}]').click();pg.locator('[data-area=website]').click();pg.locator('#preview-outer').wait_for(timeout=3000);assert pg.locator('[data-page=services]').get_attribute('aria-current')=='page';assert pg.locator('#preview-lang').input_value()=='en';assert pg.locator('[data-device=tablet]').get_attribute('aria-pressed')=='true';assert pg.locator('.tree-section-row.active').count()==1;assert pg.locator('#dirty-tag').is_visible();assert pg.evaluate('openCount')==1;assert pg.evaluate("JSON.parse(localStorage.getItem('wset-workspace-v1:C:/Test/CBPM')).scroll")==480
 assert pg.evaluate('previewLoads.length')==n,(n,pg.evaluate('previewLoads'))
 # Error-document load without bridge acknowledgement invalidates the cached preview.
 pg.evaluate("document.getElementById('site-preview').dispatchEvent(new Event('load'))")
 pg.locator('[data-area=overview]').click();pg.locator('[data-area=website]').click();pg.wait_for_timeout(100);assert pg.evaluate('previewLoads.length')==n+1
 pg.locator('[data-area=settings]').click();pg.locator('[data-area=website]').click();pg.wait_for_timeout(100);assert pg.locator('[data-page=services]').get_attribute('aria-current')=='page';assert pg.locator('#preview-lang').input_value()=='en';assert pg.locator('.tree-section-row.active').count()==1;assert pg.evaluate('openCount')==1
 for width in [1600,1200,1040]:
  pg.set_viewport_size({'width':width,'height':900});pg.wait_for_timeout(100);bounds=pg.evaluate('''()=>{const c=document.querySelector('.canvas-head').getBoundingClientRect();return [...document.querySelectorAll('.canvas-head button')].map(x=>{const r=x.getBoundingClientRect();return [x.id,r.left>=c.left-1,r.right<=c.right+1]})}''');assert all(all(x[1:]) for x in bounds),(width,bounds)
 assert not errors,errors
 print('PASS: actual renderer, mock IPC and iframe transport; 8 area round-trips and failed-preview recovery, dirty state, selected page/section/language/device, no project reopen, no redundant preview reload, toolbar at 1600/1200/1040 px.');b.close()
