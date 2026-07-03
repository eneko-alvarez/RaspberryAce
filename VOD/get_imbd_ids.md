# README — Integración TMDb para app tipo Netflix

## Objetivo

Construir una app tipo Netflix/IMDb usando **TMDb API** como fuente principal de datos para películas, series, tendencias, búsquedas, portadas, fondos, ratings y metadatos.

La app debe permitir:

* Mostrar una home con secciones dinámicas tipo “Trending”, “Popular”, “Top Rated”, “Películas”, “Series”, etc.
* Buscar películas, series y personas.
* Ver detalle de una película o serie.
* Mostrar posters oficiales, backdrops y logos usando las rutas de imagen de TMDb.
* Guardar IDs de TMDb y, cuando exista, también el `imdb_id`.
* No scrapear IMDb ni TMDb.
* Respetar atribución y uso no comercial de TMDb.

TMDb ofrece API oficial para datos e imágenes de películas, series y personas. La API key es gratuita para uso no comercial siempre que se atribuya TMDb como fuente.

---

## API base

```env
TMDB_API_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
TMDB_ACCESS_TOKEN=xxxxx
TMDB_LANGUAGE=es-ES
TMDB_REGION=ES
```

Usar autenticación por header Bearer:

```http
Authorization: Bearer <TMDB_ACCESS_TOKEN>
accept: application/json
```

No exponer el token en frontend si hay backend propio. Crear un backend/proxy para las llamadas sensibles.

---

## Endpoints principales

### 1. Home / Trending

Para contenido en tendencia:

```http
GET /trending/all/day?language=es-ES
GET /trending/all/week?language=es-ES
GET /trending/movie/day?language=es-ES
GET /trending/movie/week?language=es-ES
GET /trending/tv/day?language=es-ES
GET /trending/tv/week?language=es-ES
```

`/trending/all/{time_window}` devuelve varios tipos de contenido en una sola llamada: películas, series y personas. `time_window` puede ser `day` o `week`.

Uso recomendado para home:

```text
Hero principal: /trending/all/day
Fila “Tendencias de la semana”: /trending/all/week
Fila “Películas en tendencia”: /trending/movie/week
Fila “Series en tendencia”: /trending/tv/week
```

---

### 2. Películas populares

```http
GET /movie/popular?language=es-ES&region=ES&page=1
```

Devuelve películas ordenadas por popularidad. TMDb indica que este endpoint funciona internamente como un discover con `sort_by=popularity.desc`.

---

### 3. Series populares

```http
GET /tv/popular?language=es-ES&page=1
```

Uso:

```text
Fila “Series populares”
```

---

### 4. Películas mejor valoradas

```http
GET /movie/top_rated?language=es-ES&region=ES&page=1
```

Uso:

```text
Fila “Mejor valoradas”
```

---

### 5. Discover avanzado

Usar `discover` para crear filas tipo Netflix filtradas por género, año, rating o popularidad.

```http
GET /discover/movie?language=es-ES&region=ES&sort_by=popularity.desc&page=1
GET /discover/movie?language=es-ES&region=ES&with_genres=28&sort_by=popularity.desc&page=1
GET /discover/tv?language=es-ES&sort_by=popularity.desc&page=1
```

Ejemplos de filas:

```text
Acción: /discover/movie?with_genres=28
Comedia: /discover/movie?with_genres=35
Terror: /discover/movie?with_genres=27
Documentales: /discover/movie?with_genres=99
Series populares: /discover/tv?sort_by=popularity.desc
```

---

## Búsqueda

### Búsqueda global

```http
GET /search/multi?query=breaking%20bad&language=es-ES&page=1&include_adult=false
```

Usar `search/multi` para buscar películas, series y personas en una sola llamada. TMDb lo recomienda cuando se quieren buscar varios tipos de contenido a la vez.

Campos importantes del resultado:

```ts
type TmdbSearchResult = {
  id: number
  media_type: "movie" | "tv" | "person"
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  profile_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  popularity?: number
}
```

Regla de UI:

```text
Si media_type === "movie", usar title y release_date.
Si media_type === "tv", usar name y first_air_date.
Si media_type === "person", usar name y profile_path.
```

---

## Detalle de película

```http
GET /movie/{movie_id}?language=es-ES&append_to_response=external_ids,images,videos,credits,recommendations,similar
```

Guardar como mínimo:

