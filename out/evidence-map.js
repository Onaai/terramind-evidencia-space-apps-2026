/* Created for the event evidence app, 2026-11-14.
 * Imagery is context only. Exactly one pilot point is shown; no regional estimate.
 * Leaflet 1.9.4 stable; official GIBS capabilities verified on 2026-11-14.
 */
const LEAFLET = {
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  jsIntegrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  cssIntegrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
};
const NASA_TILES = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
let leafletLoading;
let googleLoading;
let googleKeyInUse = '';
const googleAuthSubscribers = new Set();

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(label, title) {
  const el = element('button', 'em-button', label);
  el.type = 'button';
  if (title) el.setAttribute('aria-label', title);
  return el;
}
function loadLeaflet() {
  if (window.L?.version === '1.9.4') return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = Promise.all([
    new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LEAFLET.css;
      css.integrity = LEAFLET.cssIntegrity; css.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('La hoja de estilos del mapa no respondió.')), 12000);
      css.onload = () => { clearTimeout(timer); resolve(); };
      css.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo cargar la hoja de estilos del mapa.')); };
      document.head.append(css);
    }),
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LEAFLET.js; script.async = true;
      script.integrity = LEAFLET.jsIntegrity; script.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('La biblioteca del mapa no respondió.')), 12000);
      script.onload = () => { clearTimeout(timer); window.L?.version === '1.9.4' ? resolve() : reject(new Error('La biblioteca del mapa no está disponible.')); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo cargar la biblioteca del mapa.')); };
      document.head.append(script);
    }),
  ]).then(() => window.L);
  return leafletLoading;
}

function loadGoogle(key) {
  if (!/^[A-Za-z0-9_-]{15,300}$/.test(key)) return Promise.reject(new Error('Ingresá una clave válida de tu proyecto de Google Maps.'));
  if (googleKeyInUse && key !== googleKeyInUse) return Promise.reject(new Error('Recargá la página para conectar una clave distinta.'));
  if (googleLoading) return googleLoading;
  if (window.google?.maps?.Map) return Promise.reject(new Error('Google Maps ya fue cargado por otro componente. Recargá la página.'));
  googleKeyInUse = key;
  googleLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let ended = false;
    const finish = error => {
      if (ended) return;
      ended = true; clearTimeout(timer); googleAuthSubscribers.delete(authFailure);
      if (error) { script.remove(); reject(error); } else resolve(window.google.maps);
    };
    const authFailure = () => finish(new Error('Google rechazó la conexión. Revisá la clave, la facturación, la API habilitada y los sitios permitidos.'));
    googleAuthSubscribers.add(authFailure);
    const oldAuthHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
      for (const handler of [...googleAuthSubscribers]) handler();
      if (typeof oldAuthHandler === 'function') oldAuthHandler();
    };
    const timer = setTimeout(() => finish(new Error('Google no respondió a tiempo.')), 18000);
    window.__terramindEvidenceGoogleReady = () => window.google?.maps?.Map ? finish() : finish(new Error('Google no pudo inicializarse.'));
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key, callback: '__terramindEvidenceGoogleReady', loading: 'async', v: 'quarterly', language: 'es', region: 'AR' });
    script.onerror = () => finish(new Error('No se pudo descargar Google Maps.'));
    script.async = true;
    document.head.append(script);
  });
  return googleLoading;
}

/** A dependency-free geographic locator, visible immediately and on network errors.
 * It deliberately shows only a coordinate grid, named places and the pilot point.
 */
