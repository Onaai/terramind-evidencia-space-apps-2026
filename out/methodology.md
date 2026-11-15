# Método del piloto TerraMind Evidencia

Este piloto estudia **un solo píxel nativo de MOD13Q1** cercano a −25°, −63°, entre 2015 y 2025. No representa un promedio del Gran Chaco, una parcela relevada ni un mapa de deforestación. El centro y la geometría efectivos, la colección y la procedencia se informan en el archivo de datos: no se deducen a partir del nombre comercial del producto.

## Observaciones y tiempo

Se conservan NDVI y EVI en su frecuencia nativa de composiciones de 16 días. Los índices se escalan por 0.0001; el rango de valores crudos admitido es −2000 a 10000. Los rellenos y los faltantes no son ceros.

Cada año tiene 23 posiciones nominales, comenzando en el día 1 y avanzando de 16 en 16. El último intervalo se trunca al final de ese año: representa 13 días, o 14 en años bisiestos. Esta duración es **tiempo nominal representado por el compuesto**, no cantidad de días efectivamente observados ni promedio diario de todas las pasadas. El día de la observación seleccionada, cuando está disponible, se conserva como metadato y no se utiliza para inventar una serie diaria. Una composición elige observaciones con el algoritmo del producto y no debe interpretarse como 16 mediciones independientes.

Los compuestos ausentes se mantienen como huecos explícitos. Un registro marcado `no_subset_returned` o `not_listed_by_api` no cuenta como compuesto recibido aunque exista una fila para su fecha. Un compuesto recibido con QA rechazado se distingue de esa ausencia; si sólo falta una banda, la disponibilidad del otro índice se conserva. Si se encuentra una fecha duplicada, se excluye esa posición en vez de promediarla silenciosamente. NDVI y EVI se evalúan por separado; un índice inválido no invalida por sí solo al otro.

## Filtros QA fijados antes de analizar

La decodificación sigue los campos de MOD13 documentados por LP DAAC. Los umbrales de aceptación son decisiones conservadoras de este piloto; no una clasificación universal impuesta por NASA. [Guía oficial MOD13, colección 6.1](https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf).

| Control | Estricto, análisis principal | Relajado, sensibilidad |
| --- | --- | --- |
| Pixel reliability | 0 | 0 o 1 |
| MODLAND, bits 0–1 | 0 | 0 o 1 |
| VI usefulness, bits 2–5 | 0, 1 o 2 | 0, 1, 2, 4 u 8 |
| Aerosol, bits 6–7 | Excluir 3 | Excluir 3 |
| Nube adyacente, bit 8 | Excluir si está activo | Igual |
| Nube mixta, bit 10 | Excluir si está activo | Igual |
| Nieve/hielo, bit 14 | Excluir si está activo | Igual |
| Sombra, bit 15 | Excluir si está activo | Igual |

No se admiten QA ausentes ni valores de utilidad no incluidos en la tabla. El modo relajado acepta calidad marginal y no debe usarse sólo porque arroje un resultado más llamativo. No se traduce QA a una probabilidad ficticia de que la conclusión sea correcta.

## Resumen anual

La estimación anual es la media de los compuestos aceptados, ponderada por la duración nominal de cada intervalo. Por ejemplo, un compuesto final de 13 días pesa menos que uno de 16. El denominador usa únicamente la duración de intervalos aceptados. No se interpolan los restantes.

Un año participa en la tendencia si alcanza **al menos 80% del tiempo nominal del año** y tiene representación en las cuatro estaciones meteorológicas australes. Dentro del año calendario se cuentan verano (enero, febrero y diciembre), otoño (marzo–mayo), invierno (junio–agosto) y primavera (septiembre–noviembre). Se reparte la duración de compuestos que cruzan límites de estación. Se requiere alguna duración aceptada en cada estación, no un porcentaje mínimo independiente por estación; sus coberturas se conservan para inspección. Estos criterios no eliminan por completo el sesgo de muestreo ni la incertidumbre del sensor.

Un año no apto queda sin valor para inferencia. La media de los intervalos disponibles puede conservarse como dato descriptivo, pero no reemplaza el año excluido. «Apto» no significa año observado todos los días ni validación científica definitiva.

## Referencia estacional y anomalías

Se compara cada posición de 16 días con la **misma posición del año** durante 2015–2020, con el mismo filtro QA. Se requieren cuatro compuestos aceptados de años distintos en esa posición. La diferencia absoluta es el índice actual menos la media de referencia. Si no alcanza la referencia o falla QA, no se calcula anomalía.

La referencia se construye con el archivo completo, no sólo con el período elegido en pantalla. Es corta y no constituye una normal climatológica de 30 años. En años bisiestos las posiciones siguen el día del año del producto; sus fechas calendario posteriores a febrero difieren en un día. El período de referencia puede solaparse con el análisis: las anomalías son descriptivas y no se les asigna un contraste independiente.

## Pendiente e inferencia exploratoria

**Sen:** mediana de las pendientes entre pares de años aptos, usando los años reales transcurridos. La unidad es índice por año. Una pendiente se puede describir aunque no haya suficientes años para contrastarla; no demuestra una causa ni cuantifica hectáreas de bosque.

**Mann–Kendall:** contraste bilateral de tendencia monótona, con corrección por empates y continuidad; aproximación normal. Sólo se habilita con al menos **diez años aptos consecutivos**. Es un mínimo adoptado para este piloto, no una garantía universal de potencia o validez. Los compuestos de 16 días no se tratan como observaciones independientes para inflar la muestra.

Antes del contraste se resta la recta de Sen con intercepto mediano y se calcula la correlación de retardo uno de los residuos. Si su magnitud supera `1.96 / sqrt(n)`, se suspende el p-valor clásico. Este control aproximado es una advertencia conservadora: no pasar el umbral no prueba independencia, no considera todos los retardos y con una década tiene potencia limitada. No implementa corrección automática de autocorrelación.

Se utiliza α = 0.05 como umbral **exploratorio**. No se calcula una probabilidad de que el cambio sea «real». No se aplican correcciones por múltiples pruebas ni se ofrecen intervalos de confianza de Sen en esta versión. NDVI, EVI y las variantes de sensibilidad comparten observaciones: no son confirmaciones independientes. Un resultado no significativo no demuestra estabilidad; un resultado significativo no atribuye causalidad.

## Sensibilidad fijada de antemano

Se presentan cuatro variantes cuando el período lo permite: filtro estricto completo; filtro relajado completo; estricto sin el primer año; estricto sin el último. Cada una vuelve a aplicar exactamente los criterios de cobertura y tendencia. La comparación expone fragilidad o estabilidad descriptiva frente a decisiones plausibles; no selecciona automáticamente el resultado «ganador» ni permite explorar ventanas hasta obtener significancia.

## Qué debe acompañar una conclusión

Producto y colección efectivamente verificados, ubicación del píxel, archivos y fechas de adquisición/descarga, QA, consulta, hashes y reglas de transformación. Los metadatos del catálogo no sustituyen observaciones. Una evidencia local puede motivar una investigación posterior con más píxeles, información de campo y variables explicativas; por sí sola no identifica deforestación, sequía, incendios o su causa.
