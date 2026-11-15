/** TerraMind Evidencia. New implementation for the 2026 event.
 * Native MOD13Q1 composites; never infer days actually observed from bin duration.
 */
const DAY = 86400000;
export const POLICY = Object.freeze({ annualCoverage: 0.8, referenceStart: 2015, referenceEnd: 2020, referenceMinimum: 4, trendMinimumYears: 10, alpha: 0.05 });
const median = values => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const half = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2; };
const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const yearDays = year => (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
const iso = stamp => new Date(stamp).toISOString().slice(0, 10);
const observationReturned = point => !!point && !['no_subset_returned', 'not_listed_by_api'].includes(point.availability);

function options(input = {}) {
  const result = { variable: 'ndvi', startYear: 2015, endYear: 2025, quality: 'strict', ...input };
  if (!['ndvi', 'evi'].includes(result.variable)) throw new Error('Variable inválida: elegí ndvi o evi.');
  if (!['strict', 'relaxed'].includes(result.quality)) throw new Error('Filtro inválido: elegí strict o relaxed.');
  if (![result.startYear, result.endYear].every(y => Number.isInteger(y) && y >= 2000 && y <= 2099) || result.endYear < result.startYear) throw new Error('Período inválido.');
  return result;
}

export function decodeQA(value) {
  if (!Number.isInteger(value) || value < 0 || value > 65535) return null;
  return { modland: value & 3, usefulness: (value >> 2) & 15, aerosol: (value >> 6) & 3, adjacentCloud: !!(value & 256), mixedCloud: !!(value & 1024), snow: !!(value & 16384), shadow: !!(value & 32768), landWater: (value >> 11) & 7 };
}

export function qualityDecision(point, { variable = 'ndvi', quality = 'strict' } = {}) {
  const reasons = [];
  if (!observationReturned(point)) return { accepted: false, reasons: ['Compuesto ausente'], qa: null };
  const value = point[variable];
  if (!Number.isFinite(value) || value < -0.2 || value > 1) reasons.push('Índice ausente o fuera del rango del producto');
  const raw = point[variable === 'ndvi' ? 'rawNdvi' : 'rawEvi'];
  if (raw !== undefined && (!Number.isInteger(raw) || raw < -2000 || raw > 10000 || !Number.isFinite(value) || Math.abs(raw * 0.0001 - value) > 1e-7)) reasons.push('Valor crudo, escala o relleno inválido');
  if (!(quality === 'strict' ? [0] : [0, 1]).includes(point.reliability)) reasons.push('Pixel reliability no aceptado');
  const qa = decodeQA(point.viQuality);
  if (!qa) reasons.push('VI Quality ausente o inválido');
  else {
    if (!(quality === 'strict' ? [0] : [0, 1]).includes(qa.modland)) reasons.push('MODLAND QA no aceptado');
    if (!(quality === 'strict' ? [0, 1, 2] : [0, 1, 2, 4, 8]).includes(qa.usefulness)) reasons.push('VI usefulness no aceptado');
    if (qa.aerosol === 3) reasons.push('Aerosoles altos');
    if (qa.adjacentCloud) reasons.push('Nube adyacente');
    if (qa.mixedCloud) reasons.push('Nube mixta');
    if (qa.snow) reasons.push('Posible nieve/hielo');
    if (qa.shadow) reasons.push('Posible sombra');
  }
  return { accepted: reasons.length === 0, reasons, qa };
}

function nativeSeries(points, config) {
  if (!Array.isArray(points)) throw new Error('La serie debe ser una lista de compuestos.');
  const byDate = new Map(), duplicates = new Set();
  for (const point of points) {
    if (!point || typeof point.date !== 'string') continue;
    if (byDate.has(point.date)) duplicates.add(point.date);
    else byDate.set(point.date, point);
  }
  const rows = [];
  for (let year = config.startYear; year <= config.endYear; year++) {
    const first = Date.UTC(year, 0, 1), days = yearDays(year);
    for (let slot = 0; slot < 23; slot++) {
      const startDay = slot * 16, stamp = first + startDay * DAY, date = iso(stamp);
      const point = byDate.get(date);
      const decision = qualityDecision(point, config);
      if (duplicates.has(date)) { decision.accepted = false; decision.reasons.push('Fecha duplicada: excluida'); }
      const present = observationReturned(point);
      rows.push({ ...point, date, year, slot, startDayOfYear: startDay + 1, endDateExclusive: iso(first + Math.min(days, startDay + 16) * DAY), daysRepresented: Math.min(16, days - startDay), value: present && Number.isFinite(point?.[config.variable]) ? point[config.variable] : null, present, accepted: decision.accepted, reasons: decision.reasons, reason: decision.reasons.join('; '), qa: decision.qa });
    }
  }
  return rows;
}

export function seasonalReference(points, config = {}) {
  const baselineStart = config.baselineStart ?? POLICY.referenceStart, baselineEnd = config.baselineEnd ?? POLICY.referenceEnd;
  const settings = options({ ...config, startYear: baselineStart, endYear: baselineEnd });
  const referenceRows = nativeSeries(points, settings);
  return Array.from({ length: 23 }, (_, slot) => {
    const values = referenceRows.filter(row => row.slot === slot && row.accepted).map(row => row.value);
    const sufficient = values.length >= POLICY.referenceMinimum;
    const mean = avg(values);
    return { slot, startDayOfYear: slot * 16 + 1, n: values.length, count: values.length, sufficient, mean: sufficient ? mean : null, value: sufficient ? mean : null, sd: sufficient ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null, baselineStart, baselineEnd };
  });
}

function seasonOfMonth(month) { return month === 11 || month < 2 ? 'summer' : month < 5 ? 'autumn' : month < 8 ? 'winter' : 'spring'; }

export function annualSummaries(series, startYear, endYear) {
  const results = [];
  for (let year = startYear; year <= endYear; year++) {
    const rows = series.filter(row => row.year === year);
    const seasons = Object.fromEntries(['summer', 'autumn', 'winter', 'spring'].map(key => [key, { represented: 0, total: 0 }]));
    const first = Date.UTC(year, 0, 1), days = yearDays(year);
    for (let d = 0; d < days; d++) seasons[seasonOfMonth(new Date(first + d * DAY).getUTCMonth())].total++;
    let represented = 0, weighted = 0, count = 0;
    for (const row of rows.filter(row => row.accepted)) {
      represented += row.daysRepresented;
      weighted += row.value * row.daysRepresented;
      count++;
      for (let d = 0; d < row.daysRepresented; d++) seasons[seasonOfMonth(new Date(Date.parse(row.date + 'T00:00:00Z') + d * DAY).getUTCMonth())].represented++;
    }
    const coverage = represented / days;
    const seasonsPresent = Object.values(seasons).filter(season => season.represented > 0).length;
    const accepted = coverage + 1e-12 >= POLICY.annualCoverage && seasonsPresent === 4;
    const meanOfAvailable = represented ? weighted / represented : null;
    results.push({ year, value: accepted ? meanOfAvailable : null, meanOfAvailable, accepted, complete: accepted, coverage, representedDays: represented, totalDays: days, validComposites: count, expectedComposites: 23, seasonsPresent, seasons, reason: accepted ? 'Año apto para el análisis piloto' : 'Cobertura menor al 80% o alguna estación sin representación' });
  }
  return results;
}

export function senSlope(input) {
  const points = input.filter(p => Number.isFinite(p.year) && Number.isFinite(p.value)).sort((a, b) => a.year - b.year);
  const slopes = [];
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) if (points[j].year > points[i].year) slopes.push((points[j].value - points[i].value) / (points[j].year - points[i].year));
  return median(slopes);
}

