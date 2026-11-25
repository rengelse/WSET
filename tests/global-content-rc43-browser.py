# Optional Chromium test. The UI uses simulated IPC; language commands and catalogue data
# are evaluated by the actual Node core, not hand-written translation fixtures.
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os,subprocess,zipfile
root=Path(__file__).resolve().parents[1]; ui=root/'designer/ui'
raw=(root/'designer/compat/website-seed.json').read_text()
if os.environ.get('WSET_PROJECT_ZIP'):
 with zipfile.ZipFile(os.environ['WSET_PROJECT_ZIP']) as z: raw=z.read('project/website.json').decode()
node="""import {readFileSync} from 'node:fs';import {migrateProjectForDesigner} from './designer/core/project-migrations.mjs';import {applyEditorCommand} from './designer/core/editor-operations.mjs';import {workspaceLanguageData} from './designer/core/language-workspace.mjs';import {globalDefaults} from './designer/engines/cbpm-astro-v1/lib/global-content.mjs';const arg=JSON.parse(readFileSync(0,'utf8'));const site=arg.command?applyEditorCommand(arg.site,arg.command).site:migrateProjectForDesigner(arg.site);console.log(JSON.stringify({site,globalDefaults:globalDefaults(site),data:Object.fromEntries(site.languages.map(l=>[l.code,workspaceLanguageData(site,l.code)]))}));"""
def evaluate(site,command=None):return json.loads(subprocess.check_output(['node','--input-type=module','-e',node],input=json.dumps({'site':site,'command':command}),cwd=root,text=True))
current=evaluate(json.loads(raw));history=[];redo=[]
def mutation(command):
 global current
 history.append(current);redo.clear();current=evaluate(current['site'],command);return current

def undo():
 global current
 redo.append(current);current=history.pop();return current
