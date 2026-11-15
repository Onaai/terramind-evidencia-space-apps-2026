import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, seasonalReference, sensitivity, qualityDecision, senSlope, mannKendall, evaluateTrend } from '../out/evidence-science.js';

// Artificial fixtures test the implementation; they are never shipped as observations.
function fixture(year, value = 0.4) {
  return Array.from({ length: 23 }, (_, slot) => {
    const raw = Math.round((typeof value === 'function' ? value(slot) : value) * 10000);
    return { date: new Date(Date.UTC(year, 0, 1) + slot * 16 * 86400000).toISOString().slice(0, 10), ndvi: raw / 10000, evi: raw / 10000, rawNdvi: raw, rawEvi: raw, reliability: 0, viQuality: 2048 };
  });
}
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('native composite weights sum to the calendar year, including leap year', () => {
  const result = analyze([...fixture(2015), ...fixture(2016)], { startYear: 2015, endYear: 2016 });
  assert.equal(result.annual[0].representedDays, 365);
  assert.equal(result.annual[1].representedDays, 366);
  assert.equal(result.series[22].daysRepresented, 13);
  assert.equal(result.series[45].daysRepresented, 14);
  assert.equal(result.annual[0].seasonsPresent, 4);
});

test('annual estimate weights nominal bin duration rather than averaging 23 composites equally', () => {
  const result = analyze(fixture(2015, slot => slot === 22 ? 1 : 0), { startYear: 2015, endYear: 2015 });
  near(result.annual[0].value, 13 / 365);
  assert.notEqual(result.annual[0].value, 1 / 23);
});

test('QA relaxation admits marginal reliability but never cloud/snow/shadow or high aerosol', () => {
  const point = { ...fixture(2015)[0], reliability: 1, viQuality: 2048 | 1 | (4 << 2) };
  assert.equal(qualityDecision(point).accepted, false);
  assert.equal(qualityDecision(point, { quality: 'relaxed' }).accepted, true);
  for (const flag of [256, 1024, 16384, 32768, 3 << 6]) assert.equal(qualityDecision({ ...point, viQuality: point.viQuality | flag }, { quality: 'relaxed' }).accepted, false);
});

test('missing QA, fill/scaling errors and undefined usefulness codes are excluded', () => {
  const point = fixture(2015)[0];
  assert.equal(qualityDecision({ ...point, viQuality: null }).accepted, false);
  assert.equal(qualityDecision({ ...point, rawNdvi: -3000 }).accepted, false);
  assert.equal(qualityDecision({ ...point, rawNdvi: 4100 }).accepted, false);
  assert.equal(qualityDecision({ ...point, viQuality: 2048 | (3 << 2) }, { quality: 'relaxed' }).accepted, false);
});

test('NDVI and EVI availability are evaluated independently', () => {
  const point = { ...fixture(2015)[0], evi: null, rawEvi: -3000 };
  assert.equal(qualityDecision(point, { variable: 'ndvi' }).accepted, true);
  assert.equal(qualityDecision(point, { variable: 'evi' }).accepted, false);
});

test('omitted composites remain explicit gaps; annual coverage below 80% is withheld', () => {
  const result = analyze(fixture(2015).slice(5), { startYear: 2015, endYear: 2015 });
  assert.equal(result.series.length, 23);
  assert.equal(result.series[0].value, null);
  assert.equal(result.quality.missing, 5);
  assert.equal(result.annual[0].accepted, false);
  assert.equal(result.annual[0].value, null);
  near(result.annual[0].coverage, 285 / 365);
});

test('a duplicate date is excluded, never double counted', () => {
  const rows = fixture(2015);
  const result = analyze([...rows, rows[0]], { startYear: 2015, endYear: 2015 });
  assert.equal(result.series[0].accepted, false);
  assert.equal(result.quality.accepted, 22);
  assert.equal(result.annual[0].representedDays, 349);
});

