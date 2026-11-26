const $=id=>document.getElementById(id);
function saved(k){try{return localStorage.getItem(k);}catch{return null;}}
function save(k,v){try{localStorage.setItem(k,v);}catch{}}
function applyTheme(theme){document.documentElement.dataset.theme=theme;$('theme-toggle').textContent=theme==='dark'?'☀ Claro':'☾ Oscuro';$('theme-toggle').setAttribute('aria-label',theme==='dark'?'Activar modo claro':'Activar modo oscuro');save('terramind-theme',theme);}
applyTheme(saved('terramind-theme')||((matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'));
$('theme-toggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function applyMode(mode){if(mode==='lite'&&$('quality')&&$('quality').value!=='strict'){$('quality').value='strict';$('quality').dispatchEvent(new Event('change'));}document.documentElement.dataset.experience=mode;document.querySelectorAll('[data-experience-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.experienceChoice===mode)));$('mode-description').textContent=mode==='lite'?'Lite · explorá los resultados esenciales. Calidad y límites siempre visibles.':'Pro · revisá cobertura, filtros QA, datos y trazabilidad de cada consulta.';save('terramind-experience',mode);}
applyMode(saved('terramind-experience')==='pro'?'pro':'lite');
document.querySelectorAll('[data-experience-choice]').forEach(b=>b.onclick=()=>applyMode(b.dataset.experienceChoice));
$('open-pro').onclick=()=>{applyMode('pro');document.querySelector('details.professional').open=true;document.querySelector('details.professional').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
const last=saved('terramind-last-zone');if(last?.startsWith('?')){$('resume-zone').href=last;$('resume-zone').hidden=false;}
export function saveSelection(query){save('terramind-last-zone','?'+query+'#explorer');}
export function progress(p){const panel=$('job-progress');panel.hidden=false;$('job-meter').max=p.total||1;$('job-meter').value=p.done||0;$('job-count').textContent=`${p.done} / ${p.total} bloques`;$('job-detail').textContent=`${p.reused||0} recuperados · ${p.failed||0} pendientes${p.retrying?' · reintentando '+p.retrying:''}`;}
export function coverageStrip(result,isArea,variable){
  $('coverage-bars').replaceChildren();
  for(const row of result.series){const value=isArea?(row.coverage??row[variable+'Coverage']??0):(row.accepted?1:0);const bar=document.createElement('span');bar.style.height=Math.max(3,Math.min(100,value*100))+'%';bar.className=value>=.95?'good':value>0?'partial':'missing';bar.title=`${row.date}: ${(100*value).toFixed(1)}%${isArea?' de superficie válida':' · estado de calidad'}`;$('coverage-bars').append(bar);}
  $('coverage-caption').textContent=isArea?'Porcentaje de superficie válida en cada fecha. Los huecos no son ceros ambientales.':'Cada barra indica si la observación pasó el filtro de calidad. No representa cobertura regional.';
}
