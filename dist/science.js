/**
 * TerraMind scientific utilities.
 * Bundled values are deterministic SYNTHETIC examples, never satellite observations.
 * Units and proposed products describe a future ingestion contract, not provenance
 * of the synthetic values. No operational fire or causal inference is provided.
 */
export const VARIABLES = Object.freeze({
  ndvi: { id: 'ndvi', name: 'Vegetación · NDVI', short: 'NDVI', unit: '1', units: '1', decimals: 3, color: '#57cfa3', product: 'MOD13A2.061', source: 'MODIS', aggregate: 'mean', range: [-1, 1], description: 'Índice de verdor; no equivale a cobertura de bosque.' },
  evi: { id: 'evi', name: 'Vegetación · EVI', short: 'EVI', unit: '1', units: '1', decimals: 3, color: '#86d6bb', product: 'MOD13A2.061', source: 'MODIS', aggregate: 'mean', range: [-1, 1], description: 'Índice de vegetación mejorado; requiere filtros de calidad.' },
  precip: { id: 'precip', name: 'Precipitación', short: 'Lluvia', unit: 'mm/mes', units: 'mm/mes', decimals: 1, color: '#68b9ed', product: 'GPM_3IMERGM.07', source: 'GPM IMERG', aggregate: 'sum', range: [0, 5000], description: 'Acumulado mensual; no se infiere sequía con una sola anomalía.' },
  hotspots: { id: 'hotspots', name: 'Detecciones térmicas', short: 'Focos de calor', unit: 'detecciones/mes', units: 'detecciones/mes', decimals: 0, color: '#f3aa72', product: 'VIIRS S-NPP 375 m', source: 'VIIRS / FIRMS', aggregate: 'sum', range: [0, 10000000], description: 'Conteo de detecciones de un único sensor. No equivale a incendios únicos ni a área quemada.' },
  soil: { id: 'soil', name: 'Humedad del suelo', short: 'Humedad', unit: 'm³/m³', units: 'm³/m³', decimals: 3, color: '#b29ce5', product: 'SPL3SMP', source: 'SMAP', aggregate: 'mean', range: [0, 1], description: 'Humedad superficial; disponible desde abril de 2015, no humedad de toda la zona de raíces.' },
});

export const AREAS = Object.freeze({
  seco: { id: 'seco', name: 'Chaco seco', label: 'Chaco seco', note: 'Área de estudio ilustrativa; no representa una delimitación oficial.' },
  transicion: { id: 'transicion', name: 'Zona de transición', label: 'Zona de transición', note: 'Área de estudio ilustrativa; no representa una delimitación oficial.' },
  humedo: { id: 'humedo', name: 'Chaco húmedo', label: 'Chaco húmedo', note: 'Área de estudio ilustrativa; no representa una delimitación oficial.' },
});

