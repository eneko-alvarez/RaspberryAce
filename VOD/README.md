# VOD Provider API Contract

Este documento define el contrato mínimo que debe cumplir la futura API VOD legal para integrarse con `webplayer`.

## Configuración

El `webplayer` llama al proveedor usando:

```env
VOD_PROVIDER_BASE_URL=https://mi-api-vod.example.com
VOD_PROVIDER_TOKEN=opcional
```

Si `VOD_PROVIDER_BASE_URL` es `https://mi-api-vod.example.com/api/vod`, el endpoint final será:

```http
GET https://mi-api-vod.example.com/api/vod/playback
```

Si `VOD_PROVIDER_TOKEN` existe, se enviará:

```http
Authorization: Bearer <VOD_PROVIDER_TOKEN>
```

## Endpoint requerido

```http
GET /playback
```

## Parámetros para películas

```http
GET /playback?media_type=movie&tmdb_id=927085&imdb_id=tt17048514
```

Campos:

- `media_type`: siempre `movie`.
- `tmdb_id`: ID de TMDb.
- `imdb_id`: ID público de IMDb, cuando TMDb lo devuelva.

## Parámetros para series

```http
GET /playback?media_type=tv&tmdb_id=1399&imdb_id=tt0944947&season=1&episode=5
```

Campos:

- `media_type`: siempre `tv`.
- `tmdb_id`: ID de TMDb de la serie.
- `imdb_id`: ID público de IMDb de la serie, cuando TMDb lo devuelva.
- `season`: número de temporada.
- `episode`: número de episodio.

## Respuesta esperada

La API debe devolver JSON:

```json
{
  "message": "ok",
  "providers": [
    {
      "id": "main",
      "name": "Proveedor VOD",
      "embed_url": "https://player.example.com/embed/movie/tt17048514"
    }
  ]
}
```

También se acepta `stream_url` en lugar de `embed_url`:

```json
{
  "message": "ok",
  "providers": [
    {
      "id": "hls",
      "name": "HLS",
      "stream_url": "https://cdn.example.com/movie/tt17048514/index.m3u8"
    }
  ]
}
```

## Reglas

- Cada provider debe tener `embed_url` o `stream_url`.
- `embed_url` se abrirá en un iframe.
- `stream_url` se abrirá en el reproductor HTML5.
- Si no hay contenido disponible, devolver `providers: []` y un `message` útil.

Ejemplo sin disponibilidad:

```json
{
  "message": "Contenido no disponible para este título",
  "providers": []
}
```

