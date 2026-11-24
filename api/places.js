export function geocodingURL(name){
  if(typeof name!=='string'||name.trim().length<2||name.length>100)throw new Error('Escribí entre 2 y 100 caracteres.');
  return 'https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:name.trim(),count:'6',language:'es',format:'json'});
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'Método no admitido.'}));}
  let url;try{url=geocodingURL(new URL(req.url,'http://localhost').searchParams.get('q'));}catch(e){res.statusCode=400;return res.end(JSON.stringify({error:e.message}));}
  try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const p=await r.json();res.setHeader('Cache-Control','public, s-maxage=86400');res.end(JSON.stringify({results:(p.results||[]).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).map(x=>({name:x.name,admin:x.admin1||'',country:x.country||'',lat:x.latitude,lon:x.longitude})),source:'Open-Meteo / GeoNames'}));}
  catch{res.statusCode=502;res.end(JSON.stringify({error:'La búsqueda no respondió. Podés elegir un punto en el mapa o ingresar coordenadas.'}));}
}
