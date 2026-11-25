"""Chromium UI + actual preview/model. IPC simulated, not an Electron test.
Requires Python playwright and Chromium; run from any directory."""
from pathlib import Path
from urllib.parse import urlsplit
import json, subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];ui=root/'designer/ui';base='http://127.0.0.1:43220'
def call(op, **args):
    result=subprocess.run(['node',str(root/'tests/inline-rc20-fixture.mjs')],input=json.dumps({'op':op,**args}),text=True,capture_output=True,check=True)
    return result.stdout if op in ['preview','css'] else json.loads(result.stdout)
site=call('seed'); initial=site; changes=[]; undo=[]; redo=[]; loads=[]
def state():return {'root':'C:/Test/CBPM','site':site,'previewBase':base,'dirty':site!=initial,'canUndo':bool(undo),'canRedo':bool(redo),'report':{'ok':True,'warnings':[],'errors':[]}}
def change(payload):
    global site
    new=call('change',site=site,payload=payload);undo.append(site);redo.clear();site=new;changes.append(payload);return state()
def history(direction):
    global site
    if direction=='undo' and undo:redo.append(site);site=undo.pop()
    elif direction=='redo' and redo:undo.append(site);site=redo.pop()
    return state()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=browser.new_page(viewport={'width':1600,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.expose_function('wsetTestChange',change);pg.expose_function('wsetTestTemplate',lambda q:call('template',site=site,**q));pg.expose_function('wsetTestHistory',history);pg.expose_function('wsetTestState',state)
    pg.add_init_script('''if(window===window.top){window.cbpm={state:()=>wsetTestState(),onExportProgress:()=>{},recentProjects:async()=>[{root:'C:/Test/CBPM',name:'CBPM'}],mediaList:async()=>[],propertyRemoteStatus:async()=>({connected:false}),propertyLocalCatalog:async()=>({records:[],files:[],errors:[],page:1,total:0,pages:1,allTotal:0}),templateTexts:q=>wsetTestTemplate(q),change:q=>wsetTestChange(q),undo:()=>wsetTestHistory('undo'),redo:()=>wsetTestHistory('redo'),save:()=>wsetTestState(),assistantModuleStatus:async()=>({version:'1.8.1'}),health:async()=>({metrics:{pages:{active:7,total:8,hidden:1},properties:{count:0,files:0},languages:{active:11,total:10,translated:10},media:{count:0}},issues:[],areas:[],languages:[],export:{status:'Ikke generert'},validity:{ok:true}}),languageEntries:async()=>({entries:[],locale:'no'})};}''')
    def route(r):
        path=urlsplit(r.request.url).path
        if path.startswith('/__designer-preview/'):
            loc,page=path.strip('/').split('/')[1:3];loads.append((loc,page));r.fulfill(content_type='text/html',body=call('preview',site=site,locale=loc,pageId=page));return
        if path.startswith('/__wset-design/'):
            loc,page=path.split('/')[2:4];r.fulfill(content_type='text/css',body=call('css',site=site,locale=loc,pageId=page.removesuffix('.css')));return
        if path=='/styles.css':
            r.fulfill(content_type='text/css',body='h3{font-family:Georgia, serif;font-size:23px;font-weight:600;color:#123456} p{color:#657788}');return
        if path=='/__wset-preview-bridge.js':f=root/'designer/preview/bridge.js'
        elif path=='/__wset-preview-selection.css':f=root/'designer/preview/selection.css'
        else:f=ui/path.lstrip('/')
        if f.is_file():r.fulfill(content_type='text/html' if f.suffix=='.html' else 'text/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'image/svg+xml',body=f.read_bytes())
        else:r.fulfill(status=200,body='',content_type='text/css' if path.endswith('.css') else 'text/javascript')
    pg.route('**/*',route);pg.goto(base+'/index.html');frame=pg.frame_locator('#site-preview');frame.locator('.hero-title').wait_for(timeout=10000)
    pg.locator('[data-page=rental]').click();heading=frame.get_by_role('heading',name='Før ankomst',exact=True);heading.wait_for(timeout=5000);heading.click();panel=pg.locator('.wset-context-editor');panel.wait_for(timeout=5000)
    assert panel.locator('[data-context-text]').input_value()=='Før ankomst'
    assert panel.locator('[data-design-property=font]').input_value()=='georgia'
    assert panel.locator('[data-design-property=size]').input_value()=='23'
    assert panel.locator('[data-design-property=color][type=text]').input_value()=='#123456'
    assert pg.locator('#inspector-panel-tabs').is_hidden()
    panel.locator('[data-design-property=font]').select_option('arial');pg.wait_for_function("document.querySelector('[data-design-property=font]')?.value==='arial'");pg.wait_for_timeout(300)
    assert 'Arial' in heading.evaluate('el=>getComputedStyle(el).fontFamily')
    panel.locator('[data-design-property=color][type=text]').fill('#b06040');panel.locator('[data-design-property=color][type=text]').press('Tab');pg.wait_for_timeout(300)
    assert heading.evaluate('el=>getComputedStyle(el).color')=='rgb(176, 96, 64)'
    panel.locator('[data-context-toggle=decoration]').click();pg.wait_for_timeout(300);assert 'underline' in heading.evaluate('el=>getComputedStyle(el).textDecorationLine')
    other=frame.get_by_role('heading',name='Når gjestene kommer',exact=True);assert other.evaluate('el=>getComputedStyle(el).color')=='rgb(18, 52, 86)'
    other.click();assert panel.locator('[data-context-text]').input_value()=='Når gjestene kommer';assert panel.locator('[data-design-property=color][type=text]').input_value()=='#123456'
    heading.click();panel.locator('[data-context-text]').fill('Før innsjekk');panel.locator('[data-context-text]').press('Tab');heading=frame.get_by_role('heading',name='Før innsjekk',exact=True);heading.wait_for(timeout=5000);pg.wait_for_function("document.querySelector('[data-context-text]')?.value==='Før innsjekk' && !document.querySelector('[data-context-text]')?.disabled")
    assert heading.evaluate('el=>getComputedStyle(el).color')=='rgb(176, 96, 64)'
    heading.dblclick();editor=frame.locator('[contenteditable="plaintext-only"]');editor.wait_for();editor.fill('Klargjøring før ankomst');editor.press('Enter');heading=frame.get_by_role('heading',name='Klargjøring før ankomst',exact=True);heading.wait_for(timeout=5000);pg.wait_for_function("document.querySelector('[data-context-text]')?.value==='Klargjøring før ankomst' && !document.querySelector('[data-context-text]')?.disabled")
    pg.locator('#undo-btn').click();frame.get_by_role('heading',name='Før innsjekk',exact=True).wait_for(timeout=5000);pg.wait_for_function("document.querySelector('[data-context-text]')?.value==='Før innsjekk'")
    pg.locator('#redo-btn').click();heading.wait_for(timeout=5000);pg.wait_for_function("document.querySelector('[data-context-text]')?.value==='Klargjøring før ankomst'")
    panel.locator('[data-design-reset]').click();pg.wait_for_timeout(300);assert heading.evaluate('el=>getComputedStyle(el).color')=='rgb(18, 52, 86)';assert panel.locator('[data-design-property=font]').input_value()=='georgia'
    pg.locator('[data-area=overview]').click();pg.locator('[data-area=website]').click();panel.wait_for(timeout=5000);assert panel.locator('[data-context-text]').input_value()=='Klargjøring før ankomst'
    panel.locator('[data-context-back]').click();assert pg.locator('#inspector-panel-tabs').is_visible();assert pg.locator('details[data-copy-group="Kort 01"]').count()==1
    assert not errors,errors
    print('PASS: real iframe, computed styles, contextual selection, individual styling, panel and inline editing, undo/redo, reset, navigation and full section fallback (mock IPC; synthetic template CSS).');browser.close()
