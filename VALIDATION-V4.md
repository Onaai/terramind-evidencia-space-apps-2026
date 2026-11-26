# Verificación TerraMind Global 4

- 57 pruebas automatizadas aprobadas: pesos de área, fechas, QA, reintentos limitados, pausa, recuperación de bloques y procedencia.
- Histórico real MOD13Q1 2015–2025, zona −25,05/−24,95 y −63,05/−62,95: **253/253 fechas recibidas**, cero bloques fallidos, **210/253 fechas aceptadas por QA estricto**, área 112,058958 km². Completar la descarga no garantiza una tendencia significativa.
- Prueba real de agregación espacial del 1 de enero de 2025: **1.008,5296 km² en ocho bloques**, todos recibidos; NDVI estricto 0,6484841809, cobertura espacial 100%. Esta prueba grande es de una fecha, no de todo el histórico.
- Interfaz local: selección de zona, descarga, pausa y recarga conservando bloques en IndexedDB; Pro y tema claro persistentes. Vista móvil de 390 px sin desborde horizontal.
- Los comprobantes completos con URLs, hashes y metadatos se entregan en `VALIDATION-MODIS-V4.json` y `VALIDATION-MODIS-LARGE-V4.json` dentro del paquete descargable. No son datos simulados.

Los proveedores externos pueden tener interrupciones futuras: la app conserva bloques, muestra pendientes y permite reintentar. No se afirma disponibilidad garantizada en cualquier lugar o fecha.