function mountLocator(host, lat, lon, onPoint, scopeLabel) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 800 430');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('tabindex', '0');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Localizador geográfico de respaldo. Sin imagen satelital ni límites territoriales. Flechas para desplazar, más y menos para zoom.');
  const world = document.createElementNS(ns, 'g');
  const project = (latitude, longitude) => [400 + (longitude + 61.8) * 55, 215 + (-25.5 - latitude) * 60];
  const draw = (tag, attrs, text, parent = world) => {
    const n = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) n.setAttribute(name, value);
    if (text !== undefined) n.textContent = text;
    parent.append(n); return n;
  };
  draw('rect', { x: -1000, y: -1000, width: 2800, height: 2400, fill: '#152d2a' });
  for (let x = -72; x <= -50; x += 2) {
    const [xx] = project(-26, x);
    draw('line', { x1: xx, x2: xx, y1: -500, y2: 1000, stroke: '#32534c', 'stroke-width': 1 });
    draw('text', { x: xx + 5, y: 404, fill: '#7e9f91', 'font-size': 10 }, `${Math.abs(x)}° O`);
  }
  for (let y = -34; y <= -18; y += 2) {
    const [, yy] = project(y, -63);
    draw('line', { x1: -500, x2: 1300, y1: yy, y2: yy, stroke: '#32534c', 'stroke-width': 1 });
    draw('text', { x: 12, y: yy - 6, fill: '#7e9f91', 'font-size': 10 }, `${Math.abs(y)}° S`);
  }
  for (const [name, latitude, longitude] of [['Salta', -24.78, -65.41], ['Resistencia', -27.45, -58.99], ['Formosa', -26.18, -58.18], ['Asunción', -25.26, -57.64]]) {
    const [x, y] = project(latitude, longitude);
    draw('circle', { cx: x, cy: y, r: 2, fill: '#adc2b4' });
    draw('text', { x: x + 6, y: y + 3, fill: '#adc2b4', 'font-size': 11 }, name);
  }
  draw('text', { x: 205, y: 325, fill: '#89a598', 'font-size': 20, 'letter-spacing': 4 }, 'ARGENTINA');
  draw('text', { x: 515, y: 85, fill: '#89a598', 'font-size': 12, 'letter-spacing': 3 }, 'PARAGUAY');
  const [px, py] = project(lat, lon);
  const point = draw('g', { role: 'button', tabindex: 0, 'aria-label': scopeLabel });
  draw('circle', { cx: px, cy: py, r: 9, fill: '#f0d37d', stroke: '#fff8db', 'stroke-width': 2 }, undefined, point);
  draw('path', { d: `M${px - 18} ${py}h8M${px + 10} ${py}h8M${px} ${py - 18}v8M${px} ${py + 10}v8`, stroke: '#f0d37d', 'stroke-width': 1.5 }, undefined, point);
  draw('text', { x: px + 18, y: py - 14, fill: '#fff2c0', 'font-size': 12, 'font-weight': 600 }, 'PUNTO PILOTO', point);
  point.addEventListener('click', () => onPoint());
  point.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onPoint(); } });
  svg.append(world); host.append(svg);
  let zoom = 1, dx = 0, dy = 0, drag;
  const update = () => world.setAttribute('transform', `translate(${400 + dx},${215 + dy}) scale(${zoom}) translate(-400,-215)`);
  const zoomBy = amount => { zoom = Math.max(.75, Math.min(4, zoom * amount)); update(); };
  svg.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) event.preventDefault();
    if (event.key === '+' || event.key === '=') zoomBy(1.25);
    else if (event.key === '-') zoomBy(.8);
    else { dx += event.key === 'ArrowLeft' ? 25 : event.key === 'ArrowRight' ? -25 : 0; dy += event.key === 'ArrowUp' ? 25 : event.key === 'ArrowDown' ? -25 : 0; update(); }
  });
  svg.addEventListener('pointerdown', event => { if (event.button !== 0 || event.target.closest('[role=button]')) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx, dy }; svg.setPointerCapture(event.pointerId); });
  svg.addEventListener('pointermove', event => { if (!drag || drag.id !== event.pointerId) return; const ratio = 800 / svg.getBoundingClientRect().width; dx = drag.dx + (event.clientX - drag.x) * ratio; dy = drag.dy + (event.clientY - drag.y) * ratio; update(); });
  const release = () => { drag = undefined; };
  svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
  return { zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(.8), reset: () => { zoom = 1; dx = 0; dy = 0; update(); }, setScopeLabel: label => point.setAttribute('aria-label', label) };
}

