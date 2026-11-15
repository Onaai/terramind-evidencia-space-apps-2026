// TerraMind Evidencia. Original chart implementation, 14 November 2026.
const df = new Intl.DateTimeFormat('es-AR', {day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const formatNumber = (value, digits=3) => Number.isFinite(value) ? new Intl.NumberFormat('es-AR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value) : 'No disponible';
export const formatP = value => Number.isFinite(value) ? value < .0001 ? '<0,0001' : formatNumber(value,4) : 'No informado';
export const formatDate = value => df.format(new Date(value+'T00:00:00Z'));
function median(a){const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length?s.length%2?s[m]:(s[m-1]+s[m])/2:null;}
export function chartRows(result, mode){return mode==='annual'?result.annual.map(r=>({...r,date:`${r.year}-01-01`,displayValue:r.value,referenceValue:null})):result.series.map(r=>({...r,displayValue:mode==='anomaly'?r.anomaly:r.accepted?r.value:null}));}
export function lineSegments(rows, value, x, y){const chunks=[];let part=[];for(let i=0;i<rows.length;i++){const v=value(rows[i]);if(Number.isFinite(v)){part.push([x(i),y(v)]);}else if(part.length){chunks.push(part);part=[];}}if(part.length)chunks.push(part);return chunks;}
export function renderChart(container,result,mode,{onFocus=()=>{}}={}){
  const rows=chartRows(result,mode),W=780,H=306,L=48,R=18,T=23,B=39,PW=W-L-R,PH=H-T-B;
  const values=rows.map(r=>r.displayValue).filter(Number.isFinite),rain=result.variable==='precip',label=rain?'Precipitación':result.variable.toUpperCase();
  let min=0,max=1;
  if(mode==='anomaly'){const lim=Math.max(rain?10:.1,...values.map(Math.abs));max=rain?Math.ceil(lim/50)*50:Math.ceil(lim*10)/10;min=-max;}
  else if(rain)max=Math.max(100,Math.ceil(Math.max(0,...values,...rows.map(r=>r.referenceValue).filter(Number.isFinite))/100)*100);
  else if(values.some(v=>v<0))min=-.2;
  const x=i=>L+(rows.length===1?PW/2:i*PW/(rows.length-1)),y=v=>T+PH*(1-(v-min)/(max-min));
  const title=mode==='annual'?(rain?'Precipitación acumulada anual':'Resumen anual ponderado'):mode==='anomaly'?'Anomalía frente al mismo intervalo del año en 2015–2020':rain?'Precipitación acumulada mensual':'Observaciones nativas de 16 días';
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${escapeHtml(result.variable.toUpperCase())}: ${title}</title><desc id="chart-description">Datos reales MOD13Q1 de un píxel, −25°, −63°. ${result.startYear} a ${result.endYear}. Los huecos indican observaciones excluidas o referencia insuficiente. La tabla de revisión científica contiene los valores.</desc><defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5b9a6d" stop-opacity=".17"/><stop offset="1" stop-color="#5b9a6d" stop-opacity="0"/></linearGradient></defs>`;
  for(let k=0;k<=5;k++){const v=min+(max-min)*k/5,yy=y(v);svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${Math.abs(v)<1e-9?'#b8c8b2':'#e9eee5'}" stroke-width="1"/><text x="${L-9}" y="${yy+4}" text-anchor="end" font-size="11" fill="#889580">${formatNumber(v,mode==='anomaly'?2:1)}</text>`;}
  svg=svg.replace('Datos reales MOD13Q1 de un píxel','Datos reales '+(rain?'GPM IMERG vía NASA POWER de una celda':'MOD13Q1 de un píxel'));
  svg+=`<text x="${L}" y="12" font-size="12" fill="#7c8b73">${mode==='anomaly'?'Δ ':''}${label} · ${rain?'mm':'adimensional'}</text>`;
  if(mode==='series'){
    for(const chunk of lineSegments(rows,r=>r.referenceValue,x,y)){svg+=`<path d="${chunk.map((p,j)=>`${j?'L':'M'}${p.join(',')}`).join(' ')}" fill="none" stroke="#aabca0" stroke-dasharray="4 4" stroke-width="1.4"/>`;}
  }
  if(mode==='anomaly'||(rain&&mode==='series')){
    const bw=Math.max(1,PW/rows.length*.8);rows.forEach((r,i)=>{if(Number.isFinite(r.displayValue)){const yy=y(r.displayValue);svg+=`<rect x="${x(i)-bw/2}" y="${Math.min(yy,y(0))}" width="${bw}" height="${Math.max(1,Math.abs(yy-y(0)))}" fill="${r.displayValue>=0?'#4a8b65':'#c99357'}" opacity=".86"/>`;}});
  }else{
    for(const chunk of lineSegments(rows,r=>r.displayValue,x,y)){
      const d=chunk.map((p,j)=>`${j?'L':'M'}${p.join(',')}`).join(' ');
      if(mode==='series'&&chunk.length>1)svg+=`<path d="${d} L${chunk.at(-1)[0]},${y(min)} L${chunk[0][0]},${y(min)} Z" fill="url(#area-fill)"/>`;
      svg+=`<path d="${d}" fill="none" stroke="#337a58" stroke-width="${mode==='annual'?2.4:1.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    rows.forEach((r,i)=>{if(Number.isFinite(r.displayValue))svg+=`<circle cx="${x(i)}" cy="${y(r.displayValue)}" r="${mode==='annual'?4.5:1.5}" fill="#337a58"${mode==='annual'?' stroke="white" stroke-width="2"':''}/>`;});
    if(mode==='annual'&&Number.isFinite(result.trend.slope)){
      const accepted=rows.filter(r=>r.accepted),intercept=median(accepted.map(r=>r.value-result.trend.slope*r.year));
      if(accepted.length>1){const first=rows.indexOf(accepted[0]),last=rows.indexOf(accepted.at(-1));svg+=`<line x1="${x(first)}" x2="${x(last)}" y1="${y(intercept+result.trend.slope*rows[first].year)}" y2="${y(intercept+result.trend.slope*rows[last].year)}" stroke="#a6844f" stroke-width="1.6" stroke-dasharray="6 4"/>`;}
    }
  }
  rows.forEach((r,i)=>{if(!r.accepted){const yy=mode==='series'&&Number.isFinite(r.value)&&r.value>=min&&r.value<=max?y(r.value):T+PH-5;svg+=`<path d="M${x(i)-2.1},${yy-2.1}l4.2,4.2m0,-4.2l-4.2,4.2" stroke="#bf965f" stroke-width="1" opacity=".7"/>`;}});
  const labels=mode==='annual'?rows.map((r,i)=>({year:r.year,index:i})):rows.filter(r=>r.slot===0).map(r=>({year:r.year,index:rows.indexOf(r)}));
  const step=Math.max(1,Math.ceil(labels.length/6));labels.forEach((r,i)=>{if(i%step===0||i===labels.length-1)svg+=`<text x="${x(r.index)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#7e8e76">${r.year}</text>`;});
  svg+=`<line id="chart-guide" x1="${L}" x2="${L}" y1="${T}" y2="${T+PH}" stroke="#8bab79" stroke-dasharray="3 3" opacity="0"/>`;
  rows.forEach((r,i)=>{const step=PW/Math.max(1,rows.length-1);svg+=`<rect data-index="${i}" x="${Math.max(L,x(i)-step/2)}" y="${T}" width="${Math.min(step,W-R-Math.max(L,x(i)-step/2))}" height="${PH}" fill="transparent"/>`;});
  if(!values.length)svg+=`<rect x="${L+30}" y="${T+PH/2-27}" width="${PW-60}" height="54" rx="6" fill="#f5f7f0"/><text x="${L+PW/2}" y="${T+PH/2+4}" text-anchor="middle" font-size="13" fill="#6c8061">No hay valores aptos para este gráfico.</text>`;
  svg+='</svg>';svg=svg.replaceAll('font-size="11"','font-size="13"');container.innerHTML=svg;
  function focus(index){const i=Math.max(0,Math.min(rows.length-1,Number(index)||0)),guide=container.querySelector('#chart-guide');guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('opacity','.8');onFocus(rows[i],i,mode);}
  container.querySelector('svg').addEventListener('pointermove',e=>{const hit=e.target.closest('[data-index]');if(hit)focus(Number(hit.dataset.index));});
  return {rows,focus,svg:()=>container.querySelector('svg').outerHTML};
}
