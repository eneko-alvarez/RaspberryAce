const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'httproxy';
const PROXY_PORT = process.env.PROXY_PORT || '8888';
const HLS_DIR = '/tmp/hls';
const TMDB_API_BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || '';
const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE || 'es-ES';
const TMDB_REGION = process.env.TMDB_REGION || 'ES';
const TMDB_CACHE_TTL_MS = Number(process.env.TMDB_CACHE_TTL_MS || 1000 * 60 * 30);
const VOD_PROVIDER_BASE_URL = process.env.VOD_PROVIDER_BASE_URL || 'https://api.eneko.com';
const VOD_PROVIDER_TOKEN = process.env.VOD_PROVIDER_TOKEN || '';

const SUBGROUP_RULES = [
  { group: 'Deportes', label: 'DAZN', patterns: ['dazn'] },
  { group: 'Deportes', label: 'Movistar', patterns: ['movistar', 'vamos', 'm\\+'] },
  { group: 'Deportes', label: 'LaLiga', patterns: ['laliga', 'la liga', 'hypermotion', 'liga ea'] },
  { group: 'Deportes', label: 'Champions', patterns: ['champions', 'liga de campeones', 'uefa'] },
  { group: 'Deportes', label: 'Mundial', patterns: ['mundial', 'world cup', 'copa mundial'] },
  { group: 'Deportes', label: 'Copa del Rey', patterns: ['copa del rey'] },
  { group: 'Deportes', label: 'Primera RFEF', patterns: ['primera rfef', '1 rfef'] },
  { group: 'Deportes', label: 'Formula 1', patterns: ['f1', 'formula 1', 'formula uno'] },
  { group: 'Deportes', label: 'MotoGP', patterns: ['motogp', 'moto gp'] },
  { group: 'Deportes', label: 'Tenis', patterns: ['tenis', 'tennis'] },
  { group: 'Deportes', label: 'Basket', patterns: ['basket', 'baloncesto', 'nba', 'acb', 'euroleague'] },
  { group: 'Deportes', label: 'Golf', patterns: ['golf'] },
  { group: 'Deportes', label: 'UFC', patterns: ['ufc', 'mma'] },
  { group: 'Deportes', label: 'Eurosport', patterns: ['eurosport'] },
  { group: 'Deportes', label: 'ESPN', patterns: ['espn'] },
  { group: 'Deportes', label: 'beIN Sports', patterns: ['bein'] },
  { group: 'Deportes', label: 'Sky Sports', patterns: ['sky sport', 'sky sports'] },
  { group: 'Deportes', label: 'BT Sport', patterns: ['bt sport', 'bt sports', 'tnt sports'] },
  { group: 'Deportes', label: 'Sport TV', patterns: ['sport tv'] },
  { group: 'Deportes', label: 'Viaplay', patterns: ['viaplay'] },
  { group: 'Deportes', label: 'Eventos', patterns: ['evento', 'eventos', 'ppv', 'multi', 'directo'] },

  { group: 'Cine y Series', label: 'Movistar', patterns: ['movistar', 'm\\+'] },
  { group: 'Cine y Series', label: 'HBO', patterns: ['hbo'] },
  { group: 'Cine y Series', label: 'AMC', patterns: ['amc'] },
  { group: 'Cine y Series', label: 'AXN', patterns: ['axn'] },
  { group: 'Cine y Series', label: 'TNT', patterns: ['tnt'] },
  { group: 'Cine y Series', label: 'Warner', patterns: ['warner'] },
  { group: 'Cine y Series', label: 'Paramount', patterns: ['paramount'] },
  { group: 'Cine y Series', label: 'Comedia', patterns: ['comedy', 'comedia'] },
  { group: 'Cine y Series', label: 'Series', patterns: ['series', 'serie'] },

  { group: 'Infantil', label: 'Disney', patterns: ['disney'] },
  { group: 'Infantil', label: 'Nickelodeon', patterns: ['nick', 'nickelodeon'] },
  { group: 'Infantil', label: 'Cartoon Network', patterns: ['cartoon'] },
  { group: 'Infantil', label: 'Clan', patterns: ['clan'] },
  { group: 'Infantil', label: 'Boing', patterns: ['boing'] },

  { group: 'Documentales', label: 'Discovery', patterns: ['discovery'] },
  { group: 'Documentales', label: 'National Geographic', patterns: ['nat geo', 'national geographic'] },
  { group: 'Documentales', label: 'Historia', patterns: ['history', 'historia'] },
  { group: 'Documentales', label: 'Viajes', patterns: ['travel', 'viajar', 'viajes'] },

  { group: 'Noticias', label: '24h', patterns: ['24h', '24 horas'] },
  { group: 'Noticias', label: 'CNN', patterns: ['cnn'] },
  { group: 'Noticias', label: 'Euronews', patterns: ['euronews'] },
  { group: 'Noticias', label: 'BBC', patterns: ['bbc'] },

  { group: 'Musica', label: 'MTV', patterns: ['mtv'] },
  { group: 'Musica', label: 'VH1', patterns: ['vh1'] },
  { group: 'Musica', label: 'Radio', patterns: ['radio'] },

  { group: 'Regional', label: 'Andalucia', patterns: ['andalucia', 'canal sur'] },
  { group: 'Regional', label: 'Catalunya', patterns: ['catalunya', 'cataluna', 'tv3', '3cat'] },
  { group: 'Regional', label: 'Madrid', patterns: ['madrid', 'telemadrid'] },
  { group: 'Regional', label: 'Galicia', patterns: ['galicia', 'tvg'] },
  { group: 'Regional', label: 'Euskadi', patterns: ['euskadi', 'etb'] },
  { group: 'Regional', label: 'Valencia', patterns: ['valencia', 'apunt', 'a punt'] },
];

