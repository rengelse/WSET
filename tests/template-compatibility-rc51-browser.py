"""Chromium report/gateway UI test. IPC mocked, core mapping tested separately."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
ui=Path(__file__).resolve().parents[1]/'designer/ui'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM') or '/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<!doctype html><html><head></head><body><main id="host"></main></body></html>')
 for name in ['style.css','template-gallery.css','template-compatibility.css']:page.add_style_tag(content=(ui/name).read_text())
 for name in ['template-compatibility.js','template-gallery.js']:page.evaluate((ui/name).read_text())
 page.evaluate('''()=>{const template={id:'property.mediterranean-premium',name:'Mediterranean Premium',category:'property',subcategory:'property-management',templateVersion:'1.4.4-rc.28.1'};const entry={key:'key',digest:'digest',template,supported:true,previews:[]};window.calls=[];window.api={templateLibraryList:async()=>({items:[entry],issues:[],root:'D:/WSET/Templates'}),templateCompatibility:async(key,digest)=>{window.calls.push([key,digest]);return {source:template,target:template,dirty:true,status:'blocked',counts:{mapped:1,preserve:1,review:1,blocked:1},rows:[{group:'Sider',id:'home',status:'mapped',detail:'Samme side-ID.'},{group:'Prosjektdata',id:'brand',status:'preserve',detail:'Behold bedriftsprofil.'},{group:'Medier',id:'public/assets/hero.webp',status:'review',detail:'Navnekonflikt.'},{group:'Direkte tekst',id:'home/hero/no',status:'blocked',detail:'Tekstbinding mangler.'}]}}};window.wsetTemplateGallery.mount(document.getElementById('host'),{api:window.api,create:()=>{window.created=true},hasProject:()=>true});}''')
 page.get_by_role('button',name='Kontroller kompatibilitet').click();page.get_by_text('Tekstbinding mangler.').wait_for();assert page.evaluate('window.calls')==[['key','digest']];assert page.get_by_text('Navnekonflikt.').is_visible();assert page.get_by_text('Rapporten inkluderer ulagrede endringer i det aktive prosjektet.').is_visible();assert not page.get_by_text('Samme side-ID.').is_visible()
 page.get_by_label('Kartleggingsstatus').select_option('all');page.get_by_label('Søk i kartleggingen').fill('bedriftsprofil');assert page.get_by_text('Behold bedriftsprofil.').is_visible();assert not page.get_by_text('Tekstbinding mangler.').is_visible();page.get_by_label('Søk i kartleggingen').fill('');page.get_by_label('Kartleggingsstatus').select_option('issues')
 for width in [1400,1040,960]:
  page.set_viewport_size({'width':width,'height':820});assert page.locator('.tc-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),width
 page.set_viewport_size({'width':1400,'height':900});page.get_by_role('button',name='Lukk',exact=True).click();page.locator('.tc-dialog').wait_for(state='detached');assert page.evaluate('typeof window.created')=='undefined'
 page.evaluate('window.wsetTemplateGallery.unmount();window.wsetTemplateGallery.mount(document.getElementById("host"),{api:window.api,create:()=>{},hasProject:()=>false})');page.locator('.tg-card').wait_for();assert page.get_by_role('button',name='Kontroller kompatibilitet').count()==0;assert not errors,errors
 print('PASS: gallery report entry, verified key/digest, blocked/review filters, dirty status, close, no project creation, responsive dialog and no-project state (mock IPC).');b.close()
