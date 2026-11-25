/** Versioned design identity, independent of the archive and website engine.
 * Metadata is declarative only: never execute code or resolve paths from it.
 */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {installedRenderers} from './renderer-runtime.mjs';
export const TEMPLATE_SCHEMA='wset-template-v1';
export const TEMPLATE_PATH='project/template.json';
export const LEGACY_TEMPLATE_ID='property.mediterranean-premium';
export const SUPPORTED_ENGINE='cbpm-astro-v1';
const slug=/^[a-z][a-z0-9-]{0,63}$/;
const version=/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/;
export function validateTemplateDescriptor(value,{engine=SUPPORTED_ENGINE}={}){
 const fail=()=>{throw Error('Ugyldig eller ustøttet WSET-malkontrakt.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==TEMPLATE_SCHEMA||value.contractVersion!==1||value.engine!==engine)fail();
 const {id,name,category,subcategory,templateVersion}=value;
 if(typeof category!=='string'||!slug.test(category)||typeof subcategory!=='string'||!slug.test(subcategory)||typeof id!=='string'||id.split('.').length!==2||id.split('.')[0]!==category||!slug.test(id.split('.')[1])||typeof name!=='string'||!name.trim()||name.length>120||/[\x00-\x1f\x7f]/.test(name)||typeof templateVersion!=='string'||templateVersion.length>80||!version.test(templateVersion))fail();
 return {schema:TEMPLATE_SCHEMA,contractVersion:1,id,name,category,subcategory,templateVersion,engine};
}
export function legacyTemplateDescriptor(packageVersion){
 return validateTemplateDescriptor({schema:TEMPLATE_SCHEMA,contractVersion:1,id:LEGACY_TEMPLATE_ID,name:'Mediterranean Premium',category:'property',subcategory:'property-management',templateVersion:typeof packageVersion==='string'&&version.test(packageVersion)&&packageVersion.length<=80?packageVersion:'0.0.0',engine:SUPPORTED_ENGINE});
}
export function assertSupportedTemplate(descriptor,{registry=installedRenderers}={}){
 const validated=validateTemplateDescriptor(descriptor);
 registry.resolve(validated);return validated;
}
export function parseTemplateDescriptor(bytes){
 try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error('Ugyldig JSON i WSET-malkontrakt.');}
}
export function resolveTemplateDescriptor({descriptor,manifest,packageVersion,engine=SUPPORTED_ENGINE,catalogOnly=false,registry=installedRenderers}={}){
 const a=descriptor===undefined?null:validateTemplateDescriptor(descriptor,{engine});
 const b=manifest===undefined?null:validateTemplateDescriptor(manifest,{engine});
 if(a&&b&&JSON.stringify(a)!==JSON.stringify(b))throw Error('Motstridende malmetadata i prosjektarkivet.');
 const resolved=a||b||legacyTemplateDescriptor(packageVersion);
 return catalogOnly?resolved:assertSupportedTemplate(resolved,{registry});
}
export async function readProjectTemplate(root,{registry=installedRenderers}={}){
 let descriptor;try{descriptor=parseTemplateDescriptor(await readFile(join(root,TEMPLATE_PATH)));}catch(e){if(e.code!=='ENOENT')throw e;}
 let packageVersion;try{packageVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;}catch(e){if(e.code!=='ENOENT')throw e;}
 return resolveTemplateDescriptor({descriptor,packageVersion,registry});
}
