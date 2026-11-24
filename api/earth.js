// Fixed upstreams only: no credentials, arbitrary proxy URLs, or generated observations.
export function sourceURL(query) {
  const lat = Number(query.lat), lon = Number(query.lon);
  if (!query.lat?.trim() || !query.lon?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('Coordenadas inválidas.');
  if (query.kind === 'climate') {
    return 'https://power.larc.nasa.gov/api/temporal/monthly/point?' + new URLSearchParams({parameters:'PRECTOTCORR,T2M',community:'AG',latitude:String(lat),longitude:String(lon),start:'2015',end:'2025',format:'JSON'});
  }
  if (query.kind === 'dates') return 'https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?' + new URLSearchParams({latitude:String(lat),longitude:String(lon)});
  if (query.kind === 'vegetation') {
    if (![query.start,query.end].every(v=>/^A20\d{2}\d{3}$/.test(v||''))) throw new Error('Fechas MODIS inválidas.');
    const date = s => Date.UTC(Number(s.slice(1,5)),0,Number(s.slice(5)));
    const span = (date(query.end)-date(query.start))/86400000;
    if(span<0 || span>144) throw new Error('Solicitá hasta diez compuestos por lote.');
    const above=Number(query.kmAboveBelow??0),across=Number(query.kmLeftRight??0);
    if(![above,across].every(n=>Number.isInteger(n)&&n>=0&&n<=5))throw new Error('Recorte MODIS fuera del límite de 5 km por lado.');
    return 'https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?' + new URLSearchParams({latitude:String(lat),longitude:String(lon),startDate:query.start,endDate:query.end,kmAboveBelow:String(above),kmLeftRight:String(across)});
  }
  throw new Error('Fuente no admitida.');
}
export default async function handler(req,res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end(JSON.stringify({error:'Método no admitido.'}));}
  let url;
  try { url=sourceURL(Object.fromEntries(new URL(req.url,'http://localhost').searchParams)); }
  catch(e){res.statusCode=400;return res.end(JSON.stringify({error:e.message}));}
  try {
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(50000)});
    if(!response.ok) throw new Error(`NASA respondió HTTP ${response.status}.`);
    const raw=await response.text();
    const payload=JSON.parse(raw);
    if(payload.messages?.some?.(x=>/error/i.test(x))) throw new Error('NASA no entregó una serie válida.');
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=3600');
    res.end(JSON.stringify({url,retrievedAt:new Date().toISOString(),raw,payload}));
  } catch(e) {
    res.statusCode=502;
    res.setHeader('Cache-Control','no-store');
    res.end(JSON.stringify({error:'No se pudo consultar esta fuente NASA. Reintentá en unos minutos. No se reemplazaron los datos por simulaciones.',detail:e.message}));
  }
}
