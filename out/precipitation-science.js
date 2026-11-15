/** TerraMind Evidencia. Event implementation assisted by AI; no generated observations.
 * NASA POWER IMERG_PRECTOT daily UTC estimates -> complete calendar-month/year totals.
 */
import { evaluateTrend } from './evidence-science.js';

const DAY = 86400000;
export const PRECIPITATION_POLICY = Object.freeze({ annualCoverage: 1, monthlyCoverage: 1, referenceStart: 2015, referenceEnd: 2020, referenceMinimum: 4, trendMinimumYears: 10, alpha: 0.05 });
const iso = stamp => new Date(stamp).toISOString().slice(0, 10);
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const seasonOfMonth = month => month === 11 || month < 2 ? 'summer' : month < 5 ? 'autumn' : month < 8 ? 'winter' : 'spring';

function settings(input = {}) {
  const startYear = input.startYear ?? 2015, endYear = input.endYear ?? 2025;
  if (![startYear, endYear].every(year => Number.isInteger(year) && year >= 2000 && year <= 2099) || startYear > endYear) throw new Error('Período inválido.');
  return { variable: 'precip', startYear, endYear };
}

function indexDays(points) {
  if (!Array.isArray(points)) throw new Error('La precipitación debe ser una lista de días UTC.');
  const dates = new Map(), duplicates = new Set();
  for (const point of points) {
    if (!point || typeof point.date !== 'string') continue;
    if (dates.has(point.date)) duplicates.add(point.date);
    else dates.set(point.date, point);
  }
  return { dates, duplicates };
}

function monthsFromDays(index, startYear, endYear) {
  const rows = [];
  for (let year = startYear; year <= endYear; year++) for (let slot = 0; slot < 12; slot++) {
    const start = Date.UTC(year, slot, 1), end = Date.UTC(year, slot + 1, 1);
    const daysExpected = (end - start) / DAY;
    let daysPresent = 0, daysValid = 0, daysInvalid = 0, daysDuplicate = 0, totalOfAvailable = 0;
    for (let stamp = start; stamp < end; stamp += DAY) {
      const date = iso(stamp), point = index.dates.get(date);
      if (point) daysPresent++;
      if (index.duplicates.has(date)) { daysDuplicate++; daysInvalid++; continue; }
      if (point && Number.isFinite(point.precip) && point.precip >= 0) {
        daysValid++;
        // API daily mm/day x one UTC day; documentation also calls this a daily sum in mm.
        totalOfAvailable += point.precip;
      } else if (point) daysInvalid++;
    }
    const accepted = daysValid === daysExpected;
    const reasons = [];
    if (daysPresent < daysExpected) reasons.push(`${daysExpected - daysPresent} días ausentes`);
    if (daysInvalid > daysDuplicate) reasons.push(`${daysInvalid - daysDuplicate} días con valor ausente, negativo o no finito`);
    if (daysDuplicate) reasons.push(`${daysDuplicate} fechas duplicadas excluidas`);
    rows.push({ date: iso(start), endDateExclusive: iso(end), year, slot, month: slot + 1, value: accepted ? totalOfAvailable : null, totalOfAvailable: daysValid ? totalOfAvailable : null, accepted, present: daysPresent > 0, reasons, reason: reasons.join('; '), daysRepresented: daysExpected, dailyExpected: daysExpected, dailyPresent: daysPresent, dailyValid: daysValid, dailyInvalid: daysInvalid, dailyMissing: daysExpected - daysPresent, dailyDuplicate: daysDuplicate, coverage: daysValid / daysExpected, unit: 'mm' });
  }
  return rows;
}

function referenceFromMonths(months) {
  return Array.from({ length: 12 }, (_, slot) => {
    const values = months.filter(row => row.slot === slot && row.accepted).map(row => row.value);
    const sufficient = values.length >= PRECIPITATION_POLICY.referenceMinimum, mean = average(values);
    return { slot, month: slot + 1, n: values.length, count: values.length, sufficient, mean: sufficient ? mean : null, value: sufficient ? mean : null, sd: sufficient ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null, baselineStart: PRECIPITATION_POLICY.referenceStart, baselineEnd: PRECIPITATION_POLICY.referenceEnd, unit: 'mm' };
  });
}

export function precipitationSeasonalReference(points) {
  return referenceFromMonths(monthsFromDays(indexDays(points), PRECIPITATION_POLICY.referenceStart, PRECIPITATION_POLICY.referenceEnd));
}

