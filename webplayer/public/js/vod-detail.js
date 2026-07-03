let activeVodItem = null;
let currentSeasonEpisodes = [];
const VOD_CONTINUE_KEY = 'raspberryace:vod-continue:v1';

document.addEventListener('DOMContentLoaded', loadVodDetailPage);

async function loadVodDetailPage() {
  const match = window.location.pathname.match(/^\/vod\/(movie|tv)\/(\d+)/);
  const loading = document.getElementById('vod-page-loading');
  const error = document.getElementById('vod-page-error');
  const content = document.getElementById('vod-page-content');

  if (!match) {
    showPageError('Ruta VOD inválida.');
    return;
  }

  try {
    const [, mediaType, tmdbId] = match;
    const res = await fetch(`/api/vod/${encodeURIComponent(mediaType)}/${encodeURIComponent(tmdbId)}`);
    const detail = await res.json();
    if (!res.ok || detail.error) throw new Error(detail.error || `HTTP ${res.status}`);

    activeVodItem = detail;
    document.title = `${detail.title} · AceStream TV`;
    renderVodPage(detail);
    loading.style.display = 'none';
    error.style.display = 'none';
    content.style.display = 'block';
  } catch (e) {
    loading.style.display = 'none';
    showPageError(e.message);
  }
}

function renderVodPage(item) {
  const content = document.getElementById('vod-page-content');
  const bg = tmdbImage(item.backdrop_path, 'w1280');
  const searchParams = new URLSearchParams(window.location.search);
  const initialSeason = Number(searchParams.get('season')) || item.seasons?.[0]?.season_number;
  const initialEpisode = Number(searchParams.get('episode')) || null;
  const shouldAutoplay = searchParams.get('play') === '1';

  content.innerHTML = `<section class="vod-detail-hero vod-page-hero" style="background-image:url('${escHtml(bg || '')}')">
    <div class="vod-detail-body">
      <div class="vod-kicker">${item.media_type === 'tv' ? 'Serie' : 'Película'} ${item.imdb_id ? '· IMDb ' + escHtml(item.imdb_id) : ''}</div>
      <h2>${escHtml(item.title)}</h2>
      <div class="vod-meta">${vodMetaHtml(item)}${item.runtime ? `<span>${item.runtime} min</span>` : ''}${item.number_of_seasons ? `<span>${item.number_of_seasons} temporadas</span>` : ''}</div>
      <p class="vod-overview">${escHtml(item.overview || 'Sin sinopsis disponible.')}</p>
      <div class="vod-hero-provider">
        ${item.media_type === 'tv' ? vodEpisodeSelectorHtml(item, initialSeason) : '<button class="vod-action" type="button" onclick="requestVodPlayback()">Cargar desde API</button>'}
      </div>
    </div>
  </section>

  <section id="vod-provider-panel" class="vod-provider-panel">
    <h3>Reproducción</h3>
    <div id="vod-provider-results"></div>
    <div id="vod-api-player"></div>
  </section>

  ${item.recommendations?.length ? `<section class="vod-section"><h3>Más como esto</h3><div class="vod-row">${item.recommendations.map(vodCardHtml).join('')}</div></section>` : ''}
  <div class="tmdb-credit">Datos e imágenes proporcionados por TMDb. La reproducción depende del proveedor VOD legal configurado.</div>`;

  if (item.media_type === 'tv' && item.seasons?.length) {
    loadVodSeasonEpisodes(item.tmdb_id, initialSeason).then(() => {
      if (initialEpisode) document.getElementById('vod-episode-select').value = String(initialEpisode);
      if (shouldAutoplay && document.getElementById('vod-episode-select').value) requestVodPlayback();
    });
  } else if (shouldAutoplay) {
    requestVodPlayback();
  }
}

function vodEpisodeSelectorHtml(item, selectedSeason) {
  const seasons = item.seasons || [];
  if (!seasons.length) return '<p class="vod-provider-note">TMDb no devuelve temporadas para esta serie.</p>';

  return `<div class="vod-episode-tools">
    <select id="vod-season-select" class="vod-select" onchange="loadVodSeasonEpisodes(${Number(item.tmdb_id)}, Number(this.value))">
      ${seasons.map(season => `<option value="${season.season_number}"${Number(season.season_number) === Number(selectedSeason) ? ' selected' : ''}>Temporada ${season.season_number}</option>`).join('')}
    </select>
    <select id="vod-episode-select" class="vod-select">
      <option value="">Cargando episodios…</option>
    </select>
    <button class="vod-action" type="button" onclick="requestVodPlayback()">Cargar desde API</button>
  </div>`;
}

async function loadVodSeasonEpisodes(tmdbId, seasonNumber) {
  const select = document.getElementById('vod-episode-select');
  if (!select) return;
  select.innerHTML = '<option value="">Cargando episodios…</option>';

  try {
    const res = await fetch(`/api/vod/tv/${encodeURIComponent(tmdbId)}/season/${encodeURIComponent(seasonNumber)}`);
    const season = await res.json();
    if (!res.ok || season.error) throw new Error(season.error || `HTTP ${res.status}`);
    currentSeasonEpisodes = season.episodes || [];
    select.innerHTML = (season.episodes || []).map(episode =>
      `<option value="${episode.episode_number}">${episode.episode_number}. ${escHtml(episode.name || 'Episodio')}</option>`
    ).join('');
    return season;
  } catch (e) {
    currentSeasonEpisodes = [];
    select.innerHTML = `<option value="">${escHtml(e.message)}</option>`;
    return null;
  }
}