export const BASELINE = Object.freeze({ start: 2015, end: 2020, minSamples: 5, label: '2015–2020' });
export const MIN_COVERAGE = 0.8;
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const median = values => { if (!values.length) return null; const a = [...values].sort((a, b) => a - b); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const round = (value, places = 5) => Math.round(value * 10 ** places) / 10 ** places;
const validDate = date => typeof date === 'string' && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(date);
export const isUsable = p => Number.isFinite(p?.value) && (p.quality === 'valid' || p.quality === 'demo') && Number.isFinite(p.coverage) && p.coverage >= MIN_COVERAGE;

/** Pure repeatable fictional data, deliberately including a quality gap. */
export function getSeries(variable, area, startYear = 2015, endYear = 2025) {
  if (!VARIABLES[variable] || !AREAS[area]) throw new Error('Variable o área desconocida.');
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) throw new Error('Período inválido.');
  const areaIndex = ['seco', 'transicion', 'humedo'].indexOf(area);
  const records = [];
  for (let year = Math.max(2015, startYear); year <= Math.min(2025, endYear); year++) {
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, '0')}`;
      if (variable === 'soil' && date < '2015-04') continue;
      const t = year - 2015;
      const seasonal = Math.cos((month - 2) * Math.PI / 6);
      const smallVariation = Math.sin((t * 12 + month) * 1.731 + areaIndex * 2.4);
      const fictionalDry = year === 2020 || year === 2022 ? 1 : 0;
      let value;
      if (variable === 'ndvi') value = 0.47 + areaIndex * 0.07 + 0.13 * seasonal - t * 0.0034 - fictionalDry * 0.04 + smallVariation * 0.015;
      if (variable === 'evi') value = 0.29 + areaIndex * 0.052 + 0.10 * seasonal - t * 0.0024 - fictionalDry * 0.032 + smallVariation * 0.012;
      if (variable === 'precip') value = Math.max(0, 66 + areaIndex * 26 + (51 + areaIndex * 10) * seasonal - t * 0.55 - fictionalDry * 18 + smallVariation * 10);
      if (variable === 'hotspots') value = Math.round(Math.max(0, 12 - areaIndex * 2 + 35 * Math.max(0, -seasonal) ** 2 + t * 0.9 + fictionalDry * 9 + smallVariation * 4));
      if (variable === 'soil') value = clamp(0.17 + areaIndex * 0.035 + seasonal * 0.044 - t * 0.0011 - fictionalDry * 0.022 + smallVariation * 0.009, 0, 1);
      const gap = variable === 'ndvi' && area === 'transicion' && date === '2018-02';
      records.push({ date, value: gap ? null : round(value), coverage: gap ? 0.42 : 1, quality: gap ? 'missing' : 'demo', synthetic: true });
    }
  }
  return records;
}

/** Baseline is a short reference period, not a 30-year climate normal. */
export function monthlyClimatology(series, start = BASELINE.start, end = BASELINE.end) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const points = series.filter(p => validDate(p.date) && +p.date.slice(0, 4) >= start && +p.date.slice(0, 4) <= end && +p.date.slice(5) === month && isUsable(p));
    const values = points.map(p => p.value);
    const avg = mean(values);
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)) : null;
    return { month, count: values.length, value: values.length >= BASELINE.minSamples ? avg : null, mean: values.length >= BASELINE.minSamples ? avg : null, sd: values.length >= BASELINE.minSamples ? sd : null, sufficient: values.length >= BASELINE.minSamples };
  });
}

/** Differences always compare the same calendar month. zScore uses sample SD. */
export function seasonalAnomalies(series, baselineSeries = series) {
  const climate = monthlyClimatology(baselineSeries);
  return series.map(point => {
    const base = climate[+point.date.slice(5) - 1];
    const usable = isUsable(point) && base?.sufficient;
    const anomaly = usable ? point.value - base.mean : null;
    return { ...point, anomaly, difference: anomaly, percent: usable && base.mean !== 0 ? 100 * anomaly / Math.abs(base.mean) : null, zScore: usable && base.sd > 0 ? anomaly / base.sd : null, baseline: base?.mean ?? null, baselineCount: base?.count ?? 0 };
  });
}

/** Annual sums for monthly accumulation/counts, arithmetic means for indices. */
export function annualSummaries(series, variable) {
  if (!VARIABLES[variable]) throw new Error('Variable desconocida.');
  const years = [...new Set(series.filter(p => validDate(p.date)).map(p => +p.date.slice(0, 4)))].sort((a, b) => a - b);
  return years.map(year => {
    const rows = series.filter(p => +p.date.slice(0, 4) === year);
    const usable = rows.filter(isUsable);
    const uniqueMonths = new Set(usable.map(p => +p.date.slice(5)));
    const complete = usable.length === 12 && uniqueMonths.size === 12;
    return { year, date: `${year}`, count: uniqueMonths.size, complete, coverage: uniqueMonths.size / 12, value: complete ? (VARIABLES[variable].aggregate === 'sum' ? usable.reduce((sum, p) => sum + p.value, 0) : mean(usable.map(p => p.value))) : null };
  });
}

/** Southern-hemisphere seasons. DJF belongs to the year containing Jan/Feb. */
export function seasonalSummaries(series, variable) {
  if (!VARIABLES[variable]) throw new Error('Variable desconocida.');
  const grouped = new Map();
  const names = ['Verano', 'Otoño', 'Invierno', 'Primavera'];
  for (const point of series.filter(p => validDate(p.date))) {
    const month = +point.date.slice(5), year = +point.date.slice(0, 4) + (month === 12 ? 1 : 0);
    const season = month === 12 || month <= 2 ? 0 : Math.floor((month - 3) / 3) + 1;
    const key = `${year}-${season}`;
    if (!grouped.has(key)) grouped.set(key, { year, season, label: names[season], rows: [] });
    grouped.get(key).rows.push(point);
  }
  return [...grouped.values()].sort((a, b) => a.year - b.year || a.season - b.season).map(({ rows, ...group }) => {
    const usable = rows.filter(isUsable), months = new Set(usable.map(p => p.date));
    const complete = usable.length === 3 && months.size === 3;
    return { ...group, complete, count: months.size, value: complete ? (VARIABLES[variable].aggregate === 'sum' ? usable.reduce((sum, p) => sum + p.value, 0) : mean(usable.map(p => p.value))) : null };
  });
}

/** Sen slope per year when records carry a year; per sample for numeric arrays. */
export function senSlope(records) {
  const points = records.map((p, index) => typeof p === 'number' ? { year: index, value: p } : p).filter(p => Number.isFinite(p.year) && Number.isFinite(p.value)).sort((a, b) => a.year - b.year);
  const slopes = [];
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) if (points[j].year !== points[i].year) slopes.push((points[j].value - points[i].value) / (points[j].year - points[i].year));
  return median(slopes);
}

// Abramowitz–Stegun normal CDF approximation, error < 8e-8.
function normalCdf(z) {
  const x = Math.abs(z), t = 1 / (1 + 0.2316419 * x);
  const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}

/** Two-sided classical Mann–Kendall with tie correction and continuity correction. */
export function mannKendall(values) {
  const data = values.filter(Number.isFinite), n = data.length;
  if (n < 2) return { n, s: 0, variance: null, z: null, p: null, pValue: null, tau: null };
  let s = 0;
  const frequencies = new Map();
  for (let i = 0; i < n; i++) {
    frequencies.set(data[i], (frequencies.get(data[i]) ?? 0) + 1);
    for (let j = i + 1; j < n; j++) s += Math.sign(data[j] - data[i]);
  }
  const tieTerm = [...frequencies.values()].reduce((sum, count) => sum + count * (count - 1) * (2 * count + 5), 0);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const z = variance === 0 || s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(variance);
  const pValue = variance === 0 ? 1 : Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))));
  return { n, s, variance, z, p: pValue, pValue, tau: s / (n * (n - 1) / 2) };
}

/** Pearson correlation between consecutive observations, used as a caution screen. */
export function lag1Correlation(values) {
  if (values.length < 4 || values.some(v => !Number.isFinite(v))) return null;
  const left = values.slice(0, -1), right = values.slice(1), a = mean(left), b = mean(right);
  const num = left.reduce((sum, v, i) => sum + (v - a) * (right[i] - b), 0);
  const den = Math.sqrt(left.reduce((sum, v) => sum + (v - a) ** 2, 0) * right.reduce((sum, v) => sum + (v - b) ** 2, 0));
  return den ? num / den : 0;
}

/**
 * Conservative annual trend gate. A significant result is exploratory evidence
 * of association over time, never causality. Auto-correlation screening is a
 * caution, not proof of independence; no unadjusted p is shown when it fails.
 */
export function assessTrend(annualRows, { observed = false, alpha = 0.05 } = {}) {
  const complete = annualRows.filter(p => p.complete !== false && Number.isFinite(p.value)).sort((a, b) => a.year - b.year);
  const slope = senSlope(complete);
  const base = { n: complete.length, slope, eligible: false, significant: null, p: null, pValue: null, alpha, autocorrelation: null, warning: 'Análisis exploratorio. No atribuye causas; no corrige comparaciones múltiples.' };
  if (!observed) return { ...base, status: 'demo', reason: 'Datos sintéticos: no se evalúa significancia ni se emiten conclusiones sobre el territorio.' };
  if (complete.length < 10) return { ...base, status: 'insufficient', reason: 'Se necesitan al menos 10 años completos con calidad y cobertura suficientes.' };
  const consecutive = complete.every((p, i) => i === 0 || p.year === complete[i - 1].year + 1);
  if (!consecutive) return { ...base, status: 'gaps', reason: 'Hay años faltantes: se conserva la pendiente descriptiva y se suspende la inferencia.' };
  // Detrend before screening so a monotonic trend itself is not called serial dependence.
  const intercept = median(complete.map(p => p.value - slope * p.year));
  const residuals = complete.map(p => p.value - (intercept + slope * p.year));
  const r = lag1Correlation(residuals);
  if (Math.abs(r ?? 0) > 1.96 / Math.sqrt(complete.length)) return { ...base, autocorrelation: r, status: 'autocorrelation', reason: 'Dependencia temporal en los residuos: Mann–Kendall clásico no es defendible sin ajuste.' };
  const mk = mannKendall(complete.map(p => p.value));
  return { ...base, autocorrelation: r, eligible: true, status: 'exploratory', significant: mk.pValue < alpha, p: mk.pValue, pValue: mk.pValue, mk, reason: mk.pValue < alpha ? 'Evidencia exploratoria de tendencia monotónica (α = 0,05; sin ajuste por comparaciones múltiples).' : 'No se detecta evidencia suficiente de tendencia monotónica; no demuestra ausencia de cambio.' };
}

/** Validate declared observations without pretending to authenticate their source. */
export function validateDataset(input) {
  const errors = [];
  const fail = message => errors.push(message);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['El archivo debe contener un objeto JSON.'], dataset: null };
  if (input.schemaVersion !== 1) fail('schemaVersion debe ser 1.');
  if (input.kind !== 'observations') fail('kind debe ser observations; no se aceptan simulaciones como observaciones.');
  const variable = VARIABLES[input.variable];
  if (!variable) fail('Variable no reconocida.');
  if (!AREAS[input.area]) fail('Área no reconocida.');
  if (variable && input.units !== variable.units) fail(`Unidades esperadas: ${variable.units}.`);
  const source = input.source;
  if (!source || typeof source !== 'object') fail('Falta la ficha source de procedencia.');
  else {
    for (const field of ['title', 'url', 'product', 'version', 'downloadedAt', 'aggregation', 'qualityFilter']) if (typeof source[field] !== 'string' || !source[field].trim() || source[field].length > 2000) fail(`source.${field} es obligatorio y debe ser texto de hasta 2000 caracteres.`);
    try { if (new URL(source.url).protocol !== 'https:') fail('source.url debe usar HTTPS.'); } catch { fail('source.url no es una URL válida.'); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.downloadedAt ?? '') || Number.isNaN(Date.parse(source.downloadedAt)) || new Date(source.downloadedAt).toISOString().slice(0, 10) !== source.downloadedAt) fail('source.downloadedAt debe ser una fecha válida YYYY-MM-DD.');
  }
  if (!Array.isArray(input.points) || !input.points.length || input.points.length > 2400) fail('points debe contener entre 1 y 2400 meses.');
  else {
    const seen = new Set();
    input.points.forEach((p, i) => {
      const prefix = `Fila ${i + 1}`;
      if (!p || typeof p !== 'object') { fail(`${prefix}: registro inválido.`); return; }
      if (!validDate(p.date)) fail(`${prefix}: fecha mensual inválida (YYYY-MM).`);
      if (seen.has(p.date)) fail(`${prefix}: mes duplicado.`);
      seen.add(p.date);
      if (input.variable === 'soil' && p.date < '2015-04') fail(`${prefix}: SMAP no se admite antes de abril de 2015.`);
      if (!['valid', 'suspect', 'missing'].includes(p.quality)) fail(`${prefix}: quality debe ser valid, suspect o missing.`);
      if (!Number.isFinite(p.coverage) || p.coverage < 0 || p.coverage > 1) fail(`${prefix}: coverage debe estar entre 0 y 1.`);
      if (p.value === null) { if (p.quality !== 'missing') fail(`${prefix}: los valores nulos deben marcarse missing.`); }
      else if (!Number.isFinite(p.value)) fail(`${prefix}: value debe ser un número o null.`);
      else {
        if (p.quality === 'missing') fail(`${prefix}: un mes missing debe tener value null.`);
        if (variable && (p.value < variable.range[0] || p.value > variable.range[1])) fail(`${prefix}: valor fuera del rango admitido.`);
        if (input.variable === 'hotspots' && !Number.isInteger(p.value)) fail(`${prefix}: las detecciones deben ser enteros.`);
      }
      if (p.synthetic === true) fail(`${prefix}: un registro sintético no puede importarse como observación.`);
    });
  }
  if (errors.length) return { valid: false, errors: errors.slice(0, 25), dataset: null };
  const sorted = input.points.map(p => ({ date: p.date, value: p.value, coverage: p.coverage, quality: p.quality })).sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map(p => [p.date, p]));
  const points = [];
  let year = +sorted[0].date.slice(0, 4), month = +sorted[0].date.slice(5);
  const last = sorted.at(-1).date;
  for (;;) {
    const date = `${year}-${String(month).padStart(2, '0')}`;
    if (date > last) break;
    // A missing month is a gap, never a zero or an interpolated observation.
    points.push(byDate.get(date) ?? { date, value: null, coverage: 0, quality: 'missing' });
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { valid: true, errors: [], dataset: { schemaVersion: 1, kind: 'observations', variable: input.variable, area: input.area, units: input.units, source: { ...source }, points, insertedMissingMonths: points.length - sorted.length, provenanceVerified: false } };
}

export function summarizeQuality(series) {
  const valid = series.filter(isUsable).length;
  const missing = series.filter(p => p.value === null || p.quality === 'missing').length;
  return { total: series.length, valid, missing, excluded: series.length - valid, fraction: series.length ? valid / series.length : 0 };
}
