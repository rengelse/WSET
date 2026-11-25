import {recordTranslation} from './translation-status.mjs';
import {languageEntries,applyLanguagePack,LANGUAGE_PACK_FORMAT} from '../engines/cbpm-astro-v1/lib/i18n-core.mjs';
// Never translate markup, placeholders or links. Leave those tokens byte-identical.
export async function translateContent(engine,{source,target,text}){
 if(typeof text!=='string'||!text.trim()||text.length>10000)throw Error('Ugyldig tekst.');
 const parts=text.split(/(<[^>]*>|\{\{[^{}]+\}\}|\{[\w.-]+\}|%[\w]+%|https?:\/\/[^\s<>]+|&(?:#\d+|#x[\da-f]+|[a-z]+);)/gi);
 const out=[];for(let i=0;i<parts.length;i++){const part=parts[i];if(i%2||!part.trim()){out.push(part);continue;}const leading=part.match(/^\s*/)[0],trailing=part.match(/\s*$/)[0];const r=await engine.translate({source,target,text:part.trim()});out.push(leading+r.text+trailing);}
 return out.join('');
}
export function applyTranslationBatch(site,{source,target,items}){
 if(source===target||![source,target].every(c=>site.languages.some(l=>l.code===c))||!Array.isArray(items)||!items.length)throw Error('Ugyldig oversettelsesjobb.');
 const rows=new Map(languageEntries(site,target,source).map(e=>[e.key,e]));const messages=Object.create(null);for(const item of items){const row=rows.get(item.key);if(!row||row.source!==item.sourceText||row.value!==item.expected)throw Error('Teksten er endret. Oversett på nytt.');if(typeof item.value!=='string'||!item.value.trim()||Object.hasOwn(messages,item.key))throw Error('Ugyldig oversettelse.');messages[item.key]=item.value;}
 return recordTranslation(applyLanguagePack(site,{format:LANGUAGE_PACK_FORMAT,locale:target,reference:{},messages}),{source,target,items});
}
