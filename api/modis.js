import {createHash} from 'node:crypto';
import {vegetationWindow,aggregateVegetation,validateArea} from '../out/global-area.js';
import {parseVegetation} from '../out/global-data.js';
export function modisRequest(query){
  const date=query.date;
  if(!/^A20\d{5}$/.test(date||''))throw new Error('Fecha MODIS inválida.');
  const year=+date.slice(1,5),day=+date.slice(5);
  if(year<2015||year>2025||day<1||day>353||(day-1)%16)throw new Error('Fecha fuera del histórico 2015–2025.');
  let area=null,window;
  if(query.south!==undefined){area=Object.fromEntries(['south','north','west','east'].map(k=>[k,Number(query[k])]));validateArea(area);window=vegetationWindow(area,12);}
  else{const lat=Number(query.lat),lon=Number(query.lon);if(!query.lat?.trim()||!query.lon?.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Coordenadas inválidas.');window={lat,lon,kmAboveBelow:0,kmLeftRight:0};}
  const url='https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?'+new URLSearchParams({latitude:window.lat,longitude:window.lon,startDate:date,endDate:date,kmAboveBelow:window.kmAboveBelow,kmLeftRight:window.kmLeftRight});
  return {area,window,url,date};
}
export async function processModis(query,fetcher=fetch){
  const request=modisRequest(query);
  const response=await fetcher(request.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`NASA respondió HTTP ${response.status}.`);
  const raw=await response.text(),payload=JSON.parse(raw),site={lat:request.window.lat,lon:request.window.lon};
  const rows=request.area?aggregateVegetation(payload,request.area,site):parseVegetation(payload,site);
  const expected=new Date(Date.UTC(+request.date.slice(1,5),0,+request.date.slice(5))).toISOString().slice(0,10);
  if(rows.length!==1||rows[0].date!==expected)throw new Error('NASA no devolvió el compuesto solicitado; el bloque queda pendiente.');
  return {schema:'modis-zonal-v4',row:rows[0],receipt:{kind:'vegetation',url:request.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(raw).digest('hex'),sourceBytes:Buffer.byteLength(raw),area:request.area,grid:{xllcorner:payload.xllcorner,yllcorner:payload.yllcorner,cellsize:payload.cellsize,nrows:payload.nrows,ncols:payload.ncols},bands:(payload.subset||[]).map(b=>({band:b.band,modis_date:b.modis_date,tile:b.tile,proc_date:b.proc_date})),storage:'Raw NASA response hashed on server; repeat URL to retrieve original. Only aggregated values and provenance are returned.'}};
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'Método no admitido.'}));}
  const query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);
  try{modisRequest(query);}catch(e){res.statusCode=400;return res.end(JSON.stringify({error:e.message,retryable:false}));}
  try{const result=await processModis(query);res.setHeader('Cache-Control','public, s-maxage=2592000, stale-while-revalidate=86400');res.end(JSON.stringify(result));}
  catch(e){console.error('MODIS block failed',query.date,e.message);res.statusCode=502;res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:e.message,retryable:true}));}
}