const MAIN_GROUPS = new Set([
  'deportes',
  'generalistas',
  'noticias',
  'cine y series',
  'infantil',
  'documentales',
  'musica',
  'regional',
  'internacional',
  'adultos',
  'religion',
  'otros',
]);

const GENERIC_SUBGROUPS = new Set([
  'sport',
  'sports',
  'deporte',
  'deportes',
  'movies',
  'movie',
  'cine',
  'series',
  'kids',
  'infantil',
  'regional',
  'general',
  'tv',
  'canales',
  'channels',
  'otros',
  'other',
  'unknown',
  'sin grupo',
  'educational',
  'entertaining',
  'informational',
  'documentaries',
  'documentary',
  'music',
  'musica',
  'fashion',
  'amateur',
  'acepl',
  'newera',
  'elcano',
  'misterchire',
  'af1c1onados',
]);

app.use(express.json());

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const activeStreams = {};
const tmdbCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, stream] of Object.entries(activeStreams)) {
    if (now - stream.lastAccess > 120000) {
      console.log(`Stopping idle stream: ${id}`);
      stream.process.kill();
      fs.rmSync(stream.dir, { recursive: true, force: true });
      delete activeStreams[id];
    }
  }
}, 30000);

// Fetch raw M3U from httproxy
function fetchM3U() {
  return new Promise((resolve, reject) => {
    http.get(`http://${PROXY_HOST}:${PROXY_PORT}/aio`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Parse M3U and return structured JSON
// Handles #EXTGRP lines between #EXTINF and URL
app.get('/api/channels', async (req, res) => {
  try {
    const m3u = await fetchM3U();
    const lines = m3u.split('\n').map(l => l.trim()).filter(Boolean);
    const channels = [];

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXTINF')) continue;

      const infLine = lines[i];

      // Extract fields from #EXTINF
      const nameMatch = infLine.match(/,(.+)$/);
      const groupMatch = infLine.match(/group-title="([^"]*)"/);
      const rawGroupMatch = infLine.match(/raw-group="([^"]*)"/);
      const logoMatch = infLine.match(/tvg-logo="([^"]*)"/);
      const tvgIdMatch = infLine.match(/tvg-id="([^"]*)"/);

      // Find next non-# line (the URL), skipping #EXTGRP etc.
      let url = null;
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (!lines[j].startsWith('#')) { url = lines[j]; break; }
      }

      if (!url || !nameMatch) continue;

      // Replace internal docker hostname with the server's own proxy
      // The stream endpoint will fetch server-side, so we just store the original URL
      // but rewrite httproxy -> PROXY_HOST (already correct for server-side fetch)
      const name = nameMatch[1].trim();
      const group = groupMatch ? groupMatch[1] : 'Sin grupo';
      const rawGroup = rawGroupMatch ? rawGroupMatch[1] : group;
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
      const contentId = extractContentId(url);
      const subgroups = inferSubgroups(group, name, tvgId, rawGroup);

      channels.push({
        name: nameMatch[1].trim(),
        group,
        rawGroup,
        subgroups,
        logo: logoMatch ? logoMatch[1] : null,
        tvgId,
        contentId,
        // Encode original internal URL for use with /stream/:id endpoint
        streamId: Buffer.from(url).toString('base64')
      });
    }

    const grouped = {};
    const subgrouped = {};
    for (const ch of channels) {
      if (!grouped[ch.group]) grouped[ch.group] = [];
      grouped[ch.group].push(ch);
      if (!subgrouped[ch.group]) subgrouped[ch.group] = {};
      for (const subgroup of ch.subgroups) {
        if (!subgrouped[ch.group][subgroup]) subgrouped[ch.group][subgroup] = [];
        subgrouped[ch.group][subgroup].push(ch);
      }
    }

    res.json({ channels, grouped, subgrouped: orderSubgrouped(subgrouped), total: channels.length });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/custom-channel', (req, res) => {
  const rawInput = String(req.body?.id || '').trim();
  const contentId = normalizeAceContentId(rawInput);

  if (!contentId) {
    return res.status(400).json({ error: 'Introduce un content id AceStream válido' });
  }

  const channelUrl = `http://${PROXY_HOST}:${PROXY_PORT}/content_id/${contentId}/stream.ts`;
  res.json({
    name: `Custom ${contentId.slice(0, 8)}`,
    group: 'Custom',
    rawGroup: 'Manual',
    subgroups: ['Manual'],
    logo: null,
    tvgId: null,
    contentId,
    streamId: Buffer.from(channelUrl).toString('base64')
  });
});

