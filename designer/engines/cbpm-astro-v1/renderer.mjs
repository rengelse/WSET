/** Editor-owned adapter for the existing Mediterranean Premium template. */
import {renderDynamicSite as legacyPage} from './lib/dynamic-site.mjs';
import {renderSite as legacySource} from './lib/render-site.mjs';
import {splitMainSections as legacySplit,legacySectionMap as legacySlots} from './lib/section-fragments.mjs';
import {templateTextEntries as legacyTexts} from './lib/template-editor.mjs';
import {propertyModulePreview as legacyProperty} from './lib/property-preview.mjs';
const imageSlots=Object.freeze(Object.fromEntries(Object.entries({hero:{home:'hero',about:'hero-square',contact:'hero-square',rental:'med-courtyard',projects:'hero-terrace',services:'med-holiday',reviews:'med-holiday'},team:{home:'about-team'},intro:{about:'med-courtyard'},why:{home:'hero-square'},overview:{rental:'hero-square'}}).map(([k,v])=>[k,Object.freeze(v)])));
const globalImageSlots=Object.freeze(['hero','hero-square','hero-terrace','interior','repairs','electric','aircon','pool','keys','about-team','project-before','project-after','project-terrace','project-bathroom','project-pool','med-courtyard','med-holiday']);
export const legacyRenderer=Object.freeze({
 imageSlots,globalImageSlots,
 contractVersion:1,engine:'cbpm-astro-v1',id:'property.mediterranean-premium',
 renderPage:legacyPage,renderSource:legacySource,splitSections:legacySplit,sourceSections:legacySlots,textEntries:legacyTexts,renderPropertyPage:legacyProperty
});
