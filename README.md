# TerraMind Global · análisis por zonas

Versión del 24 de noviembre de 2026. Web: https://terramind-global.vercel.app

Delimitá dos esquinas y elegí **Analizar zona seleccionada**. Series, anomalías, resúmenes anuales y conclusiones usan la media ponderada por superficie de las celdas intersectadas. CSV y JSON incluyen límites y cobertura; JSON conserva las respuestas NASA y sus hashes.

- Clima: todas las celdas MERRA‑2 de la zona, hasta 400; 100% de superficie válida por mes. Precipitación en mm medios del área.
- MODIS: todos los píxeles del recorte, QA por fecha, ≥95% de superficie válida. Límite aproximado 8 × 8 km (depende de proyección), sin cruce del antimeridiano, latitudes ±80°. El resto de la zona nunca se reemplaza por el punto central. Fuera del límite se muestra un error y se solicita reducir la selección.
- Mann–Kendall se aplica a la serie zonal; si cambia la huella válida MODIS, se suspende el p-valor. La pendiente queda descriptiva.
- Un cambio de zona cancela consultas anteriores y oculta sus resultados. Quitar zona vuelve a la consulta puntual.

Para ejecutar: Node 20 o posterior, `npm start`, abrir http://localhost:4180. Sin instalación de dependencias. Verificación: `npm test` y `npm run check`.

La ficha `/global-methodology.html` describe las fórmulas, límites de resolución y cobertura. El piloto archivado Chaco se conserva en `/pilot.html`.

Implementación posterior al prototipo del evento; no se presenta como trabajo realizado durante la competencia.

## Fuentes y publicación

Clima: NASA POWER/MERRA-2 (reanálisis, no GPM IMERG). Vegetación: NASA MOD13Q1 / ORNL DAAC; colección no confirmada individualmente contra CMR. El piloto archivado conserva su serie IMERG. No hay observaciones simuladas, predicciones de incendios ni causalidad atribuida.

Buscador Open-Meteo/GeoNames para este prototipo no comercial; fondo NASA GIBS u OpenStreetMap. Revisar licencias y planes antes de un uso comercial. El mapa no define la resolución del análisis.

Vercel: conectar el repositorio, framework Other, sin instalación ni build, salida `out`. `vercel.json` configura la función Node `/api/earth` con límite de 60 segundos por petición. El navegador descarga lotes con un máximo de dos peticiones simultáneas. No publicar sólo `out` en un hosting estático: se necesitan `api/earth.js` y `api/places.js`.

GitHub: https://github.com/Onaai/terramind-evidencia-space-apps-2026

Documentación del piloto: `README-EVIDENCIA.md` y `DATA_EVIDENCE.md`.