app.get('/api/vod/home', async (req, res) => {
  try {
    assertTmdbConfigured();
    const sections = [
      { key: 'trending_today', title: 'Tendencias de hoy', path: '/trending/all/day' },
      { key: 'trending_week', title: 'Tendencias de la semana', path: '/trending/all/week' },
      { key: 'popular_movies', title: 'Películas populares', path: '/movie/popular', params: { region: TMDB_REGION } },
      { key: 'popular_tv', title: 'Series populares', path: '/tv/popular' },
      { key: 'top_rated_movies', title: 'Mejor valoradas', path: '/movie/top_rated', params: { region: TMDB_REGION } },
      { key: 'action_movies', title: 'Acción', path: '/discover/movie', params: { with_genres: 28, sort_by: 'popularity.desc', region: TMDB_REGION } },
      { key: 'comedy_movies', title: 'Comedia', path: '/discover/movie', params: { with_genres: 35, sort_by: 'popularity.desc', region: TMDB_REGION } },
      { key: 'documentaries', title: 'Documentales', path: '/discover/movie', params: { with_genres: 99, sort_by: 'popularity.desc', region: TMDB_REGION } },
    ];

    const payload = await Promise.all(sections.map(async section => {
      const data = await tmdbFetch(section.path, section.params);
      return {
        key: section.key,
        title: section.title,
        items: normalizeMediaList(data.results).slice(0, 20)
      };
    }));

    res.json({
      sections: payload,
      imageBaseUrl: TMDB_IMAGE_BASE_URL,
      attribution: 'Metadata and images from TMDb.'
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get('/api/vod/search', async (req, res) => {
  try {
    assertTmdbConfigured();
    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ results: [] });

    const data = await tmdbFetch('/search/multi', {
      query,
      page: req.query.page || 1,
      include_adult: false
    }, 1000 * 60 * 10);

    res.json({ results: normalizeMediaList(data.results).slice(0, 40) });
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get('/api/vod/tv/:id/season/:seasonNumber', async (req, res) => {
  try {
    assertTmdbConfigured();
    const id = Number(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(seasonNumber) || seasonNumber <= 0) {
      return res.status(400).json({ error: 'Temporada inválida' });
    }

    const data = await tmdbFetch(`/tv/${id}/season/${seasonNumber}`, {}, 1000 * 60 * 60 * 24);
    res.json(normalizeTvSeason(data));
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get('/api/vod/:mediaType/:id/playback', async (req, res) => {
  try {
    assertTmdbConfigured();
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const id = Number(req.params.id);
    const season = req.query.season ? Number(req.query.season) : null;
    const episode = req.query.episode ? Number(req.query.episode) : null;

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'TMDb id inválido' });
    if (mediaType === 'tv' && (!Number.isInteger(season) || !Number.isInteger(episode))) {
      return res.status(400).json({ error: 'Las series requieren season y episode' });
    }

    const data = await tmdbFetch(`/${mediaType}/${id}`, {
      append_to_response: 'external_ids'
    }, 1000 * 60 * 60 * 24);

    const item = normalizeMediaDetail(data, mediaType);
    res.json(getLicensedPlaybackOptions(item, { season, episode }));
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get('/api/vod/:mediaType/:id', async (req, res) => {
  try {
    assertTmdbConfigured();
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'TMDb id inválido' });

    const data = await tmdbFetch(`/${mediaType}/${id}`, {
      append_to_response: 'external_ids,recommendations,similar'
    }, 1000 * 60 * 60 * 24);

    const detail = normalizeMediaDetail(data, mediaType);
    res.json(detail);
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json({ error: e.message });
  }
});

// Start or reuse HLS stream
app.get('/stream/:channelId/index.m3u8', (req, res) => {
  const { channelId } = req.params;
  let channelUrl;
  try {
    channelUrl = Buffer.from(channelId, 'base64').toString('utf8');
  } catch {
    return res.status(400).send('Invalid channel ID');
  }

  const streamDir = path.join(HLS_DIR, channelId);
  const playlistPath = path.join(streamDir, 'index.m3u8');

  if (activeStreams[channelId]) {
    activeStreams[channelId].lastAccess = Date.now();
    waitForFile(playlistPath, 15000)
      .then(() => res.sendFile(playlistPath))
      .catch(() => res.status(504).send('Stream timeout'));
    return;
  }

  fs.mkdirSync(streamDir, { recursive: true });
  console.log(`Starting stream: ${channelUrl}`);

  const ffmpeg = spawn('ffmpeg', [
    '-re', '-i', channelUrl,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'seg%03d.ts'),
    playlistPath
  ]);

  ffmpeg.stderr.on('data', d => process.stdout.write(d));
  ffmpeg.on('exit', code => {
    console.log(`ffmpeg exit (${code}) for ${channelId}`);
    delete activeStreams[channelId];
  });

  activeStreams[channelId] = { process: ffmpeg, lastAccess: Date.now(), dir: streamDir };

  waitForFile(playlistPath, 15000)
    .then(() => res.sendFile(playlistPath))
    .catch(() => res.status(504).send('Stream timeout'));
});

app.get('/stream/:channelId/:segment', (req, res) => {
  const { channelId, segment } = req.params;
  if (activeStreams[channelId]) activeStreams[channelId].lastAccess = Date.now();
  res.sendFile(path.join(HLS_DIR, channelId, segment));
});

app.get('/vod/:mediaType/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vod-detail.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

function waitForFile(filePath, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fs.existsSync(filePath)) return resolve();
      if (Date.now() - start > timeout) return reject();
      setTimeout(check, 500);
    };
    check();
  });
}

function assertTmdbConfigured() {
  if (!TMDB_ACCESS_TOKEN) {
    const err = new Error('Falta TMDB_ACCESS_TOKEN en el servicio webplayer');
    err.status = 503;
    throw err;
  }
}

async function tmdbFetch(pathname, params = {}, ttl = TMDB_CACHE_TTL_MS) {
  const url = new URL(`${TMDB_API_BASE_URL}${pathname}`);
  url.searchParams.set('language', TMDB_LANGUAGE);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const cacheKey = url.toString();
  const cached = tmdbCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < ttl) return cached.data;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    const err = new Error(`TMDb error ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  tmdbCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

function normalizeMediaList(items) {
  return (items || [])
    .map(normalizeMediaSummary)
    .filter(item => item && (item.media_type === 'movie' || item.media_type === 'tv'));
}

function normalizeMediaSummary(item) {
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;

  return {
    tmdb_id: item.id,
    media_type: mediaType,
    title: item.title || item.name || 'Sin título',
    original_title: item.original_title || item.original_name || null,
    overview: item.overview || '',
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    release_date: item.release_date || null,
    first_air_date: item.first_air_date || null,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    popularity: item.popularity || 0
  };
}

function normalizeMediaDetail(item, mediaType) {
  const summary = normalizeMediaSummary({ ...item, media_type: mediaType });
  return {
    ...summary,
    imdb_id: item.external_ids?.imdb_id || item.imdb_id || null,
    runtime: item.runtime || null,
    number_of_seasons: item.number_of_seasons || null,
    number_of_episodes: item.number_of_episodes || null,
    seasons: (item.seasons || []).filter(season => season.season_number > 0).map(season => ({
      id: season.id,
      name: season.name,
      season_number: season.season_number,
      episode_count: season.episode_count,
      poster_path: season.poster_path || null
    })),
    genres: item.genres || [],
    recommendations: normalizeMediaList(item.recommendations?.results).slice(0, 16),
    similar: normalizeMediaList(item.similar?.results).slice(0, 16)
  };
}

function normalizeTvSeason(item) {
  return {
    id: item.id,
    name: item.name,
    season_number: item.season_number,
    overview: item.overview || '',
    poster_path: item.poster_path || null,
    episodes: (item.episodes || []).map(episode => ({
      id: episode.id,
      name: episode.name,
      overview: episode.overview || '',
      episode_number: episode.episode_number,
      season_number: episode.season_number,
      still_path: episode.still_path || null,
      air_date: episode.air_date || null,
      runtime: episode.runtime || null,
      vote_average: episode.vote_average || 0
    }))
  };
}

function getLicensedPlaybackOptions(item, selection = {}) {
  const embedUrl = vodEmbedUrl(item, selection);
  return {
    configured: Boolean(VOD_PROVIDER_BASE_URL),
    request: buildPlaybackRequest(item, selection),
    providers: embedUrl ? [{
      id: 'vod-api',
      name: 'Reproducir',
      type: 'embed',
      url: embedUrl,
      embed_url: embedUrl,
      stream_url: null
    }] : [],
    message: embedUrl
      ? 'Reproductor VOD legal disponible.'
      : 'No se pudo construir la URL de reproducción VOD.'
  };
}

function buildPlaybackRequest(item, selection = {}) {
  const request = {
    media_type: item.media_type,
    tmdb_id: item.tmdb_id,
    imdb_id: item.imdb_id || null
  };

  if (item.media_type === 'tv') {
    request.season = selection.season || null;
    request.episode = selection.episode || null;
  }

  return request;
}

function vodProviderUrl(pathname) {
  const base = new URL(VOD_PROVIDER_BASE_URL);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(pathname, base);
}

function vodEmbedUrl(item, selection = {}) {
  if (!VOD_PROVIDER_BASE_URL) return null;
  const id = item.tmdb_id || item.imdb_id;
  if (!id) return null;

  if (item.media_type === 'tv') {
    if (!selection.season || !selection.episode) return null;
    return vodProviderUrl(`embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(selection.season)}/${encodeURIComponent(selection.episode)}`).toString();
  }

  return vodProviderUrl(`embed/movie/${encodeURIComponent(id)}`).toString();
}

function normalizeAceContentId(input) {
  if (!input) return null;

  let candidate = input;
  try {
    const parsed = new URL(input);
    if (parsed.protocol === 'acestream:') {
      candidate = parsed.hostname || parsed.pathname.replace(/^\/+/, '');
    } else if (parsed.searchParams.has('id')) {
      candidate = parsed.searchParams.get('id');
    } else if (parsed.searchParams.has('infohash')) {
      candidate = parsed.searchParams.get('infohash');
    } else {
      const match = parsed.pathname.match(/\/(?:content_id|pid|infohash)\/([^/]+)/);
      if (match) candidate = match[1];
    }
  } catch {
    candidate = input.replace(/^acestream:\/\//i, '');
  }

  candidate = String(candidate).trim();
  return /^[a-fA-F0-9]{40}$/.test(candidate) ? candidate.toLowerCase() : null;
}

function extractContentId(url) {
  const match = String(url || '').match(/\/(?:content_id|pid|infohash)\/([a-fA-F0-9]{40})\//);
  return match ? match[1].toLowerCase() : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferSubgroups(group, name, tvgId, rawGroup) {
  const text = normalizeText(`${name || ''} ${tvgId || ''} ${rawGroup || ''}`);
  const labels = [];

  for (const rule of SUBGROUP_RULES) {
    if (rule.group !== group) continue;
    if (rule.patterns.some(pattern => new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text))) {
      labels.push(rule.label);
    }
  }

  labels.push(...rawGroupSubgroups(group, rawGroup));

  if (!labels.length) labels.push('Otros');
  return [...new Set(labels)];
}

function rawGroupSubgroups(group, rawGroup) {
  const labels = [];
  const parts = String(rawGroup || '')
    .split(/\s*(?:,|\/|\||>|»|\s-\s)\s*/)
    .map(cleanSubgroupLabel)
    .filter(Boolean);

  for (const label of parts) {
    const normalized = normalizeText(label).trim();
    if (!normalized || MAIN_GROUPS.has(normalized) || GENERIC_SUBGROUPS.has(normalized)) continue;
    if (normalizeText(group) === normalized) continue;
    if (matchesStaticSubgroup(group, label)) continue;
    if (label.length < 3 || label.length > 28) continue;
    labels.push(label);
  }

  return labels;
}

function cleanSubgroupLabel(value) {
  const cleaned = String(value || '')
    .replace(/^\d+(?:\.\d+)?\s*/, '')
    .replace(/\.(?:w3u|m3u8?|json)$/i, '')
    .replace(/[_#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /https?:\/\//i.test(cleaned)) return null;
  const normalized = normalizeText(cleaned);
  const known = {
    dazn: 'DAZN',
    espn: 'ESPN',
    ufc: 'UFC',
    nba: 'NBA',
    acb: 'ACB',
    laliga: 'LaLiga',
    'la liga': 'LaLiga',
    motogp: 'MotoGP',
    'moto gp': 'MotoGP',
    mundial: 'Mundial',
    eurosport: 'Eurosport',
    'bein sport': 'beIN Sports',
    'bein sports': 'beIN Sports',
    'copa del rey': 'Copa del Rey',
    'primera rfef': 'Primera RFEF',
  };
  if (normalized.includes('mundial')) return 'Mundial';
  if (known[normalized]) return known[normalized];

  return cleaned
    .split(' ')
    .map(word => word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function matchesStaticSubgroup(group, label) {
  const text = normalizeText(label);
  return SUBGROUP_RULES.some(rule => {
    if (rule.group !== group) return false;
    return rule.patterns.some(pattern => new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text));
  });
}

function orderSubgrouped(subgrouped) {
  const ordered = {};
  for (const [group, subgroups] of Object.entries(subgrouped)) {
    const preferred = SUBGROUP_RULES
      .filter(rule => rule.group === group)
      .map(rule => rule.label);
    const preferredSet = new Set(preferred);
    const labels = Object.keys(subgroups);
    const dynamicLabels = labels
      .filter(label => !preferredSet.has(label) && label !== 'Otros')
      .filter(label => subgroups[label].length >= 2)
      .sort((a, b) => subgroups[b].length - subgroups[a].length || a.localeCompare(b, 'es'))
      .slice(0, 24);
    const sortedLabels = [
      ...preferred.filter(label => subgroups[label]),
      ...dynamicLabels,
      ...labels.filter(label => label === 'Otros')
    ];
    ordered[group] = {};
    for (const label of sortedLabels) {
      ordered[group][label] = subgroups[label];
    }
  }
  return ordered;
}

app.listen(8890, () => console.log('Webplayer on :8890'));
