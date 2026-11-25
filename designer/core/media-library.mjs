import {stat,readFile,writeFile,copyFile,mkdir,rm,rename} from 'node:fs/promises';
import {resolve,join,extname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';

const types=new Set(['.jpg','.jpeg','.png','.webp','.avif','.tif','.tiff']);
const sizes={hero:[640,1280,1920],card:[420,840,1260],portrait:[360,720,1080],gallery:[480,960,1440]};
const ratios={hero:16/9,card:4/3,portrait:4/5,gallery:3/2};
const LIMIT=30*1024*1024;

/** Produce a cropped, progressive WebP set per placement while preserving the
 * untouched original in project/media/originals. No external upload service. */
export async function importProjectImage({root,source,focusX=50,focusY=50,sharpModule}={}){
 if(!root||!source||!types.has(extname(source).toLowerCase()))throw Error('Bruk JPG, PNG, WebP, AVIF eller TIFF. SVG kan ikke importeres som foto.');
 const info=await stat(source);
 if(!info.isFile()||info.size>LIMIT)throw Error('Bilde må være en fil under 30 MB.');
 const sharp=(sharpModule||await import('sharp')).default||sharpModule;
 if(typeof sharp!=='function')throw Error('Bildebehandling er ikke tilgjengelig. Installer npm-avhengighetene.');
 const meta=await sharp(source,{limitInputPixels:45_000_000}).metadata();
 if(!meta.width||!meta.height||meta.pages>1||meta.width*meta.height>45_000_000)throw Error('Ugyldig eller for stort/animert bilde.');
 const id='photo-'+randomUUID().slice(0,12);
 const originalFile=`${id}${extname(source).toLowerCase()}`;
 const originalPath=join(root,'project','media','originals',originalFile);
 const assetsDir=join(root,'public','assets');
 await mkdir(join(root,'project','media','originals'),{recursive:true});
 await mkdir(assetsDir,{recursive:true});
 const created=[];
 try{
  await copyFile(source,originalPath);created.push(originalPath);
  const oriented=await sharp(source,{limitInputPixels:45_000_000}).rotate().toBuffer({resolveWithObject:true});
  const w=oriented.info.width,h=oriented.info.height;
  const fx=Math.max(0,Math.min(100,Number(focusX)||0))/100,fy=Math.max(0,Math.min(100,Number(focusY)||0))/100;
  const variants={},variantWidths={};
  for(const [type,widths] of Object.entries(sizes)){
   variants[type]=[];variantWidths[type]=[];
   const ratio=ratios[type];
   const cropW=Math.min(w,Math.round(h*ratio)),cropH=Math.min(h,Math.round(w/ratio));
   const left=Math.round(Math.max(0,Math.min(w-cropW,w*fx-cropW/2)));
   const top=Math.round(Math.max(0,Math.min(h-cropH,h*fy-cropH/2)));
   for(const width of widths){
    // Do not upscale beyond source resolution; preserve requested output filenames.
    const dest=`${id}-${type}-${width}.webp`;
    const path=join(assetsDir,dest);
    const result=await sharp(oriented.data).extract({left,top,width:cropW,height:cropH})
      .resize({width:Math.min(width,cropW),withoutEnlargement:true})
      .webp({quality:type==='hero'?80:77,effort:4}).toFile(path);
    created.push(path);variants[type].push('/assets/'+dest);variantWidths[type].push(result.width);
   }
  }
  const src=variants.gallery.at(-1);
  const master=join(assetsDir,id+'.webp');
  await copyFile(join(assetsDir,src.split('/').at(-1)),master);
  created.push(master);
  return {id,src:'/assets/'+id+'.webp',original:'project/media/originals/'+originalFile,
   originalName:basename(source),width:w,height:h,focusX:Math.round(fx*100),focusY:Math.round(fy*100),variants,variantWidths};
 }catch(error){
  await Promise.all(created.map(path=>rm(path,{force:true}).catch(()=>{})));
  throw error;
 }
}
/** Recompute derivatives when an editor changes the focal point. The untouched
 * original is the source; derivative files are atomically replaced per file. */
export async function reframeProjectImage({root,item,focusX,focusY,sharpModule}={}){
 if(!item||!/^project\/media\/originals\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|tif|tiff)$/.test(item.original||''))
  throw Error('Dette bildet har ingen lagret original. Importer en ny fil i stedet.');
 const sharp=(sharpModule||await import('sharp')).default||sharpModule;
 const original=resolve(root,item.original);
 const oriented=await sharp(original,{limitInputPixels:45_000_000}).rotate().toBuffer({resolveWithObject:true});
 const w=oriented.info.width,h=oriented.info.height;
 const fx=Math.max(0,Math.min(100,Number(focusX)||0))/100,fy=Math.max(0,Math.min(100,Number(focusY)||0))/100;
 const pending=[];
 try{
  const variantWidths={};
  for(const [preset,paths] of Object.entries(item.variants||{})){
   const ratio=ratios[preset];if(!ratio||paths.length!==3)throw Error('Ugyldig bildevariant.');
   variantWidths[preset]=[];
   const cropW=Math.min(w,Math.round(h*ratio)),cropH=Math.min(h,Math.round(w/ratio));
   const left=Math.round(Math.max(0,Math.min(w-cropW,w*fx-cropW/2)));
   const top=Math.round(Math.max(0,Math.min(h-cropH,h*fy-cropH/2)));
   for(let i=0;i<paths.length;i++){
    const target=resolve(root,'public',paths[i].slice(1));
    const temp=target+'.'+randomUUID()+'.webp';
    const result=await sharp(oriented.data).extract({left,top,width:cropW,height:cropH})
     .resize({width:Math.min(sizes[preset][i],cropW),withoutEnlargement:true})
     .webp({quality:preset==='hero'?80:77,effort:4}).toFile(temp);
    pending.push({temp,target});variantWidths[preset].push(result.width);
   }
  }
  // Master is a copy of the largest gallery rendition.
  const gallery=pending.find(x=>x.target.endsWith(item.variants.gallery?.at(-1)?.split('/').at(-1)||'~~'));
  if(gallery){const target=resolve(root,'public',item.src.slice(1)),temp=target+'.'+randomUUID()+'.webp';
    await copyFile(gallery.temp,temp);pending.push({temp,target});}
  for(const {temp,target} of pending)await rename(temp,target);
  return {...item,focusX:Math.round(fx*100),focusY:Math.round(fy*100),variantWidths};
 }finally{await Promise.all(pending.map(x=>rm(x.temp,{force:true}).catch(()=>{})))}
}

