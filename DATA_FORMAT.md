# Importar una serie mensual

En **Datos y fuentes**, elegí **Importar serie JSON** y seleccioná un archivo preparado según este contrato. Un archivo contiene una variable y una de las tres áreas de estudio. Los valores deben estar procesados y convertidos a las unidades finales; la app no abre gránulos HDF/NetCDF ni realiza su control de calidad satelital.

**La validación verifica estructura y coherencia básica, no autenticidad.** Una URL válida no prueba que los valores provengan de ella. El objeto validado conserva `provenanceVerified: false`; revisá archivos de origen, método y procedencia antes de sostener conclusiones. Nunca uses `kind: "observations"` para cargar simulaciones.

## Objeto principal

| Campo | Regla |
| --- | --- |
| `schemaVersion` | Número entero `1`. |
| `kind` | Texto exacto `"observations"`. |
| `variable` | `ndvi`, `evi`, `precip`, `hotspots` o `soil`. |
| `area` | `seco`, `transicion` o `humedo`. Debe corresponder al rectángulo documentado abajo. |
| `units` | Coincidencia exacta con la unidad de la variable. |
| `source` | Ficha de procedencia con los siete campos obligatorios indicados abajo. |
| `points` | Entre 1 y 2400 registros mensuales, sin duplicados. |

Los campos adicionales no sustituyen ninguno obligatorio. Los registros aceptados se ordenan por fecha; del registro mensual se conservan `date`, `value`, `coverage` y `quality`. Si hay meses omitidos entre la primera y la última fecha del archivo, el importador los agrega como `value: null`, `coverage: 0` y `quality: "missing"`. Así el gráfico conserva el hueco y la calidad cuenta esos meses ausentes: no se interpolan valores ni se inventan observaciones. No se extiende la serie antes o después de sus extremos.

## Variables y unidades

| `variable` | `units` exacto | Rango numérico admitido | Agregación anual |
| --- | --- | --- | --- |
| `ndvi` | `1` | −1 a 1 | Media de meses válidos |
| `evi` | `1` | −1 a 1 | Media de meses válidos |
| `precip` | `mm/mes` | 0 a 5000 | Suma de acumulados mensuales |
| `hotspots` | `detecciones/mes` | Entero de 0 a 10000000 | Suma de conteos mensuales |
| `soil` | `m³/m³` | 0 a 1 | Media de meses válidos |

Estos rangos son controles generales del importador, no sustituyen el rango válido y los valores de relleno de cada producto. Para MOD13A2 se deben aplicar su escala, sus máscaras y su rango publicado antes de importar. En precipitación, `mm/h` no equivale a `mm/mes`: verificá los atributos y convertí una sola vez. En focos, conservá sensor, plataforma, producto y método de conteo homogéneos.

## Áreas admitidas

Coordenadas WGS84 en orden `[oeste, sur, este, norte]`:

```json
{
  "seco": [-63.5, -25.5, -62.5, -24.5],
  "transicion": [-61.5, -26.5, -60.5, -25.5],
  "humedo": [-59.5, -26.5, -58.5, -25.5]
}
```

Son ventanas exploratorias. La versión actual no permite importar un polígono arbitrario ni verifica contra la geometría de los archivos originales. No asignes una serie de otra región a uno de estos identificadores.

## Procedencia: `source`

Todos estos campos son obligatorios, de texto no vacío, con hasta 2000 caracteres por campo:

- `title`: nombre descriptivo de la serie y su fuente.
- `url`: URL HTTPS de la fuente o del registro reproducible. Se comprueba sintaxis y protocolo; no se descarga ni autentica su contenido.
- `product`: identificador del producto realmente utilizado.
- `version`: versión de ese producto.
- `downloadedAt`: fecha real de descarga, válida, en formato `YYYY-MM-DD`.
- `aggregation`: cómo se aplicó el recorte espacial, ponderación de área y agregación temporal, con las conversiones de unidades necesarias.
- `qualityFilter`: banderas y umbrales de QA utilizados, tratamiento de faltantes y definición de `coverage`.

