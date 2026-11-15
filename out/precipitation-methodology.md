# Precipitación: método del piloto TerraMind Evidencia

## Fuente y alcance

Se analiza `IMERG_PRECTOT` de NASA POWER, consultado para −25°, −63° en días UTC de 2015–2025. POWER documenta este parámetro como precipitación IMERG derivada de las estimaciones de la constelación GPM, a resolución de 0.1°. Es una estimación de celda consultada por coordenada; no es un pluviómetro ni un promedio regional del Gran Chaco. No se intercambia con el parámetro de reanálisis MERRA-2 `PRECTOTCORR`. [NASA POWER: fuentes meteorológicas, sección IMERG](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

La respuesta diaria declara mm/día. La documentación también describe `IMERG_PRECTOT` como suma diaria en mm a partir de datos de media hora. Cada registro se integra sobre **un día UTC**, por lo que el acumulado mensual es la suma de esos valores. No se multiplica cada registro por los días del mes, ni se trata la suma mensual como una tasa media. Las unidades mostradas son **mm acumulados** por mes o año.

POWER advierte que puede combinar Late y Final Run cerca del tiempo real y recomienda terminar los análisis de tendencias al menos 3.5 meses antes de ese momento. El corte en diciembre de 2025 cumple ese margen al descargar en noviembre de 2026. Esto no verifica por sí mismo la colección o el run de cada registro: si la respuesta no los declara, quedan explícitamente sin verificar. Tampoco se asignan flags de calidad a partir de la ausencia de rellenos. [Advertencia y descripción de integración de NASA POWER](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

## Completitud sin imputación

Se construye el calendario UTC completo, incluyendo el 29 de febrero. Cero es precipitación válida. Valores nulos, negativos, no finitos, ausentes y fechas duplicadas se excluyen; una fecha duplicada no se promedia. El motor no adopta un máximo diario arbitrario.

Un mes recibe un acumulado para análisis sólo si **todos sus días esperados son válidos**. Un año recibe un acumulado para tendencia sólo si tiene **doce meses completos y todos los días del año válidos**. Los totales parciales se conservan como `totalOfAvailable` para inspección y no sustituyen un total completo. No se rellenan huecos con cero, no se interpolan y no se extrapola un total mediante una regla de tres. La cobertura es la fracción de días esperados con un valor válido; no representa precisión del sensor ni cantidad de recuperaciones satelitales independientes.

Las cuatro estaciones meteorológicas australes se informan como contexto de completitud: verano dentro del año calendario (enero, febrero, diciembre), otoño (marzo–mayo), invierno (junio–agosto) y primavera (septiembre–noviembre).

## Referencia y anomalías

Para cada mes calendario se obtiene el promedio de los acumulados mensuales completos de **2015–2020**, requiriendo al menos cuatro años válidos. La anomalía es acumulado mensual menos ese promedio, en mm. Un mes incompleto o una referencia insuficiente no recibe anomalía. La referencia se construye desde el archivo completo, aunque el usuario seleccione un intervalo más corto.

Esta referencia de seis años es corta y **no es una normal climatológica**. Febrero compara acumulados de 28 o 29 días según corresponda; no se normalizan sus duraciones. No se calculan SPI, SPEI ni una clasificación de sequía. Una anomalía de precipitación no demuestra por sí sola un cambio del clima, estrés de vegetación o su causa.

## Tendencia y límites

Se usa el mismo motor de tendencia declarado en la [metodología de vegetación](./methodology.md), aplicado aquí a **acumulados anuales**. Sen es la mediana de pendientes entre pares de años aptos, en **mm de acumulado anual por año**; conserva carácter descriptivo incluso si no se puede contrastar. Mann–Kendall bilateral, con empates, continuidad y aproximación normal, requiere al menos diez años aptos consecutivos. El tamaño de muestra son los años; no los días ni los meses.

Se suspende el p-valor clásico si la correlación de retardo uno de los residuos de Sen supera en magnitud `1.96/sqrt(n)`. Ese control aproximado tiene poca potencia con once años y no demuestra independencia cuando no detecta dependencia. α = 0.05 es exploratorio. No hay corrección por múltiples pruebas ni intervalos de confianza para Sen. No significancia no prueba estabilidad; significancia no identifica causas.

La sensibilidad presenta sólo tres ventanas prespecificadas cuando el período lo permite: completo, sin primer año, sin último año. No ofrece un QA «relajado»: la consulta no aporta esos flags. Las variantes no son pruebas independientes ni un mecanismo para elegir el p-valor más favorable.

## Reproducción

Cada resultado debe acompañarse de URL exacta de consulta, fecha de recuperación, archivo original, hash, unidades de la respuesta y reglas anteriores. El cotejo independiente debe comprobar sumas mensuales/anuales desde la respuesta original y la estadística resultante. La disponibilidad completa y la coincidencia aritmética no sustituyen validación con pluviómetros o una evaluación del error del producto en este sitio.
