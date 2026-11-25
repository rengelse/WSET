/** Stable, section-local text overrides for the original Mal 01 HTML renderer.
 * Text nodes only: never replace tags or attribute values. Empty override means
 * intentionally empty; absence leaves the approved original markup untouched.
 */
const textNode=/(>)([^<>]+)(<)/g;
const ignored=/^(?:[\d\s.,:;|/–—+\-→←✓★]+)$/u;
export function templateTextEntries(fragment){
 const entries=[],used=new Set();
 for(const match of String(fragment||'').matchAll(textNode)){
  const key=match[2].trim();
  if(key.length<3||ignored.test(key)||used.has(key))continue;
  used.add(key);
  entries.push(key);
 }
 return entries;
}
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function applyTemplateText(fragment,site,source,slot,locale){
 const changes=site?.templateTexts?.[source]?.[slot]?.[locale];
 if(!changes||!Object.keys(changes).length)return fragment;
 return fragment.replace(textNode,(_,before,text,after)=>{
  const original=text.trim();
  if(!Object.hasOwn(changes,original))return before+text+after;
  const paddingLeft=text.match(/^\s*/)?.[0]||'';
  const paddingRight=text.match(/\s*$/)?.[0]||'';
  return before+paddingLeft+escapeHTML(changes[original])+paddingRight+after;
 });
}
