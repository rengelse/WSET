import {pageDesignCss} from '../designer/core/design-styles.mjs';
// Test helper: the browser uses actual renderer/model functions via mocked IPC.
import {readFileSync} from 'node:fs';
import {migrateProjectForDesigner} from '../designer/core/project-migrations.mjs';
import {applyEditorCommand} from '../designer/core/editor-operations.mjs';
import {previewDocument} from '../designer/core/preview-server.mjs';
import {templateFields} from '../designer/core/inline-editing.mjs';
const q=JSON.parse(readFileSync(0,'utf8'));
const s=q.site||migrateProjectForDesigner(JSON.parse(readFileSync(process.env.WSET_TEST_SITE_ROOT?process.env.WSET_TEST_SITE_ROOT+'/project/website.json':new URL('../designer/compat/website-seed.json',import.meta.url),'utf8')));
if(q.op==='seed')console.log(JSON.stringify(s));
if(q.op==='preview')console.log(previewDocument(s,q.locale,q.pageId));
if(q.op==='change')console.log(JSON.stringify(applyEditorCommand(s,q.payload).site));
if(q.op==='template'){const p=s.sitePages.find(p=>p.id===q.pageId);console.log(JSON.stringify(templateFields(s,p,p.sections.find(x=>x.id===q.sectionId),q.locale)));}

if(q.op==='css')console.log(pageDesignCss(s,q.pageId,q.locale));
