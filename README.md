# TerraMind Evidencia

Un piloto de vegetación y precipitación del Gran Chaco argentino, desarrollado para Emi y Tomi. Pregunta: **¿cómo variaron la vegetación y la lluvia en el sitio de 25° S, 63° O, y cuánto depende la conclusión de las decisiones de análisis?**

Esta versión nueva se encuentra en `out/`. El directorio `dist/` conserva el antecedente de la primera versión demostrativa, que **no se importa ni se sirve** desde esta aplicación. El repositorio conserva su historial; no se borran ni se cambian fechas del trabajo previo.

## Ejecutar en tu computadora

Requisito: Node.js 20 o posterior. No hace falta instalar paquetes.

```text
npm start
```

Abrí `http://127.0.0.1:4180`. Para detenerlo, Ctrl+C. No abras el HTML como archivo suelto: el navegador necesita servir los módulos y el JSON por HTTP.

```text
npm test
npm run check
```

Las pruebas científicas utilizan ejemplos de control creados sólo para verificar cálculos. **No forman parte de los datos de la app.**

## Qué hace

- **Explorar el cambio:** NDVI/EVI, período, calidad, serie nativa, resumen anual, anomalía estacional y sensibilidad predefinida.
- **Revisión científica:** procedencia, QA por compuesto, cobertura nominal, años aptos, Sen y Mann–Kendall cuando se cumplen las condiciones, tabla descargable y metodología.
- **Proyecto e inversión:** hipótesis de usuarios, alcance actual y próximos pasos; separado del recorrido científico, sin cifras comerciales inventadas.
- **Exportaciones:** expediente Markdown, observaciones CSV y figura vectorial SVG. Incluyen período/filtro o columnas de auditoría según el formato.
- **Mapa:** NASA GIBS como contexto histórico y un único marcador. Google Maps opcional con clave propia. Si la red falla, se conserva un localizador geográfico explícito.

Los controles recalculan el análisis en el navegador sobre un archivo de observaciones archivadas. No es un sistema de monitoreo en tiempo real, una inferencia regional ni una alerta de incendios.

## Datos reales y reproducibilidad

La app consume `out/data/pilot.json`. Ese archivo identifica producto, sitio, descarga y consultas originales. Los archivos crudos y sus comprobantes se guardan en `out/data/raw/`, con SHA-256. Para regenerar sin red, con Python 3.10 o posterior:

```text
python scripts/fetch_evidence.py --offline
```

Para obtener las respuestas faltantes de la API oficial y reutilizar el caché existente:

```text
python scripts/fetch_evidence.py
```

La fuente pública es [NASA ORNL DAAC / TESViS](https://modis.ornl.gov/data/modis_webservice.html). Puede responder lentamente o con errores temporales; el script registra respuestas y reintenta. Nunca sustituye un fallo por datos sintéticos. El período y la ubicación están fijados en el script; no se seleccionaron después de observar una tendencia.

Consultá `DATA_EVIDENCE.md` para la verificación de versión y alcance, y `out/methodology.md` para las reglas del análisis. El archivo de datos conserva los valores crudos y escalados incluso cuando QA los excluye, siempre que sean válidos según el producto; las exclusiones se deciden por variable.

## Google Maps

No se incluyó una clave ni se creó una cuenta de facturación. En el mapa, abrí **Conectar Google Maps (opcional)** e ingresá una clave de navegador propia. Sólo permanece en memoria durante esa sesión y se envía a la API oficial de Google. Debe estar restringida al dominio donde se use y a Maps JavaScript API. Consultá `MAP_EVIDENCE.md` y la [configuración oficial](https://developers.google.com/maps/documentation/javascript/get-api-key).

Sin esa clave, el fondo NASA y el localizador funcionan por separado. Las imágenes de Google o NASA no son los valores de la serie MOD13Q1.

## Desplegar

Es un sitio estático. Publicá **el contenido de `out/`** en un proveedor de alojamiento estático, sin compilación ni servidor de datos. Los módulos, JSON y archivos crudos se sirven desde el mismo origen; no se necesitan credenciales Earthdata para consultar el archivo incluido. Los fondos cartográficos y las fuentes tipográficas sí requieren conexión externa.

La configuración de Sites apunta a `out/` en `.openai/hosting.json`. La entrega final se publica en Vercel y GitHub por pedido del propietario, para compartir con el jurado. No se envió el formulario de NASA en nombre del equipo. El sitio anterior de ChatGPT Sites conserva su acceso previo.

## Alcance científico

Un píxel no representa una región ni un tipo de cobertura del suelo verificado en campo. La posición indicada es el punto consultado dentro de la celda; el archivo guarda la grilla nativa recibida. La duración nominal de un compuesto no es la cantidad de días efectivamente observados. Una década, una referencia corta y la falta de calibración de campo limitan las conclusiones.

La significancia es exploratoria. No se aplica corrección por múltiples pruebas ni se estiman intervalos de confianza de Sen. El chequeo de autocorrelación es un filtro aproximado, no una prueba de independencia. NDVI/EVI no son confirmaciones independientes y no permiten atribuir causalidad, deforestación o sequía por sí solos.

GPM IMERG está integrado: 4.018 días UTC de NASA POWER en una grilla nominal de 0,1°, sumados a 132 meses y 11 años completos. La colección/run y el QA de recuperación no están explicitados; se declara esa limitación. Ver DATA_PRECIPITATION.md y out/precipitation-methodology.md. Fuego MODIS/VIIRS, humedad SMAP (desde 2015), agricultura, agua y biodiversidad quedan como expansión. Esta app no inventa sus métricas ni incluye series simuladas para llenar esos módulos.

## Antecedente y uso en Space Apps

La implementación nueva en `out/` y los scripts/pruebas `evidence` comenzaron el **14/11/2026 después de las 09:00 de Buenos Aires**. La identidad, investigación y un prototipo anterior existían previamente; se conservan y deben declararse. Esta separación **no acredita por sí sola elegibilidad**: el organizador debe resolver cómo trata ese antecedente. No se recibió ni se infirió autorización para reutilizarlo como entrega del evento.

El [GO Team](https://github.com/nasa/spaceapps/discussions/1827) exige al menos una fuente NASA incluida en los recursos del desafío para premios globales. La fuente ORNL es auténtica, pero la pertenencia exacta de este recurso al listado del desafío queda por confirmar. Revisen la guía y el plazo de su sede antes de enviar.

## Créditos

Producto: Emi + Tomi. Código, pruebas, textos y revisión asistidos por OpenAI Codex; las observaciones de NASA no fueron generadas por IA. La identidad visual no usa el logotipo NASA ni implica su aval. El mapa atribuye NASA GIBS y Leaflet; Google conserva sus atribuciones cuando se activa. `AI-DISCLOSURE.md` detalla la asistencia.

## Precipitación reproducible

`python scripts/fetch_precipitation.py --offline` reconstruye la serie diaria IMERG con los originales incluidos. `--refresh` obtiene una nueva respuesta. La app nunca mezcla esta serie con MERRA-2.
