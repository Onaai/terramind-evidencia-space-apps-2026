# Mapa de la aplicación de evidencia

Implementación nueva del 14 de noviembre de 2026 para esta carpeta. No importa ni copia los módulos de mapa del prototipo previo.

## Alcance

El mapa ubica **un único punto piloto, latitud −25 y longitud −63**, asociado a una celda de la variable seleccionada. Para MOD13Q1, la resolución indicada es 250 m nominales; para GPM IMERG vía NASA POWER, la app puede indicar 0,1° nominales. El tamaño del marcador es un símbolo de localización: no representa la huella de ninguna de esas celdas. Las grillas de ambos productos no son equivalentes. No hay polígonos que aparenten cobertura del bosque, estimaciones regionales ni promedios del Gran Chaco.

El fondo predeterminado es **NASA GIBS Blue Marble**, un compuesto histórico de referencia. No corresponde al período 2015–2025, no es una imagen actual y no alimenta las series científicas. El mapa lo advierte debajo de la imagen. NASA y Leaflet tienen atribuciones visibles en el borde inferior.

## Uso

Incluir `out/map.css` en el HTML e importar:

```js
import { mountMap } from './evidence-map.js';

const map = mountMap(document.querySelector('#map'), {
  lat: -25,
  lon: -63,
  product: 'MOD13Q1',
  resolutionLabel: '250 m nominales',
  onStatus: ({ provider, status, message }) => {
    // provider: locator | nasa | google
    // status: pending | ready | error
  },
  onPoint: ({ lat, lon, cells, product, resolutionLabel }) => {},
});

// Métodos disponibles:
map.reset();
map.zoomIn();
map.zoomOut();
map.useNasa();
map.updateScope({
  product: 'GPM IMERG vía NASA POWER',
  resolutionLabel: '0,1° nominales',
});
// await map.connectGoogle(clavePropia);
// map.dispose();
```

`mountMap` entrega el controlador de forma inmediata y carga la biblioteca y las imágenes de forma asíncrona. Incluye los botones de mapa y un formulario Google opcional. La altura está definida explícitamente en `.em-stage`: 280 px, o 300 px en pantallas pequeñas. `.map-container.evidence-map` anula la altura fija y el crecimiento flex del contenedor de la app, por lo que toolbar, mensajes y formulario participan del flujo normal y no se superponen con la leyenda. El fondo del componente es oscuro para conservar contraste. El contenedor no depende de la altura de hijos absolutos.

`updateScope` cambia las etiquetas de producto y resolución, la ficha del punto, el popup y tooltip Leaflet, los nombres accesibles del localizador y del marcador Google, y el contenido de `onPoint`. No recrea el mapa, mueve la cámara ni altera la clave de la sesión. Sus campos pueden omitirse para conservar el valor actual; las etiquetas vacías o inválidas generan `TypeError` antes de alterar el estado. La configuración inicial predeterminada es MOD13Q1 / 250 m nominales. El callback devuelve `cells: 1` y una etiqueta de resolución, sin asignar falsamente 250 metros a una grilla angular.

La app debe servirse por HTTP. No hay compilación ni dependencias npm adicionales para este módulo.

## Dependencias y comprobaciones

- Leaflet estable **1.9.4**, cargado de unpkg con SRI y `crossorigin="anonymous"`. Se verificaron por descarga los SHA-256 de CSS y JS y coinciden con los usados en el código. [Referencia oficial de Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html).
- NASA GIBS WMTS, proyección EPSG:3857, capa `BlueMarble_NextGeneration`, matriz `GoogleMapsCompatible_Level8`, JPEG. Los identificadores se verificaron en [GetCapabilities oficial](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml). [Documentación de acceso](https://nasa-gibs.github.io/gibs-api-docs/access-basics/).
- El mosaico que contiene el punto piloto, nivel 6 / fila 36 / columna 20, devolvió **HTTP 200**, `image/jpeg` y firma JPEG válida el 14/11/2026. El zoom nativo del fondo llega a 8; nivel 9 solo amplía esos mosaicos, sin inventar detalle.
- La sintaxis del módulo se comprueba con `node --check out/evidence-map.js`.

## Fallas de red y accesibilidad

El localizador geográfico local aparece inmediatamente. Contiene una grilla de coordenadas, localidades de referencia y el punto piloto; no presenta límites administrativos ni imágenes sintéticas como satélite. Permite desplazamiento, zoom y consulta del punto con teclado, botones y puntero.

La biblioteca remota tiene un límite de espera de 12 segundos. La carga inicial o el reintento de imágenes tiene un límite de 16 segundos. Si falla NASA, se muestra un mensaje y se conserva el localizador, sin un indicador de carga perpetuo. El botón NASA reintenta cuando la biblioteca ya está disponible. Si falló también la biblioteca, el mensaje indica recargar la página.

Los mensajes usan `role="status"`; las acciones son botones con nombres accesibles. El mapa Google oculto usa `inert` para impedir que sus controles reciban foco. Los popups del punto reiteran el alcance de una celda del producto seleccionado. La regla de marcador `.evidence-map .em-pilot-icon` conserva `display:grid` aun cuando Leaflet carga su CSS después, y el `span` interior tiene `display:block`, ancho y alto iguales.

Actualización del 15/11/2026: se comprobó `updateScope` con un arnés DOM/Leaflet de prueba, sin navegador ni solicitudes Google. Verificó el cambio MOD13Q1 → IMERG → MOD13Q1, popup/tooltip/nombres accesibles/callback, rechazo atómico de etiquetas inválidas, identidad del mapa y marcador, cámara sin reiniciar y campo de clave intacto. Esta prueba no verifica visualmente el marcador ni autentica Google.

## Google Maps opcional

No se incluye ninguna clave. El SDK Google no se solicita hasta que el usuario proporciona una clave propia y conecta. La clave ingresada se mantiene solo en memoria durante la sesión: no se escribe en archivos, almacenamiento local, cookies ni logs del módulo. La clave de navegador es visible en la solicitud a Google por diseño y debe restringirse al sitio y a Maps JavaScript API.

Para una clave estándar de producción se requiere facturación habilitada, Maps JavaScript API habilitada y restricciones de sitios/API. [Configuración oficial de Google](https://developers.google.com/maps/documentation/javascript/get-api-key) y [carga del SDK](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).

Solo se informa “Google Maps activo” después de recibir `tilesloaded`. El formulario se desactiva durante la conexión para impedir cambiar la clave en medio del intento. Para cambiar una clave cargada o corregir un intento fallido se debe recargar la página. Los errores de autenticación conservan el fondo disponible. Google renderiza sus imágenes, logotipo y atribuciones sin edición ni ocultamiento; no colocar overlays encima de su borde inferior.

No se realizó una prueba autenticada de Google porque no hay una clave propia autorizada. Las pruebas visuales e interactivas en navegador, incluyendo una falla de red deliberada, corresponden a la integración de la app y no quedan sustituidas por las comprobaciones de red y sintaxis de este módulo.
