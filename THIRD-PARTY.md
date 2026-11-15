# Fuentes y componentes externos

- **Observaciones:** NASA LP DAAC, producto MOD13Q1, distribuido a través de ORNL DAAC TESViS. Consultas, versiones verificadas y comprobantes en `out/data/pilot.json` y `DATA_EVIDENCE.md`. [Servicio](https://modis.ornl.gov/data/modis_webservice.html). Cita del servicio: ORNL DAAC. 2018. Terrestrial Ecology Subsetting & Visualization Services (TESViS) RESTful Web Service. [DOI 10.3334/ORNLDAAC/1600](https://doi.org/10.3334/ORNLDAAC/1600).
- **Documentación QA:** [Guía NASA MOD13 Collection 6.1](https://modis-land.gsfc.nasa.gov/pdf/MOD13_User_Guide_V61.pdf). Citar esta guía no basta para atribuir colección 6.1 a una respuesta; el script verifica los identificadores de procesamiento con CMR.
- **Catálogo de procedencia:** [NASA CMR](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html), usado para verificar metadatos, no como sustituto de las observaciones.
- **Mapa de contexto:** [NASA GIBS](https://www.earthdata.nasa.gov/data/tools/gibs), Blue Marble Next Generation. Es una composición histórica independiente de la serie analítica. Atribución visible en el mapa.
- **Biblioteca cartográfica:** [Leaflet 1.9.4](https://leafletjs.com/), distribuida desde unpkg con verificación de integridad. [Licencia BSD-2-Clause](https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE). Se carga externamente; no se cambia ni se elimina su atribución.
- **Tipografía:** DM Sans y Manrope, servidas por Google Fonts. [Repositorio Google Fonts](https://github.com/google/fonts), respectivas licencias OFL. Hay fuentes del sistema como alternativa sin red.
- **Google Maps:** opcional, sólo mediante la API oficial con clave del propietario y sus condiciones. No se redistribuyen mosaicos de Google ni se borran atribuciones.
- **CONAE:** enlace institucional de contexto. No es proveedor de datos del caso actual ni avala esta aplicación.

Los datos y componentes de terceros conservan sus respectivas condiciones de uso. El equipo debe declarar las fuentes y herramientas utilizadas en la entrega oficial, incluyendo asistencia de IA y antecedentes.
