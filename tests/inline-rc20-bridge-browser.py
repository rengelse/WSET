"""Local DOM smoke test: real preview HTML and bridge, no IPC or network."""
from pathlib import Path
import json, subprocess, re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
def call(op, **args):
    r=subprocess.run(['node',str(root/'tests/inline-rc20-fixture.mjs')],input=json.dumps({'op':op,**args}),text=True,capture_output=True,check=True)
    return r.stdout if op=='preview' else json.loads(r.stdout)
site=call('seed')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1200,'height':1000});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    def load(page):
        global pg
        pg.close();pg=b.new_page(viewport={"width":1200,"height":1000});pg.on("pageerror",lambda e:errors.append(str(e)))
        html=call('preview',site=site,locale='no',pageId=page)
        html=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link\b[^>]*>','',html);html=re.sub(r'\bsrc="[^"]+"','src=""',html)
        pg.set_content(html);pg.add_style_tag(content='svg{width:20px;height:20px} img{max-width:100%;max-height:100px}');pg.evaluate("window.messages=[];window.addEventListener('message',e=>{if(e.data?.kind?.startsWith('wset-inline'))window.messages.push(e.data)})")
        pg.evaluate((root/'designer/preview/bridge.js').read_text())
    def edit(locator,value,key='Enter'):
        locator.scroll_into_view_if_needed();point=locator.evaluate("el=>{const n=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(!n)return null;const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return {x:b.left+Math.min(b.width/2,20),y:b.top+b.height/2}}")
        if point:pg.mouse.dblclick(point['x'],point['y'])
        else:locator.dblclick()
        e=pg.locator('[contenteditable="plaintext-only"]');e.wait_for(timeout=3000);e.fill(value);e.press(key);pg.wait_for_timeout(100);msgs=pg.evaluate('messages');return [m for m in msgs if m['kind']=='wset-inline-finish'][-1]
    load('home');msg=edit(pg.locator('.hero-title em'),'Hele sesongen.');assert msg['commit'] and msg['value']=='Hele sesongen.',msg
    load('rental');msg=edit(pg.get_by_role('heading',name='Før ankomst',exact=True),'Før innsjekk');assert msg['commit'] and msg['value']=='Før innsjekk',msg
    msg=edit(pg.get_by_role('heading',name='Før ankomst',exact=True),'Ikke lagre','Escape');assert not msg['commit'];assert pg.get_by_role('heading',name='Før ankomst',exact=True).count()==1
    # Link label only; icon and href survive the edit session.
    links=pg.locator('[data-cbpm-section] a.btn').filter(has_text=re.compile(r'\S'));assert links.count()>0
    link=links.first;href=link.get_attribute('href');msg=edit(link,'Ny knappetekst');assert msg['commit'];assert link.get_attribute('href')==href
    pg.evaluate("window.postMessage({kind:'cbpm-editor-focus',previewOnly:true},'*')");pg.wait_for_timeout(100);pg.get_by_role('heading',name='Før ankomst',exact=True).dblclick();assert pg.locator('[contenteditable]').count()==0
    assert not errors,errors;print('PASS: real DOM rich heading, rental card, button label, Escape, clean preview.');b.close()