Conviene mantener además un manifiesto externo con polígono, lista completa de gránulos, hashes y versión del código de procesamiento. El importador no comprueba que el producto o la versión declarados sean compatibles con los valores: esa revisión sigue siendo necesaria.

## Cada registro de `points`

| Campo | Regla |
| --- | --- |
| `date` | Texto `YYYY-MM`, entre 1900 y 2099; mes 01 a 12. Una sola fila por mes. |
| `value` | Número finito en el rango de la variable o `null`. No números entre comillas. |
| `coverage` | Número entre 0 y 1: fracción válida conforme al método documentado. Debe reflejar la cobertura, no la confianza subjetiva. |
| `quality` | Texto exacto `valid`, `suspect` o `missing`. |

Un valor `null` debe llevar `quality: "missing"`; un registro `missing` debe llevar `value: null`. Un cero observado es un número válido y no representa ausencia de datos. Los registros con `synthetic: true` se rechazan. Omitir esa marca no transforma datos sintéticos en observaciones.

Para `soil` no se aceptan meses anteriores a `2015-04`. La validación general admite fechas fuera del período de la demo; eso no cambia la disponibilidad histórica del producto y requiere un período de análisis compatible en la interfaz.

Se usa un mes en los cálculos únicamente si su valor es finito, `quality` es `valid` y `coverage` es al menos **0.8**. Los valores sospechosos, los faltantes y los de cobertura menor permanecen excluidos; no se rellenan ni se convierten a cero. Un archivo puede ser válido y aun así no contener suficientes meses utilizables para un análisis.

## Plantilla sin observaciones inventadas

La siguiente plantilla contiene sólo un faltante y una fecha de descarga por completar. **No está lista para importar**: reemplazá los textos de preparación, usá la fecha verdadera y agregá únicamente valores calculados desde tus archivos reales.

```json
{
  "schemaVersion": 1,
  "kind": "observations",
  "variable": "ndvi",
  "area": "seco",
  "units": "1",
  "source": {
    "title": "COMPLETAR: título de la serie real",
    "url": "https://doi.org/10.5067/MODIS/MOD13A2.061",
    "product": "MOD13A2",
    "version": "061",
    "downloadedAt": "AAAA-MM-DD",
    "aggregation": "COMPLETAR: recorte, ponderación espacial y temporal",
    "qualityFilter": "COMPLETAR: banderas QA y definición de cobertura"
  },
  "points": [
    {"date": "2015-01", "value": null, "coverage": 0, "quality": "missing"}
  ]
}
```

## Qué calcula el motor

**Referencia mensual:** promedio de los meses calendario equivalentes entre 2015 y 2020, con al menos cinco observaciones utilizables para ese mes. La anomalía absoluta es valor menos referencia. El porcentaje se omite si la referencia es cero; el puntaje estandarizado se omite si no hay desviación estándar positiva. No se inventan referencias faltantes.

**Agregados anuales:** requieren los doce meses distintos y utilizables. Las medias anuales son medias aritméticas de los doce valores mensuales; las sumas corresponden a lluvia y detecciones. Años incompletos quedan sin valor anual, incluido 2015 de SMAP.

**Tendencias:** Sen usa los años reales entre pares para expresar la pendiente por año. Mann–Kendall clásico usa corrección por empates, corrección de continuidad y p bilateral aproximado. Sólo se evalúa en observaciones declaradas con al menos diez años completos y consecutivos. Un control de correlación de retardo uno sobre residuos sin tendencia puede suspender el contraste; superar ese control no demuestra independencia. No se implementa un ajuste automático de autocorrelación ni corrección por múltiples comparaciones. El umbral exploratorio predeterminado es 0.05.

Una serie importada no obtiene certificación científica automática. La procedencia, calidad, comparabilidad y supuestos deben verificarse independientemente. Los resultados no predicen incendios ni identifican causalidad.
