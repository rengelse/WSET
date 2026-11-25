/** Split only the immediate HTML children of <main>. We preserve the original
 * Mal 01 markup byte-for-byte within each block. HTML is produced by the
 * trusted renderer, never fed here directly from an editor input field.
 */
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function tagInfo(source,start){
  let i=start+1,quote='';
  for(;i<source.length;i++){
    const c=source[i];
    if(quote){if(c===quote)quote='';}
    else if(c==='"'||c==="'")quote=c;
    else if(c==='>')break;
  }
  if(i>=source.length)throw Error('Unclosed HTML tag in renderer output.');
  const value=source.slice(start,i+1);
  const name=value.match(/^<\s*\/?\s*([a-zA-Z][\w:-]*)/);
  return {name:name?.[1]?.toLowerCase(),close:/^<\s*\//.test(value),selfClosing:/\/\s*>$/.test(value),next:i+1};
}
export function splitMainSections(html){
  const open='<main id="main">';
  const first=html.indexOf(open);
  if(first<0)throw Error('Main element not found in Mal 01 renderer.');
  const start=first+open.length,end=html.indexOf('</main>',start);
  if(end<0)throw Error('Closing main element not found.');
  const body=html.slice(start,end);
  const sections=[];let pos=0,depth=0,begin=-1;
  while(pos<body.length){
    const next=body.indexOf('<',pos);
    if(next<0)break;
    if(body.startsWith('<!--',next)){
      const e=body.indexOf('-->',next+4);pos=e<0?body.length:e+3;continue;
    }
    const tag=tagInfo(body,next);pos=tag.next;
    if(!tag.name)continue;
    if(!tag.close){
      if(depth===0)begin=next;
      if(!tag.selfClosing&&!voidTags.has(tag.name))depth++;
      else if(depth===0&&begin>=0){sections.push(body.slice(begin,tag.next));begin=-1;}
    }else{
      depth--;
      if(depth<0)throw Error('Unbalanced original template HTML.');
      if(depth===0){sections.push(body.slice(begin,tag.next));begin=-1;}
    }
  }
  if(depth!==0)throw Error('Unbalanced original template sections.');
  return {before:html.slice(0,start),after:html.slice(end),sections};
}
export function classOf(section){
  return section.match(/^<\w+[^>]*\bclass="([^"]*)"/)?.[1]||'';
}
const slotNames={
  services:['hero','listing','faq','cta'],rental:['hero','overview','process','cta'],
  projects:['hero','listing','cta'],reviews:['hero','listing','share','cta'],
  about:['hero','intro','values','team','cta'],contact:['hero','form']
};
export function legacySectionMap(page,html){
  const fragments=splitMainSections(html).sections;
  if(page==='home'){
    const patterns={hero:'hero',trust:'trust-strip',services:'service-section',why:'why',projects:'projects-section',reviews:'reviews-band',team:'people-section',cta:'cta-banner'};
    return Object.fromEntries(fragments.map(f=>{
      const cls=classOf(f).split(/\s+/);
      const slot=Object.keys(patterns).find(k=>cls.includes(patterns[k]));
      return [slot,f];
    }).filter(([key])=>key));
  }
  if(!slotNames[page])throw Error(`Unknown Mal 01 source template: ${page}`);
  const slots=slotNames[page];
  if(fragments.length!==slots.length)throw Error(`Template ${page} produced ${fragments.length} sections, expected ${slots.length}.`);
  return Object.fromEntries(slots.map((key,i)=>[key,fragments[i]]));
}
