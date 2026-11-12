# TerraMind / SIGMA EARTH — fuentes y ruta científica

El MVP abre en **modo demostración**. Las series, cambios y anomalías de ese modo son sintéticos y no describen lo ocurrido en el Gran Chaco. El catálogo NASA verificado es real, pero encontrar un archivo en un catálogo no equivale a descargarlo, aplicar control de calidad ni producir una observación regional.

## Caso acotado

Explorar la evolución de vegetación, lluvia, humedad superficial del suelo y detecciones térmicas en tres ventanas del Gran Chaco argentino, entre 2015 y 2025. Las ventanas son rectángulos exploratorios de un grado, no límites oficiales de ecorregiones:

| ID | Nombre exploratorio | Oeste, sur, este, norte (WGS84) |
| --- | --- | --- |
| `seco` | Chaco seco | −63.5, −25.5, −62.5, −24.5 |
| `transicion` | Transición | −61.5, −26.5, −60.5, −25.5 |
| `humedo` | Chaco húmedo | −59.5, −26.5, −58.5, −25.5 |

No extrapolar sus resultados a todo el Gran Chaco ni tratarlas como una clasificación ecológica validada. Antes de un análisis real se debe fijar y conservar el polígono definitivo.

## Productos verificables

### Vegetación: MOD13A2, colección 061

NDVI y EVI de Terra/MODIS, resolución nominal 1 km, composiciones de 16 días. Aplicar el factor de escala 0.0001 y la máscara de calidad documentada; conservar la fracción válida y excluir rellenos. Los índices describen propiedades espectrales de vegetación, no hectáreas de bosque ni biodiversidad. Una serie mensual necesita una regla explícita para composiciones que atraviesan meses; no basta con asignar cada composición íntegra a su fecha inicial.

