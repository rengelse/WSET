/** Canonical property contract for CBPM v1.2.0. The Kyero XML *parser* and the
 * persistent import transaction are intentionally separate adapters delivered
 * later. This normalizer accepts structured, parsed Kyero-style records. */
const finiteNonnegative=(value,{zeroIsMissing=false}={})=>{
 if(value===''||value===undefined||value===null)return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0&&(!zeroIsMissing||n!==0)?n:null;
};
import {isIP} from 'node:net';
import {isLocalPropertyImagePath} from './property-image-path.mjs';
const oneOrZero=x=>x===true||x===1||x==='1';
const keepText=(s,max=2000)=>String(s??'').trim().slice(0,max);
const localeCode=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const allowedImageHost=url=>{
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!!u.hostname&&!isIP(u.hostname)&&!['localhost','local'].includes(u.hostname)&&!['.local','.localhost','.internal','.test','.example','.invalid'].some(suffix=>u.hostname.endsWith(suffix));}catch{return false;}
};
/** This transformation never downloads images. Remote HTTPS URLs are kept
 * as source references; importer must respect rights/approval before publishing.
 * Identifiers are scoped to the source, not assumed globally unique. */
export function normalizeKyeroRecord(raw,{sourceCode='redsp-trial'}={}){
 if(!raw||typeof raw!=='object')throw Error('Kyero entry must be an object');
 const source=keepText(sourceCode,64),externalId=keepText(raw.id,190),reference=keepText(raw.ref,120);
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(source)||!externalId||!reference)throw Error('Kyero entry lacks a valid source, id or reference');
 const price=finiteNonnegative(raw.price);if(price===null)throw Error(`Invalid price on ${externalId}`);
 const currency=String(raw.currency??'').trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw Error(`Invalid currency on ${externalId}`);
 const latitude=raw.location?.latitude===''?NaN:Number(raw.location?.latitude??NaN),longitude=raw.location?.longitude===''?NaN:Number(raw.location?.longitude??NaN);
 const localSource=!source.startsWith('new--');
 const photos=(Array.isArray(raw.images)?raw.images:[]).map((im,i)=>({
  sourceImageId:keepText(im.id??i+1,64),url:keepText(im.url,2000),
  role:(im.tags||[]).includes('floorplan')?'floorplan':'photo',order:i
 })).filter(im=>allowedImageHost(im.url)||(localSource&&isLocalPropertyImagePath(im.url)));
 const descriptions={};for(const [locale,val] of Object.entries(raw.desc||{})){
  if(localeCode.test(locale)&&typeof val==='string'&&val.trim())descriptions[locale]=val.trim();
 }
 const features=Array.isArray(raw.features)?raw.features.filter(s=>typeof s==='string').map(s=>s.trim()).filter(Boolean):[];
 const location=Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)&&Math.abs(longitude)<=180?{latitude,longitude}:null;
 return {
  identity:{sourceCode:source,externalId,reference},
  listing:{saleOrRent:raw.price_freq==='rent'?'rent':raw.price_freq==='sale'?'sale':'unknown',newBuild:oneOrZero(raw.new_build),type:keepText(raw.type,80),
   city:keepText(raw.town,120),province:keepText(raw.province,120),country:keepText(raw.country,120),
   locationDetail:keepText(raw.location_detail,200),location,
   price,currency,
   beds:finiteNonnegative(raw.beds),baths:finiteNonnegative(raw.baths),
   builtArea:finiteNonnegative(raw.surface_area?.built,{zeroIsMissing:true}),
   plotArea:finiteNonnegative(raw.surface_area?.plot,{zeroIsMissing:true}),
   pool:oneOrZero(raw.pool),energyConsumption:keepText(raw.energy_rating?.consumption,10),
   energyEmissions:keepText(raw.energy_rating?.emissions,10),
   sourceModifiedAt:keepText(raw.date,40),availability:'unknown',publicationStatus:'draft'
  },
  descriptions,images:photos,features
 };
}