```ts
type MovieDetail = {
  tmdb_id: number
  imdb_id?: string | null
  media_type: "movie"
  title: string
  original_title: string
  overview: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  runtime?: number
  genres: { id: number; name: string }[]
  vote_average: number
  vote_count: number
  popularity: number
  videos?: unknown
  credits?: unknown
  recommendations?: unknown
  similar?: unknown
}
```

---

## Detalle de serie

```http
GET /tv/{tv_id}?language=es-ES&append_to_response=external_ids,images,videos,credits,recommendations,similar
```

Guardar como mínimo:

```ts
type TvDetail = {
  tmdb_id: number
  imdb_id?: string | null
  media_type: "tv"
  name: string
  original_name: string
  overview: string
  poster_path?: string | null
  backdrop_path?: string | null
  first_air_date?: string
  last_air_date?: string
  number_of_seasons?: number
  number_of_episodes?: number
  genres: { id: number; name: string }[]
  vote_average: number
  vote_count: number
  popularity: number
  videos?: unknown
  credits?: unknown
  recommendations?: unknown
  similar?: unknown
}
```

---

## Imágenes

Los objetos de TMDb suelen traer rutas como:

```json
{
  "poster_path": "/abc123.jpg",
  "backdrop_path": "/xyz456.jpg"
}
```

Para construir una URL completa se necesitan tres piezas: `base_url`, `file_size` y `file_path`. TMDb documenta este formato para imágenes.

Ejemplo:

```ts
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

export function tmdbPoster(path?: string | null, size = "w500") {
  if (!path) return null
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}

export function tmdbBackdrop(path?: string | null, size = "original") {
  if (!path) return null
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}
```

Tamaños recomendados:

```text
Poster en cards: w342 o w500
Poster en detalle: w780
Backdrop en hero: w1280 u original
Logos: original
```

Ejemplo:

```ts
const posterUrl = tmdbPoster(movie.poster_path, "w500")
const backdropUrl = tmdbBackdrop(movie.backdrop_path, "w1280")
```

---

## Modelo de base de datos recomendado

### Tabla `media`

```sql
CREATE TABLE media (
  id BIGSERIAL PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  imdb_id TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date DATE,
  first_air_date DATE,
  vote_average NUMERIC,
  vote_count INTEGER,
  popularity NUMERIC,
  runtime INTEGER,
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  raw_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tmdb_id, media_type)
);
```

### Tabla `genres`

```sql
CREATE TABLE genres (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
```

### Tabla `media_genres`

```sql
CREATE TABLE media_genres (
  media_id BIGINT REFERENCES media(id) ON DELETE CASCADE,
  genre_id INTEGER REFERENCES genres(id),
  PRIMARY KEY (media_id, genre_id)
);
```

---

## Estrategia de carga de datos

No intentar descargar “todo TMDb” desde el frontend.

Estrategia correcta:

```text
1. La home consume endpoints dinámicos: trending, popular, top_rated, discover.
2. La búsqueda usa /search/multi bajo demanda.
3. Al abrir un detalle, se llama a /movie/{id} o /tv/{id}.
4. Se cachea el resultado en la base de datos local.
5. Se actualizan datos antiguos bajo demanda o con cron.
```

TTL recomendado:

```text
Trending: 1-6 horas
Popular: 12-24 horas
Detalle de película/serie: 7-30 días
Búsqueda: opcional, 1-7 días
Géneros/configuración: 7-30 días
```

---

## Servicio backend recomendado

Crear un servicio `tmdb.service.ts` o equivalente.

```ts
const BASE_URL = process.env.TMDB_API_BASE_URL ?? "https://api.themoviedb.org/3"
const TOKEN = process.env.TMDB_ACCESS_TOKEN

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(`TMDb error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}
```

Ejemplos:

```ts
export function getTrendingAll() {
  return tmdbFetch("/trending/all/day", {
    language: "es-ES",
  })
}

export function searchMulti(query: string, page = 1) {
  return tmdbFetch("/search/multi", {
    query,
    language: "es-ES",
    page,
    include_adult: false,
  })
}

export function getMovieDetail(id: number) {
  return tmdbFetch(`/movie/${id}`, {
    language: "es-ES",
    append_to_response: "external_ids,images,videos,credits,recommendations,similar",
  })
}