async function requestVodPlayback() {
  const results = document.getElementById('vod-provider-results');
  if (!results || !activeVodItem) return;
  results.innerHTML = '<p class="vod-provider-note">Consultando proveedor…</p>';

  const params = new URLSearchParams();
  if (activeVodItem.media_type === 'tv') {
    const season = document.getElementById('vod-season-select')?.value;
    const episode = document.getElementById('vod-episode-select')?.value;
    if (!season || !episode) {
      results.innerHTML = '<p class="vod-provider-note">Selecciona temporada y episodio.</p>';
      return;
    }
    params.set('season', season);
    params.set('episode', episode);
  }

  try {
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/vod/${encodeURIComponent(activeVodItem.media_type)}/${encodeURIComponent(activeVodItem.tmdb_id)}/playback${query}`);
    const playback = await res.json();
    if (!res.ok || playback.error) throw new Error(playback.error || `HTTP ${res.status}`);
    const providers = playback.providers || [];
    saveVodContinueEntry();
    results.innerHTML = `<p class="vod-provider-note">${escHtml(playback.message)}</p>`
      + (providers.length ? `<div class="vod-provider-actions">${providers.map(providerButtonHtml).join('')}</div>` : '')
      + nextEpisodeHtml();
    if (providers[0]?.embed_url || providers[0]?.url) playVodProvider(providers[0]);
  } catch (e) {
    results.innerHTML = `<p class="vod-provider-note">${escHtml(e.message)}</p>`;
  }
}

function saveVodContinueEntry() {
  if (!activeVodItem) return;
  const season = document.getElementById('vod-season-select')?.value || null;
  const episode = document.getElementById('vod-episode-select')?.value || null;
  const episodeOption = document.getElementById('vod-episode-select')?.selectedOptions?.[0]?.textContent || '';
  const entry = {
    key: `${activeVodItem.media_type}:${activeVodItem.tmdb_id}:${season || 'movie'}:${episode || 'movie'}`,
    tmdb_id: activeVodItem.tmdb_id,
    media_type: activeVodItem.media_type,
    title: activeVodItem.title,
    poster_path: activeVodItem.poster_path,
    backdrop_path: activeVodItem.backdrop_path,
    release_date: activeVodItem.release_date,
    first_air_date: activeVodItem.first_air_date,
    vote_average: activeVodItem.vote_average,
    season,
    episode,
    episode_label: episodeOption,
    updated_at: Date.now()
  };

  const entries = loadVodContinueEntries().filter(item => item.key !== entry.key);
  entries.unshift(entry);
  localStorage.setItem(VOD_CONTINUE_KEY, JSON.stringify(entries.slice(0, 12)));
}

function loadVodContinueEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOD_CONTINUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nextEpisodeHtml() {
  if (activeVodItem?.media_type !== 'tv') return '';
  const selectedEpisode = Number(document.getElementById('vod-episode-select')?.value);
  const next = currentSeasonEpisodes.find(episode => Number(episode.episode_number) > selectedEpisode);
  if (!next) return '';
  return `<div class="vod-next-episode">
    <button class="vod-video-btn" type="button" onclick="playNextEpisode(${Number(next.episode_number)})">Siguiente episodio: ${Number(next.episode_number)}. ${escHtml(next.name || 'Episodio')}</button>
  </div>`;
}

function playNextEpisode(episodeNumber) {
  const select = document.getElementById('vod-episode-select');
  if (!select) return;
  select.value = String(episodeNumber);
  requestVodPlayback();
}

function providerButtonHtml(provider) {
  const url = provider.url || provider.web_url || provider.playback_url || provider.embed_url || provider.stream_url || '';
  if (!url) return `<button class="vod-video-btn" type="button" disabled>${escHtml(provider.name)}</button>`;
  return `<button class="vod-video-btn" type="button" onclick="playVodProvider(${jsArg(provider)})">${escHtml(provider.name)}</button>`;
}

function playVodProvider(provider) {
  const url = provider.embed_url || provider.url || provider.playback_url || provider.web_url || provider.stream_url || '';
  const player = document.getElementById('vod-api-player');
  if (!url || !player) return;
  player.innerHTML = `<iframe class="vod-api-frame" title="${escHtml(provider.name || 'Reproductor VOD')}" src="${escHtml(url)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  player.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function vodCardHtml(item) {
  const poster = tmdbImage(item.poster_path, 'w342');
  const image = poster
    ? `<img class="vod-poster" src="${escHtml(poster)}" alt="" loading="lazy">`
    : `<div class="vod-poster-fallback">${escHtml(item.title)}</div>`;
  return `<a class="vod-card" href="${escHtml(vodDetailUrl(item))}">
    ${image}
    <div class="vod-card-body">
      <div class="vod-title">${escHtml(item.title)}</div>
      <div class="vod-card-meta"><span>${item.media_type === 'tv' ? 'Serie' : 'Película'} · ${escHtml(vodYear(item) || 's/f')}</span><span>${vodRating(item)}</span></div>
    </div>
  </a>`;
}

function showPageError(message) {
  document.getElementById('vod-page-error').style.display = 'block';
  document.getElementById('vod-page-error-msg').textContent = message;
}

function tmdbImage(path, size) {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function vodYear(item) {
  const date = item.release_date || item.first_air_date || '';
  return date ? date.slice(0, 4) : '';
}

function vodRating(item) {
  const value = Number(item.vote_average || 0);
  return value > 0 ? `★ ${value.toFixed(1)}` : '★ -';
}

function vodMetaHtml(item) {
  return `<span>${item.media_type === 'tv' ? 'Serie' : 'Película'}</span><span>${escHtml(vodYear(item) || 'Sin fecha')}</span><span>${vodRating(item)}</span>`;
}

function vodDetailUrl(item) {
  const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
  return `/vod/${encodeURIComponent(mediaType)}/${encodeURIComponent(item.tmdb_id)}`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsArg(value) {
  return escHtml(JSON.stringify(value));
}
