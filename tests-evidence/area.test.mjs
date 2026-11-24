import test from 'node:test';
import assert from 'node:assert/strict';
import {areaKm2,climateCells,aggregateClimate,pixelWeights,aggregateVegetation,vegetationWindow,areaVegetationAnalysis} from '../out/global-area.js';
import {sourceURL} from '../api/earth.js';
const R=6371007.181,rad=Math.PI/180,cellsize=231.656358264;
test('climate grid covers rectangle exactly including poles and antimeridian',()=>{
  for(const a of [{south:-25.1,north:-24.8,west:-63.4,east:-62.7},{south:89.9,north:90,west:179.8,east:180.2},{south:-90,north:-89.8,west:-180.2,east:-179.9}]){
    const cells=climateCells(a);assert.ok(Math.abs(cells.reduce((s,c)=>s+c.weight,0)/areaKm2(a)-1)<1e-10);assert.equal(new Set(cells.map(c=>`${c.lat},${c.lon}`)).size,cells.length);
  }
});
const climatePayload=(c,temp,precip=2)=>({geometry:{coordinates:[c.lon,c.lat]},header:{sources:['MERRA2'],fill_value:-999},parameters:{T2M:{units:'C'},PRECTOTCORR:{units:'mm/day'}},properties:{parameter:{T2M:{201501:temp},PRECTOTCORR:{201501:precip}}}});
test('unequal edge areas change zone mean; rain is mean depth, never summed',()=>{
  const a={south:-.1,north:.1,west:0,east:.5},cells=climateCells(a);assert.equal(cells.length,2);
  const rows=aggregateClimate(cells,cells.map((c,i)=>climatePayload(c,i?30:10)),a);
  assert.ok(Math.abs(rows[0].temp-17.5)<1e-10);assert.equal(rows[0].precip,62);assert.ok(Math.abs(rows[0].tempCoverage-1)<1e-10);
  const missing=aggregateClimate(cells,cells.map((c,i)=>climatePayload(c,i?-999:10)),a);assert.equal(missing[0].temp,null);assert.ok(missing[0].tempCoverage<1);
  assert.throws(()=>aggregateClimate(cells,[],a));assert.throws(()=>climateCells({south:-80,north:80,west:-100,east:100}));
});
const a={south:0,north:2*cellsize/R/rad,west:0,east:2*cellsize/R/rad};
const grid={latitude:a.north/2,longitude:a.east/2,xllcorner:0,yllcorner:0,cellsize,nrows:2,ncols:2};
function payload(values=[1000,2000,3000,4000],reliability=[0,0,0,0]){return {...grid,subset:[['NDVI',values],['EVI',values],['pixel_reliability',reliability],['VI_Quality',[0,0,0,0]]].map(([band,data])=>({band:'250m_16_days_'+band,modis_date:'A2025001',calendar_date:'2025-01-01',data}))};}
test('sinusoidal clipping conserves area and follows north-to-south row order',()=>{
  const weights=pixelWeights(grid,a);assert.ok(Math.abs(weights.covered/areaKm2(a)-1)<1e-8);
  const north={...a,south:a.north/2},w=pixelWeights(grid,north).weights;assert.ok(w[0]>0&&w[1]>0);assert.equal(w[2],0);assert.equal(w[3],0);
  assert.throws(()=>pixelWeights({...grid,ncols:1},a));
});
test('zonal vegetation QA occurs before aggregation and excludes uncovered dates',()=>{
  const good=aggregateVegetation(payload(),a,{lat:grid.latitude,lon:grid.longitude})[0];assert.ok(Math.abs(good.aggregates['strict-ndvi'].value-.25)<1e-7);assert.equal(good.cells,4);
  const bad=aggregateVegetation(payload(undefined,[0,0,0,1]),a,{lat:grid.latitude,lon:grid.longitude})[0];assert.equal(bad.aggregates['strict-ndvi'].value,null);assert.ok(bad.aggregates['strict-ndvi'].coverage<.8);assert.ok(bad.aggregates['relaxed-ndvi'].value>.2);
  const analysis=areaVegetationAnalysis([bad],'ndvi',2025,2025,'strict');assert.equal(analysis.series[0].accepted,false);assert.equal(analysis.trend.pValue,null);
});
test('MODIS limits reject unsupported zones without a point fallback',()=>{
  assert.throws(()=>vegetationWindow({south:0,north:1,west:0,east:1}));assert.throws(()=>vegetationWindow({south:0,north:.01,west:179.99,east:180.01}));
  assert.ok(vegetationWindow({south:-25,north:-24.99,west:-63,east:-62.99}).kmLeftRight<=5);
  assert.throws(()=>sourceURL({kind:'vegetation',lat:'0',lon:'0',start:'A2025001',end:'A2025017',kmAboveBelow:'6'}));
  assert.equal(new URL(sourceURL({kind:'vegetation',lat:'0',lon:'0',start:'A2025001',end:'A2025017',kmAboveBelow:'2'})).searchParams.get('kmAboveBelow'),'2');
});
