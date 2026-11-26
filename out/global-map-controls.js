import {areaFromCorners,wrapLongitude} from './global-geography.js';
export let selectedArea=null;
let rectangle,activeMap,draw=false,first=null;
const $=id=>document.getElementById(id);
export function clearArea(){selectedArea=null;first=null;draw=false;if(rectangle){rectangle.remove();rectangle=null;}if($('area-status'))$('area-status').textContent='Arrastrá para recorrer el mapa. Tocá un punto para ubicar la consulta.';if($('load'))$('load').textContent='Consultar punto seleccionado';if($('draw-area')){$('draw-area').textContent='Delimitar zona';$('draw-area').setAttribute('aria-pressed','false');}}
export function setupMapControls(L,map,onSelect){
  activeMap=map;
  const note=message=>$('area-status').textContent=message;
  const applyArea=area=>{
    if(rectangle)rectangle.remove();selectedArea=area;
    rectangle=L.rectangle([[area.south,area.west],[area.north,area.east]],{color:'#edb856',weight:2,fillOpacity:.12,interactive:false}).addTo(map);
    draw=false;first=null;$('draw-area').textContent='Delimitar zona';$('draw-area').setAttribute('aria-pressed','false');
    onSelect(area.center.lat,area.center.lon,'Zona seleccionada',true);
    note(`Zona elegida: ${area.south.toFixed(3)}° a ${area.north.toFixed(3)}° de latitud. La consulta analizará toda la zona ponderando las celdas por superficie. Clima: hasta 400 celdas. MODIS: hasta 5.000 km², dividido en hasta 32 bloques recuperables.`);
  };
  $('draw-area').onclick=()=>{if(draw){clearArea();onSelect(Number($('latitude').value),Number($('longitude').value));return;}clearArea();onSelect(Number($('latitude').value),Number($('longitude').value));draw=true;$('draw-area').textContent='Cancelar delimitación';$('draw-area').setAttribute('aria-pressed','true');note('Tocá una esquina y después la esquina opuesta de la zona. Podés mover y acercar el mapa entre ambos toques.');};
  $('clear-area').onclick=()=>{clearArea();onSelect(Number($('latitude').value),Number($('longitude').value),'Punto personalizado');};
  $('world-view').onclick=()=>map.setView([12,5],2);
  $('selected-point').onclick=()=>map.setView([Number($('latitude').value),Number($('longitude').value)],Math.max(6,map.getZoom()));
  $('expand-map').onclick=()=>{const expanded=$('map-shell').classList.toggle('expanded');$('expand-map').textContent=expanded?'Cerrar mapa ampliado':'Ampliar mapa';$('expand-map').setAttribute('aria-expanded',String(expanded));document.body.style.overflow=expanded?'hidden':'';requestAnimationFrame(()=>map.invalidateSize());};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if($('map-shell').classList.contains('expanded'))$('expand-map').click();if(draw)clearArea();}});
  map.on('click',event=>{
    const p=event.latlng.wrap();$('preset').value='';
    if(draw){if(!first){first=p;note('Primera esquina lista. Tocá la esquina opuesta.');}else{try{applyArea(areaFromCorners(first,p));}catch(e){note(e.message);}}return;}
    let keep=false;if(selectedArea){const lon=selectedArea.west+((p.lng-selectedArea.west)%360+360)%360;keep=p.lat>=selectedArea.south&&p.lat<=selectedArea.north&&lon<=selectedArea.east;}
    if(keep){note('La zona sigue seleccionada. Analizar zona consulta todo el rectángulo; quitá la zona para consultar sólo un punto.');return;}clearArea();onSelect(p.lat,p.lng,'Punto elegido en el mapa');
  });
  $('search-place').onclick=async()=>{
    const query=$('place-query').value.trim();if(query.length<2){$('search-status').textContent='Escribí un lugar, por ejemplo Córdoba, Argentina.';return;}
    $('search-place').disabled=true;$('search-results').replaceChildren();$('search-status').textContent='Buscando lugares…';
    try{const response=await fetch('/api/places?'+new URLSearchParams({q:query}));const p=await response.json();if(!response.ok)throw new Error(p.error);
      $('search-status').textContent=p.results.length?'Elegí el resultado que corresponda.':'Sin coincidencias. Probá una ciudad cercana o elegí el punto en el mapa.';
      p.results.forEach(place=>{const b=document.createElement('button');b.type='button';b.textContent=[place.name,place.admin,place.country].filter(Boolean).join(' · ');b.onclick=()=>{clearArea();$('preset').value='';onSelect(place.lat,place.lon,b.textContent);map.setView([place.lat,place.lon],10);$('map-layer').value='streets';$('map-layer').dispatchEvent(new Event('change'));$('search-results').replaceChildren();$('search-status').textContent='Lugar ubicado. Elegí un punto o delimitá una zona alrededor.';};$('search-results').append(b);});
    }catch(e){$('search-status').textContent=e.message||'No se pudo buscar el lugar.';}finally{$('search-place').disabled=false;}
  };
  const params=new URLSearchParams(location.search);if(['south','north','west','east'].every(k=>params.has(k))){try{const a=areaFromCorners({lat:Number(params.get('south')),lng:Number(params.get('west'))},{lat:Number(params.get('north')),lng:Number(params.get('east'))});applyArea(a);map.fitBounds([[a.south,a.west],[a.north,a.east]]);}catch(e){note(e.message);}}
  $('place-query').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('search-place').click();}});
}
