import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {inlineTargets} from '../designer/core/inline-editing.mjs';
import {elementStyleSupported,pageDesignCss} from '../designer/core/design-styles.mjs';
import {renderDynamicSite} from '../designer/engines/cbpm-astro-v1/lib/dynamic-site.mjs';
const site=migrateProjectForDesigner(JSON.parse(readFileSync(new URL('../designer/compat/website-seed.json',import.meta.url))));
const find=(sectionId,text)=>inlineTargets(site,'rental','no')[sectionId].find(t=>t.value===text);
const update=(s,sectionId,target,property,value)=>applyEditorCommand(s,{action:'design:update',scope:'element',role:'heading',pageId:'rental',sectionId,locale:'no',targetId:target.id,property,value}).site;
const heading=find('rental-process','Før ankomst'),button=find('rental-cta','Ta kontakt');
test('Individual underline and fractional size remain isolated, valid and resettable',()=>{
 let s=update(site,'rental-process',heading,'decoration','underline');s=update(s,'rental-process',heading,'size',23.5);
 assert.match(pageDesignCss(s,'rental','no'),/h3:nth-child\(2\)\{font-size:23\.5px !important;text-decoration-line:underline !important/);
 assert.doesNotMatch(pageDesignCss(s,'rental','en'),/underline/);assert.throws(()=>update(s,'rental-process',heading,'decoration','url(x)'),/Ugyldig/);
 assert.equal(pageDesignCss(update(s,'rental-process',heading,'reset',null),'rental','no'),'');
});
test('Only uniquely mapped actual buttons accept individual background and radius',()=>{
 assert.ok(elementStyleSupported(site,'rental','rental-cta','no',button.id,true));
 assert.equal(elementStyleSupported(site,'rental','rental-process','no',heading.id,true),false);
 let s=update(site,'rental-cta',button,'background','#abcdef');s=update(s,'rental-cta',button,'radius',8);
 const css=pageDesignCss(s,'rental','no');assert.match(css,/background-color:#abcdef !important;border-radius:8px !important/);
 assert.throws(()=>update(s,'rental-process',heading,'background','#abcdef'),/knapper/);assert.throws(()=>update(s,'rental-cta',button,'radius',50),/Ugyldig/);
 const html=renderDynamicSite({site:s,locale:'no',page:'rental'}).html;
 assert.equal(pageDesignCss(s,'rental','no',{publicHtml:html}),css);
 const changed=html.replace(/class="btn btn-deep"/g,'class="ordinary-link"').replace(/class="btn btn-primary"/g,'class="ordinary-link"');
 if(changed!==html)assert.throws(()=>pageDesignCss(s,'rental','no',{publicHtml:changed}),/knappen avviker/);
});
test('Context text edit preserves canonical target and associated style; stale expected text rejected',()=>{
 const s=update(site,'rental-process',heading,'color','#123456');const payload={action:'inline:text',pageId:'rental',sectionId:'rental-process',locale:'no',targetId:heading.id,expected:heading.value,value:'Før innsjekk'};
 const next=applyEditorCommand(s,payload).site;assert.match(pageDesignCss(next,'rental','no'),/#123456/);assert.equal(inlineTargets(next,'rental','no')['rental-process'].find(t=>t.id===heading.id).value,'Før innsjekk');assert.throws(()=>applyEditorCommand(next,payload),/Teksten er endret/);
});
