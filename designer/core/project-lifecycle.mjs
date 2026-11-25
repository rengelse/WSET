/** Local administration only. Website content and server credentials never belong here. */
import {createHash,randomUUID} from 'node:crypto';
export const lifecycleStatuses=['not-started','development','review','approval','ready','published','maintenance','archived'];
export const approvalStatuses=['not-requested','pending','changes-requested','approved','not-required'];
export const checklistIds=['brand','pages','media','languages','legal','modules','server'];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const statuses=['pending','done','na'];
const hashPattern=/^[a-f0-9]{64}$/;
export const contentDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
function choice(value,allowed,label){if(!allowed.includes(value))throw Error('Ugyldig '+label+'.');return value;}
function dateOnly(v){if(v==='')return v;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Ugyldig leveringsdato.');return v;}
function iso(v){return typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;}
export function normalizeLifecycleInput(input={}){
 if(!object(input))throw Error('Ugyldig prosjektoppfølging.');
 const notes=input.notes??'';if(typeof notes!=='string'||notes.length>8000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notes))throw Error('Ugyldige prosjektnotater (maks 8000 tegn).');
 const checklist=input.checklist??{};if(!object(checklist)||Object.keys(checklist).some(k=>!checklistIds.includes(k)))throw Error('Ugyldig sjekkliste.');
 return {status:choice(input.status??'not-started',lifecycleStatuses,'prosjektstatus'),dueDate:dateOnly(input.dueDate??''),notes:notes.trim(),approval:choice(input.approval??'not-requested',approvalStatuses,'kundegodkjenning'),checklist:Object.fromEntries(checklistIds.map(k=>[k,choice(checklist[k]??'pending',statuses,'kontrollpunkt')]))};
}
export function normalizeLifecycle(value={}){
 const settings=normalizeLifecycleInput(value);const validation=value.validation;
 const validCheck=object(validation)&&iso(validation.at)&&typeof validation.ok==='boolean'&&hashPattern.test(validation.digest||'');
 const count=v=>Number.isSafeInteger(v)&&v>=0?v:0;
 return {...settings,approvalAt:iso(value.approvalAt),updatedAt:iso(value.updatedAt),validation:validCheck?{at:iso(validation.at),ok:validation.ok,digest:validation.digest,errors:count(validation.errors),warnings:count(validation.warnings)}:null};
}
export function updateLifecycle(previous,input,at=new Date().toISOString()){
 const old=normalizeLifecycle(previous),settings=normalizeLifecycleInput(input);at=iso(at);
 return {...old,...settings,updatedAt:at,approvalAt:settings.approval===old.approval?old.approvalAt:settings.approval==='approved'?at:null};
}
export function lifecycleProgress(lifecycle,digest){
 const v=normalizeLifecycle(lifecycle),values=Object.values(v.checklist),validationCurrent=!!digest&&v.validation?.digest===digest;
 const total=values.filter(x=>x!=='na').length+1+Number(v.approval!=='not-required');
 const done=values.filter(x=>x==='done').length+Number(validationCurrent&&v.validation.ok)+Number(v.approval==='approved');
 return {done,total,percent:Math.round(100*done/total),validationCurrent};
}
const kinds=['export','website','New','Existing'];const outcomes=['completed','failed','cancelled','partial'];
export function publicationEvent(input,at=new Date().toISOString()){
 if(!object(input))throw Error('Ugyldig publiseringshendelse.');
 const count=v=>{if(!Number.isSafeInteger(v)||v<0)throw Error('Ugyldig overføringstall.');return v;};
 return {id:randomUUID(),at,kind:choice(input.kind,kinds,'hendelsestype'),outcome:choice(input.outcome,outcomes,'hendelsesstatus'),digest:hashPattern.test(input.digest||'')?input.digest:null,counts:input.counts?Object.fromEntries(['done','skipped','failed','cancelled','other'].map(k=>[k,count(input.counts[k]??0)])):null};
}
export function publicationOutcome(rows,{cancelled=false,unexpectedFailure=false}={}){
 const counts={done:0,skipped:0,failed:0,cancelled:0,other:0};
 for(const row of rows){const status=row.status;counts[Object.hasOwn(counts,status)?status:'other']++;}
 const unexpectedSkip=rows.some(r=>r.status==='skipped'&&!((r.policy==='preserve'&&['Eksisterende serverfil beholdt.','Destinasjonen finnes allerede.'].includes(r.error))||(r.policy==='immutable'&&r.error==='Identisk boligbilde beholdt.')));
 const outcome=cancelled||counts.cancelled?'cancelled':unexpectedFailure||counts.failed?'failed':!rows.length||counts.other||unexpectedSkip?'partial':'completed';
 return {outcome,counts};
}
export function publicationSummary(history,digest){
 const rows=Array.isArray(history)?history:[];
 const last=rows.find(r=>r.kind==='website'&&r.outcome==='completed')||null;
 const lastExport=rows.find(r=>r.kind==='export'&&r.outcome==='completed')||null;
 return {lastPublication:last?.at||null,lastExport:lastExport?.at||null,contentChanged:last?.digest&&digest?last.digest!==digest:null,latest:rows[0]||null,total:rows.length};
}