function annualTotals(months, startYear, endYear) {
  const rows = [];
  for (let year = startYear; year <= endYear; year++) {
    const selected = months.filter(row => row.year === year);
    const validMonths = selected.filter(row => row.accepted).length;
    const representedDays = selected.reduce((sum, row) => sum + row.dailyValid, 0);
    const totalDays = selected.reduce((sum, row) => sum + row.dailyExpected, 0);
    const seasons = Object.fromEntries(['summer', 'autumn', 'winter', 'spring'].map(key => [key, { represented: 0, total: 0 }]));
    for (const month of selected) { seasons[seasonOfMonth(month.slot)].represented += month.dailyValid; seasons[seasonOfMonth(month.slot)].total += month.dailyExpected; }
    const accepted = validMonths === 12 && representedDays === totalDays;
    const totalOfAvailable = representedDays ? selected.reduce((sum, row) => sum + (row.totalOfAvailable ?? 0), 0) : null;
    rows.push({ year, value: accepted ? totalOfAvailable : null, totalOfAvailable, accepted, complete: accepted, coverage: totalDays ? representedDays / totalDays : 0, representedDays, totalDays, validMonths, validComposites: validMonths, expectedComposites: 12, seasonsPresent: Object.values(seasons).filter(season => season.represented > 0).length, seasons, reason: accepted ? 'Año completo: doce meses y todos los días válidos' : 'Se requieren doce meses completos y todos los días del año válidos', unit: 'mm' });
  }
  return rows;
}

export function analyzePrecipitation(points, input = {}) {
  const config = settings(input), index = indexDays(points);
  const months = monthsFromDays(index, config.startYear, config.endYear);
  const reference = referenceFromMonths(monthsFromDays(index, PRECIPITATION_POLICY.referenceStart, PRECIPITATION_POLICY.referenceEnd));
  const series = months.map(row => ({ ...row, anomaly: row.accepted && reference[row.slot].sufficient ? row.value - reference[row.slot].mean : null, referenceValue: reference[row.slot].mean, referenceCount: reference[row.slot].n }));
  const annual = annualTotals(months, config.startYear, config.endYear);
  const trend = { ...evaluateTrend(annual), unit: 'mm de acumulado anual por año', warning: 'Inferencia exploratoria de una celda IMERG consultada por coordenada. No demuestra causalidad; sin ajuste por múltiples pruebas.' };
  const accepted = series.filter(row => row.accepted).length;
  const dailyExpected = months.reduce((sum, row) => sum + row.dailyExpected, 0);
  const dailyPresent = months.reduce((sum, row) => sum + row.dailyPresent, 0);
  const dailyValid = months.reduce((sum, row) => sum + row.dailyValid, 0);
  const dailyInvalid = months.reduce((sum, row) => sum + row.dailyInvalid, 0);
  const dailyMissing = months.reduce((sum, row) => sum + row.dailyMissing, 0);
  const dailyDuplicate = months.reduce((sum, row) => sum + row.dailyDuplicate, 0);
  return { ...config, series, annual, trend, reference, quality: { total: series.length, expected: series.length, present: series.filter(row => row.present).length, accepted, rejected: series.length - accepted, missing: series.filter(row => row.dailyMissing > 0).length, representedDays: dailyValid, totalDays: dailyExpected, coverage: dailyExpected ? dailyValid / dailyExpected : 0, dailyExpected, dailyPresent, dailyValid, dailyAccepted: dailyValid, dailyInvalid, dailyMissing, dailyDuplicate }, policy: PRECIPITATION_POLICY, warnings: ['Estimación IMERG en una celda consultada por coordenada; no es un pluviómetro ni un promedio de todo el Gran Chaco.', 'Cobertura completa indica valores diarios disponibles, no ausencia de error satelital ni número de observaciones independientes.', 'POWER no entrega en esta consulta QA de cada recuperación ni identificación explícita de colección/run: no se inventan filtros de calidad.', 'Referencia 2015–2020 corta; no es una normal climatológica. Una anomalía de lluvia no diagnostica sequía ni atribuye causas.'] };
}

export function sensitivityPrecipitation(points, input = {}) {
  const base = settings(input);
  const cases = [{ id: 'full', label: 'Período completo', options: base }];
  if (base.endYear - base.startYear >= 2) cases.push({ id: 'without-first', label: 'Sin primer año', options: { ...base, startYear: base.startYear + 1 } }, { id: 'without-last', label: 'Sin último año', options: { ...base, endYear: base.endYear - 1 } });
  return { cases: cases.map(item => { const result = analyzePrecipitation(points, item.options); return { ...item, ...result.trend, coverage: result.quality.coverage, acceptedComposites: result.quality.accepted, dailyValid: result.quality.dailyValid }; }), note: 'Ventanas fijadas de antemano; no son pruebas independientes ni permiten elegir el p-valor más favorable. No hay variante QA relajada: la consulta POWER no aporta esos flags.' };
}
