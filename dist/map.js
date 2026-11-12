/** Offline geographical map. Administrative geometry: Natural Earth, public domain.
 * AOI rectangles are illustrative sampling windows, not biome boundaries.
 * WGS84 coordinates; regional equirectangular display with cos(26°) correction.
 */
const NS = 'http://www.w3.org/2000/svg';
export const MAP_AREAS = [
  { id: 'seco', label: 'Chaco seco', bbox: [-63.5, -25.5, -62.5, -24.5], number: '01' },
  { id: 'transicion', label: 'Transición', bbox: [-61.5, -26.5, -60.5, -25.5], number: '02' },
  { id: 'humedo', label: 'Chaco húmedo', bbox: [-59.5, -26.5, -58.5, -25.5], number: '03' },
];
const COLORS = { ndvi: '#61e4af', evi: '#9bdfa7', precip: '#79c8f5', hotspots: '#ffb77a', soil: '#baa5f8' };
const project = ([lon, lat]) => [400 + (lon + 60.5) * 58, 230 + (-25.75 - lat) * 64.5];
function node(tag, attrs = {}, text) {
  const result = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => result.setAttribute(key, value));
  if (text !== undefined) result.textContent = text;
  return result;
}
function geometryPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.flatMap(polygon => polygon.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(v => v.toFixed(2)).join(',')}`).join('') + 'Z')).join('');
}

export function createMap(container, { onSelect = () => {} } = {}) {
  container.replaceChildren();
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.background = '#101e25';
  container.style.minHeight = '0';
  const svg = node('svg', { viewBox: '0 0 800 460', preserveAspectRatio: 'xMidYMid slice', width: '100%', height: '100%', tabindex: '0', role: 'group', 'aria-label': 'Mapa regional del Gran Chaco argentino. Usá las flechas para desplazar, más y menos para acercar y alejar. Seleccioná una de las tres áreas de ejemplo.' });
  svg.style.cssText = 'display:block;min-height:0;touch-action:none;cursor:grab;outline-offset:-4px;position:absolute;inset:0;font-family:inherit';
  const defs = node('defs');
  const pattern = node('pattern', { id: 'tm-map-grain', width: '9', height: '9', patternUnits: 'userSpaceOnUse' });
  pattern.append(node('circle', { cx: '1', cy: '1', r: '.55', fill: '#94b6b5', opacity: '.065' }));
  defs.append(pattern);
  svg.append(defs, node('rect', { width: '800', height: '460', fill: '#101e25' }));
  const world = node('g');
  svg.append(world);
  const countries = node('g', { 'aria-hidden': 'true' });
  const provinces = node('g', { 'aria-hidden': 'true' });
  const grid = node('g', { 'aria-hidden': 'true' });
  for (let lon = -70; lon <= -50; lon += 2) {
    const [x] = project([lon, -26]);
    grid.append(node('line', { x1: x, y1: -400, x2: x, y2: 900, stroke: '#91b9bd', 'stroke-width': '.6', opacity: '.1', 'vector-effect': 'non-scaling-stroke' }));
  }
  for (let lat = -34; lat <= -18; lat += 2) {
    const [, y] = project([-61, lat]);
    grid.append(node('line', { x1: -400, y1: y, x2: 1200, y2: y, stroke: '#91b9bd', 'stroke-width': '.6', opacity: '.1', 'vector-effect': 'non-scaling-stroke' }));
  }
  world.append(countries, provinces, grid, node('rect', { x: '-400', y: '-400', width: '1600', height: '1300', fill: 'url(#tm-map-grain)', 'pointer-events': 'none' }));
  const labels = node('g', { 'aria-hidden': 'true' });
  const putLabel = (text, lon, lat, size = 11, color = '#7d979c', extra = {}) => {
    const [x, y] = project([lon, lat]);
    labels.append(node('text', { x, y, fill: color, 'font-size': size, 'letter-spacing': size > 12 ? '3' : '1.1', 'text-anchor': 'middle', ...extra }, text));
  };
  putLabel('ARGENTINA', -63.1, -28.65, 14, '#66867f');
  putLabel('PARAGUAY', -58.4, -23.6, 13, '#6f8992');
  putLabel('BOLIVIA', -64.1, -22.25, 12);
  putLabel('BRASIL', -55.3, -24, 12);
  putLabel('SALTA', -64.65, -24.4);
  putLabel('FORMOSA', -59.75, -24.9);
  putLabel('CHACO', -61.5, -27.35);
  putLabel('SANTIAGO', -63.4, -27.75, 9);
  putLabel('DEL ESTERO', -63.4, -27.95, 9);
  putLabel('CORRIENTES', -57.8, -28.25, 9);
  for (const city of [
    ['Salta', -65.41, -24.78, -7, -8, 'end'],
    ['Resistencia', -58.9867, -27.4514, 9, 15, 'start'],
    ['Formosa', -58.1781, -26.1849, 9, 4, 'start'],
    ['Asunción', -57.6359, -25.2637, 9, 4, 'start'],
  ]) {
    const [name, lon, lat, dx, dy, anchor] = city;
    const [x, y] = project([lon, lat]);
    labels.append(node('circle', { cx: x, cy: y, r: '2.3', fill: '#9bb1b4' }));
    labels.append(node('text', { x: x + dx, y: y + dy, fill: '#b1c4c7', 'font-size': '10', 'text-anchor': anchor, style: 'paint-order:stroke;stroke:#14262b;stroke-width:3px;stroke-linejoin:round' }, name));
  }
  world.append(labels);
  const samples = node('g');
  const areaNodes = new Map();
  MAP_AREAS.forEach(area => {
    const [west, south, east, north] = area.bbox;
    const [x, y] = project([west, north]);
    const [right, bottom] = project([east, south]);
    const group = node('g', { role: 'button', tabindex: '0', 'aria-label': `${area.label}. Ventana de muestra ilustrativa. ${Math.abs(west)} a ${Math.abs(east)} grados oeste, ${Math.abs(south)} a ${Math.abs(north)} grados sur.`, 'aria-pressed': 'false', 'data-area': area.id, style: 'cursor:pointer;outline:none' });
    group.append(node('title', {}, `${area.label}: área ilustrativa de 1° × 1°. No delimita una ecorregión.`));
    const outer = node('rect', { x: x - 5, y: y - 5, width: right - x + 10, height: bottom - y + 10, rx: '5', fill: 'none', stroke: '#61e4af', 'stroke-width': '1', opacity: '0', 'vector-effect': 'non-scaling-stroke' });
    const rect = node('rect', { x, y, width: right - x, height: bottom - y, rx: '2', fill: '#61e4af', 'fill-opacity': '.08', stroke: '#61e4af', 'stroke-opacity': '.48', 'stroke-width': '1.3', 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' });
    const cross = node('path', { d: `M${(x + right) / 2 - 6},${(y + bottom) / 2}h12M${(x + right) / 2},${(y + bottom) / 2 - 6}v12`, stroke: '#61e4af', 'stroke-width': '1.2', 'vector-effect': 'non-scaling-stroke', opacity: '.8' });
    const label = node('text', { x: (x + right) / 2, y: y - 13, 'text-anchor': 'middle', 'font-size': '11', 'font-weight': '600', fill: '#d3ece1', style: 'paint-order:stroke;stroke:#14262b;stroke-width:3px;stroke-linejoin:round' }, area.label);
    const number = node('text', { x: x + 7, y: bottom - 8, fill: '#61e4af', 'font-size': '9', opacity: '.9' }, area.number);
    group.append(outer, rect, cross, label, number);
    group.addEventListener('click', event => { if (event.detail === 0) { event.stopPropagation(); choose(area.id); } });
    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); choose(area.id); } });
    group.addEventListener('focus', () => outer.setAttribute('opacity', '1'));
    group.addEventListener('blur', () => outer.setAttribute('opacity', selection === area.id ? '.5' : '0'));
    areaNodes.set(area.id, { group, outer, rect, cross, number });
    samples.append(group);
  });
  world.append(samples);
  // HTML positioning keeps the compass in frame when the SVG is cropped on mobile.
  const compass = node('svg', { width: '22', height: '46', viewBox: '0 0 22 46', 'aria-hidden': 'true' });
  compass.style.cssText = 'position:absolute;right:16px;bottom:40px;pointer-events:none';
  compass.append(node('path', { d: 'M11 27V4m-5 7 5-7 5 7', fill: 'none', stroke: '#b0c7c6', 'stroke-width': '1.4' }));
  compass.append(node('text', { x: '11', y: '42', fill: '#b0c7c6', 'font-size': '10', 'text-anchor': 'middle' }, 'N'));
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.style.cssText = 'display:none;position:absolute;left:14px;right:46px;bottom:42px;padding:8px 10px;border:1px solid #8c7046;border-radius:5px;background:#312a1eee;color:#f5cf99;font-size:11px;line-height:1.4;font-family:inherit;pointer-events:none';
  container.append(svg, compass, status);
  let selection = 'seco', color = COLORS.ndvi, zoom = 1, dx = 0, dy = 0, drag = null, moved = false, disposed = false;
  const paintSelection = () => areaNodes.forEach((a, id) => {
    const selected = id === selection;
    a.group.setAttribute('aria-pressed', String(selected));
    a.rect.setAttribute('fill', color);
    a.rect.setAttribute('fill-opacity', selected ? '.23' : '.06');
    a.rect.setAttribute('stroke', color);
    a.rect.setAttribute('stroke-opacity', selected ? '1' : '.48');
    a.rect.setAttribute('stroke-width', selected ? '2' : '1.3');
    a.rect.setAttribute('stroke-dasharray', selected ? '' : '4 4');
    a.outer.setAttribute('stroke', color);
    a.outer.setAttribute('opacity', selected ? '.5' : '0');
    a.cross.setAttribute('stroke', color);
    a.number.setAttribute('fill', color);
  });
  const choose = id => { selection = id; paintSelection(); onSelect(id); };
  const update = () => {
    dx = Math.min(500 * zoom, Math.max(-500 * zoom, dx));
    dy = Math.min(350 * zoom, Math.max(-350 * zoom, dy));
    world.setAttribute('transform', `translate(${400 + dx},${230 + dy}) scale(${zoom}) translate(-400,-230)`);
  };
  const zoomBy = factor => { zoom = Math.max(.8, Math.min(4, zoom * factor)); update(); };
  const localPoint = event => {
    const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const p = localPoint(event); drag = { x: p.x, y: p.y, dx, dy, pointerId: event.pointerId, area: event.target.closest('[data-area]')?.getAttribute('data-area') }; moved = false;
    svg.setPointerCapture(event.pointerId); svg.style.cursor = 'grabbing';
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const p = localPoint(event);
    if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) moved = true;
    dx = drag.dx + p.x - drag.x; dy = drag.dy + p.y - drag.y; update();
  });
  const release = () => { drag = null; svg.style.cursor = 'grab'; };
  svg.addEventListener('pointerup', event => { if (!drag || drag.pointerId !== event.pointerId) return; const tappedArea = drag.area; release(); if (tappedArea && !moved) choose(tappedArea); });
  svg.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) release(); });
  svg.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) release(); });
  svg.addEventListener('wheel', event => { event.preventDefault(); zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  svg.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.25); }
    else if (event.key === '-') { event.preventDefault(); zoomBy(.8); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); dx += event.key === 'ArrowLeft' ? 25 : event.key === 'ArrowRight' ? -25 : 0; dy += event.key === 'ArrowUp' ? 25 : event.key === 'ArrowDown' ? -25 : 0; update();
    }
  });
  fetch(new URL('./data/geography.json', import.meta.url))
    .then(response => { if (!response.ok) throw new Error('Cartografía no disponible'); return response.json(); })
    .then(data => {
      if (disposed) return;
      data.features.forEach(f => countries.append(node('path', { d: geometryPath(f.geometry), fill: f.properties.iso === 'ARG' ? '#1b3531' : '#17282d', stroke: '#42605e', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' })));
      (data.provinces || []).forEach(f => provinces.append(node('path', { d: geometryPath(f.geometry), fill: 'none', stroke: '#45615b', 'stroke-width': '.65', 'stroke-dasharray': '3 4', 'vector-effect': 'non-scaling-stroke', opacity: '.7' })));
    }).catch(() => { if (!disposed) { status.textContent = 'Cartografía no disponible. Las ventanas de muestra conservan sus coordenadas, pero no se pudieron cargar los límites administrativos.'; status.style.display = 'block'; } });
  paintSelection();
  return {
    setSelection(id) { if (areaNodes.has(id)) { selection = id; paintSelection(); } },
    setLayer(variable) { color = COLORS[variable] || COLORS.ndvi; paintSelection(); },
    zoomIn() { zoomBy(1.25); },
    zoomOut() { zoomBy(.8); },
    reset() { zoom = 1; dx = 0; dy = 0; update(); },
    destroy() { disposed = true; container.replaceChildren(); },
  };
}