/** Brand logo pipeline: no fixed-ratio photo crops. Retain transparency and original file. */
export async function importProjectLogo({root,source,sharpModule}={}){
 const ext=extname(source||'').toLowerCase();
 if(!root||!['.png','.jpg','.jpeg','.webp','.avif','.svg'].includes(ext))
  throw Error('Logo må være SVG, PNG, JPG, WebP eller AVIF.');
 const info=await stat(source);
 if(!info.isFile()||info.size>8*1024*1024)throw Error('Logoen må være under 8 MB.');
 const sharp=(sharpModule||await import('sharp')).default||sharpModule;
 if(typeof sharp!=='function')throw Error('Bildebehandling er ikke tilgjengelig. Kjør npm install.');
 if(ext==='.svg'){
  const text=(await readFile(source)).toString('utf8');
  // Block executable content, remote resources and DTDs before rasterising.
  if(!/<svg[\s>]/i.test(text)||/<\s*(?:script|foreignObject|image|iframe|object|embed|use|animate|set)\b|<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|\son[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(\s*(?!["']?#)|@import/i.test(text))
   throw Error('SVG inneholder potensielt usikkert eller eksternt innhold. Eksporter logoen som PNG.');
 }
 const img=sharp(source,{limitInputPixels:20_000_000,density:144});
 const meta=await img.metadata();
 if(!meta.width||!meta.height||meta.pages>1||meta.width*meta.height>20_000_000)throw Error('Ugyldig eller for stor logo.');
 const id='logo-'+randomUUID().slice(0,12);
 const originals=join(root,'project','media','originals'),assets=join(root,'public','assets');
 await mkdir(originals,{recursive:true});await mkdir(assets,{recursive:true});
 const originalFilename=id+ext;
 const originalPath=join(originals,originalFilename);
 const created=[];
 try{
  await copyFile(source,originalPath);created.push(originalPath);
  const variants={logo:[],favicon:[]},variantWidths={logo:[],favicon:[]};
  for(const width of [320,640,1280]){
   const name=`${id}-logo-${width}.webp`,dest=join(assets,name);
   const result=await sharp(source,{limitInputPixels:20_000_000,density:144}).rotate()
    .resize({width:Math.min(width,meta.width),withoutEnlargement:true})
    .webp({quality:88,effort:4}).toFile(dest);
   created.push(dest);variants.logo.push('/assets/'+name);variantWidths.logo.push(result.width);
  }
  for(const width of [64,128,256]){
   const name=`${id}-favicon-${width}.png`,dest=join(assets,name);
   const result=await sharp(source,{limitInputPixels:20_000_000,density:144}).rotate()
    .resize({width,height:width,fit:'contain',background:{r:0,g:0,b:0,alpha:0},withoutEnlargement:true})
    .png({compressionLevel:9}).toFile(dest);
   created.push(dest);variants.favicon.push('/assets/'+name);variantWidths.favicon.push(result.width);
  }
  const final=join(assets,id+'.webp');
  await copyFile(join(assets,variants.logo.at(-1).split('/').at(-1)),final);created.push(final);
  return {id,src:'/assets/'+id+'.webp',original:'project/media/originals/'+originalFilename,
   originalName:basename(source),width:meta.width,height:meta.height,variants,variantWidths,kind:'logo'};
 }catch(error){await Promise.all(created.map(file=>rm(file,{force:true}).catch(()=>{})));throw error;}
}
