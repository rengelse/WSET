"""WSET integrated create dialog, Chromium with mocked Electron API."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
ui=Path(__file__).resolve().parents[1]/'designer/ui'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('WSET_TEST_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1400,'height':900});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content('<style>'+ (ui/'style.css').read_text()+(ui/'project-creation.css').read_text()+'</style><button id="trigger">Bruk mal</button>')
 pg.evaluate((ui/'project-creation.js').read_text())
 pg.evaluate('''()=>{window.result='pending';window.entry={supported:true,digest:'a'.repeat(64),template:{name:'Mediterranean Premium',category:'property',templateVersion:'1.4.4-rc.28'}};document.querySelector('#trigger').onclick=async()=>{window.result='pending';window.result=await window.wsetProjectCreation.open({api:{workspaceStatus:async()=>({paths:{projects:'C:/Documents/WSET/Projects'}})},entry:window.entry});};}''')
 pg.locator('#trigger').click();d=pg.locator('.wset-create-project');d.wait_for();assert d.get_by_text('C:/Documents/WSET/Projects').is_visible();d.get_by_role('button',name='Opprett nettsted').click();assert d.is_visible();assert pg.evaluate('window.result')=='pending'
 d.get_by_label('Prosjektnavn *',exact=True).fill('Test / nettsted');d.get_by_label('Kunde (valgfritt)').fill('Eksempel AS');d.get_by_label('Domene (valgfritt)').fill('example.com');d.get_by_role('button',name='Opprett nettsted').click();assert d.is_visible();d.get_by_role('checkbox').check()
 for width,height in [(1400,900),(1040,820),(760,650)]:
  pg.set_viewport_size({'width':width,'height':height});assert d.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
 pg.set_viewport_size({'width':1400,'height':900});pg.screenshot(path='/mnt/data/WSET-v1.0.0-Opprett-nettsted.png');d.get_by_role('button',name='Opprett nettsted').click();d.wait_for(state='detached');pg.wait_for_function("window.result!=='pending'");assert pg.evaluate('window.result')=={'trusted':True,'digest':'a'*64,'info':{'name':'Test / nettsted','customer':'Eksempel AS','domain':'example.com'}}
 pg.locator('#trigger').click();d.wait_for();d.get_by_role('button',name='Avbryt').click();pg.wait_for_function('window.result===null');assert not errors,errors;b.close()
 print('PASS: integrated project creation, required fields and trust, cancel, submit, three viewport sizes (mock IPC).')
