import {wrapLongitude} from './global-geography.js';
import {parseClimate,validateLocation} from './global-data.js';
import {qualityDecision,annualSummaries,evaluateTrend} from './evidence-science.js';
const RAD=Math.PI/180,R=6371007.181;
export function validateArea(a){
  if(!a||![a.south,a.north,a.west,a.east].every(Number.isFinite)||a.south< -90||a.north>90||a.south>=a.north||a.east<=a.west||a.east-a.west>180)throw new Error('La zona debe ser un rectángulo válido de hasta 180° de ancho.');
  return a;
}
export const areaKm2=a=>{validateArea(a);return R*R*RAD*(a.east-a.west)*(Math.sin(a.north*RAD)-Math.sin(a.south*RAD))/1e6;};
export function climateCells(a){
  validateArea(a);const cells=[];
  for(let j=Math.max(0,Math.floor((a.south+90-.25)/.5));j<=Math.min(360,Math.ceil((a.north+90+.25)/.5));j++){
    const lat=-90+j*.5,south=Math.max(a.south,lat-.25,-90),north=Math.min(a.north,lat+.25,90);if(north<=south)continue;
    for(let i=Math.floor((a.west+180-.3125)/.625);i<=Math.ceil((a.east+180+.3125)/.625);i++){
      const unwrapped=-180+i*.625,west=Math.max(a.west,unwrapped-.3125),east=Math.min(a.east,unwrapped+.3125);if(east<=west)continue;
      cells.push({lat,lon:wrapLongitude(unwrapped),weight:areaKm2({south,north,west,east}),bounds:{south,north,west,east}});
      if(cells.length>400)throw new Error('Esta zona supera las 400 celdas climáticas por consulta de esta versión. Reducí el rectángulo; no se sustituye por su centro ni por una muestra.');
    }
  }return cells;
}
export function aggregateClimate(cells,responses,a){
  if(cells.length!==responses.length||!cells.length)throw new Error('Faltan celdas: no se publica un promedio parcial.');
  const parsed=responses.map((p,i)=>parseClimate(p,cells[i])),total=areaKm2(a),weight=cells.reduce((s,c)=>s+c.weight,0);
  if(Math.abs(weight/total-1)>1e-7)throw new Error('La grilla no cubre toda la zona.');
  return parsed[0].map((r,k)=>{
    const row={date:r.date,year:r.year,slot:r.slot,days:r.days,cells:cells.length};
    for(const v of ['temp','precip']){
      const good=cells.filter((c,i)=>Number.isFinite(parsed[i][k][v]));
      row[v+'Coverage']=good.reduce((s,c)=>s+c.weight,0)/total;
      row[v]=good.length===cells.length?cells.reduce((s,c,i)=>s+c.weight*parsed[i][k][v],0)/total:null;
    }return row;
  });
}
// MODIS sinusoidal projection: x=R*longitude*cos(latitude), y=R*latitude.
export function vegetationWindow(a){
  validateArea(a);
  if(a.west< -180||a.east>180||Math.max(Math.abs(a.south),Math.abs(a.north))>80)throw new Error('La agregación MODIS de esta versión requiere una zona entre 80° S y 80° N que no cruce el antimeridiano. El clima sí admite esos límites.');
  const lat=(a.south+a.north)/2,lon=(a.west+a.east)/2,x=R*lon*RAD*Math.cos(lat*RAD),y=R*lat*RAD;
  const lats=[a.south,a.north,...(a.south<0&&a.north>0?[0]:[])];
  const xs=lats.flatMap(t=>[a.west,a.east].map(l=>R*l*RAD*Math.cos(t*RAD)));
  const kmAboveBelow=Math.ceil(Math.max(y-R*a.south*RAD,R*a.north*RAD-y)/1000+.5);
  const kmLeftRight=Math.ceil(Math.max(...xs.map(v=>Math.abs(v-x)))/1000+.5);
  if(kmAboveBelow>5||kmLeftRight>5)throw new Error('Para MODIS, reducí la zona a aproximadamente 8 × 8 km (el límite depende de la proyección). Se procesan todos sus píxeles de 250 m; no se usa el centro. El clima admite zonas mucho mayores.');
  return {lat,lon,kmAboveBelow,kmLeftRight};
}
export function pixelWeights(p,a){
  validateArea(a);const size=Number(p.cellsize),x0=Number(p.xllcorner),y0=Number(p.yllcorner),nr=p.nrows,nc=p.ncols;
  if(!Number.isInteger(nr)||!Number.isInteger(nc)||nr<1||nc<1||nr*nc>2500||![size,x0,y0].every(Number.isFinite)||Math.abs(size-231.656358264)>.01)throw new Error('Grilla MODIS inválida o demasiado grande.');
  const weights=[];
  for(let row=0;row<nr;row++)for(let col=0;col<nc;col++){
    const lo=Math.max(y0+(nr-row-1)*size,R*a.south*RAD),hi=Math.min(y0+(nr-row)*size,R*a.north*RAD),left=x0+col*size,right=left+size;
    let weight=0;
    // Integrate the geographic rectangle's curved edges in the equal-area projection.
    if(hi>lo){const n=32,h=(hi-lo)/n;for(let k=0;k<=n;k++){const y=lo+k*h,c=Math.cos(y/R),w=Math.max(0,Math.min(right,R*a.east*RAD*c)-Math.max(left,R*a.west*RAD*c));weight+=(k===0||k===n?1:k%2?4:2)*w;}weight*=h/3;}
    weights.push(weight/1e6);
  }
  const total=areaKm2(a),sum=weights.reduce((s,w)=>s+w,0);
  if(Math.abs(sum/total-1)>.001)throw new Error('El recorte MODIS recibido no cubre toda la zona. No se calcula un promedio parcial.');
  return {weights,total,covered:sum,cells:weights.filter(w=>w>1e-12).length};
}
export function aggregateVegetation(p,a,site){
  validateLocation(p,site,'vegetation');const {weights,total,cells}=pixelWeights(p,a),dates=new Map();
  const fields={'250m_16_days_NDVI':'rawNdvi','250m_16_days_EVI':'rawEvi','250m_16_days_pixel_reliability':'reliability','250m_16_days_VI_Quality':'viQuality'};
  for(const b of p.subset||[]){if(!fields[b.band])continue;
    if(!/^A20\d{5}$/.test(b.modis_date)||!Array.isArray(b.data)||b.data.length!==weights.length)throw new Error('Banda regional MODIS inválida.');
    const date=new Date(Date.UTC(+b.modis_date.slice(1,5),0,+b.modis_date.slice(5))).toISOString().slice(0,10);
    if(b.calendar_date&&b.calendar_date!==date)throw new Error('Fecha MODIS inconsistente.');
    const item=dates.get(date)||{};if(item[fields[b.band]])throw new Error('Banda MODIS duplicada.');item[fields[b.band]]=b.data;dates.set(date,item);
  }
  return [...dates].map(([date,bands])=>{
    const out={date,cells,areaKm2:total,aggregates:{}};
    for(const quality of ['strict','relaxed'])for(const variable of ['ndvi','evi']){
      let sum=0,valid=0,count=0;
      weights.forEach((w,i)=>{if(w<=1e-12)return;const point={availability:'returned'};for(const [key,data] of Object.entries(bands))point[key]=data[i];point.ndvi=point.rawNdvi*.0001;point.evi=point.rawEvi*.0001;
        if(qualityDecision(point,{variable,quality}).accepted){sum+=point[variable]*w;valid+=w;count++;}});
      const coverage=Math.min(1,valid/total);
      out.aggregates[quality+'-'+variable]={value:coverage>=.95?sum/valid:null,coverage,validCells:count};
    }return out;
  });
}
export function areaVegetationAnalysis(rows,variable,startYear,endYear,quality){
  const map=new Map(rows.map(r=>[r.date,r])),series=[];
  const reference=Array.from({length:23},(_,slot)=>{
    const values=[];for(let year=2015;year<=2020;year++){const d=new Date(Date.UTC(year,0,1+slot*16)).toISOString().slice(0,10),v=map.get(d)?.aggregates[quality+'-'+variable]?.value;if(Number.isFinite(v))values.push(v);}
    return {mean:values.length>=4?values.reduce((s,v)=>s+v,0)/values.length:null,n:values.length};
  });
  for(let year=startYear;year<=endYear;year++)for(let slot=0;slot<23;slot++){
    const date=new Date(Date.UTC(year,0,1+slot*16)).toISOString().slice(0,10),r=map.get(date),v=r?.aggregates[quality+'-'+variable],accepted=Number.isFinite(v?.value),daysRepresented=Math.min(16,(Date.UTC(year+1,0,1)-Date.parse(date))/86400000),ref=reference[slot];
    series.push({date,year,slot,daysRepresented,value:accepted?v.value:null,accepted,present:!!r,coverage:v?.coverage??0,cells:r?.cells??0,validCells:v?.validCells??0,reason:accepted?'Media de superficie válida (≥95%)':'Cobertura espacial <95% o compuesto ausente',referenceValue:ref.mean,anomaly:accepted&&ref.mean!==null?v.value-ref.mean:null});
  }
  const annual=annualSummaries(series,startYear,endYear),trend=evaluateTrend(annual);
  // Different accepted pixels can create an apparent temporal trend; do not publish a p-value for that footprint.
  if(series.some(r=>!r.accepted||r.coverage<.999999))Object.assign(trend,{eligible:false,pValue:null,significant:null,reason:'La cobertura espacial varía entre fechas. Pendiente descriptiva; p-valor suspendido para evitar inferir una tendencia de cambios de cobertura.'});
  trend.warning='Inferencia exploratoria del promedio zonal; no demuestra causalidad.';
  return {variable,startYear,endYear,series,annual,trend,reference,quality:{accepted:series.filter(r=>r.accepted).length,total:series.length}};
}