html=(ui/'index.html').read_text();html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>','',html);html=re.sub(r'<script src="[^"]+" defer></script>','',html);html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ui/'style.css').read_text()+'</style>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM') or '/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1600,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
 # Test harness uses data URIs only for bundled flags because about:blank has no file origin.
 import base64
 flag_data={x.stem:'data:image/svg+xml;base64,'+base64.b64encode(x.read_bytes()).decode() for x in (ui/'flags').glob('*.svg')}
 pg.evaluate('''flags=>{new MutationObserver(()=>{for(const img of document.querySelectorAll('img[src^="./flags/"]')){const key=img.getAttribute('src').split('/').pop().split('.')[0];if(flags[key])img.src=flags[key];}}).observe(document.body,{childList:true,subtree:true});}''',flag_data)
 pg.expose_function('coreChange',mutation);pg.expose_function('coreUndo',undo)
 pg.evaluate('''initial=>{const storage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});let result=initial,opened=false;const state=()=>({root:'C:/Test/CBPM',site:result.site,globalDefaults:result.globalDefaults,previewBase:'http://127.0.0.1:43210',dirty:window.dirty??false,canUndo:true,canRedo:false,report:{ok:true,warnings:[],errors:[]}});window.cbpm={state:async()=>opened?state():null,onExportProgress:()=>{},recentProjects:async()=>[{root:state().root,name:state().site.brand.displayName}],openRecent:async()=>{opened=true;return state()},mediaList:async()=>[],propertyRemoteStatus:async()=>({connected:false}),propertyLocalCatalog:async()=>({records:[],files:[],errors:[],page:1,total:0,pages:1,allTotal:0}),templateTexts:async()=>[],assistantModuleStatus:async()=>null,health:async()=>({metrics:{pages:{active:7,total:8,hidden:1},properties:{count:0,files:0},languages:{active:11,total:10,translated:10},media:{count:0}},issues:[],areas:[],languages:[],export:{status:'Ikke generert'},validity:{ok:true}}),languageEntries:async code=>structuredClone(result.data[code]),change:async o=>{result=await coreChange(o);window.dirty=true;return state()},undo:async()=>{result=await coreUndo();return state()},save:async()=>{window.saved=structuredClone(result.site);window.dirty=false;return state()},validate:async()=>state().report,translateContent:async r=>({text:'Traducción '+r.text}),languageExport:async code=>{window.exported=code;return 'test.json'},languageImportSelect:async()=>({pack:{format:'cbpm-language-v1',locale:'nl',reference:{},messages:{'content.pages.home.title':'Import test'}},inspection:{ok:true,changed:1,added:0,ignored:0}})};const frame=document.getElementById('site-preview');Object.defineProperty(frame,'src',{set(v){window.previewUrl=v;queueMicrotask(()=>{frame.dispatchEvent(new Event('load'));window.dispatchEvent(new MessageEvent('message',{origin:state().previewBase,source:frame.contentWindow,data:{kind:'wset-preview-ready',href:v}}))})},get(){return window.previewUrl||''}});}''',current)
 for name in ['app-i18n.js','property-drafts.js','property-manager.js','language-workspace.js','app.js']:pg.evaluate((ui/name).read_text())
 pg.get_by_role('button',name='Fortsett redigering').wait_for(timeout=3000)
 pg.locator('[data-area=library]').click();pg.locator('[data-library-root]').click();pg.locator('[data-sidebar-section=home-hero]').wait_for(timeout=3000)
 pg.locator('#preview-lang').select_option('es');pg.locator('[data-area=settings]').click();pg.locator('#settings-workspace').wait_for();assert not pg.locator('#preview-outer').is_visible();assert not pg.locator('.workspace>.sidebar').is_visible();assert not pg.locator('.workspace>.inspector').is_visible()
 assert pg.locator('#settings-workspace [data-field=displayName]').input_value()==current['site']['brand']['displayName']
 pg.locator('#toast').wait_for(state='hidden',timeout=7000);pg.screenshot(path=os.environ.get('WSET_SCREENSHOT','/tmp/w40-settings.png'))
 def category(key):pg.locator('.sw-nav [data-sw-category='+key+']').click()
 category('global');assert 'DESIGN MAL 01' in pg.locator('[data-global-section=footer][data-field=extra]').input_value()
 pg.locator('[data-global-section=footer][data-field=showExtra]').uncheck();pg.wait_for_function("!document.querySelector('[data-global-section=footer][data-field=showExtra]').checked")
 pg.locator('#sw-save').click();pg.wait_for_function("window.saved?.globalContent?.footer?.showExtra===false");assert 'DESIGN MAL 01' not in pg.locator('.sw-footer-preview').inner_text()
 category('legal');assert pg.locator('[data-global-section=legal][data-field=body]').input_value();pg.locator('#sw-global-doc').select_option('privacy');pg.locator('[data-global-section=legal][data-field=title]').fill('Personvern CBPM');pg.locator('[data-global-section=legal][data-field=body]').fill('Dette er vår personvernerklæring.\nNytt avsnitt.');pg.locator('[data-global-section=legal][data-field=body]').press('Tab');pg.locator('[data-global-section=legal][data-field=enabled]').check();pg.locator('#sw-save').click();pg.wait_for_function("window.saved?.globalContent?.legal?.documents?.privacy?.enabled===true");assert current['site']['globalContent']['legal']['documents']['privacy']['body']['no']=='Dette er vår personvernerklæring.\nNytt avsnitt.'
 pg.locator('#sw-global-locale').select_option('es');pg.locator('[data-sw-action=global-translate]').click();pg.wait_for_function("document.querySelector('#toast').textContent.includes('Oversettelse lagret')");assert current['site']['globalContent']['legal']['documents']['privacy']['body']['es'].startswith('Traducción ')
 pg.locator('#sw-global-locale').select_option('no');pg.locator('.sw-legal-preview summary').click();assert 'Nytt avsnitt.' in pg.locator('.sw-legal-preview').inner_text();pg.screenshot(path=os.environ.get('WSET_SCREENSHOT','/tmp/w43-legal.png'))
 category('global');assert not pg.locator('[data-global-section=footer][data-field=showExtra]').is_checked();pg.screenshot(path=os.environ.get('WSET_FOOTER_SCREENSHOT','/tmp/w43-footer.png'))
 for w in (1600,1366,1200,1040):
  pg.set_viewport_size({'width':w,'height':950});pg.wait_for_timeout(80);assert pg.locator('#settings-workspace').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),w
 category('assistant');assert pg.locator('[data-command="assistant:identity"]').count()>0 or pg.locator('[data-field=enabled]').is_visible()
 assert not errors,errors
 print('PASS: actual core-backed global footer, legal document, translation (mock), save, preview and four viewport widths.');b.close()
