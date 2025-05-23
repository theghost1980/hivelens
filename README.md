# Hivelens Image Index

**Version:** 1.0.0

---

## English

### About The Project

Hivelens is a project dedicated to indexing images posted on the HIVE blockchain. With a constant stream of new images being created, especially in blogging, many valuable visual resources often go underutilized or are difficult to rediscover. Hivelens addresses this by:

1.  **Indexing Images:** Systematically cataloging images from HIVE posts.
2.  **Providing a Reliable API:** Offering an API endpoint for developers and platforms to search and retrieve these indexed images.
3.  **Promoting Resource Reusability:** Encouraging the reuse of existing visual assets, thus saving resources.
4.  **Respecting Copyright:** Facilitating the discovery of functional and reliable images, where users can choose how to provide attribution and respect author rights.

This project was born out of the necessity to make better use of the visual content on HIVE and to provide a trustworthy image source for various applications, including my smart code editor project, which you can find here: **[https://aegispad.com/]**

Hivelens also features an integrated Frontend application to visually search and explore the indexed images.

### Key Features

- **Image Indexing:** Regularly scans and stores metadata for images found on HIVE.
- **Search API:** Allows querying the image index based on:
  - Keywords (search term)
  - Author
  - Title
  - Tags
  - Date Range
- **Tag Listing API:** Provides a list of all unique tags available in the index.
- **Integrated Frontend:** A web interface to visually search and browse images.
- **Rate Limiting:** Basic protection on API endpoints.

### API Usage Examples

The API is accessible via GET requests. The base URL for your local development server is typically `http://localhost:9002/api`.

**1. API Root Information:**
Provides general information about the API and available endpoints.

```bash
curl "http://localhost:9002/api"
```

**2. Search Images:**

- **By tag:**
  ```bash
  curl "http://localhost:9002/api/search?tags=%23biking"
  ```
- **By author and limit results:**
  ```bash
  curl "http://localhost:9002/api/search?author=trezzahn&limit=5"
  ```
- **By search term, multiple tags, and pagination:**
  ```bash
  curl "http://localhost:9002/api/search?searchTerm=winter%20report&tags=%23photography,%23actifit&page=2&limit=10"
  ```
- **By date range:**
  ```bash
  curl "http://localhost:9002/api/search?dateFrom=2025-01-01&dateTo=2025-01-05"
  ```

**3. Get Available Tags:**
Lists all unique tags present in the indexed images.

```bash
curl "http://localhost:9002/api/tags"
```

_(For more details on API parameters and response structure, please refer to the API root endpoint or future dedicated documentation.)_

### Technical Details

#### Synchronization: Test Results (May 2024)

Results from a synchronization test for **1 full day** of HIVE blockchain data:

- **Total Process Time:** 38.35 minutes (2,301,140.06 ms)
- **Posts Processed:** 2,333
- **New Images Added to DB:** 9,199
- **Existing Images Skipped (Duplicates):** 1,090
- **Invalid/Inaccessible Images Skipped (Not added):** 10,458
- **Database Errors during Insertion:** 0
- **Database Size Increase (SQLite):** Approximately 9.2 MB (from 10 MB to 19.2 MB)

**Inferences:**

- **Estimated Time per Day:** Based on this test, an estimate of **40 minutes per day** is used to warn the user before initiating long synchronizations.
- **Estimated DB Growth:** ~9.2 MB per day of synchronized data. This implies an annual growth of approximately 3.2 - 3.4 GB if every day of the year is synchronized.

---

## Español

### Sobre El Proyecto

Hivelens es un proyecto dedicado a indexar imágenes publicadas en la blockchain de HIVE. Con un flujo constante de nuevas imágenes creándose, especialmente en el blogging, muchos recursos visuales valiosos a menudo son subutilizados o difíciles de redescubrir. Hivelens aborda esto mediante:

1.  **Indexación de Imágenes:** Catalogando sistemáticamente imágenes de publicaciones en HIVE.
2.  **Provisión de una API Confiable:** Ofreciendo un endpoint API para que desarrolladores y plataformas busquen y recuperen estas imágenes indexadas.
3.  **Promoción de la Reutilización de Recursos:** Fomentando la reutilización de activos visuales existentes, ahorrando así recursos.
4.  **Respeto por los Derechos de Autor:** Facilitando el descubrimiento de imágenes funcionales y confiables, donde los usuarios pueden elegir cómo dar atribución y respetar los derechos de autor.

Este proyecto nació de la necesidad de hacer un mejor uso del contenido visual en HIVE y de proporcionar una fuente de imágenes confiable para diversas aplicaciones, incluyendo mi proyecto de editor de código inteligente, que puedes encontrar aquí: **[https://aegispad.com/]**

Hivelens también cuenta con una aplicación Frontend integrada para buscar y explorar visualmente las imágenes indexadas.

### Características Principales

- **Indexación de Imágenes:** Escanea y almacena regularmente metadatos de imágenes encontradas en HIVE.
- **API de Búsqueda:** Permite consultar el índice de imágenes basándose en:
  - Palabras clave (término de búsqueda)
  - Autor
  - Título
  - Tags
  - Rango de Fechas
- **API de Listado de Tags:** Proporciona una lista de todos los tags únicos disponibles en el índice.
- **Frontend Integrado:** Una interfaz web para buscar y navegar visualmente por las imágenes.
- **Limitación de Tasa (Rate Limiting):** Protección básica en los endpoints de la API.

### Ejemplos de Uso de la API

La API es accesible mediante peticiones GET. La URL base para tu servidor de desarrollo local es típicamente `http://localhost:9002/api`.

**1. Información Raíz de la API:**
Proporciona información general sobre la API y los endpoints disponibles.

```bash
curl "http://localhost:9002/api"
```

**2. Buscar Imágenes:**

- **Por tag:**
  ```bash
  curl "http://localhost:9002/api/search?tags=%23biking"
  ```
- **Por autor y limitar resultados:**
  ```bash
  curl "http://localhost:9002/api/search?author=trezzahn&limit=5"
  ```

**3. Obtener Tags Disponibles:**
Lista todos los tags únicos presentes en las imágenes indexadas.

```bash
curl "http://localhost:9002/api/tags"
```

_(Para más detalles sobre los parámetros de la API y la estructura de la respuesta, por favor consulta el endpoint raíz de la API o futura documentación dedicada.)_

_(La sección de Detalles Técnicos con los resultados de las pruebas de sincronización se encuentra en la versión en inglés más arriba)._
