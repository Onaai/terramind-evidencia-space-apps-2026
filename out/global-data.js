import {analyze,evaluateTrend} from './evidence-science.js';
export const PRESETS=[
  {name:'Gran Chaco · Argentina',lat:-25,lon:-63},
  {name:'Nairobi · Kenia',lat:-1.29,lon:36.82},
  {name:'Madrid · España',lat:40.42,lon:-3.70},
  {name:'Nueva Delhi · India',lat:28.61,lon:77.21},
  {name:'Sacramento · Estados Unidos',lat:38.58,lon:-121.49},
  {name:'Dubbo · Australia',lat:-32.25,lon:148.60},
  {name:'Manaos · Brasil',lat:-3.12,lon:-60.02},
];
export function coordinates(lat,lon) {
  if(String(lat).trim()===''||String(lon).trim()===''||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180) throw new Error('Ingresá latitud entre −90 y 90, y longitud entre −180 y 180.');
  return {lat:Number(Number(lat).toFixed(4)),lon:Number(Number(lon).toFixed(4))};
}
export function validateLocation(payload,site,kind) {
  const lat=kind==='climate'?payload.geometry?.coordinates?.[1]:Number(payload.latitude);
  const lon=kind==='climate'?payload.geometry?.coordinates?.[0]:Number(payload.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat-site.lat)>0.00011||Math.abs(lon-site.lon)>0.00011) throw new Error('La respuesta no coincide con la ubicación pedida.');
}
export function parseClimate(payload,site) {
  validateLocation(payload,site,'climate');
  if(!payload.header?.sources?.includes('MERRA2')) throw new Error('NASA no identifica MERRA‑2 como fuente; no se rotula una procedencia desconocida.');
  if(payload.parameters?.T2M?.units!=='C'||payload.parameters?.PRECTOTCORR?.units!=='mm/day') throw new Error('Unidades inesperadas en NASA POWER.');
  const p=payload.properties?.parameter;
  if(!p?.T2M||!p?.PRECTOTCORR) throw new Error('Faltan variables en la respuesta de NASA.');
  const rows=[];
  for(let year=2015;year<=2025;year++) for(let month=1;month<=12;month++) {
    const key=`${year}${String(month).padStart(2,'0')}`,days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v!==payload.header?.fill_value&&v!==-999;
    const temp=p.T2M[key],rain=p.PRECTOTCORR[key];
    rows.push({date:`${year}-${String(month).padStart(2,'0')}-01`,year,slot:month-1,days,temp:valid(temp)&&temp>=-100&&temp<=70?temp:null,precip:valid(rain)&&rain>=0?rain*days:null,rawPrecip:rain??null});
  }
  return rows;
}
export function climateAnalysis(rows,variable,startYear,endYear) {
  const reference=Array.from({length:12},(_,slot)=>{
    const values=rows.filter(r=>r.year>=2015&&r.year<=2020&&r.slot===slot&&Number.isFinite(r[variable])).map(r=>r[variable]);
    return values.length>=4?values.reduce((a,b)=>a+b,0)/values.length:null;
  });
  const series=rows.filter(r=>r.year>=startYear&&r.year<=endYear).map(r=>({...r,value:r[variable],accepted:Number.isFinite(r[variable]),referenceValue:reference[r.slot],anomaly:Number.isFinite(r[variable])&&reference[r.slot]!==null?r[variable]-reference[r.slot]:null}));
  const annual=[];
  for(let year=startYear;year<=endYear;year++){
    const months=series.filter(r=>r.year===year),accepted=months.length===12&&months.every(r=>r.accepted);
    annual.push({year,accepted,value:accepted?(variable==='temp'?months.reduce((s,r)=>s+r.value*r.days,0)/months.reduce((s,r)=>s+r.days,0):months.reduce((s,r)=>s+r.value,0)):null});
  }
  return {variable,startYear,endYear,series,annual,trend:evaluateTrend(annual),quality:{accepted:series.filter(r=>r.accepted).length,total:series.length}};
}
export function parseVegetation(payload,site) {
  validateLocation(payload,site,'vegetation');
  if(payload.nrows!==1||payload.ncols!==1) throw new Error('La respuesta no representa una celda MODIS.');
  const fields={'250m_16_days_NDVI':'rawNdvi','250m_16_days_EVI':'rawEvi','250m_16_days_pixel_reliability':'reliability','250m_16_days_VI_Quality':'viQuality'};
  const byDate=new Map();
  for(const band of payload.subset||[]){
    if(!fields[band.band])continue;
    if(!/^A20\d{5}$/.test(band.modis_date)||!Array.isArray(band.data)||band.data.length!==1) throw new Error('Compuesto MODIS inválido.');
    const date=new Date(Date.UTC(Number(band.modis_date.slice(1,5)),0,Number(band.modis_date.slice(5)))).toISOString().slice(0,10);
    if(band.calendar_date&&date!==band.calendar_date)throw new Error('Fecha MODIS inconsistente.');
    const row=byDate.get(date)||{date,availability:'returned'};
    if(fields[band.band] in row)throw new Error('Banda MODIS duplicada.');
    row[fields[band.band]]=band.data[0];byDate.set(date,row);
  }
  return [...byDate.values()].map(r=>({...r,ndvi:Number.isInteger(r.rawNdvi)&&r.rawNdvi>=-2000&&r.rawNdvi<=10000?r.rawNdvi*.0001:null,evi:Number.isInteger(r.rawEvi)&&r.rawEvi>=-2000&&r.rawEvi<=10000?r.rawEvi*.0001:null}));
}
export function vegetationAnalysis(rows,variable,startYear,endYear,quality='strict') {
  const result=analyze(rows,{variable,startYear,endYear,quality});
  result.warnings=['Celda nativa MODIS de 250 m nominales. No representa una región ni demuestra deforestación.','Referencia 2015–2020 corta; no es una normal climatológica.'];
  return result;
}
