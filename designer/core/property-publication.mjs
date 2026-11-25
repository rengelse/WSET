/** One publication policy for local XML imports. Explicit editorial choices win. */
export function activateImportedCategory(site,category,count){
 if(!Number.isInteger(count)||count<=0)return {site,activated:[],skipped:true};
 const id=category==='New'?'developments':category==='Existing'?'properties':null;
 if(!id)throw Error('Ukjent XML-kategori.');
 const next=structuredClone(site),activated=[];
 const page=next.sitePages?.find(p=>p.id==='properties');
 if(!page)throw Error('Prosjektet mangler Eiendommer-siden.');
 next.propertyModules??={};
 const module=next.propertyModules[id]??={enabled:true,showInNavigation:true,labels:{}};
 if(page.enabled===false&&page.visibilityExplicit!==true){page.enabled=true;activated.push('Eiendommer-siden');}
 if(module.enabled!==true&&module.visibilityExplicit!==true){module.enabled=true;activated.push(id==='developments'?'Nybygg':'Boliger til salgs');}
 return {site:next,activated,skipped:false};
}

/** Reconcile imports from older WSET versions without overwriting intentional choices. */
export async function reconcileExistingImports(root,site){
 const {listLocalFeeds}=await import('./local-property-feeds.mjs');
 const inventory=await listLocalFeeds(root);let next=site,activated=[];
 for(const category of ['New','Existing']){
  const count=inventory.files.filter(file=>file.category===category).reduce((sum,file)=>sum+file.count,0);
  if(!count)continue;
  const result=activateImportedCategory(next,category,count);next=result.site;activated.push(...result.activated);
 }
 return {site:next,activated,errors:inventory.errors};
}
