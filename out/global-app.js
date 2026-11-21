import {PRESETS,coordinates,parseClimate,parseVegetation,climateAnalysis,vegetationAnalysis} from './global-data.js';
import {renderChart,escapeHtml as esc,formatNumber as fmt,formatP} from './evidence-charts.js';
const $=id=>document.getElementById(id);
let site=null,climate=null,vegetation=null,receipts=[],result=null,chart=null,mode='series',controller=null,generation=0,map,marker;
const cache=new Map();
const label={temp:'Temperatura',precip:'Precipitación',ndvi:'NDVI',evi:'EVI'};
const climateVariable=()=>['temp','precip'].includes($('indicator').value);
function status(message,error=false,target='status'){$(target).textContent=message;$(target).classList.toggle('error',error);}
function busy(value){$('load').disabled=value;$('cancel').hidden=!value;}
function invalidate(){generation++;controller?.abort();controller=null;busy(false);site=null;result=null;climate=null;vegetation=null;receipts=[];$('results').hidden=true;$('analysis').hidden=true;}
function choose(lat,lon,name='Coordenadas personalizadas'){
  invalidate();const point=coordinates(lat,lon);$('latitude').value=point.lat;$('longitude').value=point.lon;
  $('selection').textContent=`${name} · ${point.lat}, ${point.lon}`;
  if(marker)marker.setLatLng([point.lat,point.lon]);
  status('Ubicación elegida. Consultá NASA para cargar la evidencia de este punto.');
}
PRESETS.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.name;$('preset').append(o);});$('preset').value='0';
for(let y=2015;y<=2025;y++)for(const id of ['start','end']){const o=document.createElement('option');o.value=y;o.textContent=y;$(id).append(o);}$('end').value='2025';
$('preset').addEventListener('change',()=>{const p=PRESETS[$('preset').value];if(p){choose(p.lat,p.lon,p.name);map?.setView([p.lat,p.lon],4);}});
for(const id of ['latitude','longitude'])$(id).addEventListener('input',()=>{invalidate();$('preset').value='';$('selection').textContent='Coordenadas modificadas · consulta pendiente';status('Consultá de nuevo para analizar las coordenadas ingresadas.');});
async function get(kind,params,signal){
  const response=await fetch('/api/earth?'+new URLSearchParams({kind,lat:site.lat,lon:site.lon,...params}),{signal});
  const body=await response.json();if(!response.ok)throw new Error(body.error||'La fuente no respondió.');
  if(!body.payload||typeof body.raw!=='string'||!body.url.startsWith('https://'))throw new Error('Respuesta de procedencia inválida.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.raw));
  return {...body,kind,sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
async function loadSource(){
  if(!site)return;
  const kind=climateVariable()?'climate':'vegetation';
  if(kind==='climate'?climate:vegetation){render();return;}
  const key=`${site.lat},${site.lon},${kind}`;
  if(cache.has(key)){const saved=cache.get(key);if(kind==='climate')climate=saved.rows;else vegetation=saved.rows;receipts.push(...saved.receipts);render();return;}
  controller?.abort();const token=++generation;controller=new AbortController();const signal=controller.signal;
  $('analysis').hidden=true;result=null;busy(true);$('export').disabled=true;
  status(kind==='climate'?'Consultando once años de clima NASA POWER…':'Consultando disponibilidad MODIS. Puede demorar unos minutos…',false,'source-status');
  try{
    let rows,used=[];
    if(kind==='climate'){
      const response=await get(kind,{},signal);if(token!==generation)return;
      rows=parseClimate(response.payload,site);used=[response];
      if(!rows.some(r=>r.temp!==null||r.precip!==null))throw new Error('NASA no entregó valores climáticos válidos en esta ubicación.');
      climate=rows;
    }else{
      const response=await get('dates',{},signal);if(token!==generation)return;
      const dates=(response.payload.dates||[]).filter(d=>/^A20\d{5}$/.test(d.modis_date)&&d.modis_date>='A2015001'&&d.modis_date<='A2025365').map(d=>d.modis_date).sort();
      if(!dates.length)throw new Error('No hay compuestos MODIS terrestres disponibles para esta coordenada en 2015–2025. Probá otro lugar.');
      if(new Set(dates).size!==dates.length)throw new Error('NASA devolvió fechas duplicadas.');
      used=[response];rows=[];
      // Respect the ten-date limit AND the maximum span even when acquisitions have gaps.
      const batches=[];let batch=[];
      const stamp=d=>Date.UTC(Number(d.slice(1,5)),0,Number(d.slice(5)));
      for(const d of dates){if(batch.length&&(batch.length===10||stamp(d)-stamp(batch[0])>144*86400000)){batches.push(batch);batch=[];}batch.push(d);}if(batch.length)batches.push(batch);
      for(let i=0;i<batches.length;i++){
        status(`Vegetación MODIS · lote ${i+1} de ${batches.length}. Descargando valores y banderas de calidad…`,false,'source-status');
        const block=await get(kind,{start:batches[i][0],end:batches[i].at(-1)},signal);if(token!==generation)return;
        const parsed=parseVegetation(block.payload,site);
        const allowed=new Set(batches[i].map(d=>new Date(stamp(d)).toISOString().slice(0,10)));
        if(parsed.some(r=>!allowed.has(r.date)))throw new Error('NASA devolvió fechas fuera del lote solicitado.');
        rows.push(...parsed);used.push(block);
      }
      if(new Set(rows.map(r=>r.date)).size!==rows.length)throw new Error('La serie tiene compuestos duplicados.');
      vegetation=rows;
    }
    if(token!==generation)return;
    receipts.push(...used);cache.set(key,{rows,receipts:used});if(cache.size>10)cache.delete(cache.keys().next().value);
    status('Datos recibidos de NASA para la ubicación indicada. Las respuestas originales se incluyen en el expediente.');render();
  }catch(error){
    if(token!==generation)return;
    status(signal.aborted?'Consulta cancelada. Podés reintentar o elegir otro indicador.':error.message,true,'source-status');
    const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar esta fuente';retry.style.marginLeft='14px';retry.addEventListener('click',loadSource);$('source-status').append(retry);
  }finally{if(token===generation){busy(false);$('export').disabled=!receipts.length;}}
}
$('location-form').addEventListener('submit',event=>{
  event.preventDefault();let point;try{point=coordinates($('latitude').value,$('longitude').value);}catch(e){status(e.message,true);return;}
  invalidate();site={...point,name:PRESETS[$('preset').value]?.name||'Punto personalizado'};
  $('place-title').textContent=site.name;$('place-detail').textContent=`${site.lat}°, ${site.lon}° · Consulta puntual · 2015–2025`;
  $('results').hidden=false;marker?.setLatLng([site.lat,site.lon]);
  history.replaceState(null,'',`?lat=${site.lat}&lon=${site.lon}#explorer`);
  loadSource();
});
$('cancel').addEventListener('click',()=>controller?.abort());
$('indicator').addEventListener('change',()=>{controller?.abort();generation++;busy(false);$('analysis').hidden=true;result=null;loadSource();});
for(const id of ['start','end','quality'])$(id).addEventListener('change',render);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>{const selected=x===b;x.classList.toggle('active',selected);x.setAttribute('aria-pressed',String(selected));});render();}));
function render(){
  if(!site)return;const variable=$('indicator').value,isClimate=climateVariable(),start=Number($('start').value),end=Number($('end').value);
  $('quality-label').hidden=isClimate;
  if(start>end){$('analysis').hidden=true;result=null;status('El año inicial debe ser menor o igual al final.',true,'source-status');return;}
  if(!(isClimate?climate:vegetation))return;
  result=isClimate?climateAnalysis(climate,variable,start,end):vegetationAnalysis(vegetation,variable,start,end,$('quality').value);
  $('analysis').hidden=false;$('export').disabled=false;
  const unit=variable==='temp'?'°C':variable==='precip'?'mm':'índice';
  const source=isClimate?'NASA POWER · MERRA‑2 · reanálisis mensual':'NASA / ORNL DAAC · MOD13Q1 · compuestos de 16 días';
  status(isClimate?'Datos reales de reanálisis MERRA‑2. No son mediciones locales ni GPM IMERG. La disponibilidad mensual no equivale a calidad observacional.':`${result.quality.accepted} de ${result.quality.total} compuestos aceptados por QA. Colección no verificada individualmente contra CMR; no se asume una versión.`,false,'source-status');
  const trend=result.trend;
  const significance=trend.eligible?(trend.significant?'Señal exploratoria':'Sin evidencia concluyente'):'Evidencia insuficiente';
  const items=[['Qué medimos',label[variable],isClimate?'Serie mensual 2015–2025; elegí el período que querés revisar.':'Verdor de la vegetación. No diagnostica pérdida de bosque.'],['Dónde',`${site.lat}°, ${site.lon}°`,isClimate?'Una celda de grilla 0,5° × 0,625° nominales.':'Una celda MODIS de 250 m nominales.'],['Cuánto',Number.isFinite(trend.slope)?`${fmt(trend.slope,3)} ${unit}/año`:'No estimable','Pendiente de Sen sobre resúmenes anuales aptos.'],['¿Es significativo?',significance,trend.eligible?`p = ${formatP(trend.pValue)} · ${trend.n} años aptos. Exploratorio, sin ajuste por múltiples consultas.`:trend.reason]];
  $('findings').innerHTML=items.map(([title,value,note])=>`<article class="finding"><span>${esc(title)}</span><strong>${esc(value)}</strong><p>${esc(note)}</p></article>`).join('');
  document.querySelector('.chart-key').innerHTML=mode==='annual'?'<span>━━ Resumen anual apto</span><span>┄ Pendiente de Sen</span><span>× Año no apto</span>':mode==='anomaly'?'<span>Verde: sobre la referencia</span><span>Ámbar: bajo la referencia</span><span>× Ausente o excluido</span>':'<span>━━ Valores aceptados</span><span>┄ Referencia 2015–2020</span><span>× Ausente o excluido</span>';
  $('chart-source').textContent=source;$('global-chart-heading').textContent=`${label[variable]} · ${start}–${end}`;
  chart=renderChart($('chart'),result,mode,{description:`${source}. Coordenada ${site.lat}, ${site.lon}. ${start}–${end}. No es un promedio regional. Huecos conservados.`,onFocus:row=>{$('readout').textContent=`${row.date} · ${fmt(row.displayValue,variable==='precip'?1:3)} ${unit}${row.accepted?'':' · Ausente o excluido'}${mode==='anomaly'?' de anomalía':''}`;}});
  $('cursor').max=Math.max(0,chart.rows.length-1);$('cursor').value='0';chart.focus(0);
  const sourceReceipts=receipts.filter(r=>r.kind===(isClimate?'climate':'vegetation'));
  $('professional').innerHTML=`<p><b>${esc(source)}</b><br>${esc(trend.reason)}</p><p>${isClimate?'Años aptos: doce meses válidos. Temperatura anual ponderada por días. Lluvia mensual derivada del promedio diario, anual sumada. POWER no entrega QA por observación en esta consulta.':'Filtro QA MODIS antes del análisis; años con ≥80% de cobertura nominal y presencia en los cuatro trimestres estacionales. El filtro ampliado es una prueba de sensibilidad.'} No se atribuyen causas. No se combinan celdas de diferente resolución.</p><p>Recuperado: ${esc(sourceReceipts[0]?.retrievedAt||'Sin fecha')} · ${sourceReceipts.length} respuestas originales. Hash SHA‑256 incluido en el expediente.</p><p>Fuente informada en la respuesta: ${esc(isClimate?JSON.stringify(sourceReceipts[0]?.payload?.header?.sources||[]):'MOD13Q1; conservar metadatos de cada respuesta.')}</p><p><a href="${esc(sourceReceipts[0]?.url||'#')}" target="_blank" rel="noopener">Repetir la primera consulta a NASA</a></p>`;
  $('rows').innerHTML=result.series.map(r=>`<tr><td>${r.date}</td><td>${esc(fmt(r.value,3))}</td><td>${r.accepted?'Aceptado':esc(r.reason||'Ausente o excluido')}</td><td>${esc(fmt(r.anomaly,3))}</td></tr>`).join('');
}
$('cursor').addEventListener('input',()=>chart?.focus($('cursor').value));
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('export').addEventListener('click',()=>{if(!site||!receipts.length)return;download(`terramind-${site.lat}-${site.lon}.json`,JSON.stringify({schemaVersion:1,kind:'NASA-real-data-point-query',site,exportedAt:new Date().toISOString(),analysis:result,limitations:['Point query, not regional aggregation','Climate: MERRA-2, not IMERG','MODIS collection not individually verified with CMR','No causal attribution; no operational predictions'],receipts},null,2),'application/json');});
$('csv').addEventListener('click',()=>{if(!result)return;const rows=['latitude,longitude,variable,date,value,accepted,anomaly',...result.series.map(r=>[site.lat,site.lon,result.variable,r.date,r.value??'',r.accepted,r.anomaly??''].join(','))];download(`terramind-${site.lat}-${site.lon}-${result.variable}.csv`,rows.join('\n'),'text/csv');});
async function loadMap(){
  try{
    await Promise.all([new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='anonymous';css.onload=resolve;css.onerror=reject;document.head.append(css);}),new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous';script.onload=resolve;script.onerror=reject;document.head.append(script);})]);
    const L=window.L;map=L.map('world-map',{scrollWheelZoom:false,worldCopyJump:true,minZoom:1,maxZoom:8}).setView([12,5],2);
    const tiles=L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',{maxZoom:8,attribution:'Imagery © NASA GIBS / Blue Marble'}).addTo(map);
    let errors=0;tiles.on('tileerror',()=>{if(++errors===3)document.querySelector('.map-note').textContent='El fondo NASA no está disponible. Podés seguir consultando por coordenadas; no se muestran imágenes sustitutas.';});
    marker=L.marker([Number($('latitude').value),Number($('longitude').value)],{icon:L.divIcon({className:'global-marker',iconSize:[16,16],iconAnchor:[8,8]}),keyboard:false}).addTo(map);
    if($('preset').value!=='0')map.setView([Number($('latitude').value),Number($('longitude').value)],4);
    map.on('click',event=>{const wrapped=event.latlng.wrap();$('preset').value='';choose(wrapped.lat,wrapped.lng);});
  }catch{$('world-map').innerHTML='<p class="map-failure">No se pudo cargar el mapa. Usá las coordenadas o los lugares de ejemplo para consultar NASA.</p>';}
}
const initial=new URLSearchParams(location.search);
if(initial.has('lat')&&initial.has('lon'))try{choose(initial.get('lat'),initial.get('lon'));$('preset').value='';}catch(e){status(e.message,true);}
loadMap();
