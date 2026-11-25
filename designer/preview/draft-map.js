'use strict';
(()=>{
 const msg=document.getElementById('map-note'),params=new URLSearchParams(location.search),lat=params.get('lat'),lon=params.get('lon');
 const valid=lat!==null&&lon!==null&&lat!==''&&lon!==''&&Number.isFinite(+lat)&&Number.isFinite(+lon)&&Math.abs(+lat)<=90&&Math.abs(+lon)<=180;
 try{
  if(!window.maplibregl)throw Error('Kartbiblioteket mangler. Kjør npm install i WSET.');
  const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:valid?[+lon,Math.max(-85,Math.min(85,+lat))]:[-0.68,38.09],zoom:valid?15:10,attributionControl:true});
  map.addControl(new maplibregl.NavigationControl(),'top-right');
  let marker=null;const setPin=(lngLat,notify)=>{const a=lngLat.lat,b=((lngLat.lng+180)%360+360)%360-180;if(!marker){marker=new maplibregl.Marker({draggable:true}).setLngLat([b,a]).addTo(map);marker.on('dragend',()=>setPin(marker.getLngLat(),true));}else marker.setLngLat([b,a]);if(notify)parent.postMessage({kind:'wset-draft-map-position',latitude:a.toFixed(6),longitude:b.toFixed(6)},'*');};
  if(valid&&Math.abs(+lat)<=85)setPin({lat:+lat,lng:+lon},false);
  window.addEventListener('message',e=>{if(e.source!==parent||e.data?.kind!=='wset-draft-map-set')return;const a=e.data.latitude,b=e.data.longitude;if(typeof a!=='string'||typeof b!=='string'||!a||!b||!Number.isFinite(+a)||!Number.isFinite(+b)||Math.abs(+a)>85||Math.abs(+b)>180)return;setPin({lat:+a,lng:+b},false);map.easeTo({center:[+b,+a],zoom:Math.max(map.getZoom(),15)});});
  map.on('click',e=>setPin(e.lngLat,true));map.on('load',()=>{msg.textContent='Klikk i kartet eller dra nålen for å velge posisjon.';});map.on('error',()=>{msg.textContent='Kartdata kan ikke lastes. Du kan fortsatt skrive koordinatene manuelt.';});
 }catch(e){msg.textContent=e.message||'Kartet kunne ikke åpnes.';}
})();
