# Evidencia satelital — TerraMind

Este caso usa exclusivamente datos del servicio público NASA/ORNL DAAC TESViS. No contiene una serie sintética de reemplazo. El sitio se fijó antes de descargar y evaluar los resultados: **25° S, 63° O**, un único píxel MOD13Q1 de resolución nominal 250 m. No representa todo el Gran Chaco ni una ventana regional de 1° × 1°.

La fuente se conserva a su resolución nativa: compuestos de 16 días, del 1 de enero de 2015 al 31 de diciembre de 2025. El calendario nominal incluye 253 compuestos. Su fecha identifica el comienzo de una ventana; `selectedDayOfYear` conserva el día elegido por el algoritmo para el píxel. La última ventana anual dura 13 o 14 días. Estos días representados **no son observaciones diarias independientes**. [Guía oficial MOD13](https://modis-land.gsfc.nasa.gov/pdf/MOD13_User_Guide_V61.pdf).

## Reproducir

Desde la carpeta del proyecto, con Python 3 y sin paquetes adicionales:

```text
python scripts/fetch_evidence.py --self-test
python scripts/fetch_evidence.py
python scripts/fetch_evidence.py --offline
```

El primer comando prueba el parser sin red. El segundo consulta los metadatos y descarga lotes de hasta diez fechas, con un tiempo de espera de 120 segundos por solicitud, reintentos limitados y caché reutilizable. El tercero reconstruye el resultado únicamente con bytes guardados, después de comprobar sus SHA-256. `--refresh` obtiene comprobantes nuevos y conserva los anteriores; `--timeout 180` permite ampliar la espera de solicitudes lentas.

El servicio puede responder 503 o demorarse. Una ejecución fallida no fabrica valores ni sobrescribe el resultado final con una serie parcial. Se puede repetir el comando: las respuestas ya obtenidas se reutilizan. La API documenta el límite de diez fechas por solicitud y las consultas de productos, bandas, fechas y subconjuntos. [Documentación oficial de TESViS](https://modis.ornl.gov/data/modis_webservice.html).

## Archivos de salida

- `out/data/pilot.json`: índices escalados, enteros originales, QA original, fechas, alcance geográfico, procedencia y enlaces a comprobantes.
- `out/data/manifest.json`: hash del conjunto derivado y lista de respuestas que lo originaron.
- `out/data/raw/`: cuerpos HTTP originales, sin reformatear, y comprobantes con URL solicitada y final, estado, fecha UTC, tamaño y SHA-256. También se guardan cuerpos de errores HTTP.

El conjunto final sólo se escribe al terminar la recolección. Las fechas nominales sin datos se mantienen con valores nulos y una causa explícita. No se sustituyen por cero ni se interpolan.

## Escala y control de calidad

Los metadatos públicos de bandas se verifican antes de usar datos: NDVI/EVI requieren escala **0,0001**, rango entero válido **−2000 a 10000** y descarte de relleno. Se conservan `rawNdvi` y `rawEvi`; los valores escalados fuera de rango son nulos. [Metadatos de bandas de la fuente](https://modis.ornl.gov/rst/api/v1/MOD13Q1/bands).

La bandera precalculada `usable` utiliza un filtro estricto: confiabilidad 0, MODLAND QA 0, utilidad 0–2, aerosol distinto de alto y sin flags de nube adyacente, nube mixta, nieve/hielo o sombra. Además exige ambos índices en rango. El motor de análisis puede recalcular por variable y comparar filtros explícitos utilizando los enteros QA originales. Una clasificación QA favorable no demuestra ausencia de error de medición.

El parser comprueba que todas las respuestas correspondan al punto solicitado y al mismo píxel nativo; exige exactamente un valor por banda, coherencia entre fecha MODIS y fecha calendario y coincidencia del tile/procesamiento entre bandas. Rechaza duplicados o cambios de alcance en lugar de ocultarlos.

## Colección y trazabilidad

No se asume la colección 061 a partir de que sea la versión actual en otro catálogo. Se intenta cruzar **fecha MODIS + tile + identificador de procesamiento** con los nombres de gránulos obtenidos del catálogo NASA CMR. El resultado se registra en `source.collectionVerification`, tanto si logra verificar todos los compuestos como si queda parcial o sin resolver. Sólo una coincidencia completa y unívoca permite declarar `source.collectionVersion` verificada. [API pública NASA CMR](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html).

El servicio TESViS se cita mediante [DOI 10.3334/ORNLDAAC/1600](https://doi.org/10.3334/ORNLDAAC/1600). Para citar el producto debe usarse la colección efectivamente verificada en el manifiesto.

No se derivan aquí conclusiones de deforestación, causalidad ni riesgo operativo. El conjunto es una evidencia local para evaluar variación temporal con sus faltantes y decisiones de calidad a la vista.
