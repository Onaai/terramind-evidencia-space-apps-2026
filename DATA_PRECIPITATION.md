# Precipitación real — NASA POWER / GPM IMERG

La serie corresponde a una consulta fija en **25° S, 63° O**, del **1 de enero de 2015 al 31 de diciembre de 2025**. NASA POWER devolvió 4.018 registros diarios con fuente explícita `IMERG`, tiempo UTC y unidades `mm/day`. Son estimaciones de precipitación del producto satelital; no una simulación ni una medición de pluviómetro en el punto.

La resolución nominal documentada es **0,1°**. La respuesta repite las coordenadas consultadas, pero no entrega el centro o el contorno exacto de la celda nativa. No se atribuye a esta serie la resolución de 250 m del píxel MODIS, ni se la presenta como un promedio de todo el Gran Chaco. [Fuente y metodología oficial POWER/IMERG](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/#imerg).

## Reproducir y auditar

Desde la carpeta del proyecto, usando Python 3 sin instalar paquetes:

```text
python scripts/fetch_precipitation.py --self-test
python scripts/fetch_precipitation.py --offline
```

La segunda orden reconstruye el conjunto exclusivamente desde los originales incluidos y comprueba sus SHA-256. Para una descarga nueva: `python scripts/fetch_precipitation.py --refresh`. Sin `--refresh`, el script reutiliza el caché y sólo consulta la API si falta. Los bytes anteriores se archivan si la respuesta nueva cambia.

El código valida producto, coordenadas, período, UTC, unidades y ausencia de fechas inesperadas o claves duplicadas. Mantiene los días ausentes o inválidos como `null`; cero sigue siendo precipitación cero. No impone un máximo arbitrario de lluvia ni rellena faltantes.

- `out/data/power-raw/imerg-daily-2015-2025.raw.json`: respuesta HTTP original, sin reformatear.
- `out/data/power-raw/receipt.json`: URL, estado, fecha real de consulta, tamaño y hash del original.
- `out/data/precipitation.json`: serie diaria normalizada, alcance, limitaciones y procedencia.
- `out/data/precipitation-manifest.json`: comprobación del conjunto derivado y de sus fuentes.

SHA-256 del original incluido: `b9884ccbba49a7eb49c4410df015ade4e8a272a2b95fd8c11436b938e576ff76`. La consulta se realizó el 15/11/2026 a las 16:43:43 UTC; respondió HTTP 200, con API v2.10.3. [Consulta exacta reproducible](https://power.larc.nasa.gov/api/temporal/daily/point?parameters=IMERG_PRECTOT&community=AG&longitude=-63&latitude=-25&format=JSON&start=20150101&end=20251231&time-standard=UTC).

## Unidades y agregación

La documentación describe IMERG_PRECTOT como suma diaria derivada de datos de media hora; la respuesta concreta rotula `mm/day`. Se integra cada valor sobre **su único día UTC**, de modo que su aporte numérico al acumulado diario en mm es el mismo. El acumulado mensual suma los días válidos de un mes completo; el anual suma los doce meses completos. **No se multiplica cada registro diario por los días del mes.** [API diaria y estándar temporal](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).

Comprobaciones independientes del original incluido: enero de 2015 suma 209,03 mm; febrero de 2016 suma 274,16 mm en 29 días. Se contrastaron sumas directas con aritmética decimal y sumas de los acumulados mensuales. El calendario contiene 4.018/4.018 días esperados, sin rellenos −999, valores negativos, días extra ni días ausentes: 132 meses completos y once años completos.

## Límites que deben acompañar el resultado

La API identifica IMERG pero **no declara colección ni run de procesamiento**. `collectionVersion` y `run` permanecen nulos. La documentación sitúa la mezcla Late/Final cerca del tiempo presente y recomienda terminar una serie de tendencias con suficiente margen; el corte 2025 queda fuera de esa ventana reciente. Eso no verifica por sí mismo la versión de cada registro, por lo que no se afirma “V07 verificado” ni “Final verificado”.

El parámetro `IMERG_PRECRETRIEVALS` aparece en la documentación, pero la API lo rechazó con HTTP 422 durante esta investigación. No se dispone en este conjunto de esos conteos ni de banderas detalladas de calidad. **100% de fechas disponibles expresa completitud temporal, no calidad del 100%, ausencia de sesgo ni certeza de una tendencia.** Los errores de estimación y la representatividad espacial siguen requiriendo revisión científica.

La alternativa PRECTOTCORR/MERRA-2 investigada por separado no se incluyó ni se mezcló con estos datos. El análisis debe interpretar cualquier tendencia como exploratoria, sin atribuir causas ni emitir alertas operativas.
