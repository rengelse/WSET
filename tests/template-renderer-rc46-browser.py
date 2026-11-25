"""Chromium DOM smoke with a test-only alternate renderer, no Electron IPC."""
from pathlib import Path
import json, re, subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
script='''import {readFileSync} from 'node:fs';
import {legacyRenderer,createRendererRegistry,withTemplateRenderer} from './designer/core/renderer-runtime.mjs';
import {legacyTemplateDescriptor} from './designer/core/template-contract.mjs';
import {migrateProjectForDesigner} from './designer/core/project-migrations.mjs';
import {previewDocument} from './designer/core/preview-server.mjs';
const site=migrateProjectForDesigner(JSON.parse(readFileSync('./designer/compat/website-seed.json','utf8')));
const template={...legacyTemplateDescriptor(),id:'property.browser-fixture'};
const adapt=r=>({...r,html:r.html.replaceAll('class="detail-card reveal"','class="technical-tile"').replace(/<h3 (data-content-ref="services:[^"<>]+:title")>([\\s\\S]*?)<\\/h3>/g,'<strong $1>$2</strong>')});
const registry=createRendererRegistry([{...legacyRenderer,id:template.id,renderPage:args=>adapt(legacyRenderer.renderPage(args)),renderSource:args=>adapt(legacyRenderer.renderSource(args))}]);
console.log(withTemplateRenderer(template,()=>previewDocument(site,'no','services'),{registry}));'''
html=subprocess.run(['node','--input-type=module','-e',script],cwd=root,capture_output=True,text=True,check=True).stdout
html=re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link\b[^>]*>','',html);html=re.sub(r'\bsrc="[^"]+"','src=""',html)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html);page.add_style_tag(content='svg{width:20px;height:20px} img{display:block;width:100px;height:50px} .technical-tile{padding:8px}');page.evaluate("window.messages=[];window.addEventListener('message',e=>messages.push(e.data))")
    page.evaluate((root/'designer/preview/bridge.js').read_text());card=page.locator('.technical-tile').first;rec=card.get_attribute('data-content-id');image=card.locator('img');image.click();page.wait_for_timeout(50)
    msg=page.evaluate("messages.filter(m=>m.kind==='cbpm-preview-select').at(-1)");assert msg['collection']=='services' and msg['recordId']==rec and msg['targetKind']=='image',msg
    title=card.locator('strong[data-content-ref]');title.dblclick();editor=page.locator('[contenteditable="plaintext-only"]');editor.wait_for();editor.fill('Teknisk test');editor.press('Enter');page.wait_for_timeout(50)
    msg=page.evaluate("messages.filter(m=>m.kind==='wset-inline-start').at(-1)");assert msg['targetId']==f'record:services:{rec}:title',msg
    msg=page.evaluate("messages.filter(m=>m.kind==='wset-inline-finish').at(-1)");assert msg['commit'] and msg['value']=='Teknisk test',msg
    page.evaluate("window.postMessage({kind:'cbpm-editor-focus',sectionId:'services-listing',collection:'services',recordId:"+json.dumps(rec)+"},'*')");page.wait_for_timeout(50);assert card.evaluate("el=>el.classList.contains('wset-preview-selected')")
    assert not errors,errors;print('PASS: alternate card classes, canonical image selection, inline text edit and record focus.');browser.close()
