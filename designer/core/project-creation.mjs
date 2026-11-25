import {normalizeDashboardInfo} from './project-dashboard.mjs';
// User-provided metadata is administrative only, never website content or a raw path.
export function validateTemplateCreation(input){
 if(!input||input.trusted!==true)throw Error('Bekreft at du stoler på kilden til malen.');
 if(typeof input.digest!=='string'||! /^[a-f0-9]{64}$/.test(input.digest))throw Error('Synkroniser malbiblioteket og velg malen på nytt.');
 const info=normalizeDashboardInfo(input.info);
 if(!info.name)throw Error('Angi prosjektnavn.');
 return {digest:input.digest,info};
}
