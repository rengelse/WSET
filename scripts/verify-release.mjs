import {readFile,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const sha=(algorithm,b,encoding)=>createHash(algorithm).update(b).digest(encoding);
// Only simple top-level scalars produced by electron-builder are accepted here.
const scalar=(text,key)=>{const hit=text.match(new RegExp('^'+key+':[ \\t]*(.+?)\\s*$','m'));if(!hit)throw Error('Missing manifest '+key);return hit[1].trim().replace(/^(['"])(.*)\1$/,'$2');};
export async function verifyRelease(dir,version){
 const installer=`WSET-Setup-${version}.exe`,manifest='latest.yml',blockmap=installer+'.blockmap';
 const names=await readdir(dir);assert.ok(names.includes(installer)&&names.includes(manifest)&&names.includes(blockmap),'Required release artifacts missing');
 assert.ok(!names.includes('rc.yml'),'Unexpected rc.yml: use a clean dist directory (single latest channel)');
 const text=await readFile(join(dir,manifest),'utf8');assert.equal(scalar(text,'version'),version);assert.equal(scalar(text,'path'),installer);
 const bytes=await readFile(join(dir,installer));assert.equal(bytes.subarray(0,2).toString(),'MZ','Not a Windows PE installer');assert.equal(scalar(text,'sha512'),sha('sha512',bytes,'base64'));
 // Verify the single files[] entry as well (updater normally uses files[] before legacy path/sha512).
 const entries=[...text.matchAll(/^\s*- url:[ \t]*(.+?)\s*\r?\n[ \t]+sha512:[ \t]*(.+?)\s*\r?\n[ \t]+size:[ \t]*(\d+)\s*$/gm)];
 assert.equal(entries.length,1,'Expected one installer in update manifest');const unquote=s=>s.trim().replace(/^(['"])(.*)\1$/,'$2');assert.equal(unquote(entries[0][1]),installer);assert.equal(unquote(entries[0][2]),sha('sha512',bytes,'base64'));assert.equal(Number(entries[0][3]),bytes.length);
 assert.ok((await stat(join(dir,blockmap))).size>0,'Empty blockmap');
 return [installer,blockmap,manifest];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));console.log('Verified:',(await verifyRelease(process.argv[2]||'dist',pkg.version)).join(', '));}
