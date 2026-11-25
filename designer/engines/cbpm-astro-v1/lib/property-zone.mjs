/** Exact same public bounded coordinate format as PHP catalogue; editor preview only. */
export function parseZone(raw){
 if(typeof raw!=='string'||raw.length>800||!raw)return null;
 const parts=raw.split(';');if(parts.length<3||parts.length>24)return null;
 const points=[];
 for(const part of parts){if(!/^-?\d{1,3}(?:\.\d{1,6})?,-?\d{1,2}(?:\.\d{1,6})?$/.test(part))return null;
  const pair=part.split(',').map(Number);if(Math.abs(pair[0])>180||Math.abs(pair[1])>90)return null;points.push(pair);}
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
 return Math.abs(area)>1e-10?points:null;
}
export function insideZone([x,y],vertices){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
 const [xi,yi]=vertices[i],[xj,yj]=vertices[j],cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
 if(Math.abs(cross)<1e-9&&x>=Math.min(xi,xj)-1e-9&&x<=Math.max(xi,xj)+1e-9&&y>=Math.min(yi,yj)-1e-9&&y<=Math.max(yi,yj)+1e-9)return true;
 if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
}return inside;}
