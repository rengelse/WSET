'use strict';
(()=>{
 function mount({api,prepare,refresh}){
  if(!api.updateStatus)return;
  const $=id=>document.getElementById(id),d=$('app-update-dialog'),alert=$('app-update-alert'),check=$('app-update-check'),install=$('app-update-install'),close=$('app-update-close'),progress=$('app-update-progress'),notes=$('app-update-notes'),status=$('app-update-status');
  let current=null,working=false;
  const busy=()=>working||['downloading','installing'].includes(current?.phase);
  function render(s){current=s;const active=busy();$('app-version').textContent='v'+s.current;$('app-update-installed').textContent='Installert: v'+s.current;alert.hidden=!['available','downloading','installing'].includes(s.phase);alert.textContent=s.phase==='available'?'↑ Oppdatering':'↑ Oppdaterer …';alert.title=s.version?'WSET '+s.version:'Programoppdatering';check.disabled=active||s.phase==='checking'||s.phase==='unsupported';install.hidden=s.phase!=='available';install.disabled=active;close.disabled=active;progress.hidden=!['downloading','installing'].includes(s.phase);progress.value=s.percent||0;notes.hidden=!s.notes;notes.textContent=s.notes||'';
   const labels={idle:'Kontroller tilgjengelig ny versjon.',unsupported:'Automatiske oppdateringer er tilgjengelige i den installerte Windows-utgaven.',checking:'Kontrollerer GitHub Releases …',current:'Du har nyeste publiserte versjon.',available:'Ny versjon tilgjengelig: v'+s.version,downloading:'Laster ned og verifiserer … '+Math.round(s.percent||0)+' %',installing:'Installerer og starter WSET på nytt …',error:'Oppdateringen kunne ikke fullføres: '+(s.error||'Ukjent feil')};status.textContent=labels[s.phase]||'';
  }
  async function open(){document.querySelector('.app-options')?.removeAttribute('open');if(!d.open)d.showModal();try{render(await api.updateStatus());}catch(e){status.textContent=e.message;}}
  alert.addEventListener('click',open);$('app-update-open').addEventListener('click',open);close.addEventListener('click',()=>{if(!busy())d.close();});d.addEventListener('cancel',e=>{if(busy())e.preventDefault();});
  check.addEventListener('click',async()=>{try{render(await api.updateCheck());}catch(e){status.textContent=e.message;}});
  install.addEventListener('click',async()=>{if(busy())return;working=true;render(current);try{if(!await prepare())return;render(await api.updateInstall());}catch(e){status.textContent=e.message;}finally{working=false;if(current?.phase!=='installing'){const message=status.textContent;try{await refresh?.();}catch{}render(current);if(message)status.textContent=message;}}});
  api.onUpdateState?.(render);api.updateStatus().then(render).catch(()=>{});
 }
 window.wsetApplicationUpdates={mount};
})();
