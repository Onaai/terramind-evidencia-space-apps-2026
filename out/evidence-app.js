// Implementation begun 14 November 2026; expanded with verified GPM data 15 November.
// OpenAI Codex assisted code/text. Satellite observations are never generated.
import {analyze,sensitivity} from './evidence-science.js';
import {analyzePrecipitation,sensitivityPrecipitation} from './precipitation-science.js';
import {mountMap} from './evidence-map.js';
import {renderChart,escapeHtml as esc,formatNumber as fmt,formatP,formatDate} from './evidence-charts.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={variable:'ndvi',startYear:2015,endYear:2025,quality:'strict',chart:'series',view:'explore'};
let vegetation,precipitation,result,comparisons,chart,map;
const rain=()=>state.variable==='precip';
const data=()=>rain()?precipitation:vegetation;
const label=()=>rain()?'Precipitación':state.variable.toUpperCase();
const unit=()=>rain()?'mm':'índice';
const resolution=()=>rain()?'0,1° nominales':'250 m nominales';
const qualityName=()=>rain()?'Disponibilidad diaria completa; QA de recuperación no disponible':state.quality==='strict'?'estricta':'ampliada';
const slopeText=s=>Number.isFinite(s)?`${s>0?'+':''}${fmt(s,rain()?2:4)}`:'No estimable';
const number=v=>fmt(v,rain()?1:3);
const percent=v=>`${fmt(v*100,1)} %`;
const years=n=>`${n} ${n===1?'año apto':'años aptos'}`;
const methodFile=()=>rain()?'precipitation-methodology.md':'methodology.md';
const datasetFile=()=>rain()?'precipitation.json':'pilot.json';
function setView(view){
  if(!['explore','science','project'].includes(view))view='explore';state.view=view;
  $$('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);
  $$('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#breadcrumb').textContent={explore:'Exploración',science:'Revisión científica',project:'Proyecto e inversión'}[view];
  const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);
  if(view==='explore')window.dispatchEvent(new Event('resize'));
}
function renderFindings(){
  const annual=result.annual.filter(r=>r.accepted),first=annual[0],last=annual.at(-1),difference=annual.length>1?last.value-first.value:null;
  const significant=result.trend.eligible?(result.trend.significant?'Señal exploratoria':'Sin señal concluyente'):'Evidencia insuficiente';
  $('#findings').innerHTML=`<article class="finding"><span class="step">QUÉ CAMBIÓ</span><strong>${difference===null?'Sin comparación':`${difference>0?'+':''}${number(difference)}${rain()?' mm':''}`}</strong><p>${difference===null?'Faltan al menos dos años aptos.':`${label()} entre ${rain()?'los acumulados':'las medias'} anuales de ${first.year} y ${last.year}. Comparación descriptiva.`}</p></article><article class="finding"><span class="step">DÓNDE</span><strong class="text-value">Un sitio del Chaco</strong><p>Una celda de ${resolution()} en el punto −25°, −63°. No se extrapola a la región.</p></article><article class="finding"><span class="step">CUÁNTO POR AÑO</span><strong>${slopeText(result.trend.slope)}</strong><p>Pendiente de Sen · ${unit()}/año<br>${years(result.trend.n)} para el resumen.</p></article><article class="finding accent"><span class="step">¿ES SIGNIFICATIVO?</span><strong class="text-value">${significant}</strong><p>${result.trend.eligible?`Mann–Kendall exploratorio, p ${esc(formatP(result.trend.pValue))}. Sin inferencia causal.`:`No se informa p-valor. ${esc(result.trend.reason)}`}</p></article>`;
}
function focusRow(row,index,mode){
  $('#chart-cursor').value=index;
  if(mode==='annual')$('#chart-tooltip').innerHTML=`<b>${row.year}</b> · ${row.accepted?`${label()} ${number(row.value)} ${unit()}`:'Año no apto'} · ${rain()?'Disponibilidad diaria':'Cobertura nominal'} ${percent(row.coverage)}${rain()?'':` · ${row.validComposites}/23 compuestos aceptados`}`;
  else $('#chart-tooltip').innerHTML=`<b>${formatDate(row.date)}</b> · ${row.accepted?`${mode==='anomaly'?'Δ ':''}${label()} ${Number.isFinite(row.displayValue)?`${number(row.displayValue)} ${unit()}`:'sin referencia suficiente'}`:'Excluida / ausente'} · ${row.accepted?`Referencia: ${row.referenceCount} años${row.selectedDayOfYear?` · Día seleccionado: ${row.selectedDayOfYear}`:''}`:esc(row.reason)}`;
}
function drawChart(){
  chart=renderChart($('#chart'),result,state.chart,{onFocus:focusRow});$('#chart-cursor').max=chart.rows.length-1;chart.focus(chart.rows.length-1);
  $$('[data-chart]').forEach(b=>{const active=b.dataset.chart===state.chart;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('[data-chart="series"]').textContent=rain()?'Acumulados mensuales':'Compuestos de 16 días';
  $('#chart-heading').textContent=rain()?'Lluvia a través del tiempo':'Vegetación a través del tiempo';
  const keys=$$('.chart-key>span');keys[1].innerHTML=state.chart==='annual'?'<i class="key-line muted" style="border-color:#a6844f"></i>Pendiente de Sen descriptiva':state.chart==='anomaly'?'<i class="key-line muted"></i>Cero = referencia 2015–2020':'<i class="key-line muted"></i>Referencia 2015–2020';
  $('#legend-observed').textContent=state.chart==='annual'?(rain()?'Acumulado anual completo':'Media anual apta'):state.chart==='anomaly'?'Diferencia respecto a referencia':rain()?'Acumulado mensual':'Observación aceptada';
  keys[2].innerHTML='<i class="key-cross">×</i>'+ (rain()?'Mes incompleto / ausente':'Excluida por calidad');
  const notes=rain()?{
    annual:'Se suman todos los valores diarios de cada año. Sólo se admiten años con el 100% de los días disponibles y válidos. Disponibilidad completa no significa calidad de recuperación verificada.',
    anomaly:'Acumulado mensual menos la media del mismo mes en 2015–2020 (mínimo 4 meses completos). Referencia corta, no normal climatológica. Lluvia menor a la referencia no demuestra sequía.',
    series:'GPM IMERG a través de NASA POWER: suma de valores diarios UTC en mm/día × 1 día. Grilla de 0,1°, diferente de MODIS. La API no explicita colección ni tipo de procesamiento IMERG.'
  }:{
    annual:'Media ponderada por duración nominal del compuesto. Año apto: ≥80% de duración representada y las cuatro estaciones presentes. Los huecos no se interpolan.',
    anomaly:'Cada compuesto se compara con el mismo intervalo de 16 días en 2015–2020 (mínimo 4 valores aceptados). Es una referencia corta, no una normal climatológica.',
    series:'La fecha identifica el inicio del compuesto. Cada valor procede de una observación seleccionada dentro de ese intervalo, no de un promedio diario. Los huecos no se interpolan.'
  };$('#chart-note').textContent=notes[state.chart];
}
function renderRobustness(){
  $('#robustness-cards').innerHTML=comparisons.cases.map(c=>`<article class="robust-card"><h4>${esc(c.label)} · ${c.options.startYear}–${c.options.endYear}</h4><div class="slope-value">${slopeText(c.slope)}${Number.isFinite(c.slope)?`<small>${unit()} / año</small>`:''}</div><p>${years(c.n)} · ${percent(c.coverage)} ${rain()?'de días disponibles':'de duración representada'}.<br>${c.eligible?`p exploratorio ${esc(formatP(c.pValue))}`:'p-valor no informado'}</p></article>`).join('');
  $('#sensitivity-table').innerHTML=`<table><thead><tr><th>VARIANTE PREDEFINIDA</th><th>PERÍODO</th><th>AÑOS APTOS</th><th>SEN · ${unit()}/AÑO</th><th>p EXPLORATORIO</th><th>CRITERIO</th></tr></thead><tbody>${comparisons.cases.map(c=>`<tr><td>${esc(c.label)}</td><td>${c.options.startYear}–${c.options.endYear}</td><td>${c.n}</td><td>${slopeText(c.slope)}</td><td>${esc(formatP(c.pValue))}</td><td>${esc(c.reason)}</td></tr>`).join('')}</tbody></table>`;
}
function renderMethods(){
  const sections=rain()?[
    ['Producto y alcance','GPM IMERG, distribuido por NASA POWER. Una celda nominal de 0,1° en el punto consultado; no equivale al píxel MODIS de 250 m.'],
    ['Disponibilidad y calidad','Se excluyen rellenos, días ausentes, fechas duplicadas y valores negativos. No hay QA de recuperación en la respuesta. Días disponibles no equivalen a días sin error.'],
    ['Acumulados y referencia','Se suman valores diarios UTC por mes y año sin completar huecos. Se exige el 100% de días válidos. La anomalía compara el mismo mes con 2015–2020.'],
    ['Inferencia con límites','Sen y Mann–Kendall exploratorio sobre años completos. Sin atribución causal, corrección múltiple ni inferencia de sequía. Colección y tipo de procesamiento IMERG no explicitados.']
  ]:[
    ['Producto y alcance','MOD13Q1, NDVI y EVI en compuestos de 16 días. Una celda nativa en el punto fijado antes de descargar. No es un promedio regional.'],
    ['Calidad antes del resultado','Se conservan enteros y banderas QA. El filtro estricto excluye observaciones problemáticas; el ampliado sirve para evaluar sensibilidad.'],
    ['Resumen y estacionalidad','Medias anuales ponderadas por duración nominal. Se exige cobertura ≥80% y cuatro estaciones. Anomalías frente al mismo intervalo en 2015–2020.'],
    ['Inferencia con límites','Sen y Mann–Kendall exploratorio con años suficientes. La dependencia temporal puede suspender el p-valor clásico. NDVI y EVI no son evidencia independiente.']
  ];$('#method-content').innerHTML=sections.map(([title,text],i)=>`<div><span>0${i+1}</span><h4>${title}</h4><p>${text}</p></div>`).join('');$('#methodology-link').href='./'+methodFile();
}
function renderScience(){
  const stats=[['Pendiente de Sen',`${slopeText(result.trend.slope)} ${unit()}/año`],['Años aptos',`${result.trend.n} de ${result.annual.length}`],[rain()?'Meses completos':'Compuestos aceptados',`${result.quality.accepted} de ${result.quality.expected}`],[rain()?'Disponibilidad diaria':'Duración nominal representada',percent(result.quality.coverage)],['Autocorrelación residual de orden 1',Number.isFinite(result.trend.lag1)?fmt(result.trend.lag1):'No evaluada'],['Mann–Kendall · p bilateral',formatP(result.trend.pValue)]];
  $('#trend-detail').innerHTML=stats.map(([key,value])=>`<div class="stat-row"><span>${key}</span><strong>${esc(value)}</strong></div>`).join('')+`<p class="trend-message">${esc(result.trend.reason)}<br>${esc(result.trend.warning)}${rain()?'<br>La disponibilidad no verifica QA; colección y tipo de procesamiento IMERG no explicitados por la respuesta.':''}</p>`;
  const d=data(),source=d.source||{},site=d.site||{};
  const provenance=[['Proveedor',source.provider||'NASA'],['Producto',source.product],['Colección',source.collectionVersion?`${source.collectionVersion} · ver comprobantes`:'No explícita en el servicio; sin atribuir una versión'],['Lugar',`${site.lat}, ${site.lon} · punto consultado dentro de una celda`],['Resolución',`${resolution()} · ${rain()?'diario UTC → mensual':'compuestos de 16 días'}`],['Serie',`${d.period.start} a ${d.period.end}`],['Descarga',d.generatedAt||'Consultar manifiesto'],['Trazabilidad',`${d.retrievals?.length??0} respuestas archivadas con SHA-256`]];
  $('#provenance').innerHTML=provenance.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('');$('#dataset-link').href='./data/'+datasetFile();
  $('#calendar-unit').textContent=rain()?'CADA CELDA = UN MES':'CADA CELDA = UN COMPUESTO';
  $('#quality-calendar').innerHTML=result.annual.map(year=>`<div class="calendar-row"${rain()?' style="grid-template-columns:45px repeat(12,minmax(10px,1fr))"':''}><span>${year.year}</span>${result.series.filter(r=>r.year===year.year).map(r=>{const text=`${r.date}: ${r.accepted?'aceptada':r.reason}; ${label()} ${Number.isFinite(r.value)?number(r.value):'ausente'} ${unit()}`;return `<button class="calendar-cell ${r.accepted?'accepted':r.present?'rejected':''}" title="${esc(text)}" aria-label="${esc(text)}"></button>`;}).join('')}</div>`).join('')+'<p id="quality-readout" class="footnote" aria-live="polite">Seleccioná una celda para revisar su estado.</p>';
  $('#quality-calendar-note').textContent=rain()?'Verde: mes con todos los días válidos disponibles. Ámbar: incompleto. Gris: ausente. No es una evaluación de calidad de recuperación del sensor.':'Verde: aceptado por el filtro. Ámbar: descartado. Gris: sin compuesto. Consultá una celda para ver sus banderas.';
  $('#quality-calendar').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>$('#quality-readout').textContent=b.getAttribute('aria-label')));
  renderMethods();if($('#observations-details').open)renderObservations();
}
function renderObservations(){
  $('#observations-table').innerHTML=rain()?`<table><thead><tr><th>MES</th><th>PRECIPITACIÓN · mm</th><th>DÍAS VÁLIDOS</th><th>ESTADO</th><th>MOTIVO</th></tr></thead><tbody>${result.series.map(r=>`<tr><td>${r.date.slice(0,7)}</td><td>${Number.isFinite(r.value)?fmt(r.value,2):'Ausente'}</td><td>${r.dailyValid}/${r.dailyExpected}</td><td>${r.accepted?'Completo':'Excluido'}</td><td>${esc(r.reason||'Disponibilidad completa; QA no verificado')}</td></tr>`).join('')}</tbody></table>`:`<table><thead><tr><th>INICIO COMPUESTO</th><th>${label()}</th><th>ESTADO</th><th>RELIABILITY</th><th>VI QUALITY</th><th>DÍA SELECCIONADO</th><th>MOTIVO</th></tr></thead><tbody>${result.series.map(r=>`<tr><td>${r.date}</td><td>${Number.isFinite(r.value)?fmt(r.value,4):'Ausente'}</td><td>${r.accepted?'Aceptada':'Excluida'}</td><td>${r.reliability??'—'}</td><td>${r.viQuality??'—'}</td><td>${r.selectedDayOfYear??'—'}</td><td>${esc(r.reason||'Cumple el filtro elegido')}</td></tr>`).join('')}</tbody></table>`;
}
function update(){
  result=rain()?analyzePrecipitation(precipitation.points,state):analyze(vegetation.points,state);comparisons=rain()?sensitivityPrecipitation(precipitation.points,state):sensitivity(vegetation.points,state);
  result.variable=state.variable;$('#quality').disabled=rain();
  $('#scope-label').textContent=`${resolution()} · ${rain()?'GPM IMERG':'MODIS Terra'}`;
  $('#filter-status').textContent=`${state.startYear}–${state.endYear} · ${rain()?'Disponibilidad diaria completa':`Calidad ${qualityName()}`} · ${result.quality.accepted}/${result.quality.expected} ${rain()?'meses completos':'compuestos aceptados'} · ${years(result.trend.n)} · ${rain()?'QA de recuperación no disponible.':state.quality==='relaxed'?'Sensibilidad con calidad marginal incluida.':'El filtro se mantiene aunque deje evidencia insuficiente.'}`;
  $('#data-badge').textContent=data().status==='partial'?'NASA · descarga parcial':'● NASA · datos reales';
  $('#loading').hidden=data().status!=='partial';if(data().status==='partial')$('#loading').textContent='REVISIÓN LOCAL · Descarga parcial de vegetación. Los compuestos todavía no obtenidos aparecen como ausentes. No es el archivo histórico final.';
  $('#export-report').disabled=data().status==='partial';
  map?.updateScope({resolutionLabel:resolution(),product:rain()?'GPM IMERG vía NASA POWER':'MOD13Q1'});
  renderFindings();drawChart();renderRobustness();renderScience();
}
export function csvFor(r){const cols=r.variable==='precip'?['date','value','dailyValid','dailyExpected','accepted','reason','anomaly']:['date','ndvi','evi','rawNdvi','rawEvi','reliability','viQuality','selectedDayOfYear','accepted','reason','anomaly'];return [cols.join(','),...r.series.map(row=>cols.map(key=>`"${String(row[key]??'').replaceAll('"','""')}"`).join(','))].join('\r\n');}
function report(){const d=data();return `# TerraMind Evidencia — expediente\n\nGenerado: ${new Date().toISOString()}\n\n## Pregunta y alcance\n¿Cómo varió ${label()} en la celda que contiene −25°, −63°, entre ${state.startYear} y ${state.endYear}?\nResolución nominal: ${resolution()}. Un sitio, no todo el Gran Chaco.\n\n## Fuente y procesamiento\n${d.source.provider}; ${d.source.product}. Datos reales archivados, no simulados.\nColección: ${d.source.collectionVersion??'no explícita en la respuesta; no se atribuye versión'}.\nArchivo generado: ${d.generatedAt}.\nFiltro: ${qualityName()}.\n${result.quality.accepted}/${result.quality.expected} ${rain()?'meses completos':'compuestos aceptados'}. ${rain()?'Disponibilidad diaria':'Duración nominal representada'}: ${percent(result.quality.coverage)}.\n${rain()?'Acumulados: suma diaria de mm/día × 1 día UTC. Disponibilidad no es calidad.':'Duración nominal no equivale a cantidad de días observados.'}\n\n## Resultado\n${years(result.trend.n)}. Sen: ${slopeText(result.trend.slope)} ${unit()}/año.\n${result.trend.eligible?`Mann–Kendall exploratorio bilateral: p ${formatP(result.trend.pValue)}.`:'p-valor no informado.'}\n${result.trend.reason}\n${result.trend.warning}\n\n## Sensibilidad predefinida\n${comparisons.cases.map(c=>`- ${c.label}, ${c.options.startYear}–${c.options.endYear}: Sen ${slopeText(c.slope)} ${unit()}/año; ${years(c.n)}; ${c.reason}`).join('\n')}\n\n## Límites\n${result.warnings.map(s=>'- '+s).join('\n')}\n- No acredita causalidad, deforestación, sequía, recuperación ecológica ni alertas de incendios.\n- MODIS e IMERG tienen grillas distintas; no son una comparación espacial armonizada.\n- No elegir el período por el p-valor más favorable.\n\n## Reproducir\nArchivo y comprobantes: ${new URL('./data/'+datasetFile(),location.href).href}\nMétodo: ${new URL('./'+methodFile(),location.href).href}\nCada retrieval conserva URL, fecha y SHA-256.\nFuente: ${rain()?'https://power.larc.nasa.gov/docs/services/api/temporal/daily/':'https://modis.ornl.gov/data/modis_webservice.html'}\n\nCódigo y textos asistidos por OpenAI Codex. Los datos NASA no fueron generados por IA. Sin aval institucional.\n`;}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('[data-chart]').forEach(b=>b.addEventListener('click',()=>{state.chart=b.dataset.chart;drawChart();}));
$('#go-science').addEventListener('click',()=>{setView('science');$('#main').scrollIntoView({block:'start'});});
$('#chart-cursor').addEventListener('input',e=>chart.focus(e.target.value));
$('#observations-details').addEventListener('toggle',()=>{if($('#observations-details').open)renderObservations();});
$('#export-report').addEventListener('click',()=>download(report(),`TerraMind-evidencia-${state.variable}-${state.startYear}-${state.endYear}.md`,'text/markdown;charset=utf-8'));
$('#export-csv').addEventListener('click',()=>download('\ufeff'+csvFor(result),`TerraMind-serie-${state.variable}-${state.startYear}-${state.endYear}.csv`,'text/csv;charset=utf-8'));
$('#export-chart').addEventListener('click',()=>{const caption=`${data().source.product} · ${resolution()} · −25°, −63° · ${state.startYear}–${state.endYear} · ${rain()?'Días completos':qualityName()} · TerraMind`;const svg=chart.svg().replace('viewBox="0 0 780 306"','viewBox="0 0 780 336"').replace('</svg>',`<text x="48" y="328" font-family="sans-serif" font-size="10" fill="#61705a">${esc(caption)}</text></svg>`);download(svg,`TerraMind-${state.variable}-${state.chart}.svg`,'image/svg+xml;charset=utf-8');});
for(const [id,key] of [['variable','variable'],['start-year','startYear'],['end-year','endYear'],['quality','quality']])$('#'+id).addEventListener('change',e=>{state[key]=key.includes('Year')?Number(e.target.value):e.target.value;if(state.startYear>state.endYear){if(key==='startYear')state.endYear=state.startYear;else state.startYear=state.endYear;$('#start-year').value=state.startYear;$('#end-year').value=state.endYear;}update();});
$('#reset').addEventListener('click',()=>{Object.assign(state,{variable:vegetation?'ndvi':'precip',startYear:2015,endYear:2025,quality:'strict',chart:'series'});$('#variable').value=state.variable;$('#start-year').value=2015;$('#end-year').value=2025;$('#quality').value='strict';update();});
async function readData(filename){const response=await fetch('./data/'+filename);if(!response.ok)throw new Error(`Archivo ${filename} no disponible (${response.status}).`);const d=await response.json();if(d.kind!=='observations'||!Array.isArray(d.points)||!d.points.length||d.site.lat!==-25||d.site.lon!==-63)throw new Error('Archivo observacional incompatible con el sitio declarado.');return d;}
async function start(){try{
  const preview=['127.0.0.1','localhost'].includes(location.hostname)&&new URL(location.href).searchParams.get('preview')==='partial';
  const loaded=await Promise.allSettled([readData(preview?'pilot-preview.json':'pilot.json'),readData('precipitation.json')]);
  vegetation=loaded[0].status==='fulfilled'?loaded[0].value:null;precipitation=loaded[1].status==='fulfilled'?loaded[1].value:null;
  if(!vegetation&&!precipitation)throw new Error('Ninguno de los archivos de observaciones está disponible.');
  $('#variable option[value="ndvi"]').disabled=!vegetation;$('#variable option[value="evi"]').disabled=!vegetation;$('#variable option[value="precip"]').disabled=!precipitation;
  if(!vegetation)state.variable='precip';$('#variable').value=state.variable;
  if(!vegetation||!precipitation){$('#error').hidden=false;$('#error').textContent='Una fuente no pudo cargarse y quedó deshabilitada. El análisis usa únicamente el archivo real disponible. No se creó una serie de reemplazo.';}
  for(const id of ['start-year','end-year'])$('#'+id).innerHTML=Array.from({length:11},(_,i)=>`<option value="${2015+i}">${2015+i}</option>`).join('');$('#start-year').value=2015;$('#end-year').value=2025;
  $('#app').hidden=false;update();setView(new URL(location.href).searchParams.get('view')||'explore');
  map=mountMap($('#map'),{lat:-25,lon:-63,resolutionLabel:resolution(),product:rain()?'GPM IMERG vía NASA POWER':'MOD13Q1'});
}catch(error){$('#loading').hidden=true;$('#data-badge').textContent='Archivo no disponible';$('#error').hidden=false;$('#error').textContent=`No pudimos abrir la evidencia. ${error.message} No se reemplazaron datos por una simulación.`;console.error(error);}}
start();
