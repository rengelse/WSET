/** Trusted-renderer text structure. No arbitrary selector or HTML input from UI.
 * Paths use element indices; slots refer to direct text nodes within an element.
 * Text values are checked before a binding is accepted. */
const voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const excluded=new Set('svg script style textarea select option input title'.split(' '));
export const decodeText=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,e)=>{const k=e.toLowerCase();if(k.startsWith('#')){const n=k[1]==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):all;}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k]??all;});
export const normalText=s=>String(s??'').replace(/\s+/g,' ').trim();
export const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseTextStructure(fragment){
 const root={children:[],parts:[],path:'',tag:'',attrs:'',parent:null},stack=[root],nodes=[],slots=[];
 for(const m of fragment.matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</g)){
  const t=m[0],p=stack.at(-1);if(t.startsWith('<!--'))continue;
  if(!/^<\/?[a-zA-Z]/.test(t)){const item={raw:t,text:decodeText(t),start:m.index,end:m.index+t.length,parent:p,index:p.parts.length};p.parts.push(item);if(!p.excluded&&normalText(item.text))slots.push(item);continue;}
  const tag=t.match(/^<\/?([\w:-]+)/)[1].toLowerCase();if(t.startsWith('</')){const idx=stack.findLastIndex(n=>n.tag===tag);if(idx>0)stack.splice(idx);continue;}
  const path=p===root?'':p.path+` > ${tag}:nth-child(${p.children.length+1})`;
  const n={tag,attrs:t,children:[],parts:[],parent:p,path,start:m.index,openEnd:m.index+t.length,excluded:p.excluded||excluded.has(tag)||/\bclass="[^"]*\b(?:sr-only|fake-stars|review-quote)\b/.test(t)};
  p.children.push(n);p.parts.push(n);nodes.push(n);if(!voidTags.has(tag)&&!t.endsWith('/>'))stack.push(n);
 }
 return {root,nodes,slots};
}
export const classes=n=>(n?.attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]||'').split(/\s+/);
export const attr=(n,k)=>n?.attrs.match(new RegExp('\\b'+k+'="([^"]*)"'))?.[1]||'';
export const ancestor=(n,predicate)=>{for(let a=n;a?.tag;a=a.parent)if(predicate(a))return a;return null;};
export const fullText=n=>normalText(n.parts.map(p=>p.tag?p.tag==='br'?' ':fullText(p):p.text).join(''));
export const buttonNode=n=>n?.tag==='button'||n?.tag==='a'&&classes(n).includes('btn');
// An SVG icon does not make a button or list item's text a mixed text run.
export const mixedSlot=s=>s.parent.parts.filter(p=>p.tag?!p.excluded&&p.tag!=='br'&&!!fullText(p):!!normalText(p.text)).length>1 || s.parent.parts.some(p=>p.tag==='br');
export const slotKey=s=>`${s.parent.path}|${s.index}`;
export const labelFor=n=>classes(n).includes('text-kicker')?'Overtittel':n.tag==='em'?'Fremhevet tekst':/^h[1-6]$/.test(n.tag)?'Overskrift':n.tag==='p'?'Beskrivelse':buttonNode(n)||n.tag==='a'?'Knappetekst':n.tag==='li'?'Listepunkt':'Tekst';
