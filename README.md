# TerraMind Global 4 · Lite + Pro

Web: https://terramind-global.vercel.app
Código: https://github.com/Onaai/terramind-evidencia-space-apps-2026

## Usar

Buscá un lugar o delimitá un rectángulo. Elegí **Analizar zona seleccionada** y el indicador. Clima y vegetación se agregan por superficie; nunca se sustituye el rectángulo por su centro.

- **Lite:** gráficos, tendencias y límites esenciales. QA estricto.
- **Pro:** filtros de sensibilidad, cobertura por fecha, tabla científica y expediente JSON con procedencia.
- Ambos modos usan el mismo motor científico y están disponibles sin cuenta ni pago.
- Modo oscuro/claro y nivel de detalle se conservan en el navegador. Las animaciones respetan la preferencia de movimiento reducido.

## Histórico MODIS recuperable

Se consultan las 253 fechas nominales MOD13Q1 de 2015–2025. El servidor procesa una fecha y un bloque espacial por petición: descarga NASA, aplica QA a cada píxel, integra la intersección con la zona y devuelve acumuladores y procedencia compacta. Así no se envían grandes archivos crudos duplicados al navegador ni se concentran diez fechas en una función.

Hasta **5.000 km² y 32 bloques**, según forma y proyección, a resolución MODIS original de 250 m nominales. Cada bloque tiene un recorte proyectado de hasta 12 km por lado. Límites: latitudes ±80°, sin cruce del antimeridiano en vegetación. El clima admite hasta 400 celdas MERRA‑2.

Máximo dos peticiones simultáneas, hasta tres intentos por bloque con espera creciente, tiempo máximo por petición y guardado en IndexedDB durante 30 días. Pausar, recargar o cerrar el navegador conserva los bloques recibidos cuando el almacenamiento está disponible. Cerrar el navegador pausa el trabajo: no hay un proceso en segundo plano que continúe con la página cerrada. **Retomar última zona** restaura la selección; consultá MODIS para continuar.

Los acumuladores se combinan antes de aplicar el umbral espacial del 95%. Los bordes compartidos no duplican superficie: cada bloque pondera sólo su intersección. La cifra de intersecciones píxel/bloque puede contar un mismo píxel de borde en dos bloques. Un fallo no se reemplaza por una muestra o simulación; las fechas sin todos los bloques quedan pendientes y se pueden reintentar sin perder el resto.

El expediente MODIS contiene URL reproducible, fecha de recuperación, SHA-256 del texto crudo NASA, metadatos de grilla/bandas y resúmenes. **No contiene los archivos crudos MODIS**: se descargan desde las URLs originales. El clima conserva sus respuestas originales. Completar 253 fechas no significa que todas pasen QA ni que exista una tendencia significativa.

## Ejecutar y verificar

Node.js 22 o posterior, con Internet. Sin dependencias de instalación.

```sh
npm start
npm test
npm run check
```

Abrir http://127.0.0.1:4180. No abrir el HTML como archivo: las consultas requieren las funciones `api/`.

Prueba real completa (no forma parte de los tests unitarios):

```sh
npm run test:modis-live
```

Recupera el histórico sobre 112 km², conserva bloques locales para reanudar y genera `VALIDATION-MODIS-V4.json`. Puede tardar varios minutos; NASA puede responder con fallos temporales. No se marca completa si falta una fecha.

## Desplegar

Vercel, framework Other, sin build ni instalación, salida `out`; funciones Node `api/earth.js`, `api/modis.js` y `api/places.js`. `vercel.json` limita las peticiones a 60 segundos. La caché CDN de los bloques MODIS dura 30 días; la fecha original de recuperación permanece en el comprobante. No publicar sólo `out/` en un hosting estático.

## Fuentes y alcance

NASA POWER/MERRA‑2 es reanálisis, no GPM IMERG. MODIS: MOD13Q1 / ORNL DAAC; colección no confirmada individualmente contra CMR. QA espacial ≥95% y cobertura temporal nominal ≥80% para resúmenes anuales de vegetación. Si varía la superficie válida, el p-valor zonal de vegetación se suspende. No se atribuyen causas ni se predicen incendios.

Metodología completa: `/global-methodology.html`. Piloto Chaco e IMERG archivado: `/pilot.html`. Sin SMAP, alertas operativas ni polígonos libres. Open-Meteo/GeoNames y OpenStreetMap sirven para orientación; revisar sus licencias y planes antes de un uso comercial.

Versión posterior al prototipo del evento; no se presenta como trabajo hecho durante la competencia. Emi + Tomi. Código y textos asistidos por IA; sin aval institucional NASA.
