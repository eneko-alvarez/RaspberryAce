# Cómo usar la API

Dominio base:

```txt
https://api.eneko.com
```

## Reproducir una película

Usa:

```txt
https://api.eneko.com/embed/movie/{id}
```

Ejemplos:

```txt
https://api.eneko.com/embed/movie/927085
https://api.eneko.com/embed/movie/tt17048514
```

El `{id}` puede ser un ID de TMDb o IMDb.

En frontend se usa en un iframe:

```html
<iframe
  src="https://api.eneko.com/embed/movie/927085"
  allowfullscreen>
</iframe>
```

---

## Reproducir un episodio de serie

Usa:

```txt
https://api.eneko.com/embed/tv/{id}/{season}/{episode}
```

Ejemplo:

```txt
https://api.eneko.com/embed/tv/1399/1/5
```

Formato:

```txt
{id} = ID de la serie
{season} = temporada
{episode} = episodio
```

---

## Ver películas nuevas o añadidas

```txt
https://api.eneko.com/vapi/movie/new
https://api.eneko.com/vapi/movie/add
```

Con paginación:

```txt
https://api.eneko.com/vapi/movie/new/2
https://api.eneko.com/vapi/movie/add/15
```

---

## Ver series nuevas o añadidas

```txt
https://api.eneko.com/vapi/tv/new
https://api.eneko.com/vapi/tv/add
```

Con paginación:

```txt
https://api.eneko.com/vapi/tv/new/2
https://api.eneko.com/vapi/tv/add/15
```

---

## Últimos episodios añadidos

```txt
https://api.eneko.com/vapi/episode/latest
```

---

## Diferencia rápida

```txt
/embed = reproductor para ver una película o episodio concreto
/vapi  = listas de contenido disponible
```

---

## Flujo recomendado

```txt
1. Usar TMDb para buscar películas, series, posters, títulos y metadatos.
2. Guardar el tmdb_id o imdb_id.
3. Cuando el usuario pulse reproducir, abrir el iframe con /embed.
4. Usar /vapi solo para ver contenido nuevo o recientemente añadido.
```

---

## Subtítulos personalizados

Puedes pasar subtítulos al reproductor con `sub.info`.

```txt
https://api.eneko.com/embed/movie/927085?sub.info=https://example.com/subs.json
```

Formato del JSON:

```json
[
  {
    "file": "sub_en.vtt",
    "label": "English"
  }
]
```
