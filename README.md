# TerraMind / SIGMA EARTH

Un observatorio web del **Gran Chaco argentino**, enfocado en inteligencia forestal y climática. Este MVP permite explorar vegetación y su contexto hidroclimático, comparar meses equivalentes y explicar qué cambió, dónde, cuánto y qué evidencia falta para sostener una tendencia.

**Las series incluidas son demostrativas.** Se generan de forma determinista para probar el recorrido de la aplicación y no describen observaciones del territorio. El catálogo NASA consultado es real y reproducible; no contiene las series ambientales procesadas. La interfaz mantiene esa diferencia visible.

## Abrilo en tu computadora

Requisitos: Node.js 20 o posterior y un navegador moderno. No hace falta ejecutar `npm install`: la app y el servidor local usan recursos incluidos y bibliotecas estándar.

1. Abrí una terminal en esta carpeta, la que contiene `package.json`.
2. Ejecutá:

```sh
npm start
```

3. Entrá a [http://127.0.0.1:4173](http://127.0.0.1:4173).

Dejá esa terminal abierta mientras usás la app. Para detenerla, presioná `Ctrl+C`. No abras `index.html` directamente como archivo: los módulos JavaScript y los datos locales necesitan servirse por HTTP. Si el puerto está ocupado, podés definir otro mediante la variable `PORT`.

## Recorrido del MVP

- Mapa regional con límites administrativos de Natural Earth, desplazamiento, zoom y tres ventanas seleccionables. Las ventanas son áreas ilustrativas, no límites oficiales de ecorregiones.
- Selección de área, período y variable: NDVI, EVI, precipitación mensual, detecciones térmicas y humedad superficial del suelo.
- Series mensuales y tabla de valores; comparación por mes calendario contra la referencia 2015–2020.
- Panel de las cuatro preguntas, información de calidad, ficha metodológica y acceso a fuentes.
- Exportación de resumen y CSV para revisar los resultados y su carácter demostrativo.
- Importación local de una serie mensual JSON con procedencia, unidades y cobertura. El formato se valida; la autenticidad del archivo requiere revisión externa. Consultá [DATA_FORMAT.md](DATA_FORMAT.md).

La serie de humedad comienza en abril de 2015. No se generan datos SMAP anteriores ni se completa una ausencia con cero. La demo incluye también un faltante en NDVI para probar el manejo de calidad.

En modo demo no se presentan significancias como evidencia sobre el territorio. El motor incluye pendiente de Sen y Mann–Kendall para series importadas que cumplan los controles de elegibilidad; siguen siendo resultados exploratorios, con límites explícitos. Un cambio de NDVI no identifica por sí solo deforestación; las detecciones térmicas no equivalen a incendios únicos ni a hectáreas quemadas.

## Un caso científico entregable

La pregunta piloto es: **¿cómo varía la vegetación entre 2015 y 2025 en tres ventanas del Gran Chaco argentino, y cómo se compara su variación mensual con la lluvia y la humedad superficial del suelo?** Las detecciones térmicas agregan contexto independiente, sin inferir causalidad ni emitir alertas de incendios.

La referencia de seis años sirve para explorar estacionalidad; no es una normal climatológica de 30 años. El alcance queda acotado a tres ventanas de 1° × 1°. Agricultura, agua, biodiversidad y riesgo ambiental figuran como futuras expansiones, sin funciones operativas en esta versión.

Para el equipo de dos, una división posible es que Emi lleve la experiencia de uso, integración y presentación, y Tomi la selección del área, procesamiento y revisión científica. Ambos deberían poder reproducir una misma serie y explicar sus límites antes de presentarla.

## Catálogo NASA reproducible

Con Python 3.10 o posterior, desde esta carpeta:

```sh
python scripts/discover_nasa.py
```

El script consulta metadatos públicos de NASA CMR para MOD13A2, GPM IMERG, SMAP, VIIRS y área quemada MODIS. Guarda colección, versión, consultas, fechas y hashes en `dist/data/nasa-catalog.json`; las respuestas originales quedan en `dist/data/catalog-cache/`. No necesita claves. Los ejemplos de gránulos y sus conteos son **metadatos de archivos**, no mediciones ambientales.

La captura de catálogo incluida se obtuvo satisfactoriamente y sus 20 respuestas originales se verificaron por hash. Esto no garantiza que un producto esté disponible en otra fecha ni sustituye la validación de sus datos.

La ruta hacia observaciones reales todavía requiere descargar los productos que correspondan con acceso Earthdata, aplicar QA, escalas y máscaras, armonizar unidades y agregaciones y conservar la procedencia. Ese procesamiento científico autenticado **no está implementado** por el script de catálogo. Consultá [SOURCES.md](SOURCES.md) para productos, fuentes, cautelas y pasos pendientes.

## Comprobar el proyecto

```sh
npm test
npm run check
```

El primer comando ejecuta las pruebas automáticas incluidas; el segundo revisa la sintaxis de los módulos de la app. Para revisar la experiencia completa, abrí la app, cambiá área y período, recorré las variables, probá el mapa, revisá tabla y exportaciones y contrastá las advertencias de calidad. Estas comprobaciones del software no validan una conclusión ambiental.

## Estructura y despliegue

```text
dist/
  index.html             Interfaz en español
  styles.css             Diseño responsive
  app.js                 Estado, gráficos, filtros, importación y exportaciones
  science.js             Datos demo, controles de calidad y estadística
  map.js                 Mapa interactivo sin servicio externo de mapas
  data/                  Cartografía y metadatos NASA verificables
scripts/
  serve.mjs              Servidor local de desarrollo
  discover_nasa.py        Descubrimiento del catálogo público NASA CMR
tests/                   Pruebas del motor científico
DATA_FORMAT.md           Contrato de importación
SOURCES.md               Fuentes y ruta científica
```

La aplicación es estática: se puede publicar el contenido completo de **`dist/`** en un alojamiento HTTPS que sirva HTML, CSS, JavaScript y JSON. No necesita compilación, servidor de aplicación, base de datos ni variables secretas. Conservá la estructura de archivos y sus rutas relativas. El servidor de `npm start` escucha sólo en tu computadora y está pensado para ejecución local.

La importación procesa archivos en el navegador; no los envía a un backend del proyecto. Si se agrega una conexión autenticada en el futuro, las credenciales deben vivir en un servicio seguro, fuera de `dist/` y del repositorio.

Proyecto independiente de Emi y Tomi para el contexto de NASA Space Apps 2026. No implica afiliación, certificación o validación de NASA ni CONAE.
