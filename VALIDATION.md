# Verificación del MVP

Registro de comprobaciones realizadas el 11 de noviembre de 2026. Se separan las pruebas automáticas del motor y las comprobaciones interactivas de la aplicación. Estas pruebas verifican comportamiento del software; no validan observaciones ni conclusiones ambientales.

## Pruebas automáticas

- Pruebas del motor científico ejecutadas con Node: **10 de 10 aprobadas**.
- Revisión de sintaxis de los módulos JavaScript: completada sin errores.
- Catálogo NASA CMR: consulta real completada para cinco productos y tres áreas; los hashes de las 20 respuestas originales guardadas coinciden con el manifiesto.

Para repetir las pruebas del proyecto:

```sh
npm test
npm run check
```

Para actualizar y comprobar el catálogo público:

```sh
python scripts/discover_nasa.py
```

## Recorrido interactivo en navegador

Se probó la aplicación servida por HTTP, en escritorio y en una vista móvil de **390 px de ancho**. No se observó desbordamiento horizontal en esas vistas. Las comprobaciones fueron interacciones reales en navegador; no se presenta este registro como una suite automática de pruebas de extremo a extremo.

| Comprobación | Resultado observado |
| --- | --- |
| Mapa | Funcionaron el zoom y la selección de área mediante teclado. |
| Filtros de área y variable | Los cambios actualizaron la presentación; se comprobó también EVI. |
| Humedad del suelo, año 2015 | La serie comenzó en abril y mostró nueve meses. No se habilitó inferencia anual para ese año incompleto. |
| Orden del período | Al seleccionar un año final anterior al inicial, la aplicación corrigió el período. |
| Importación inválida | El archivo inválido fue rechazado con información de validación. |
| Importación sin valores observados | Se aceptó una ficha válida cuyos valores eran todos faltantes. El intervalo se normalizó a tres meses, incluidos los huecos; no se generaron mediciones. |
| Descarga de CSV | Se abrió el archivo descargado y se comprobaron sus primeras filas; la procedencia de la demo quedó rotulada `demo_sintetico`. |
| Consola del navegador | No se observaron errores durante el recorrido comprobado. |

## Límites de esta verificación

La aplicación incluida opera con series demostrativas. La consulta de catálogo no descarga ni procesa observaciones satelitales. La importación valida formato y controles básicos, pero no autentica la fuente ni reproduce el procesamiento de terceros.

Este registro no acredita un sistema operativo de alertas, predicciones de incendios, validación científica regional ni compatibilidad exhaustiva con todos los dispositivos y navegadores. Tampoco constituye constancia de publicación: la disponibilidad del sitio desplegado se informa por separado.