Fuente y cita: [NASA LP DAAC: MOD13A2.061](https://doi.org/10.5067/MODIS/MOD13A2.061). [Guía del producto MOD13, colección 6](https://lpdaac.usgs.gov/documents/103/MOD13_User_Guide_V6.pdf); para producción confirmar diferencias de versión 6.1 en la ficha del producto.

### Precipitación: GPM_3IMERGM, versión 07, Final Run

Producto mensual de 0.1°. Usar una versión y una corrida consistentes durante todo el período. La precipitación nativa del producto mensual es una tasa; verificar los atributos del archivo y convertir `mm/h` a acumulación `mm/mes` multiplicando por las horas efectivas de cada mes. Un GeoTIFF de acumulación ya convertido no debe multiplicarse otra vez. Final incorpora información de pluviómetros y tiene latencia: no es una fuente de alertas inmediatas.

Fuentes: [NASA GPM: IMERG, acceso y documentación](https://gpm.nasa.gov/data/imerg), [DOI del producto mensual V07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07) y [ATBD IMERG V07](https://gpm.nasa.gov/sites/default/files/2023-07/IMERG_V07_ATBD_final_230712.pdf).

### Humedad del suelo: SPL3SMP, versión 009

Producto diario radiométrico de 36 km. La ficha informa cobertura desde el **31 de marzo de 2015**; el primer mes completo elegible en este MVP es **abril de 2015**. Representa humedad superficial estimada, no humedad de todo el perfil ni disponibilidad de agua para un cultivo. Usar los indicadores de recuperación y superficie; documentar la pasada seleccionada, su promedio temporal y la cobertura válida. No interpolar hacia años anteriores ni sugerir detalle parcelario a partir de la grilla de 36 km.

Fuente: [NASA NSIDC DAAC: SPL3SMP, versión 9](https://nsidc.org/data/spl3smp/versions/9). Esta página indica que el acceso a los datos requiere una cuenta gratuita Earthdata Login.

### Detecciones térmicas y área quemada

El catálogo incluye **VNP14IMG 002**, VIIRS/Suomi-NPP, 375 m nominales: son detecciones en píxeles y pasadas, no una cantidad de incendios independientes. El mismo evento puede producir muchas detecciones. Nubosidad, hora de pasada, resolución y cambios de sensor afectan las comparaciones. Para una tendencia mantener sensor/plataforma/producto constantes y describir la cobertura observacional; no sumar MODIS y VIIRS indiscriminadamente.

Como alternativa distinta está **MCD64A1 061**, área quemada mensual MODIS a 500 m. Sus valores requieren QA y cálculo de área; no convertir focos a hectáreas multiplicándolos por el área nominal de un píxel. El MVP no emite alertas operativas ni predice propagación.

Fuentes: [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/), [guía MODIS de fuego activo](https://modis-land.gsfc.nasa.gov/pdf/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf), [NASA ARSET, aclaración sobre conteos de píxeles térmicos](https://disasters.nasa.gov/sites/default/files/2021-05/Fire%20Risk%20Q%26A%20Part%203_0.pdf), [MCD64A1.061](https://doi.org/10.5067/MODIS/MCD64A1.061).

### Contexto argentino

[CONAE: consultas de focos de calor y áreas quemadas](https://catalogos5.conae.gov.ar/catalogoFocos/default.aspx) permite consultar por período y área. [CONAE: preguntas frecuentes del visor de incendios](https://geoportal.conae.gov.ar/mapstore/faq/visor-incendios/faq.html) explica incertidumbre y fuentes térmicas. Son referencias de contexto y contraste; el MVP no incorpora una serie CONAE ni afirma validación oficial.

## Conexión reproducible incluida

Desde la carpeta del proyecto, con Python 3.10 o posterior:

```sh
python scripts/discover_nasa.py
```

El script sólo usa la biblioteca estándar y no solicita credenciales. Consulta el [catálogo público NASA CMR](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html), resuelve cada colección por nombre y versión y consulta ejemplos de metadatos de gránulos para cada ventana y período. Escribe `dist/data/nasa-catalog.json` y respuestas originales en `dist/data/catalog-cache/`, con URL, fecha UTC, estado HTTP y SHA-256. El campo `cmrHits` cuenta archivos coincidentes, **no focos, lluvia ni observaciones regionales**. Los ejemplos no constituyen el inventario completo.

Se puede cambiar el período sin cambiar el código:

```sh
python scripts/discover_nasa.py --start 2020-01-01 --end 2020-12-31 --output work/catalogo-2020.json
```

Un fallo de red o una colección ambigua se registra como error y devuelve salida distinta de cero. No se sustituye por valores inventados. El archivo incluido es una captura de catálogo, no una garantía de disponibilidad futura. Para contrastarlo, volver a ejecutar el script y revisar el manifiesto nuevo.

## Qué falta para observaciones reales

1. Fijar polígono, período, producto, versión y variable. Obtener acceso Earthdata para los productos que lo requieran; mantener credenciales fuera del navegador, repositorio y archivos públicos.
2. Enumerar todos los gránulos mediante paginación `CMR-Search-After`, descargarlos y conservar identificadores, hashes, versión y fecha de acceso. El script de descubrimiento deliberadamente sólo obtiene ejemplos.
3. Decodificar HDF/NetCDF, aplicar rellenos, escalas y banderas de calidad del producto. Conservar máscara y cobertura. Un adaptador de producción necesitará bibliotecas geoespaciales, que no se incluyen como dependencia del dashboard.
4. Recortar al polígono y calcular promedios espaciales ponderados por área válida. Evitar presentar una grilla interpolada como resolución observada más fina. Agregar a meses con unidades y cobertura coherentes; no rellenar ausencias con cero.
5. Exportar una serie con procedencia, geometría, versión, método, unidades y QA. Importarla en la app según su esquema, contrastar meses de muestra con el producto y revisar la cobertura antes de interpretar tendencias.

## Interpretación estadística

Comparar cada mes contra el mismo mes de la referencia 2015–2020 evita confundir el ciclo anual con una anomalía. Es una referencia breve del MVP, no una normal climatológica de 30 años. Exigir al menos cinco valores válidos del mes de referencia; mantener anomalías sin referencia suficiente como ausentes.

Sen estima la mediana de pendientes entre pares. Mann–Kendall contrasta una tendencia monótona y debe corregir empates. Para evitar un contraste ingenuo de meses estacionales, el MVP considera agregados anuales completos; eso no elimina por sí solo autocorrelación. Una década ofrece potencia limitada. No usar un p-valor como prueba de causalidad y no etiquetar diferencias como significativas cuando faltan datos reales o no se satisfacen las condiciones del análisis. La exploración de múltiples áreas/variables necesita considerar multiplicidad antes de una conclusión confirmatoria.

## NASA Space Apps

Las fechas **14–15 de noviembre de 2026** están publicadas en el [sitio oficial NASA Space Apps](https://www.spaceappschallenge.org/). El proyecto toma el desafío «Be An Earth System Trend Detective!» indicado por el equipo. La página oficial individual no respondió durante esta verificación; no se utiliza su numeración como una afirmación científica. El MVP es un proyecto independiente, sin afiliación o validación de NASA/CONAE.
