import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/science.js', import.meta.url), 'utf8');
const science = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { getSeries, senSlope, mannKendall, annualSummaries, seasonalSummaries, monthlyClimatology, seasonalAnomalies, assessTrend, validateDataset } = science;
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('Sen slope uses calendar intervals and handles ties', () => {
  close(senSlope([{year: 2000, value: 1}, {year: 2002, value: 5}, {year: 2005, value: 11}]), 2);
  close(senSlope([4, 4, 4, 4]), 0);
  assert.equal(senSlope([]), null);
});

test('Mann–Kendall matches hand-computed monotone and tie-corrected statistics', () => {
  const inc = mannKendall([1, 2, 3, 4, 5]);
  assert.equal(inc.s, 10);
  close(inc.variance, 50 / 3);
  close(inc.z, 9 / Math.sqrt(50 / 3));
  close(inc.pValue, 0.0274863, 1e-6);
  const tied = mannKendall([1, 1, 2, 2]);
  assert.equal(tied.s, 4);
  close(tied.variance, 20 / 3);
  close(tied.z, 3 / Math.sqrt(20 / 3));
  assert.equal(mannKendall([1, 1, 1]).pValue, 1);
  assert.equal(mannKendall([1]).pValue, null);
  close(mannKendall([5, 4, 3, 2, 1]).pValue, inc.pValue);
});

test('Synthetic data reproducible, SMAP starts April 2015', () => {
  assert.deepEqual(getSeries('ndvi', 'seco'), getSeries('ndvi', 'seco'));
  assert.equal(getSeries('soil', 'seco')[0].date, '2015-04');
  assert.equal(getSeries('soil', 'seco', 2010, 2014).length, 0);
  assert.equal(getSeries('ndvi', 'seco').length, 132);
  assert.ok(getSeries('ndvi', 'seco').every(p => p.synthetic));
});

test('Annual means/sums only include complete years', () => {
  const data = Array.from({length:12}, (_, i) => ({date:`2020-${String(i+1).padStart(2,'0')}`,value:i+1,coverage:1,quality:'valid'}));
  close(annualSummaries(data, 'ndvi')[0].value, 6.5);
  close(annualSummaries(data, 'precip')[0].value, 78);
  assert.equal(annualSummaries(data.slice(1), 'precip')[0].value, null);
  assert.equal(annualSummaries(getSeries('soil','seco'), 'soil')[0].complete, false);
  const lowCoverage = data.map((p,i)=>i===1 ? {...p,coverage:0.79} : p);
  assert.equal(annualSummaries(lowCoverage, 'precip')[0].value, null);
});

test('Anomalies compare matching months and use a fixed baseline with minimum samples', () => {
  const baseline = [];
  for(let y=2015;y<=2020;y++) for(let m=1;m<=12;m++) baseline.push({date:`${y}-${String(m).padStart(2,'0')}`,value:m*10+(y-2015),coverage:1,quality:'valid'});
  const result = seasonalAnomalies([{date:'2025-02',value:30,coverage:1,quality:'valid'}],baseline)[0];
  close(result.anomaly,7.5);
  assert.equal(result.baselineCount,6);
  const fewer = baseline.filter(p=>+p.date.slice(0,4)<=2018);
  assert.equal(monthlyClimatology(fewer)[0].value,null);
  assert.equal(seasonalAnomalies([{date:'2025-02',value:30,coverage:1,quality:'valid'}],fewer)[0].anomaly,null);
});

test('Southern summer joins December with the following January and February', () => {
  const points = ['2019-12','2020-01','2020-02'].map(date=>({date,value:10,coverage:1,quality:'valid'}));
  const summer = seasonalSummaries(points, 'precip');
  assert.equal(summer.length,1);
  assert.deepEqual(summer[0],{year:2020,season:0,label:'Verano',complete:true,count:3,value:30});
  assert.equal(seasonalSummaries(points.slice(1),'precip')[0].value,null);
});

test('Demo and short records never produce significance claims', () => {
  const demo = assessTrend(annualSummaries(getSeries('ndvi','seco'), 'ndvi'));
  assert.equal(demo.status,'demo');
  assert.equal(demo.pValue,null);
  assert.equal(demo.significant,null);
  assert.equal(assessTrend([{year:2020,value:1,complete:true}],{observed:true}).status,'insufficient');
});

test('Annual observational trend guards serial dependence and missing years', () => {
  const trend = Array.from({length:12},(_,i)=>({year:2000+i,value:2*i,complete:true}));
  assert.equal(assessTrend(trend,{observed:true}).eligible,true);
  assert.equal(assessTrend(trend,{observed:true}).significant,true);
  assert.equal(assessTrend(trend.filter(p=>p.year!==2004),{observed:true}).status,'gaps');
  const oscillating = Array.from({length:20},(_,i)=>({year:2000+i,value:i+(i%2?5:-5),complete:true}));
  assert.equal(assessTrend(oscillating,{observed:true}).status,'autocorrelation');
});

const fixture = () => ({schemaVersion:1,kind:'observations',variable:'ndvi',area:'seco',units:'1',source:{title:'Test observations',url:'https://example.org/data',product:'MOD13A2',version:'061',downloadedAt:'2026-11-11',aggregation:'Monthly mean',qualityFilter:'Good quality pixels'},points:[{date:'2020-01',value:0.5,coverage:0.95,quality:'valid'}]});

test('Observation validator preserves provenance uncertainty and rejects data defects', () => {
  const result = validateDataset(fixture());
  assert.equal(result.valid,true);
  assert.equal(result.dataset.provenanceVerified,false);
  for(const mutation of [
    x=>x.points.push({...x.points[0]}),
    x=>x.points[0].date='2020-13',
    x=>x.points[0].value=2,
    x=>x.points[0].coverage=2,
    x=>x.points[0].synthetic=true,
    x=>x.points[0].quality='demo',
    x=>x.source.url='javascript:alert(1)',
    x=>x.source.downloadedAt='2026-02-31',
    x=>x.units='mm',
    x=>delete x.source.qualityFilter,
  ]) {const invalid=fixture();mutation(invalid);assert.equal(validateDataset(invalid).valid,false);}
  const soil=fixture();soil.variable='soil';soil.units='m³/m³';soil.points[0].date='2015-03';assert.equal(validateDataset(soil).valid,false);
});

test('Omitted calendar months become explicit gaps, never compressed time or imputed values', () => {
  const input = fixture();
  input.points.push({date:'2020-04',value:0.7,coverage:1,quality:'valid'});
  const result = validateDataset(input);
  assert.equal(result.valid,true);
  assert.equal(result.dataset.points.length,4);
  assert.equal(result.dataset.insertedMissingMonths,2);
  assert.deepEqual(result.dataset.points[1],{date:'2020-02',value:null,coverage:0,quality:'missing'});
  assert.equal(science.summarizeQuality(result.dataset.points).excluded,2);
});
