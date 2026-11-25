/** Mal 01 global content contract. Opt-in: untouched projects render exactly as before. */
export const legalIds=['legal','privacy','cookies','terms','disclaimer'];
const titles={legal:['Juridisk informasjon','Legal information','Información legal'],privacy:['Personvernerklæring','Privacy policy','Política de privacidad'],cookies:['Informasjonskapsler','Cookie policy','Política de cookies'],terms:['Vilkår og betingelser','Terms and conditions','Términos y condiciones'],disclaimer:['Ansvarsfraskrivelse','Disclaimer','Aviso de responsabilidad']};
const keys={extra:'ui.not-published-illustrative-images-and-sample-con.a710ef21',intro:'ui.from-small-repairs-to-larger-projects-and-ongoin.f565f273',contact:'ui.contact-details-coming-soon.badc0d57',legalTitle:'ui.legal-information.91c0afc3',legalBody:'ui.required-spanish-company-information-and-privacy.771de8c2'};
const own=(obj,key)=>Object.hasOwn(obj||{},key);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=(v,site,locale)=>v?.[locale]??v?.[site.defaultLanguage]??v?.en??'';
export function globalDefaults(site){
 const langs=site.languages||[],ui=site.i18n?.ui||{},localized=(key,transform=x=>x)=>Object.fromEntries(langs.filter(l=>own(ui[l.code],key)).map(l=>[l.code,transform(ui[l.code][key])]));
 const defaultTitle=id=>Object.fromEntries(['no','en','es'].map((l,i)=>[l,titles[id][i]]));
 return {footer:{configured:false,showCopyright:true,showYear:false,showExtra:true,showIntro:true,showContact:true,useBrandArea:false,extra:localized(keys.extra,x=>'DESIGN MAL 01 · v0.2.1 · '+x),intro:localized(keys.intro),contact:localized(keys.contact)},header:{configured:false,showContact:true,showFloating:true},legal:{configured:false,documents:Object.fromEntries(legalIds.map(id=>[id,{enabled:id==='legal',includeCompany:false,title:id==='legal'?{...defaultTitle(id),...localized(keys.legalTitle)}:defaultTitle(id),body:id==='legal'?localized(keys.legalBody):{}}]))}};
}
const footerFlags=['showCopyright','showYear','showExtra','showIntro','showContact','useBrandArea'];
const headerFlags=['showContact','showFloating'];
const footerText=['extra','intro','contact'];
const legalFlags=['enabled','includeCompany'];
const legalText=['title','body'];
function text(v){if(typeof v!=='string'||v.length>10000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||/<[^>]*>/.test(v))throw Error('Skriv ren tekst, maks 10 000 tegn. HTML er ikke tillatt.');return v;}
export function editGlobalContent(site,{section,field,id,locale,value}){
 if(!['footer','header','legal'].includes(section))throw Error('Ukjent global innstilling.');
 const global=site.globalContent??={};const block=global[section]??=globalDefaults(site)[section];
 let record=block,flags=section==='footer'?footerFlags:headerFlags,fields=section==='footer'?footerText:[];
 if(section==='legal'){if(!legalIds.includes(id))throw Error('Ukjent juridisk dokument.');record=block.documents[id];flags=legalFlags;fields=legalText;}
 if(flags.includes(field)){if(typeof value!=='boolean')throw Error('Ugyldig valg.');record[field]=value;}
 else if(fields.includes(field)){if(!site.languages.some(l=>l.code===locale))throw Error('Ukjent språk.');record[field]??={};record[field][locale]=text(value);}
 else throw Error('Ukjent globalt felt.');
 block.configured=true;return site;
}
export function validateGlobalContent(site){const errors=[];const g=site.globalContent;if(!g)return errors;
 try{for(const section of ['footer','header','legal']){const block=g[section];if(!block)continue;if(typeof block.configured!=='boolean')throw Error('Ugyldig global konfigurasjon.');const validate=(record,flags,fields)=>{if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Ugyldig innstilling.');for(const flag of flags)if(typeof record[flag]!=='boolean')throw Error('Ugyldig globalt valg.');for(const field of fields){const map=record[field];if(!map||typeof map!=='object'||Array.isArray(map))throw Error('Ugyldig språkfelt.');for(const value of Object.values(map))text(value);}};if(section==='legal')for(const id of legalIds)validate(block.documents?.[id],legalFlags,legalText);else validate(block,section==='footer'?footerFlags:headerFlags,section==='footer'?footerText:[]);}}catch(error){errors.push(error.message);}return errors;}
export function globalTranslationEntries(site){const g=site.globalContent,entries=[];const add=(key,object,field,active)=>entries.push({key,object,field,active});if(g?.footer?.configured)for(const f of footerText)add(`global.footer.${f}`,g.footer,f,g.footer[{extra:'showExtra',intro:'showIntro',contact:'showContact'}[f]]);if(g?.legal?.configured)for(const id of legalIds){const doc=g.legal.documents[id];for(const f of legalText)add(`global.${id}.${f}`,doc,f,doc.enabled);}return entries;}
export function hasGlobalContent(site){return ['footer','header','legal'].some(k=>site.globalContent?.[k]?.configured===true);}
export function hasLegalContent(site){return site.globalContent?.legal?.configured===true;}
const businessText=site=>{const b=site.brand||{};return [b.legalName||b.displayName,b.registrationNumber,[b.streetAddress,b.postalCode,b.city,b.country].filter(Boolean).join(', '),b.email,b.phone].filter(Boolean).join('\n');};
function docsMarkup(site,locale){const docs=site.globalContent.legal.documents,links=[],dialogs=[];for(const id of legalIds){const doc=docs[id];if(!doc?.enabled)continue;const title=pick(doc.title,site,locale),body=pick(doc.body,site,locale);if(!title.trim()||!body.trim())continue;const domId='wset-legal-'+id;links.push(`<button type="button" class="footer-link" data-wset-legal-open="${domId}">${esc(title)}</button>`);dialogs.push(`<dialog class="wset-legal-dialog" id="${domId}" aria-labelledby="${domId}-title"><button type="button" data-wset-legal-close class="wset-legal-close" aria-label="${esc(site.i18n?.ui?.[locale]?.['ui.close.faa44301']||'Close')}">×</button><h2 id="${domId}-title">${esc(title)}</h2>${doc.includeCompany?`<p class="wset-legal-copy">${esc(businessText(site))}</p>`:''}<div class="wset-legal-copy">${esc(body)}</div></dialog>`);}return {links:links.join(''),dialogs:dialogs.join('')};}
/** Same scoped transformation for local renderer and generated static/PHP shells. */
export function applyGlobalMarkup(html,site,locale,{strict=false}={}){
 if(!hasGlobalContent(site))return html;
 const g=site.globalContent;let matched=false;
 if(g.header?.configured){if(!g.header.showContact)html=html.replace(/<a\b[^>]*class="[^"]*\b(?:header-cta|mobile-cta)\b[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');if(!g.header.showFloating)html=html.replace(/<a\b[^>]*class="[^"]*\bfloating-contact\b[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');}
 html=html.replace(/<footer\b[^>]*class="[^"]*\bfooter\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i,footer=>{
  matched=true;
  if(g.footer?.configured){const f=g.footer;
   footer=footer.replace(/<p class="footer-intro">[\s\S]*?<\/p>/,()=>f.showIntro&&pick(f.intro,site,locale).trim()?`<p class="footer-intro">${esc(pick(f.intro,site,locale))}</p>`:'');
   footer=footer.replace(/(<div class="footer-col"><h4>[^<]*<\/h4>)<span class="footer-link">([\s\S]*?)<\/span><span class="footer-link">[\s\S]*?<\/span>/,(_m,start,area)=>start+`<span class="footer-link">${f.useBrandArea?esc(site.brand?.area||''):area}</span>`+(f.showContact&&pick(f.contact,site,locale).trim()?`<span class="footer-link">${esc(pick(f.contact,site,locale))}</span>`:''));
   const extra=pick(f.extra,site,locale),brand=site.brand||{};const copy=f.showCopyright?`<span>© ${f.showYear?new Date().getFullYear()+' · ':''}${esc(brand.shortName||'CBPM')} · ${esc(brand.displayName||'Costa Blanca Property Management')}</span>`:'';
   footer=footer.replace(/<div class="footer-bottom">[\s\S]*?<\/div>/,()=>copy||f.showExtra&&extra.trim()?`<div class="footer-bottom">${copy}${f.showExtra&&extra.trim()?`<span>${esc(extra)}</span>`:''}</div>`:'');
  }
  if(g.legal?.configured){const {links,dialogs}=docsMarkup(site,locale);const pattern=/<button\b[^>]*data-modal="legal"[^>]*>[\s\S]*?<\/button>/i;if(strict&&!pattern.test(footer))throw Error('Ukjent juridisk lenke i Mal 01.');footer=footer.replace(pattern,()=>links).replace('</footer>',()=>dialogs+'</footer>');}
  return footer;
 });
 if(strict&&!matched)throw Error('Ukjent bunntekst i Mal 01.');return html;
}
// No inline script or executable project text. Native dialog provides focus management.
export const globalLegalJs=`\n;document.addEventListener('click',function(e){var close=e.target.closest('[data-wset-legal-close]');if(close){close.closest('dialog')?.close();return;}var b=e.target.closest('[data-wset-legal-open]');if(!b)return;var d=document.getElementById(b.getAttribute('data-wset-legal-open'));if(d&&typeof d.showModal==='function'&&!d.open)d.showModal();});\n`;
export const globalLegalCss=`\n.wset-legal-dialog{width:min(680px,calc(100% - 32px));max-height:85vh;overflow:auto;border:0;border-radius:16px;padding:32px;background:#fff;color:#12343e;box-shadow:0 20px 70px #0004;margin:auto}.wset-legal-dialog::backdrop{background:#001a27a8}.wset-legal-dialog h2{font-size:24px;margin:0 28px 16px 0}.wset-legal-copy{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:14px;margin:0 0 16px}.wset-legal-close{float:right;border:0;background:none;font-size:28px;color:#12343e;cursor:pointer}.wset-legal-dialog:not([open]){display:none}\n`;
