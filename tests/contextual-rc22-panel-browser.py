"""rc.21: real model/renderer with mocked IPC, plus real browser CSS application."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,subprocess,os
root=Path(__file__).resolve().parents[1];ui=root/'designer/ui';base='http://127.0.0.1:43220'
def call(op, **args):
    r=subprocess.run(['node',str(root/'tests/inline-rc20-fixture.mjs')],input=json.dumps({'op':op,**args}),text=True,capture_output=True,check=True)
    return r.stdout if op in ['preview','css'] else json.loads(r.stdout)
site=call('seed');initial=site;undo=[];redo=[];changes=[]
def state():return {'root':'C:/Test/CBPM','site':site,'previewBase':base,'dirty':site!=initial,'canUndo':bool(undo),'canRedo':bool(redo),'report':{'ok':True,'warnings':[],'errors':[]}}
def change(payload):
    global site
    new=call('change',site=site,payload=payload);undo.append(site);redo.clear();site=new;changes.append(payload);return state()
def history(direction):
    global site
    if direction=='undo' and undo:redo.append(site);site=undo.pop()
    elif direction=='redo' and redo:undo.append(site);site=redo.pop()
    return state()
html=(ui/'index.html').read_text();html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>','',html);html=re.sub(r'<script src="[^"]+" defer></script>','',html);html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ui/'style.css').read_text()+'</style>')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM') or '/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1600,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
    pg.expose_function('testChange',change);pg.expose_function('testTemplate',lambda q:call('template',site=site,**q));pg.expose_function('testHistory',history);pg.expose_function('testState',state)
    pg.evaluate('''base=>{const storage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});window.previewLoads=[];window.cbpm={state:()=>testState(),onExportProgress:()=>{},recentProjects:async()=>[],mediaList:async()=>[],propertyRemoteStatus:async()=>({connected:false}),propertyLocalCatalog:async()=>({records:[],files:[],errors:[],page:1,total:0,pages:1,allTotal:0}),templateTexts:q=>testTemplate(q),change:q=>testChange(q),undo:()=>testHistory('undo'),redo:()=>testHistory('redo'),assistantModuleStatus:async()=>({version:'1.8.1'}),health:async()=>({metrics:{pages:{active:7,total:8,hidden:1},properties:{count:0,files:0},languages:{active:11,total:10,translated:10},media:{count:0}},issues:[],areas:[],languages:[],export:{status:'Ikke generert'},validity:{ok:true}})};const f=document.getElementById('site-preview');window.messageFromPreview=d=>window.dispatchEvent(new MessageEvent('message',{origin:base,source:f.contentWindow,data:{href:previewLoads.at(-1),...d}}));Object.defineProperty(f,'src',{set(v){previewLoads.push(v);queueMicrotask(()=>{f.dispatchEvent(new Event('load'));messageFromPreview({kind:'wset-preview-ready'});})},get(){return previewLoads.at(-1)||''}});}''',base)
    for n in ['app-i18n.js','property-drafts.js','property-manager.js','language-workspace.js','app.js']:pg.evaluate((ui/n).read_text())
    pg.locator('[data-page=rental]').wait_for(timeout=5000);pg.locator('[data-page=rental]').click();pg.wait_for_timeout(200)
    live=b.new_page(viewport={'width':1200,'height':1000});live.on('pageerror',lambda e:errors.append(str(e)))
    def load_live():
        markup=call('preview',site=site,pageId='rental',locale='no');markup=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',markup);markup=re.sub(r'<link\b[^>]*>','',markup);markup=re.sub(r'\bsrc="[^"]+"','src=""',markup)
        live.set_content(markup);live.add_style_tag(content='svg{width:20px;height:20px} img{max-width:100%;max-height:100px} h3{font-family:Georgia,serif;font-size:23px;font-weight:600;color:#123456} p{color:#657788}')
        live.add_style_tag(content=call('css',site=site,pageId='rental',locale='no') or '/* none */')
        live.evaluate("window.messages=[];window.addEventListener('message',e=>{if(['cbpm-preview-select','wset-context-details'].includes(e.data?.kind))window.messages.push(e.data)})");live.evaluate((root/'designer/preview/bridge.js').read_text())
    def forward(m):
        m.pop('href',None);pg.evaluate('d=>messageFromPreview(d)',m)
    def choose(name):
        live.get_by_role('heading',name=name,exact=True).click();live.wait_for_timeout(100);m=live.evaluate("messages.filter(m=>m.kind==='cbpm-preview-select').at(-1)");assert m['details']['text']==name,m;forward(m);pg.wait_for_function("v=>document.querySelector('[data-context-text]')?.value===v",arg=name,timeout=4000);return m['details']['id']
    def sync(id):
        load_live();live.evaluate("id=>window.postMessage({kind:'cbpm-editor-focus',sectionId:'rental-process',targetId:id},'*')",id);live.wait_for_timeout(100);m=live.evaluate("messages.filter(m=>m.kind==='wset-context-details').at(-1)");assert m and m['details']['id']==id,m;forward(m);pg.wait_for_timeout(100)
    load_live();target=choose('Før ankomst');panel=pg.locator('.wset-context-editor');assert panel.is_visible();assert pg.locator('#inspector-panel-tabs').is_hidden();assert panel.locator('[data-design-property=font]').input_value()=='georgia';assert panel.locator('[data-design-property=size]').input_value()=='23';assert panel.locator('[data-design-property=color][type=text]').input_value()=='#123456'
    # rc.24 visual regression: inherited precision is displayed rounded, not persisted.
    m=live.evaluate("messages.filter(m=>m.kind==='cbpm-preview-select').at(-1)");m['details']['computed']['size']=35.104;previous=len(changes);forward(m);pg.wait_for_timeout(100)
    assert panel.locator('[data-design-property=size]').input_value()=='35.1';assert len(changes)==previous
    assert panel.locator('.wset-context-extra').get_attribute('open') is None
    for width in [240,285,315,365,530]:
        pg.evaluate("w=>document.body.style.setProperty('--wset-inspector-width',w+'px')",width);pg.wait_for_timeout(220)
        metrics=panel.evaluate("el=>({overflow:el.scrollWidth-el.clientWidth,font:el.querySelector('[data-design-property=font]').getBoundingClientRect().height,size:el.querySelector('[data-design-property=size]').getBoundingClientRect().height,hex:el.querySelector('[data-design-property=color][type=text]').getBoundingClientRect().height,picker:el.querySelector('.wset-color-picker').getBoundingClientRect().height,order:el.querySelector('[data-context-text]').getBoundingClientRect().top<el.querySelector('[data-design-reset]').getBoundingClientRect().top})")
        assert metrics['overflow']<=1 and metrics['font']==metrics['size']==metrics['hex']==metrics['picker']==36 and metrics['order'],(width,metrics)
    pg.evaluate("document.body.style.setProperty('--wset-inspector-width','365px')");pg.wait_for_timeout(250)
    panel.locator('.wset-context-extra summary').click();assert panel.locator('.wset-context-extra').get_attribute('open') is not None
    panel.locator('.wset-context-extra summary').click()
    assert panel.locator('iframe,canvas').count()==0
    pg.locator('#inspector-body').screenshot(path='/tmp/wset-rc24-inspector.png')
    panel.locator('[data-design-property=font]').select_option('arial');pg.wait_for_timeout(250);sync(target);assert 'Arial' in live.get_by_role('heading',name='Før ankomst',exact=True).evaluate('el=>getComputedStyle(el).fontFamily')
    panel.locator('[data-design-property=color][type=text]').fill('#b06040');panel.locator('[data-design-property=color][type=text]').press('Tab');pg.wait_for_timeout(250);sync(target);assert live.get_by_role('heading',name='Før ankomst',exact=True).evaluate('el=>getComputedStyle(el).color')=='rgb(176, 96, 64)'
    panel.locator('[data-context-toggle=decoration]').click();pg.wait_for_timeout(250);sync(target);assert 'underline' in live.get_by_role('heading',name='Før ankomst',exact=True).evaluate('el=>getComputedStyle(el).textDecorationLine')
    other=choose('Når gjestene kommer');assert other!=target;assert panel.locator('[data-design-property=color][type=text]').input_value()=='#123456';choose('Før ankomst');assert panel.locator('[data-design-property=color][type=text]').input_value()=='#b06040'
    panel.locator('[data-context-text]').fill('Før innsjekk');panel.locator('[data-context-text]').press('Tab');pg.wait_for_timeout(250);sync(target);assert panel.locator('[data-context-text]').input_value()=='Før innsjekk';assert not panel.locator('[data-context-text]').is_disabled();assert live.get_by_role('heading',name='Før innsjekk',exact=True).count()==1
    pg.locator('#undo-btn').click();pg.wait_for_timeout(250);sync(target);assert panel.locator('[data-context-text]').input_value()=='Før ankomst';pg.locator('#redo-btn').click();pg.wait_for_timeout(250);sync(target);assert panel.locator('[data-context-text]').input_value()=='Før innsjekk'
    panel.locator('[data-design-reset]').click();pg.wait_for_timeout(250);sync(target);assert panel.locator('[data-design-property=font]').input_value()=='georgia';assert panel.locator('[data-design-property=color][type=text]').input_value()=='#123456'
    pg.locator('[data-area=overview]').click();pg.locator('[data-area=website]').click();pg.wait_for_timeout(200);sync(target);assert panel.locator('[data-context-text]').input_value()=='Før innsjekk'
    panel.locator('[data-context-back]').click();assert pg.locator('#inspector-panel-tabs').is_visible();assert pg.locator('details[data-copy-group="Kort 01"]').count()==1
    pg.locator('[data-inspector-pane=appearance]').click();assert pg.locator('[data-design-choose=section]').is_visible();pg.locator('[data-area=settings]').click();pg.locator('.wset-global-design summary').click();assert pg.locator('[data-design-choose=global]').is_visible()
    assert not errors,errors;print('PASS: contextual panel, actual DOM effective typography, exact selection, isolated styles, panel edits, undo/redo/reset, navigation and section/global fallback. Mock IPC and iframe transport.');b.close()
