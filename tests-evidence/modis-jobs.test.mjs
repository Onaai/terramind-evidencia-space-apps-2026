import test from 'node:test';
import assert from 'node:assert/strict';
import {planTiles,modisDates,combineTiles,runTasks} from '../out/modis-jobs.js';
import {areaKm2} from '../out/global-area.js';
import {modisRequest,processModis} from '../api/modis.js';
test('larger zones partition without overlap or missing area and keep full resolution',()=>{
  const area={south:-25.3,north:-24.7,west:-63.3,east:-62.7},tiles=planTiles(area);assert.ok(areaKm2(area)>3000);assert.ok(tiles.length>1&&tiles.length<=32);
  assert.ok(Math.abs(tiles.reduce((s,t)=>s+areaKm2(t.area),0)/areaKm2(area)-1)<1e-10);
  for(const t of tiles){assert.ok(t.window.kmAboveBelow<=12&&t.window.kmLeftRight<=12);for(const other of tiles.filter(o=>o.id>t.id)){const overlapLat=Math.min(t.area.north,other.area.north)-Math.max(t.area.south,other.area.south),overlapLon=Math.min(t.area.east,other.area.east)-Math.max(t.area.west,other.area.west);assert.ok(overlapLat<=0||overlapLon<=0);}}
  assert.throws(()=>planTiles({south:-26,north:-24,west:-64,east:-62}));
});
test('nominal historical schedule has exactly 253 unique dates including leap years',()=>{const d=modisDates();assert.equal(d.length,253);assert.equal(new Set(d).size,253);assert.equal(d[0],'A2015001');assert.equal(d.at(-1),'A2025353');});
const aggregate=(area,weightedSum,validArea)=>({date:'2025-01-01',areaKm2:area,cells:4,aggregates:Object.fromEntries(['strict-ndvi','strict-evi','relaxed-ndvi','relaxed-evi'].map(k=>[k,{weightedSum,validAreaKm2:validArea,validCells:4}]))});
test('merge accumulators before QA threshold; do not average tile means',()=>{
  const area={south:0,north:.1,west:0,east:.1},total=areaKm2(area),row=combineTiles([aggregate(total*.8,total*.8*.4,total*.8),aggregate(total*.2,total*.2*.8,total*.2)],area);
  assert.ok(Math.abs(row.aggregates['strict-ndvi'].value-.48)<1e-12);
  const gap=combineTiles([aggregate(total*.8,total*.8*.4,total*.8),aggregate(total*.2,0,0)],area);assert.equal(gap.aggregates['strict-ndvi'].value,null);assert.throws(()=>combineTiles([aggregate(total*.8,1,1)],area));
});
const tasks=Array.from({length:4},(_,i)=>({key:String(i),date:'A2025001',tile:{id:i}}));
test('failed blocks retry with bounds, successes persist, restart fetches only missing blocks',async()=>{
  const store=new Map(),calls=[];
  const options={read:async k=>store.get(k),write:async(k,v)=>store.set(k,v),delay:async()=>{},fetchTask:async t=>{calls.push(t.key);if(t.key==='2')throw new Error('temporary');return {ok:t.key};}};
  const first=await runTasks(tasks,options);assert.equal(first.failed.length,1);assert.equal(calls.filter(k=>k==='2').length,3);assert.equal(store.size,3);
  calls.length=0;const second=await runTasks(tasks,{...options,fetchTask:async t=>{calls.push(t.key);return {ok:t.key};}});assert.equal(second.reused,3);assert.deepEqual(calls,['2']);assert.equal(second.failed.length,0);
});
test('abort stops the queue and never claims completion',async()=>{const control=new AbortController();control.abort();await assert.rejects(()=>runTasks(tasks,{signal:control.signal,fetchTask:async()=>({})}),{name:'AbortError'});});
test('single-date server endpoint validates date, area and fixed upstream',()=>{
  const r=modisRequest({lat:'-25',lon:'-63',date:'A2018001'});assert.equal(new URL(r.url).hostname,'modis.ornl.gov');assert.equal(new URL(r.url).searchParams.get('endDate'),'A2018001');
  for(const date of ['A2026365','A2025366','A2025002','foo'])assert.throws(()=>modisRequest({lat:'0',lon:'0',date}));
  assert.throws(()=>modisRequest({date:'A2025001',south:'',north:'',west:'',east:''}));
});
test('server returns compact provenance with actual raw-response hash, never fabricated QA',async()=>{
  const bands=[['NDVI',5000],['EVI',3000],['pixel_reliability',0],['VI_Quality',0]];
  const payload={latitude:-25,longitude:-63,nrows:1,ncols:1,subset:bands.map(([band,v])=>({band:'250m_16_days_'+band,modis_date:'A2025001',calendar_date:'2025-01-01',data:[v]}))};
  const result=await processModis({lat:'-25',lon:'-63',date:'A2025001'},async()=>new Response(JSON.stringify(payload)));
  assert.equal(result.row.ndvi,.5);assert.equal(result.receipt.sha256.length,64);assert.equal(result.receipt.sourceBytes,Buffer.byteLength(JSON.stringify(payload)));assert.equal(result.raw,undefined);
  await assert.rejects(()=>processModis({lat:'-25',lon:'-63',date:'A2025017'},async()=>new Response(JSON.stringify(payload))),/compuesto solicitado/);
});
