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
    fields=call('template',site=site,pageId='rental',sectionId='rental-process',locale='no');field=next(e for e in fields if e['value']=='Før ankomst')
    pg.evaluate('d=>messageFromPreview(d)',{'kind':'cbpm-preview-select','id':'rental-process','text':'Før ankomst','targetKind':'text','inlineTarget':field['targetId'],'styleable':True})
    pg.locator('[data-inspector-pane=appearance]').click();pg.wait_for_function("document.querySelector('[data-design-choose=section]')?.value==='element'")
    pg.locator('[data-design-property=font]').select_option('georgia');pg.wait_for_function("document.querySelector('[data-design-property=font]')?.value==='georgia'");pg.wait_for_timeout(250)
    assert site['wsetDesign']['sections']['rental']['rental-process']['elements']['no'][field['targetId']]['font']=='georgia'
    pg.locator('[data-design-property=color][type=text]').fill('#b06040');pg.locator('[data-design-property=color][type=text]').press('Tab');pg.wait_for_function("document.querySelector('[data-design-property=color][type=text]')?.value==='#b06040'");pg.wait_for_timeout(250)
    css=call('css',site=site,pageId='rental',locale='no');assert '#b06040' in css
    # Render the actual HTML in a real Chromium DOM and verify computed style.
    live=b.new_page();markup=call('preview',site=site,pageId='rental',locale='no');markup=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',markup);markup=re.sub(r'<link\b[^>]*>','',markup);markup=re.sub(r'\bsrc="[^"]+"','src=""',markup)
    live.set_content(markup);live.add_style_tag(content=css)
    card=live.get_by_role('heading',name='Før ankomst',exact=True);other=live.get_by_role('heading',name='Når gjestene kommer',exact=True)
    assert card.evaluate('el=>getComputedStyle(el).color')=='rgb(176, 96, 64)';assert 'Georgia' in card.evaluate('el=>getComputedStyle(el).fontFamily');assert other.evaluate('el=>getComputedStyle(el).color')!='rgb(176, 96, 64)'
    live.evaluate("window.messages=[];window.addEventListener('message',e=>{if(e.data?.kind==='cbpm-preview-select')window.messages.push(e.data)})");live.evaluate((root/'designer/preview/bridge.js').read_text());card.click();live.wait_for_timeout(100);assert live.evaluate('messages.at(-1)?.styleable') is True
    pg.locator('[data-design-choose=section]').select_option('heading');pg.locator('[data-design-property=size]').fill('28');pg.locator('[data-design-property=size]').press('Tab');pg.wait_for_timeout(300);assert site['wsetDesign']['sections']['rental']['rental-process']['roles']['heading']['size']==28
    pg.locator('#undo-btn').click();pg.wait_for_timeout(300);assert not site['wsetDesign']['sections']['rental']['rental-process']['roles'];pg.locator('#redo-btn').click();pg.wait_for_timeout(300);assert site['wsetDesign']['sections']['rental']['rental-process']['roles']['heading']['size']==28
    pg.locator('[data-design-reset]').click();pg.wait_for_timeout(300);assert not site['wsetDesign']['sections']['rental']['rental-process']['roles']
    pg.locator('[data-area=settings]').click();pg.locator('.wset-global-design summary').click();pg.locator('[data-design-property=font]').select_option('arial');pg.wait_for_timeout(300);assert site['wsetDesign']['global']['heading']['font']=='arial'
    assert not errors,errors;print('PASS: appearance panel, selected element, global and section styles, reset, undo/redo, actual Chromium computed style and exact click target.');b.close()