export function mountMap(container, { lat = -25, lon = -63, resolutionLabel = '250 m nominales', product = 'MOD13Q1', onStatus = () => {}, onPoint = () => {} } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) throw new Error('Coordenadas inválidas para el punto piloto.');
  const scopeText = value => { if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new TypeError('Producto y resolución deben ser etiquetas de texto válidas.'); return value.trim(); };
  let scope = { resolutionLabel: scopeText(resolutionLabel), product: scopeText(product) };
  const scopeLabel = () => `Punto piloto ${lat}, ${lon}. Una celda de ${scope.product}, resolución ${scope.resolutionLabel}. El símbolo no representa su huella real.`;
  const pointPayload = () => ({ lat, lon, cells: 1, product: scope.product, resolutionLabel: scope.resolutionLabel });
  container.replaceChildren(); container.classList.add('evidence-map');
  let disposed = false, provider = 'locator', busyGoogle = false, connectedKey = '', googleMap, googlePoint, googleListener;
  let leafletMap, nasaLayer, pilotMarker, nasaReady = false, nasaTimer;
  const toolbar = element('div', 'em-toolbar');
  const title = element('div', 'em-map-title', 'Gran Chaco argentino');
  const actions = element('div', 'em-actions');
  const nasaButton = button('NASA', 'Usar fondo de contexto NASA');
  const pointButton = button('Ubicar punto', 'Volver al único punto piloto');
  const zoomIn = button('+', 'Acercar el mapa');
  const zoomOut = button('−', 'Alejar el mapa');
  actions.append(nasaButton, pointButton, zoomIn, zoomOut); toolbar.append(title, actions);
  const stage = element('div', 'em-stage');
  const locatorHost = element('div', 'em-layer em-locator');
  const nasaHost = element('div', 'em-layer em-nasa');
  const googleHost = element('div', 'em-layer em-google');
  nasaHost.hidden = true;
  googleHost.style.visibility = 'hidden'; googleHost.inert = true;
  const pointCard = element('div', 'em-point-card');
  pointCard.hidden = true;
  const pointTitle = element('strong', '', 'Un punto, una celda');
  const pointText = element('p');
  const closePoint = button('Cerrar', 'Cerrar información del punto');
  closePoint.addEventListener('click', () => { pointCard.hidden = true; pointButton.focus(); });
  pointCard.append(pointTitle, pointText, closePoint);
  stage.append(locatorHost, nasaHost, googleHost, pointCard);
  const status = element('p', 'em-status', 'Conectando imágenes de contexto NASA…');
  status.setAttribute('role', 'status');
  const context = element('p', 'em-context', 'Blue Marble: compuesto histórico de referencia. No es una medición de 2015–2025 ni una imagen actual.');
  const scopeSummary = element('p', 'em-scope');
  const options = element('details', 'em-options');
  options.append(element('summary', '', 'Conectar Google Maps (opcional)'));
  const form = element('form', 'em-key-form');
  const label = element('label', '', 'Clave de navegador de tu proyecto');
  const keyInput = element('input', 'em-key-input'); keyInput.type = 'password'; keyInput.autocomplete = 'off'; keyInput.spellcheck = false; keyInput.setAttribute('aria-label', 'Clave de navegador propia de Google Maps');
  label.append(keyInput);
  const connectButton = element('button', 'em-button', 'Conectar'); connectButton.type = 'submit';
  const help = element('p', 'em-key-help', 'Se usa solo en esta sesión. Requiere una clave propia restringida a este sitio y a Maps JavaScript API; para producción, Google exige facturación habilitada.');
  const docs = element('a', '', 'Ver configuración oficial'); docs.href = 'https://developers.google.com/maps/documentation/javascript/get-api-key'; docs.target = '_blank'; docs.rel = 'noopener noreferrer';
  form.append(label, connectButton); options.append(form, help, docs);
  container.append(toolbar, stage, status, context, scopeSummary, options);
  const report = (state, message) => { if (disposed) return; status.textContent = message; status.dataset.state = state; onStatus({ provider, status: state, message }); };
  const showPoint = () => { pointCard.hidden = false; onPoint(pointPayload()); };
  const locator = mountLocator(locatorHost, lat, lon, showPoint, scopeLabel());
  const setVisible = target => {
    provider = target;
    locatorHost.hidden = target !== 'locator';
    nasaHost.hidden = target !== 'nasa';
    googleHost.style.visibility = target === 'google' ? 'visible' : 'hidden'; googleHost.inert = target !== 'google';
    context.textContent = target === 'google' ? 'Google Maps aporta contexto visual. Sus imágenes no son las observaciones de la serie científica.' : target === 'nasa' ? 'Blue Marble: compuesto histórico de referencia. No es una medición de 2015–2025 ni una imagen actual.' : 'Respaldo local: grilla geográfica y localidades de referencia. Sin imagen satelital ni límites territoriales.';
    if (target === 'nasa') leafletMap?.invalidateSize(false);
  };
  const fallback = message => { clearTimeout(nasaTimer); setVisible('locator'); report('error', `${message} El punto sigue disponible en el localizador geográfico.`); };
  function useNasa() {
    if (disposed || busyGoogle) return false;
    pointCard.hidden = true;
    if (leafletMap && nasaReady) { setVisible('nasa'); report('ready', 'NASA GIBS · imagen de referencia. El análisis corresponde a una única celda.'); return true; }
    if (leafletMap && nasaLayer) {
      setVisible('nasa'); report('pending', 'Reintentando la carga de imágenes NASA…');
      nasaLayer.redraw(); clearTimeout(nasaTimer);
      nasaTimer = setTimeout(() => { if (!nasaReady && provider !== 'google') fallback('NASA no respondió al reintento.'); }, 16000);
      return true;
    }
    setVisible('locator');
    report('error', 'La biblioteca del mapa no está disponible. Se mantiene el localizador geográfico; recargá la página para reintentar.');
    return false;
  }
  nasaButton.addEventListener('click', useNasa);
  const reset = () => { pointCard.hidden = true; if (provider === 'google') { googleMap.setCenter({ lat, lng: lon }); googleMap.setZoom(6); } else if (provider === 'nasa') leafletMap.setView([lat, lon], 6); else locator.reset(); };
  pointButton.addEventListener('click', reset);
  const changeZoom = step => { if (provider === 'google') googleMap.setZoom(Math.max(4, Math.min(16, googleMap.getZoom() + step))); else if (provider === 'nasa') leafletMap.setZoom(Math.max(4, Math.min(9, leafletMap.getZoom() + step))); else step > 0 ? locator.zoomIn() : locator.zoomOut(); };
  zoomIn.addEventListener('click', () => changeZoom(1)); zoomOut.addEventListener('click', () => changeZoom(-1));
  const popupContent = () => { const content = element('div', 'em-popup'); content.append(element('strong', '', 'Punto piloto · 1 celda'), element('p', '', `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`), element('p', '', `${scope.product} · ${scope.resolutionLabel}. El símbolo ubica la celda de la serie; su tamaño no representa su huella. No es un promedio de toda la región.`)); return content; };
  function updateScope(next = {}) {
    if (disposed) return false;
    // Validate both fields before changing any labels. No provider, camera, SDK or
    // credential state is touched: a variable switch must not rebuild the map.
    scope = {
      resolutionLabel: scopeText(next.resolutionLabel ?? scope.resolutionLabel),
      product: scopeText(next.product ?? scope.product),
    };
    const accessibleLabel = scopeLabel();
    pointText.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}° · ${scope.product} · ${scope.resolutionLabel}. Este símbolo ubica el punto; su tamaño no representa la huella de la celda. No es un promedio del Gran Chaco.`;
    scopeSummary.textContent = `Serie seleccionada: ${scope.product} · ${scope.resolutionLabel} · 1 celda.`;
    locator.setScopeLabel(accessibleLabel);
    if (pilotMarker) {
      pilotMarker.options.title = accessibleLabel; pilotMarker.options.alt = accessibleLabel;
      const markerElement = pilotMarker.getElement();
      markerElement?.setAttribute('title', accessibleLabel);
      markerElement?.setAttribute('aria-label', accessibleLabel);
      markerElement?.setAttribute('alt', accessibleLabel);
      pilotMarker.setPopupContent(popupContent());
      const tooltip = element('span', '', `Punto piloto · ${scope.resolutionLabel}`);
      pilotMarker.setTooltipContent(tooltip);
    }
    if (googlePoint?.el) {
      googlePoint.el.textContent = `● Punto piloto · ${scope.resolutionLabel}`;
      googlePoint.el.setAttribute('aria-label', accessibleLabel);
      googlePoint.el.setAttribute('title', accessibleLabel);
    }
    return { ...scope };
  }
  updateScope();
  loadLeaflet().then(L => {
    if (disposed) return;
    nasaHost.hidden = false;
    leafletMap = L.map(nasaHost, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 9, scrollWheelZoom: false, keyboard: true, maxBounds: [[-36, -74], [-15, -47]], maxBoundsViscosity: .8 }).setView([lat, lon], 6);
    leafletMap.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
    nasaLayer = L.tileLayer(NASA_TILES, { minZoom: 0, maxZoom: 9, maxNativeZoom: 8, noWrap: true, attribution: '<a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank" rel="noopener">NASA GIBS / Blue Marble</a> · compuesto histórico' });
    let successes = 0, failures = 0;
    nasaLayer.on('loading', () => { successes = 0; failures = 0; });
    nasaLayer.on('tileload', () => {
      successes++;
      nasaReady = true; clearTimeout(nasaTimer);
      if (provider !== 'google' && !busyGoogle) { setVisible('nasa'); report('ready', 'NASA GIBS · imagen de referencia. El análisis corresponde a una única celda.'); }
    });
    nasaLayer.on('tileerror', () => { failures++; });
    nasaLayer.on('load', () => {
      if (!successes && failures && provider !== 'google' && !busyGoogle) { nasaReady = false; fallback('No se pudieron cargar los mosaicos NASA.'); }
      else if (failures && provider === 'nasa') report('error', 'Imagen NASA parcial: faltan mosaicos. El punto piloto mantiene su ubicación.');
    });
    nasaLayer.addTo(leafletMap);
    pilotMarker = L.marker([lat, lon], { title: scopeLabel(), alt: scopeLabel(), keyboard: true, icon: L.divIcon({ className: 'em-pilot-icon', html: '<span aria-hidden="true"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(leafletMap);
    pilotMarker.bindPopup(popupContent(), { maxWidth: 270 });
    pilotMarker.bindTooltip(element('span', '', `Punto piloto · ${scope.resolutionLabel}`), { permanent: true, direction: 'right', offset: [14, 0], className: 'em-point-tooltip' });
    pilotMarker.on('click', () => onPoint(pointPayload()));
    updateScope();
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(leafletMap);
    // Render tiles with a definite stage height. Never rely on absolute children for layout.
    leafletMap.invalidateSize(false);
    nasaTimer = setTimeout(() => { if (!nasaReady && provider !== 'google' && !busyGoogle) fallback('NASA tardó demasiado en responder.'); }, 16000);
  }).catch(error => { if (!disposed && provider !== 'google' && !busyGoogle) fallback(error.message); });
  const resize = new ResizeObserver(() => leafletMap?.invalidateSize(false)); resize.observe(stage);

  const googleFailure = () => {
    // During initial connection, the pending readiness promise owns error cleanup.
    if (disposed || busyGoogle) return;
    if (googlePoint) { googlePoint.setMap(null); googlePoint = undefined; }
    if (googleMap && window.google?.maps) window.google.maps.event.clearInstanceListeners(googleMap);
    googleMap = undefined;
    googleHost.replaceChildren();
    useNasa(); report('error', 'Google rechazó la conexión. Revisá clave, facturación y restricciones. Se conserva el fondo disponible.');
  };
  googleAuthSubscribers.add(googleFailure);
  async function connectGoogle(rawKey) {
    if (disposed || busyGoogle) return false;
    const key = String(rawKey || '').trim();
    if (!key) { report('error', 'Google no está conectado. Ingresá una clave propia o seguí usando NASA.'); return false; }
    if (googleMap) {
      if (key !== connectedKey) { report('error', 'Recargá la página para cambiar la clave de Google.'); return false; }
      setVisible('google'); report('ready', 'Google Maps activo como fondo de contexto.'); return true;
    }
    busyGoogle = true; connectButton.disabled = true; keyInput.disabled = true; nasaButton.disabled = true;
    report('pending', 'Conectando Google Maps con tu clave…');
    try {
      const maps = await loadGoogle(key);
      if (disposed) return false;
      googleMap = new maps.Map(googleHost, { center: { lat, lng: lon }, zoom: 6, mapTypeId: 'hybrid', mapTypeControl: false, zoomControl: false, fullscreenControl: false, streetViewControl: false, scaleControl: true, gestureHandling: 'cooperative', keyboardShortcuts: true });
      class PilotPoint extends maps.OverlayView {
        onAdd() { this.el = button(`● Punto piloto · ${scope.resolutionLabel}`, scopeLabel()); this.el.className = 'em-google-point'; this.el.setAttribute('title', scopeLabel()); this.el.addEventListener('click', showPoint); maps.OverlayView.preventMapHitsAndGesturesFrom(this.el); this.getPanes().overlayMouseTarget.append(this.el); }
        draw() { const p = this.getProjection().fromLatLngToDivPixel(new maps.LatLng(lat, lon)); if (p && this.el) { this.el.style.left = `${p.x}px`; this.el.style.top = `${p.y}px`; } }
        onRemove() { this.el?.remove(); }
      }
      googlePoint = new PilotPoint(); googlePoint.setMap(googleMap);
      await new Promise((resolve, reject) => {
        let ended = false;
        let timer;
        const done = error => { if (ended) return; ended = true; clearTimeout(timer); googleAuthSubscribers.delete(auth); maps.event.removeListener(googleListener); error ? reject(error) : resolve(); };
        const auth = () => done(new Error('Google rechazó la autenticación.'));
        googleAuthSubscribers.add(auth);
        googleListener = maps.event.addListenerOnce(googleMap, 'tilesloaded', () => done());
        timer = setTimeout(() => done(new Error('Google no terminó de cargar sus imágenes.')), 18000);
      });
      if (disposed) return false;
      connectedKey = key; setVisible('google'); keyInput.value = '';
      report('ready', 'Google Maps activo como fondo de contexto.'); return true;
    } catch (error) {
      googlePoint?.setMap(null); googlePoint = undefined;
      if (googleMap && window.google?.maps) window.google.maps.event.clearInstanceListeners(googleMap);
      googleMap = undefined; googleHost.replaceChildren();
      busyGoogle = false; useNasa();
      report('error', `${error.message} Se conserva el fondo disponible; para cambiar la clave, recargá la página.`); return false;
    } finally { busyGoogle = false; connectButton.disabled = false; keyInput.disabled = false; nasaButton.disabled = false; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); connectGoogle(keyInput.value); });
  return {
    reset, zoomIn: () => changeZoom(1), zoomOut: () => changeZoom(-1), connectGoogle, useNasa, updateScope,
    dispose() {
      disposed = true; clearTimeout(nasaTimer); resize.disconnect(); leafletMap?.remove();
      googleAuthSubscribers.delete(googleFailure);
      googlePoint?.setMap(null);
      if (googleMap && window.google?.maps) window.google.maps.event.clearInstanceListeners(googleMap);
      keyInput.value = ''; connectedKey = ''; container.replaceChildren();
    },
  };
}
