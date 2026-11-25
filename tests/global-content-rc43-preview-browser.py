# Real loopback preview with original Mal 01 assets and the WSET renderer.
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,sys,os,urllib.request,re
root=Path(__file__).resolve().parents[1]
project=sys.argv[1] if len(sys.argv)>1 else None
if not project:raise SystemExit('Provide path to extracted CBPM project.')
code='''import {readDesignerProject} from './designer/core/project-storage.mjs';import {applyEditorCommand} from './designer/core/editor-operations.mjs';import {startDesignerPreview} from './designer/core/preview-server.mjs';const root=process.argv[1];const loaded=await readDesignerProject(root);let site=loaded.site;site.smartAssistant.enabled=false;site.sitePages.find(x=>x.id==='properties').enabled=true;for(const command of [{section:'footer',field:'showExtra',value:false},{section:'legal',id:'privacy',field:'body',locale:'no',value:'Første avsnitt.\\n\\nAndre avsnitt & kontakt.'},{section:'legal',id:'privacy',field:'enabled',value:true},{section:'legal',id:'legal',field:'enabled',value:false}])site=applyEditorCommand(site,{action:'global-content:update',...command}).site;const server=await startDesignerPreview({getSite:()=>site,getRoot:()=>root});console.log(server.url);'''
server=subprocess.Popen(['node','--input-type=module','-e',code,project],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 url=server.stdout.readline().strip();assert url.startswith('http'),url
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox']);page=browser.new_page(viewport={'width':1450,'height':950});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  # Read the actual HTTP output and load the markup/scripts locally; no network navigation.
  def get(path):
   with urllib.request.urlopen(url.rstrip('/')+path) as r: return r.read().decode('utf8')
  for path in ['/no/','/no/eiendommer/']:
   html=get(path);html=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link\b[^>]*>','',html)
   page.set_content(html);page.add_style_tag(content=get('/styles.css'));page.evaluate(get('/site.js'))
   assert 'DESIGN MAL 01' not in page.locator('footer.footer').inner_text();assert page.locator('#wset-legal-privacy').is_hidden()
   page.locator('[data-wset-legal-open=wset-legal-privacy]').click();assert page.locator('#wset-legal-privacy').is_visible();assert 'Andre avsnitt & kontakt.' in page.locator('#wset-legal-privacy').inner_text()
   page.locator('[data-wset-legal-close]').click();assert page.locator('#wset-legal-privacy').is_hidden()
   page.locator('[data-wset-legal-open=wset-legal-privacy]').click();page.keyboard.press('Escape');assert page.locator('#wset-legal-privacy').is_hidden()
  assert not errors,errors
  browser.close();print('PASS: real preview, home and property page, native dialog open/close/Escape, footer hidden.')
finally:
 server.terminate();server.wait(timeout=10)
