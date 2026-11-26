import {areaKm2,vegetationWindow,validateArea} from './global-area.js';
export const ENGINE_VERSION='modis-zonal-v4';
export function planTiles(area){
  validateArea(area);
  if(areaKm2(area)>5000)throw new Error('Esta versión procesa hasta 5.000 km² MODIS por trabajo. Reducí la zona; no se reemplaza por una muestra.');
  if(area.west< -180||area.east>180||Math.max(Math.abs(area.south),Math.abs(area.north))>80)throw new Error('MODIS zonal requiere latitudes entre ±80° y una zona sin cruce del antimeridiano.');
  const queue=[area],tiles=[];
  while(queue.length){const a=queue.shift();try{const window=vegetationWindow(a,12);tiles.push({area:a,window});}catch{
    const lat=(a.south+a.north)/2;
    if((a.north-a.south)>(a.east-a.west)*Math.cos(lat*Math.PI/180)){queue.push({...a,north:lat},{...a,south:lat});}
    else{const lon=(a.west+a.east)/2;queue.push({...a,east:lon},{...a,west:lon});}
    if(tiles.length+queue.length>32)throw new Error('El rectángulo requiere más de 32 bloques MODIS. Elegí una zona más compacta.');
  }}
  return tiles.map((t,i)=>({...t,id:i}));
}
export function modisDates(start=2015,end=2025){const dates=[];for(let y=start;y<=end;y++)for(let d=1;d<=353;d+=16)dates.push(`A${y}${String(d).padStart(3,'0')}`);return dates;}
export function tasksFor(site){
  const tiles=site.area?planTiles(site.area):[{id:0,area:null,window:{lat:site.lat,lon:site.lon,kmAboveBelow:0,kmLeftRight:0}}];
  return {tiles,tasks:modisDates().flatMap(date=>tiles.map(tile=>({tile,date,key:ENGINE_VERSION+':'+JSON.stringify([tile.area,tile.window,date])})))};
}
export function combineTiles(tileRows,area){
  const total=areaKm2(area),sumArea=tileRows.reduce((s,r)=>s+r.areaKm2,0);
  if(!tileRows.length||tileRows.some(r=>r.date!==tileRows[0].date)||Math.abs(sumArea/total-1)>1e-6)throw new Error('Faltan bloques de la zona; no se publica un promedio parcial.');
  const row={date:tileRows[0].date,areaKm2:total,cells:tileRows.reduce((s,r)=>s+r.cells,0),aggregates:{}};
  for(const key of ['strict-ndvi','strict-evi','relaxed-ndvi','relaxed-evi']){
    let weightedSum=0,validAreaKm2=0,validCells=0;
    for(const r of tileRows){const a=r.aggregates[key];if(!a||![a.weightedSum,a.validAreaKm2].every(Number.isFinite))throw new Error('Acumulador zonal inválido.');weightedSum+=a.weightedSum;validAreaKm2+=a.validAreaKm2;validCells+=a.validCells;}
    const coverage=Math.min(1,validAreaKm2/total);
    row.aggregates[key]={value:coverage>=.95?weightedSum/validAreaKm2:null,coverage,validCells,weightedSum,validAreaKm2};
  }return row;
}
export async function runTasks(tasks,{fetchTask,read=async()=>null,write=async()=>{},signal,onProgress=()=>{},concurrency=2,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
  let next=0,done=0,reused=0;const results=new Array(tasks.length),failed=[];
  const abort=()=>{if(signal?.aborted)throw new DOMException('Trabajo pausado','AbortError');};
  async function worker(){while(next<tasks.length){abort();const index=next++,task=tasks[index];let result=await read(task.key);abort();
    if(result)reused++;
    else for(let attempt=0;attempt<3;attempt++){
      try{result=await fetchTask(task,signal);abort();await write(task.key,result);break;}
      catch(e){abort();if(e.retryable===false||attempt===2){failed.push({index,date:task.date,tile:task.tile.id,error:e.message});break;}onProgress({done,total:tasks.length,reused,failed:failed.length,retrying:task.date});await delay(1000*2**attempt);}
    }
    results[index]=result??null;done++;onProgress({done,total:tasks.length,reused,failed:failed.length});
  }}
  await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},worker));abort();
  return {results,failed,reused};
}