// Complementary error function approximation (absolute error about 1.5e-7).
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + z * 0.5);
  const result = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? result : 2 - result;
}

export function mannKendall(values) {
  const data = values.filter(Number.isFinite), n = data.length;
  if (n < 2) return { n, s: 0, variance: null, z: null, pValue: null };
  const ties = new Map();
  let s = 0;
  for (let i = 0; i < n; i++) { ties.set(data[i], (ties.get(data[i]) ?? 0) + 1); for (let j = i + 1; j < n; j++) s += Math.sign(data[j] - data[i]); }
  const adjustment = [...ties.values()].reduce((sum, t) => sum + t * (t - 1) * (2 * t + 5), 0);
  const variance = (n * (n - 1) * (2 * n + 5) - adjustment) / 18;
  const z = variance === 0 || s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(variance);
  return { n, s, variance, z, pValue: z === 0 ? 1 : Math.min(1, erfc(Math.abs(z) / Math.sqrt(2))) };
}

function lagOne(values) {
  const left = values.slice(0, -1), right = values.slice(1), mx = avg(left), my = avg(right);
  const xx = left.reduce((sum, x) => sum + (x - mx) ** 2, 0), yy = right.reduce((sum, y) => sum + (y - my) ** 2, 0);
  if (xx < 1e-24 || yy < 1e-24) return 0;
  return left.reduce((sum, x, i) => sum + (x - mx) * (right[i] - my), 0) / Math.sqrt(xx * yy);
}