test('explicit missing records are absent, while received bad QA or a missing band remain distinguishable', () => {
  const rows = fixture(2015);
  rows[0] = { ...rows[0], availability: 'no_subset_returned', ndvi: null, evi: null, rawNdvi: null, rawEvi: null };
  // Availability must win even if a malformed record contains stale numbers.
  rows[1] = { ...rows[1], availability: 'not_listed_by_api' };
  rows[2] = { ...rows[2], availability: 'returned', ndvi: null, rawNdvi: null };
  rows[3] = { ...rows[3], availability: 'returned', reliability: 3 };
  const ndvi = analyze(rows, { startYear: 2015, endYear: 2015 });
  assert.equal(ndvi.quality.present, 21);
  assert.equal(ndvi.quality.missing, 3);
  assert.equal(ndvi.quality.accepted, 19);
  assert.equal(ndvi.series[1].value, null);
  assert.equal(ndvi.series[2].present, true);
  assert.equal(ndvi.series[3].present, true);
  const evi = analyze(rows, { variable: 'evi', startYear: 2015, endYear: 2015 });
  assert.equal(evi.quality.missing, 2);
  assert.equal(evi.quality.accepted, 20);
});

test('reference compares the same native slot and requires at least four accepted years', () => {
  const rows = [2015, 2016, 2017, 2018].flatMap((year, index) => fixture(year, slot => slot === 0 ? 0.1 * (index + 1) : 0.8));
  const reference = seasonalReference(rows);
  near(reference[0].mean, 0.25);
  near(reference[1].mean, 0.8);
  assert.equal(reference[0].n, 4);
  const short = seasonalReference(rows.filter(point => point.date !== '2018-01-01'));
  assert.equal(short[0].mean, null);
  assert.equal(short[0].sufficient, false);
});

test('selected period does not replace the fixed seasonal reference', () => {
  const rows = [2015, 2016, 2017, 2018, 2025].flatMap(year => fixture(year, year === 2025 ? 0.6 : 0.4));
  const result = analyze(rows, { startYear: 2025, endYear: 2025 });
  near(result.series[0].anomaly, 0.2);
  assert.equal(result.series[0].referenceCount, 4);
});

test('Sen slope uses elapsed years, including irregular intervals', () => {
  near(senSlope([{ year: 2015, value: 0.2 }, { year: 2017, value: 0.4 }, { year: 2020, value: 0.7 }]), 0.1);
  assert.equal(senSlope([{ year: 2015, value: 0.2 }]), null);
});

test('Mann–Kendall handles ties and a known monotone reference', () => {
  const ties = mannKendall([1, 1, 2]);
  assert.equal(ties.s, 2);
  near(ties.variance, 8 / 3);
  assert.equal(mannKendall([0.4, 0.4, 0.4]).pValue, 1);
  const monotone = mannKendall(Array.from({ length: 10 }, (_, i) => i));
  assert.equal(monotone.s, 45);
  near(monotone.variance, 125);
  near(monotone.pValue, 0.000083031, 1e-8);
});

test('short or nonconsecutive annual series do not receive a p-value', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ year: 2015 + i, value: 0.3 + i * 0.01, accepted: true }));
  assert.equal(evaluateTrend(rows.slice(0, 9)).status, 'insufficient');
  const gaps = evaluateTrend(rows.filter(row => row.year !== 2020));
  assert.equal(gaps.status, 'gaps');
  assert.equal(gaps.pValue, null);
});

test('autocorrelated residuals suspend classical Mann–Kendall', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ year: 2001 + i, value: 0.3 + i * 0.01 + 0.1 * Math.sin(i * 0.5), accepted: true }));
  const result = evaluateTrend(rows);
  assert.equal(result.status, 'autocorrelation');
  assert.equal(result.eligible, false);
  assert.equal(result.pValue, null);
});

test('a complete constant annual sequence is eligible but not significant', () => {
  const result = evaluateTrend(Array.from({ length: 11 }, (_, i) => ({ year: 2015 + i, value: 0.4, accepted: true })));
  assert.equal(result.status, 'exploratory');
  assert.equal(result.significant, false);
  assert.equal(result.pValue, 1);
});

test('sensitivity keeps declared QA and period variants rather than seeking a better p-value', () => {
  const points = [2015, 2016, 2017].flatMap(year => fixture(year));
  const result = sensitivity(points, { startYear: 2015, endYear: 2017 });
  assert.deepEqual(result.cases.map(item => item.id), ['strict', 'relaxed', 'without-first', 'without-last']);
  assert.equal(result.cases[2].options.startYear, 2016);
  assert.ok(result.cases.every(item => item.pValue === null));
});