export function getTvDetail(id: number) {
  return tmdbFetch(`/tv/${id}`, {
    language: "es-ES",
    append_to_response: "external_ids,images,videos,credits,recommendations,similar",
  })
}
```

---

## Home page recomendada

La home debe construirse con varias filas independientes:

```ts
const homeSections = [
  {
    key: "trending_today",
    title: "Tendencias de hoy",
    endpoint: "/trending/all/day",
  },
  {
    key: "trending_week",
    title: "Tendencias de la semana",
    endpoint: "/trending/all/week",
  },
  {
    key: "popular_movies",
    title: "Películas populares",
    endpoint: "/movie/popular",
  },
  {
    key: "popular_tv",
    title: "Series populares",
    endpoint: "/tv/popular",
  },
  {
    key: "top_rated_movies",
    title: "Mejor valoradas",
    endpoint: "/movie/top_rated",
  },
  {
    key: "action_movies",
    title: "Acción",
    endpoint: "/discover/movie",
    params: { with_genres: 28, sort_by: "popularity.desc" },
  },
  {
    key: "comedy_movies",
    title: "Comedia",
    endpoint: "/discover/movie",
    params: { with_genres: 35, sort_by: "popularity.desc" },
  },
]
```

Cada card debe mostrar:

```text
Poster
Título
Año
Rating
Tipo: película / serie
```

---

## Normalización de resultados

Crear una función para unificar películas y series:

```ts
export function normalizeMedia(item: any) {
  const mediaType = item.media_type ?? (item.title ? "movie" : "tv")

  return {
    tmdb_id: item.id,
    media_type: mediaType,
    title: item.title ?? item.name,
    original_title: item.original_title ?? item.original_name,
    overview: item.overview,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date ?? null,
    first_air_date: item.first_air_date ?? null,
    vote_average: item.vote_average,
    vote_count: item.vote_count,
    popularity: item.popularity,
  }
}
```

---

## IDs externos / IMDb ID

Para guardar el ID de IMDb:

```http
GET /movie/{movie_id}?append_to_response=external_ids
GET /tv/{tv_id}?append_to_response=external_ids
```

En la respuesta, buscar:

```json
{
  "external_ids": {
    "imdb_id": "tt0944947"
  }
}
```

Guardar:

```text
tmdb_id: ID interno principal
imdb_id: ID externo opcional
```

Regla:

```text
La app debe usar tmdb_id como identificador principal.
El imdb_id se guarda solo como referencia externa.
```

---

## Paginación

Muchos endpoints devuelven:

```json
{
  "page": 1,
  "results": [],
  "total_pages": 500,
  "total_results": 10000
}
```

Implementar infinite scroll o botón “cargar más” usando `page`.

No cargar todas las páginas de golpe.

---

## Rate limiting y caché

TMDb tiene documentación específica sobre rate limiting en sus guías de API. Implementar caché y evitar llamadas repetidas innecesarias.

Reglas prácticas:

```text
No llamar a TMDb en cada render.
Cachear respuestas de home.
Debounce en búsqueda: 300-500 ms.
No hacer detalle de 20 películas a la vez sin control.
Reintentar solo errores temporales: 429, 500, 502, 503.
```

---

## Atribución obligatoria

Añadir en una pantalla “About”, “Créditos” o footer:

```text
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

TMDb exige atribución cuando se usan sus datos o imágenes; también indica que el uso de su logo debe seguir sus normas y no implicar endorsement.

---

## Cosas que NO debe hacer el agente

```text
No scrapear IMDb.
No scrapear TMDb.
No usar APIs no oficiales.
No guardar el token de TMDb en frontend público si existe backend.
No descargar todo el catálogo completo sin necesidad.
No usar imágenes sin construir correctamente la URL.
No asumir que todo resultado tiene poster_path o backdrop_path.
No mezclar movie y tv sin guardar media_type.
No usar imdb_id como clave principal.
```

---

## Resultado esperado

La app debe tener:

```text
Home estilo streaming con filas dinámicas.
Buscador global.
Pantalla de detalle.
Cards con poster/backdrop.
Persistencia local/cache.
IDs TMDb + IMDb ID cuando exista.
Atribución visible a TMDb.
Código limpio y preparado para ampliar.
```

Arquitectura sugerida:

```text
Frontend
  ├── Home
  ├── Search
  ├── MediaDetail
  └── Components: MediaCard, MediaRow, HeroBanner

Backend
  ├── tmdb.service.ts
  ├── media.repository.ts
  ├── cache layer
  └── API routes propias

Database
  ├── media
  ├── genres
  └── media_genres
```
