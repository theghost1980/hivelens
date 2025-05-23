# Hive Image Lens - Tareas Pendientes

# TODO List - Hivelens Project

- [ ] Planificar e implementar una estrategia de respaldos (backups) para la base de datos SQLite, considerando su crecimiento estimado.
- [ ] Implementar funcionalidad de backup de la BD (usando el comando `.backup` de SQLite o la API de backup online si la librería lo permite).

## I. Análisis con Inteligencia Artificial (IA)

Tecnología: (Opción B - Local/Más Simple)
Librería Sugerida: TensorFlow.js con un modelo pre-entrenado para clasificación de imágenes (ej. MobileNet).

Estrategia de Integración:

1.  **Proceso Separado:** Implementar la lógica de análisis de IA como un proceso que no se ejecuta durante la sincronización inicial de Hive.
2.  **Activación Manual:** Crear un mecanismo para activar el proceso de análisis de IA manualmente (ej. un script, una ruta API protegida, o un botón en una UI de administración futura).
3.  **Procesamiento por Bloques:** El proceso de IA deberá tomar imágenes de la base de datos local con `ai_analysis_status = 'pending'`, analizarlas en bloques (ej. 10, 50, o 100 a la vez) para gestionar recursos y permitir la depuración.
4.  **Actualización de DB:** Guardar los resultados del análisis de IA (categoría, features) en la tabla `indexed_images` y actualizar `ai_analysis_status` a 'completed' o 'failed'.

## II. Interfaz Gráfica (Buscador) - Mejoras

1.  **Filtros por Resultados de IA:** Permitir filtrar las imágenes en la UI basándose en los campos `ai_content_type` y `ai_features` una vez que el análisis de IA esté implementado.
2.  **Paginación:** Implementar paginación en la `ImageResultsGrid` para manejar grandes cantidades de imágenes de manera eficiente.

## III. Mejoras Adicionales (Opcional / Futuro)

1.  **Botones para Detener Procesos:** Investigar e implementar (si es factible con la arquitectura actual) botones para detener la sincronización o búsquedas largas.
2.  **Optimización de Rendimiento de Sincronización:** Evaluar si la validación de URLs (`isValidImageUrl`) puede optimizarse más o moverse a un proceso en segundo plano si la sincronización se vuelve demasiado lenta.
3.  **UI de Administración para IA:** Si se implementa la activación manual de IA, considerar una pequeña UI para gestionar este proceso.
4.  **Extracción de Créditos/Fuente:** Reconsiderar la extracción de referencias de fuente/crédito del cuerpo del post si se considera una característica importante.

## IV. API de Servicio de Imágenes (Futuro)

Esta sección describe mejoras y consideraciones para cuando HiveLens actúe como un servicio de imágenes para sitios externos, ofreciendo transformaciones bajo demanda.

1.  **Implementación de API Route (`/api/serve-image`):**
    - Diseñar y desarrollar la ruta API que acepte una URL de imagen externa y parámetros de transformación.
2.  **Librería de Procesamiento de Imágenes:**
    - Integrar una librería del lado del servidor (ej. **Sharp.js**) para realizar las transformaciones de imágenes (redimensionar, cambiar formato, ajustar calidad, etc.).
3.  **Estrategia de Caché para Imágenes Transformadas:**
    - Diseñar e implementar un sistema de caché robusto para las imágenes procesadas.
    - Opciones: caché en disco, Redis, o almacenamiento en S3/Cloud Storage para las variantes generadas.
4.  **Parámetros de Transformación en la API:**
    - Definir cómo se especificarán las transformaciones (ej. `?url=...&width=300&height=200&format=webp&quality=80`).
    - Considerar transformaciones básicas (tamaño, formato, calidad) y potencialmente avanzadas (recorte, marcas de agua) a largo plazo.
5.  **Seguridad y Límites de la API:**
    - Implementar medidas para prevenir el abuso (ej. rate limiting, validación de URLs de origen si es necesario).
    - Manejo de errores y timeouts al obtener imágenes externas.
