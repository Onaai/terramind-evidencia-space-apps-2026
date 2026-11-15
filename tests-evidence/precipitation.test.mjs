import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrecipitation, precipitationSeasonalReference, sensitivityPrecipitation } from '../out/precipitation-science.js';

// Artificial fixtures exercise arithmetic and missingness; never used as observations.
function yearFixture(year, value = 1) {
  const points = [];
  for (let stamp = Date.UTC(year, 0, 1); stamp < Date.UTC(year + 1, 0, 1); stamp += 86400000) {
    const date = new Date(stamp);
    points.push({ date: date.toISOString().slice(0, 10), precip: typeof value === 'function' ? value(date) : value });
  }
  return points;
}
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('daily rates integrate once; calendar months and leap-year totals have exact expected lengths', () => {
  const result = analyzePrecipitation([...yearFixture(2015, 2), ...yearFixture(2016, 2)], { startYear: 2015, endYear: 2016 });
  assert.equal(result.series[1].value, 56);
  assert.equal(result.series[13].value, 58);
  assert.equal(result.annual[0].value, 730);
  assert.equal(result.annual[1].value, 732);
  assert.equal(result.quality.dailyExpected, 731);
  assert.equal(result.quality.accepted, 24);
  assert.equal(result.quality.coverage, 1);
});

test('a single missing day withholds its whole month and annual inference instead of prorating', () => {
  const result = analyzePrecipitation(yearFixture(2015, 1).filter(p => p.date !== '2015-01-10'), { startYear: 2015, endYear: 2015 });
  assert.equal(result.series[0].value, null);
  assert.equal(result.series[0].totalOfAvailable, 30);
  assert.equal(result.annual[0].value, null);
  assert.equal(result.annual[0].totalOfAvailable, 364);
  assert.equal(result.quality.dailyMissing, 1);
  assert.equal(result.quality.dailyInvalid, 0);
  near(result.quality.coverage, 364 / 365);
});

test('zero precipitation is valid while fill, negative, missing and non-finite values are excluded', () => {
  const rows = yearFixture(2015, 0);
  [null, -999, -0.01, Infinity, NaN].forEach((value, i) => rows[i].precip = value);
  const result = analyzePrecipitation(rows, { startYear: 2015, endYear: 2015 });
  assert.equal(result.quality.dailyInvalid, 5);
  assert.equal(result.quality.dailyMissing, 0);
  assert.equal(result.series[1].value, 0);
  assert.equal(result.series[1].accepted, true);
});

test('duplicate dates are excluded rather than summed or silently deduplicated', () => {
  const rows = yearFixture(2015, 1);
  const result = analyzePrecipitation([...rows, rows[0]], { startYear: 2015, endYear: 2015 });
  assert.equal(result.quality.dailyDuplicate, 1);
  assert.equal(result.quality.dailyValid, 364);
  assert.equal(result.series[0].value, null);
  assert.match(result.series[0].reason, /duplicadas/);
});

test('an empty input normalizes all months without inventing zeros or coverage', () => {
  const result = analyzePrecipitation([], { startYear: 2020, endYear: 2020 });
  assert.equal(result.series.length, 12);
  assert.equal(result.quality.dailyMissing, 366);
  assert.equal(result.quality.coverage, 0);
  assert.equal(result.quality.present, 0);
  assert.ok(result.series.every(row => row.value === null && row.anomaly === null));
});

test('reference uses the same calendar month with four complete baseline years, excluding partial months', () => {
  const rows = [2015, 2016, 2017, 2018].flatMap(year => yearFixture(year, date => date.getUTCMonth() === 0 ? 1 : 2));
  const reference = precipitationSeasonalReference(rows);
  assert.equal(reference[0].mean, 31);
  assert.equal(reference[0].n, 4);
  assert.equal(reference[1].mean, (56 + 58 + 56 + 56) / 4);
  const broken = precipitationSeasonalReference(rows.filter(p => p.date !== '2018-01-01'));
  assert.equal(broken[0].mean, null);
  assert.equal(broken[0].n, 3);
});

test('a selected year keeps the fixed reference from the complete input dataset', () => {
  const rows = [2015, 2016, 2017, 2018, 2025].flatMap(year => yearFixture(year, year === 2025 ? 3 : 1));
  const result = analyzePrecipitation(rows, { startYear: 2025, endYear: 2025 });
  assert.equal(result.series[0].referenceValue, 31);
  assert.equal(result.series[0].anomaly, 62);
  assert.equal(result.series[0].referenceCount, 4);
});

test('annual totals, not monthly samples, determine the number of years for inference', () => {
  const result = analyzePrecipitation([2015, 2016].flatMap(year => yearFixture(year)), { startYear: 2015, endYear: 2016 });
  assert.equal(result.trend.n, 2);
  assert.equal(result.trend.pValue, null);
  assert.equal(result.trend.slope, 1);
});

test('eleven complete years of identical annual rainfall yield zero Sen and p=1', () => {
  const rows = Array.from({ length: 11 }, (_, i) => 2015 + i).flatMap(year => yearFixture(year, date => date.getUTCMonth() === 0 && date.getUTCDate() === 1 ? 100 : 0));
  const result = analyzePrecipitation(rows);
  assert.equal(result.quality.dailyValid, 4018);
  assert.equal(result.quality.accepted, 132);
  assert.equal(result.trend.n, 11);
  assert.equal(result.trend.slope, 0);
  assert.equal(result.trend.pValue, 1);
  assert.equal(result.trend.significant, false);
});

test('one missing day in the middle of eleven years blocks classical inference on nonconsecutive years', () => {
  const rows = Array.from({ length: 11 }, (_, i) => 2015 + i).flatMap(year => yearFixture(year)).filter(p => p.date !== '2020-06-01');
  const result = analyzePrecipitation(rows);
  assert.equal(result.trend.n, 10);
  assert.equal(result.trend.status, 'gaps');
  assert.equal(result.trend.pValue, null);
});

test('precipitation sensitivity has only the three stated windows and no invented QA filter', () => {
  const rows = [2015, 2016, 2017].flatMap(year => yearFixture(year));
  const result = sensitivityPrecipitation(rows, { startYear: 2015, endYear: 2017, quality: 'relaxed' });
  assert.deepEqual(result.cases.map(item => item.id), ['full', 'without-first', 'without-last']);
  assert.equal(result.cases[1].options.startYear, 2016);
  assert.equal(result.cases[2].options.endYear, 2016);
  assert.ok(result.cases.every(item => !('quality' in item.options)));
  assert.equal(sensitivityPrecipitation(rows, { startYear: 2015, endYear: 2015 }).cases.length, 1);
});

test('invalid periods fail explicitly and no arbitrary upper rainfall limit is introduced', () => {
  assert.throws(() => analyzePrecipitation([], { startYear: 2025, endYear: 2015 }), /Período/);
  const rows = yearFixture(2015, 0);
  rows[0].precip = 600;
  const result = analyzePrecipitation(rows, { startYear: 2015, endYear: 2015 });
  assert.equal(result.series[0].value, 600);
  assert.equal(result.annual[0].accepted, true);
});
