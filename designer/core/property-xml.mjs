/** Strict, network-free Kyero v3 XML reader for locally selected files.
 * No DTD, external entities, namespaces, processing instructions or network fetch.
 * Purposefully accepts only the supported Kyero feed vocabulary. */
import {normalizeKyeroRecord} from '../engines/cbpm-astro-v1/lib/property-model.mjs';
const MAX_XML_BYTES=25*1024*1024,MAX_PROPERTIES=5000;
function entities(s){if(/&(?!(?:#(?:x[0-9a-fA-F]+|[0-9]+)|amp|lt|gt|quot|apos);)/.test(s))throw Error('Ukjent eller uavsluttet XML-entitet.');return s.replace(/&(#(?:x[0-9a-fA-F]+|[0-9]+)|amp|lt|gt|quot|apos);/g,(_,v)=>{
 if(v==='amp')return '&';if(v==='lt')return '<';if(v==='gt')return '>';if(v==='quot')return '"';if(v==='apos')return "'";
 const n=v[1]==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10);
 if(n===0||n>0x10ffff||(n>=0xd800&&n<=0xdfff))throw Error('Ugyldig XML-tegnreferanse.');
 return String.fromCodePoint(n);
 });}
function parseTree(xml){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>MAX_XML_BYTES)throw Error('XML-fil er større enn 25 MB.');
 if(/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))throw Error('DOCTYPE og ENTITY er ikke tillatt i XML-filer.');
 const tree={name:'#document',children:[],parts:[]},stack=[tree];let pos=0,nodes=0;
 while(pos<xml.length){
  if(xml[pos]!=='<'){
   const end=xml.indexOf('<',pos),to=end<0?xml.length:end;
   stack.at(-1).parts.push(entities(xml.slice(pos,to)));pos=to;continue;
  }
  if(xml.startsWith('<!--',pos)){const end=xml.indexOf('-->',pos+4);if(end<0)throw Error('Uavsluttet XML-kommentar.');pos=end+3;continue;}
  if(xml.startsWith('<![CDATA[',pos)){const end=xml.indexOf(']]>',pos+9);if(end<0)throw Error('Uavsluttet CDATA.');stack.at(-1).parts.push(xml.slice(pos+9,end));pos=end+3;continue;}
  if(xml.startsWith('<?xml',pos)&&pos<3){const end=xml.indexOf('?>',pos+5);if(end<0)throw Error('Ugyldig XML-deklarasjon.');pos=end+2;continue;}
  if(xml.startsWith('<!',pos)||xml.startsWith('<?',pos))throw Error('Ustøttet XML-direktiv.');
  let end=pos+1,quote=null;for(;end<xml.length;end++){const c=xml[end];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
  if(end===xml.length)throw Error('Uavsluttet XML-element.');
  const token=xml.slice(pos+1,end).trim();pos=end+1;
  if(token.startsWith('/')){
   const name=token.slice(1).trim();if(stack.length<2||name!==stack.at(-1).name)throw Error('Ubalanserte XML-elementer.');
   stack.pop();continue;
  }
  const selfClosing=token.endsWith('/'),inner=selfClosing?token.slice(0,-1).trim():token;
  const match=/^([A-Za-z_][A-Za-z0-9_.-]*)([\s\S]*)$/.exec(inner);if(!match)throw Error('Ugyldig XML-element.');
  const attrs={};let rest=match[2];
  while(rest.trim()){
   const a=/^\s+([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);
   if(!a||Object.hasOwn(attrs,a[1]))throw Error('Ugyldig XML-attributt.');attrs[a[1]]=entities(a[2]??a[3]);rest=rest.slice(a[0].length);
  }
  if(++nodes>250000||stack.length>35)throw Error('XML-filen er for kompleks.');
  const current={name:match[1],attrs,parts:[],children:[]};stack.at(-1).children.push(current);
  if(!selfClosing)stack.push(current);
 }
 if(stack.length!==1||tree.children.length!==1||tree.parts.join('').trim())throw Error('XML-filen er ikke gyldig eller har flere rotelementer.');
 return tree.children[0];
}
const first=(x,name)=>x?.children?.find(e=>e.name===name);
const all=(x,name)=>x?.children?.filter(e=>e.name===name)||[];
const value=(x,name)=>first(x,name)?.parts.join('').trim()||'';
export function parseKyeroXML(xml,{sourceCode='redsp'}={}){
 const root=parseTree(xml);
 if(root.name!=='root'||value(first(root,'kyero'),'feed_version')!=='3')throw Error('Forventer Kyero v3 XML med <root><kyero><feed_version>3.');
 const nodes=all(root,'property');if(nodes.length>MAX_PROPERTIES)throw Error('For mange eiendommer i én XML-fil.');
 const seen=new Set(),items=[];
 for(const p of nodes){
  const raw={id:value(p,'id'),ref:value(p,'ref'),date:value(p,'date'),price:value(p,'price'),currency:value(p,'currency'),
   price_freq:value(p,'price_freq'),new_build:value(p,'new_build'),type:value(p,'type'),town:value(p,'town'),
   province:value(p,'province'),country:value(p,'country'),location_detail:value(p,'location_detail'),
   beds:value(p,'beds'),baths:value(p,'baths'),pool:value(p,'pool'),
   location:{latitude:value(first(p,'location'),'latitude'),longitude:value(first(p,'location'),'longitude')},
   surface_area:{built:value(first(p,'surface_area'),'built'),plot:value(first(p,'surface_area'),'plot')},
   energy_rating:{consumption:value(first(p,'energy_rating'),'consumption'),emissions:value(first(p,'energy_rating'),'emissions')},
   desc:Object.fromEntries((first(p,'desc')?.children||[]).map(n=>[n.name,n.parts.join('').trim().replace(/&#(?:13|10);/g,'\n').replace(/&amp;/g,'&')])),
   features:all(first(p,'features'),'feature').map(n=>n.parts.join('').trim()),
   images:all(first(p,'images'),'image').map(n=>({id:n.attrs.id,url:value(n,'url'),tags:all(first(n,'tags'),'tag').map(t=>t.parts.join('').trim())}))};
  const normalized=normalizeKyeroRecord(raw,{sourceCode});
  const key=normalized.identity.externalId;
  if(seen.has(key))throw Error('XML inneholder duplikat-ID: '+key);
  seen.add(key);items.push(normalized);
 }
 if(items.length===0)throw Error('XML-filen inneholder ingen eiendommer.');
 return items;
}
export function exampleOwnXML(){return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <kyero><feed_version>3</feed_version></kyero>
  <property>
    <id>egen-001</id><ref>CBPM-001</ref>
    <date>2026-11-22</date><price>295000</price><currency>EUR</currency>
    <price_freq>sale</price_freq><new_build>0</new_build>
    <type>Apartment</type><town>Torrevieja</town><province>Alicante</province><country>Spain</country>
    <beds>2</beds><baths>1</baths><pool>0</pool>
    <surface_area><built>75</built><plot>0</plot></surface_area>
    <desc><no><![CDATA[Beskrivelse av egen eiendom.]]></no><en><![CDATA[Your property description.]]></en></desc>
    <features><feature>Terrace</feature></features>
    <images><image id="1"><url>images/CBPM-001/01.webp</url></image></images>
  </property>
</root>
`;}
