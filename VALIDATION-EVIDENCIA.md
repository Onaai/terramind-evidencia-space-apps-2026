# Verificación de entrega — 15 de noviembre de 2026

## Resultado

33 pruebas automatizadas aprobadas. Se verificaron módulos y recursos locales, parser de MODIS, interfaz en escritorio y celular (390 px), cambio de indicador, gráficos anuales/anomalías, filtros de período y vistas científica/proyecto. No hay desborde horizontal en la revisión móvil final. El fondo NASA GIBS cargó imágenes reales y mantiene atribución. Google Maps requiere una clave propia y no se probó con una clave autenticada.

## Auditoría independiente de observaciones

Se contrastó el motor JavaScript con una implementación independiente en Python, sin importar el motor ni el parser de la aplicación.

- **MODIS:** 253 compuestos recibidos; 30 comprobantes SHA-256 verificados; 3.036 registros de bandas originales leídos y 1.265 valores de las cinco bandas utilizadas cotejados. Se comprobaron 16 combinaciones de índice, QA y período: medias anuales, Sen, referencia estacional, anomalías, empates y suspensión de inferencia cuando corresponde.
- **IMERG:** 4.018 valores diarios cotejados contra el original; hash verificado; acumulados de 11 años contrastados con aritmética decimal. Pendiente de Sen y Mann–Kendall reproducidos independientemente con corrección de continuidad. Cero días ausentes en el archivo obtenido; eso no equivale a QA verificado.

| Análisis principal 2015–2025 | Compuestos/días aceptados | Años aptos | Sen por año | p exploratorio |
|---|---:|---:|---:|---:|
| NDVI, QA estricto | 238/253 | 11 | −0,01152289 | 0,27575787 |
| EVI, QA estricto | 238/253 | 11 | +0,00174139 | 0,64042875 |
| IMERG, calendario diario completo | 4.018/4.018 | 11 | −0,95285714 mm | 1,00000000 |

Ninguno de estos resultados es significativo a α=0,05 en el contraste exploratorio empleado. Esto no demuestra ausencia de cambio ni atribuye causas. Las resoluciones espaciales son diferentes y no se calculó correlación causal ni promedio regional.

## Procedencia y límites

MODIS: 252 de 253 identificadores de adquisición/tile/procesamiento coinciden con gránulos CMR colección 061. Uno no quedó resuelto, por eso **no se declara la colección del conjunto completo como verificada**. IMERG: la respuesta POWER identifica IMERG, pero no explicita colección/run ni QA de recuperación. Esas limitaciones figuran en la aplicación y documentación.

No se ofrece un selector arbitrario de regiones, extracciones de polígonos, alertas operativas, causalidad, recuperación ecológica validada ni datos SMAP/incendios en esta entrega. Son expansiones pendientes.

No se probó el guardado de descargas mediante el diálogo automatizado del navegador; se revisaron sus generadores y tipos. Las respuestas originales, datos normalizados y metodología también están disponibles como archivos directos y en GitHub.

No hubo validación externa por investigadores ni pruebas de impacto con usuarios. Las pruebas verifican implementación y trazabilidad; no son un aval científico institucional.
