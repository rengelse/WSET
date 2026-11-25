/** Apply the same backwards-compatible public PHP extension to the generated CBPM runtime.
 * Never execute or rewrite supplier XML. Unknown template layouts fail explicitly. */
import {labels,markingEntries} from './property-markings.mjs';
const marker='WSET property markings v1';
export const markingCss=`\n/* ${marker} */\n.cbpm-property-marks{display:flex;flex-wrap:wrap;gap:.35rem;margin:.45rem 0}.cbpm-property-mark{display:inline-block;border-radius:4px;padding:.25rem .5rem;background:#e7eef6;color:#23466a;font-size:.78rem;font-weight:700;line-height:1.25}.cbpm-property-mark-sold{background:#9e2635;color:white}.cbpm-property-mark-reserved{background:#f3d69d;color:#62400a}.cbpm-sale-card-image .cbpm-property-marks{position:absolute;left:.65rem;top:.65rem;right:3rem;z-index:2;margin:0;pointer-events:none}.cbpm-sale-card-image .cbpm-property-mark{padding:.25rem .5rem;text-align:left}\n`;
const helper=`
// ${marker}
function cbpmWsetReadMarkings(string $siteRoot): array {
    $root=cbpmXmlRoot($siteRoot);$result=[];
    foreach(['New'=>'new--','Existing'=>'existing--'] as $folder=>$prefix){
        $dir=$root.'/'.$folder;$file=$dir.'/wset-listing-status.json';
        if(!is_file($file))continue;
        if(is_link($dir)||is_link($file)||filesize($file)>8388608)throw new RuntimeException('Invalid WSET property metadata.');
        $doc=json_decode((string)file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
        if(!is_array($doc)||($doc['version']??null)!==1||!is_array($doc['items']??null))throw new RuntimeException('Invalid WSET property metadata.');
        foreach($doc['items'] as $m){
            if(!is_array($m)||!is_string($m['source']??null)||!str_starts_with($m['source'],$prefix)||!preg_match('/^(new|existing)--[a-z0-9][a-z0-9-]{0,63}$/D',$m['source'])||!is_string($m['id']??null)||$m['id']===''||strlen($m['id'])>1000||!in_array($m['status']??null,['available','reserved','sold'],true)||!is_bool($m['visible']??null)||!is_array($m['badges']??null))throw new RuntimeException('Invalid WSET property marking.');
            $badges=[];foreach($m['badges'] as $b){if(!in_array($b,['new','exclusive','recommended','reduced'],true))throw new RuntimeException('Invalid WSET badge.');$badges[$b]=$b;}
            $result[$m['source'].":".$m['id']]=['status'=>$m['status'],'visible'=>$m['visible'],'badges'=>array_values($badges)];
        }
    }
    return $result;
}
function cbpmWsetMarks(array $record,string $locale): string {
    $labels=json_decode('${JSON.stringify(labels).replaceAll('\\','\\\\').replaceAll("'","\\'")}',true);
    $labels=$labels[$locale]??$labels['en'];$m=$record['wset_marking']??[];$codes=['available','reserved','sold','new','exclusive','recommended','reduced'];
    $active=($m['status']??'available')==='available'?[]:[$m['status']];
    foreach(($m['badges']??[]) as $badge)$active[]=$badge;
    $html='';foreach($active as $code){$i=array_search($code,$codes,true);if($i===false)continue;$html.='<span class="cbpm-property-mark cbpm-property-mark-'.$codes[$i].'">'.htmlspecialchars($labels[$i],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</span>';}
    return $html===''?'':'<div class="cbpm-property-marks">'.$html.'</div>';
}
`;
function replaceOne(text,needle,replacement){if(text.split(needle).length!==2)throw Error('Eiendomsmerking: nettsidemalen har en ukjent runtime.');return text.replace(needle,replacement);}
export function patchPropertyRuntime(path,text){if(text.includes(marker))return text;
 if(path==='api/property/json-catalogue.php'){
  text=replaceOne(text,'function cbpmReadPublishedProperties(): array {',helper+'\nfunction cbpmReadPublishedProperties(): array {');
  text=replaceOne(text,'    $items=[];$usedIds=[];','    $markings=cbpmWsetReadMarkings($siteRoot);\n    $items=[];$usedIds=[];');
  text=replaceOne(text,"            $item['publication_status']='published';", "            $marking=$markings[$key]??null;\n            if($marking!==null&&!$marking['visible'])continue;\n            if($marking!==null)$item['wset_marking']=$marking;\n            $item['publication_status']='published';");return text;
 }
 if(path==='api/property/listing.php'){
  text=replaceOne(text,'</a><div class="cbpm-sale-card-copy"><div class="cbpm-sale-ref">','<?php /* '+marker+' */ echo cbpmWsetMarks($row,$locale); ?></a><div class="cbpm-sale-card-copy"><div class="cbpm-sale-ref">');
  return replaceOne(text,'<strong class="cbpm-sale-large-price">','<?=cbpmWsetMarks($record,$locale)?><strong class="cbpm-sale-large-price">');
 }
 if(path==='assets/css/property-modules.css')return text+markingCss;
 throw Error('Ukjent runtimefil.');
}
export function markingPublicationFiles(site){return ['New','Existing'].flatMap(c=>markingEntries(site,c));}
export const markingRuntimePaths=['api/property/json-catalogue.php','api/property/listing.php','assets/css/property-modules.css'];
