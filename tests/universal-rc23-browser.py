"""Real browser DOM + bridge against the supplied project, without executing website source scripts."""
import json, subprocess, re, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=Path(os.environ['WSET_TEST_SITE_ROOT']) if os.environ.get('WSET_TEST_SITE_ROOT') else None
def call(op, **args):
    r=subprocess.run(['node',str(root/'tests/inline-rc20-fixture.mjs')],input=json.dumps({'op':op,**args}),text=True,capture_output=True,check=True)
    return r.stdout if op in ['preview','css'] else json.loads(r.stdout)
site=call('seed')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1440,'height':950});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    def load(page):
        html=call('preview',site=site,locale='no',pageId=page)
        html=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link\b[^>]*>','',html);html=re.sub(r'\bsrc="[^"]+"','src=""',html)
        pg.set_content(html)
        if source:
            for f in ['styles.css','designer-sections.css']:pg.add_style_tag(content=(source/'public'/f).read_text())
            pg.add_style_tag(content='.reveal{opacity:1!important;transform:none!important}')
        else:pg.add_style_tag(content='svg{width:20px;height:20px} img{max-width:100%;max-height:100px}')
        css=call('css',site=site,pageId=page,locale='no');pg.add_style_tag(content=css or '/* none */')
        pg.evaluate("window.messages=[];window.addEventListener('message',e=>{if(e.data?.kind?.startsWith('wset-inline')||e.data?.kind==='cbpm-preview-select')window.messages.push(e.data)})")
        pg.evaluate((root/'designer/preview/bridge.js').read_text())
    def select(text):
        loc=pg.locator('[data-wset-bind]').filter(has_text=re.compile('^'+re.escape(text)+'$')).first
        loc.click();pg.wait_for_timeout(60);m=pg.evaluate("messages.filter(x=>x.kind==='cbpm-preview-select').at(-1)");assert m['details']['text']==text and m['details']['styleable'],m;return m,loc
    load('rental');a,loc=select('Boligen din.');other,_=select('Godt ivaretatt.');assert a['details']['id']!=other['details']['id']
    site=call('change',site=site,payload={'action':'design:update','scope':'element','role':'heading','pageId':'rental','sectionId':'rental-hero','locale':'no','targetId':a['details']['id'],'property':'color','value':'#123456'})
    # Fresh preview after style edit.
    pg.reload();load('rental');a,loc=select('Boligen din.');other,accent=select('Godt ivaretatt.')
    assert loc.evaluate('el=>getComputedStyle(el).color')=='rgb(18, 52, 86)';assert accent.evaluate('el=>getComputedStyle(el).color')!='rgb(18, 52, 86)'
    loc.dblclick();editor=pg.locator('[contenteditable="plaintext-only"]');editor.wait_for(timeout=3000);editor.fill('Boligen vår.');editor.press('Enter');pg.wait_for_timeout(100)
    msg=pg.evaluate("messages.filter(x=>x.kind==='wset-inline-finish').at(-1)");assert msg['commit'] and msg['value']=='Boligen vår.',msg
    site=call('change',site=site,payload={'action':'inline:text','pageId':'rental','sectionId':'rental-hero','locale':'no','targetId':a['details']['id'],'expected':a['details']['expected'],'value':msg['value']})
    pg.reload();load('rental');select('Boligen vår.');select('Godt ivaretatt.');select('Før. Under.');select('Etter.');select('COSTA BLANCA · SPAIN');select('Før ankomst')
    assert not errors,errors;print('PASS: mixed headings and ordinary text select exact targets; isolated CSS, inline editing and preserved emphasis.');b.close()
