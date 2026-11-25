/** Strict operator-owned image reference in an Existing XML feed.
 * XML: images/<property-id>/<image-file>. The images never enter public www/.
 */
export const LOCAL_PROPERTY_IMAGE_RE=/^images\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.(?:jpe?g|png|webp|avif))$/i;
export function isLocalPropertyImagePath(value){
 return typeof value==='string'&&value.length<=220&&!value.includes('..')&&LOCAL_PROPERTY_IMAGE_RE.test(value);
}
export function localPropertyImagePreviewUrl(relative){
 if(!isLocalPropertyImagePath(relative))return null;
 return '/__wset-property-image/'+relative.slice('images/'.length).split('/').map(encodeURIComponent).join('/');
}
