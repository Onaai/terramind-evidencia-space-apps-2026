# TerraMind Global — v3

Explorador mundial por coordenada. Implementación global posterior al prototipo del evento; no se presenta como trabajo realizado durante la competencia.

- App: https://terramind-evidencia.vercel.app/
- Expediente archivado del Chaco: https://terramind-evidencia.vercel.app/pilot.html
- Repositorio: https://github.com/Onaai/terramind-evidencia-space-apps-2026

## Ejecutar

Requiere Node.js 20 o superior y conexión a Internet. No requiere paquetes ni claves para el explorador global.

```sh
npm start
```

Abrir http://127.0.0.1:4180. Este servidor también atiende `/api/earth`; abrir HTML como archivo o servir sólo `out/` no permite las consultas globales.

```sh
npm test
npm run check
```

## Qué cambia

Buscador mundial por nombre (Open-Meteo/GeoNames), fondo NASA GIBS o calles OpenStreetMap con zoom hasta 19, mapa ampliado, delimitación de zonas visuales por dos esquinas y coordenadas libres y ejemplos en América, Europa, África, Asia y Oceanía. Clima mensual NASA POWER/MERRA-2 (temperatura y precipitación corregida). Vegetación MOD13Q1 bajo disponibilidad de ORNL DAAC, con descarga de NDVI/EVI y QA. Períodos 2015–2025, anomalías estacionales, Sen/Mann–Kendall exploratorio y exportaciones JSON/CSV. Al cambiar de lugar se cancelan consultas y se retiran los resultados anteriores.

El expediente JSON incluye respuestas NASA originales, URL, fecha y SHA-256. Los datos de clima son reanálisis MERRA-2, **no IMERG**. El piloto archivado conserva sus observaciones MODIS y su serie IMERG anterior.

## Límites

Acceso por coordenadas a escala mundial no equivale a promedios globales o regionales. Son celdas en grillas distintas. MODIS puede no cubrir agua, hielo o puntos con mala calidad; fallos de la fuente se muestran sin inventar series. Colección de MODIS no confirmada individualmente contra CMR en consultas globales. Sin SMAP, incendios, predicciones ni análisis de polígonos en este explorador.

Metodología: `out/global-methodology.html`. El análisis del piloto anterior y su procedencia permanecen documentados en `README-EVIDENCIA.md` y `DATA_EVIDENCE.md`.

## Publicar en Vercel

Conectar este repositorio. Framework Other; sin instalación ni build; salida `out`. `vercel.json` configura `/api/earth` como función Node y límite de 60 segundos. La función sólo consulta dos dominios NASA fijos y valida coordenadas, tipo y tamaño del lote. No recibe claves ni URLs arbitrarias. Respuestas exitosas con caché CDN de 24 horas; errores sin caché.

No publicar esta versión sólo en hosting estático: requiere la función incluida en `api/earth.js`.

La delimitación de una zona consulta una celda de su centro o el punto elegido dentro; no es una agregación espacial. El expediente conserva `site.visualArea`. La búsqueda gratuita de Open-Meteo se usa como prototipo no comercial; para un servicio comercial revisar su plan/licencia.