export function evaluateTrend(annual) {
  const points = annual.filter(row => row.accepted && Number.isFinite(row.value)).sort((a, b) => a.year - b.year);
  const n = points.length, slope = senSlope(points);
  const result = { n, slope, eligible: false, pValue: null, significant: null, lag1: null, alpha: POLICY.alpha, status: 'insufficient', reason: 'Se requieren al menos diez años aptos y consecutivos.', warning: 'Inferencia exploratoria de un píxel. No demuestra causalidad; sin ajuste por múltiples pruebas.' };
  if (n < POLICY.trendMinimumYears) return result;
  if (points.some((row, i) => i && row.year !== points[i - 1].year + 1)) return { ...result, status: 'gaps', reason: 'Hay años no aptos entre los años utilizados; no se calcula el p-valor.' };
  const intercept = median(points.map(row => row.value - slope * row.year));
  const residuals = points.map(row => row.value - intercept - slope * row.year);
  const lag1 = lagOne(residuals), screeningThreshold = 1.96 / Math.sqrt(n);
  if (Math.abs(lag1) > screeningThreshold) return { ...result, lag1, screeningThreshold, status: 'autocorrelation', reason: 'El control de residuos detecta dependencia temporal; Mann–Kendall clásico queda suspendido.' };
  const mk = mannKendall(points.map(row => row.value));
  return { ...result, lag1, screeningThreshold, mk, pValue: mk.pValue, eligible: true, significant: mk.pValue < POLICY.alpha, status: 'exploratory', reason: mk.pValue < POLICY.alpha ? 'Evidencia exploratoria de tendencia monótona bajo los supuestos revisados.' : 'No se detecta evidencia suficiente de tendencia monótona; esto no prueba ausencia de cambio.' };
}

export function analyze(points, input = {}) {
  const config = options(input), series = nativeSeries(points, config);
  const reference = seasonalReference(points, config);
  const enriched = series.map(row => ({ ...row, anomaly: row.accepted && reference[row.slot].sufficient ? row.value - reference[row.slot].mean : null, referenceValue: reference[row.slot].mean, referenceCount: reference[row.slot].n }));
  const annual = annualSummaries(series, config.startYear, config.endYear);
  const trend = evaluateTrend(annual);
  const accepted = series.filter(row => row.accepted).length;
  const missing = series.filter(row => !row.present || row.value === null).length;
  const representedDays = series.filter(row => row.accepted).reduce((sum, row) => sum + row.daysRepresented, 0);
  const totalDays = annual.reduce((sum, row) => sum + row.totalDays, 0);
  return { ...config, series: enriched, annual, trend, reference, quality: { total: series.length, expected: series.length, present: series.filter(row => row.present).length, accepted, rejected: series.length - accepted, missing, representedDays, totalDays, coverage: totalDays ? representedDays / totalDays : 0 }, policy: POLICY, warnings: ['Un solo píxel nativo: no representa todo el Gran Chaco ni un promedio de área.', 'Cobertura significa duración nominal representada, no cantidad de días realmente observados.', 'Referencia 2015–2020 corta; no es una normal climatológica.', ...(config.quality === 'relaxed' ? ['Filtro relajado sólo para sensibilidad: incluye calidad marginal y menor VI usefulness.'] : [])] };
}

export function sensitivity(points, input = {}) {
  const base = options(input);
  const cases = [{ id: 'strict', label: 'Estricto · período completo', options: { ...base, quality: 'strict' } }, { id: 'relaxed', label: 'Relajado · período completo', options: { ...base, quality: 'relaxed' } }];
  if (base.endYear - base.startYear >= 2) cases.push({ id: 'without-first', label: 'Estricto · sin primer año', options: { ...base, quality: 'strict', startYear: base.startYear + 1 } }, { id: 'without-last', label: 'Estricto · sin último año', options: { ...base, quality: 'strict', endYear: base.endYear - 1 } });
  return { cases: cases.map(item => { const result = analyze(points, item.options); return { ...item, ...result.trend, coverage: result.quality.coverage, acceptedComposites: result.quality.accepted }; }), note: 'Variantes fijadas de antemano para inspeccionar sensibilidad. No son pruebas independientes ni permiten elegir el p-valor más favorable.' };
}
