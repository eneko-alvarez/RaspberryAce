let allChannels = [];
let grouped = {};
let subgrouped = {};
let customChannels = [];
let currentView = { type: 'favorites', group: null, subgroup: null };
let hls = null;
let liveStateTimer = null;
let controlsHideTimer = null;
let streamLoadTimer = null;
let streamLoadProgress = 0;
let streamLoadStartedAt = 0;
let activeChannel = null;
let userClosedPlayer = false;
let appMode = 'live';
let vodLoaded = false;
let vodHomeSections = [];
let vodSearchTimer = null;
const sidebarEl = document.getElementById('sidebar');
const videoEl = document.getElementById('video');
const playerShellEl = document.getElementById('player-shell');
const streamLoaderEl = document.getElementById('stream-loader');
const streamErrorEl = document.getElementById('stream-error');
const FAVORITES_KEY = 'raspberryace:favorites:v1';
const VOD_CONTINUE_KEY = 'raspberryace:vod-continue:v1';
let favoriteKeys = loadFavoriteKeys();

function toggleSidebar() { sidebarEl.classList.toggle('open'); }

function setAppMode(mode) {
  appMode = mode === 'vod' ? 'vod' : 'live';
  document.body.classList.toggle('vod-mode', appMode === 'vod');
  document.getElementById('live-tab').classList.toggle('active', appMode === 'live');
  document.getElementById('vod-tab').classList.toggle('active', appMode === 'vod');
  const search = document.getElementById('search');
  search.value = '';
  search.placeholder = appMode === 'vod' ? 'Buscar película o serie…' : 'Buscar canal o pegar AceStream ID…';
  document.getElementById('channel-count').textContent = appMode === 'vod' ? 'VOD legal' : `${allChannels.length} canales`;
  if (appMode === 'vod') {
    if (!vodLoaded) loadVodHome();
  } else {
    renderCurrentView();
    document.getElementById('channel-count').textContent = `${allChannels.length} canales`;
  }
}

async function loadVodHome() {
  const loading = document.getElementById('vod-loading');
  const error = document.getElementById('vod-error');
  const home = document.getElementById('vod-home');
  loading.style.display = 'block';
  error.style.display = 'none';
  home.style.display = 'none';

  try {
    const res = await fetch('/api/vod/home');
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    vodLoaded = true;
    vodHomeSections = data.sections || [];
    renderVodHome(vodHomeSections);
    loading.style.display = 'none';
    home.style.display = 'block';
    document.getElementById('channel-count').textContent = 'Catálogo VOD';
  } catch (e) {
    loading.style.display = 'none';
    error.style.display = 'block';
    document.getElementById('vod-error-msg').textContent = e.message;
    document.getElementById('channel-count').textContent = 'VOD no configurado';
  }
}

function renderVodHome(sections) {
  const home = document.getElementById('vod-home');
  if (!sections.length) {
    home.innerHTML = '<div id="vod-loading">No hay contenido VOD para mostrar.</div>';
    return;
  }

  const continueItems = loadVodContinueItems();
  const continueSection = continueItems.length ? vodContinueSectionHtml(continueItems) : '';
  const heroItem = sections.flatMap(section => section.items || []).find(item => item.backdrop_path) || sections[0]?.items?.[0];
  const hero = heroItem ? vodHeroHtml(heroItem) : '';
  home.innerHTML = hero + continueSection + sections.map(section => `
    <section class="vod-section">
      <h3>${escHtml(section.title)}</h3>
      <div class="vod-row">${(section.items || []).map(item => vodCardHtml(item)).join('')}</div>
    </section>
  `).join('') + '<div class="tmdb-credit">Datos e imágenes proporcionados por TMDb. La reproducción depende del proveedor VOD legal configurado.</div>';
}

function vodHeroHtml(item) {
  const bg = tmdbImage(item.backdrop_path, 'w1280');
  const url = vodDetailUrl(item);
  return `<section class="vod-hero" style="background-image:url('${escHtml(bg || '')}')">
    <div class="vod-hero-inner">
      <div class="vod-kicker">${item.media_type === 'tv' ? 'Serie' : 'Película'} destacada</div>
      <h2>${escHtml(item.title)}</h2>
      <div class="vod-meta">${vodMetaHtml(item)}</div>
      <p class="vod-overview">${escHtml(shortText(item.overview, 260) || 'Sin sinopsis disponible.')}</p>
      <a class="vod-action" href="${escHtml(url)}">Ver ficha</a>
      <a class="vod-action secondary" href="${escHtml(url)}">Detalles</a>
    </div>
  </section>`;
}

function vodCardHtml(item) {
  const poster = tmdbImage(item.poster_path, 'w342');
  const url = vodDetailUrl(item);
  const image = poster
    ? `<img class="vod-poster" src="${escHtml(poster)}" alt="" loading="lazy">`
    : `<div class="vod-poster-fallback">${escHtml(item.title)}</div>`;
  return `<a class="vod-card" href="${escHtml(url)}">
    ${image}
    <div class="vod-card-body">
      <div class="vod-title">${escHtml(item.title)}</div>
      <div class="vod-card-meta"><span>${item.media_type === 'tv' ? 'Serie' : 'Película'} · ${escHtml(vodYear(item) || 's/f')}</span><span>${vodRating(item)}</span></div>
    </div>
  </a>`;
}

function vodContinueSectionHtml(items) {
  return `<section class="vod-section">
    <h3>Seguir viendo</h3>
    <div class="vod-row">${items.map(vodContinueCardHtml).join('')}</div>
  </section>`;
}

function vodContinueCardHtml(item) {
  const poster = tmdbImage(item.poster_path, 'w342');
  const url = vodContinueUrl(item);
  const label = item.media_type === 'tv' && item.season && item.episode
    ? `T${item.season} E${item.episode}`
    : 'Película';
  const image = poster
    ? `<img class="vod-poster" src="${escHtml(poster)}" alt="" loading="lazy">`
    : `<div class="vod-poster-fallback">${escHtml(item.title)}</div>`;
  return `<a class="vod-card vod-continue-card" href="${escHtml(url)}">
    ${image}
    <div class="vod-card-body">
      <div class="vod-progress-pill">${escHtml(label)}</div>
      <div class="vod-title">${escHtml(item.title)}</div>
      <div class="vod-card-meta"><span>${escHtml(shortText(item.episode_label || 'Reanudar reproducción', 34))}</span></div>
    </div>
  </a>`;
}

function vodContinueUrl(item) {
  const params = new URLSearchParams();
  params.set('play', '1');
  if (item.season) params.set('season', item.season);
  if (item.episode) params.set('episode', item.episode);
  return `${vodDetailUrl(item)}?${params.toString()}`;
}

function loadVodContinueItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOD_CONTINUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

async function openVodDetail(item) {
  window.location.href = vodDetailUrl(item);
}

async function loadChannels() {
  try {
    const res = await fetch('/api/channels');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    allChannels = data.channels;
    grouped = data.grouped;
    subgrouped = data.subgrouped || {};
    syncCustomGroup();
    document.getElementById('channel-count').textContent = `${data.total} canales`;
    renderGroups();
    renderCurrentView();
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch(e) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('error-msg').textContent = e.message;
  }
}

function renderGroups() {
  const ul = document.getElementById('group-list');
  const favoritesCount = getFavoriteChannels().length;

  if (currentView.group && grouped[currentView.group]) {
    const group = currentView.group;
    const subgroups = Object.keys(subgrouped[group] || {});
    ul.innerHTML = viewLi('all', null, null, '← Categorías', 'back')
      + viewLi('group', group, null, `${escHtml(group)} <span style="color:#555;font-size:11px">(${grouped[group].length})</span>`)
      + '<li class="section-label">Subgrupos</li>'
      + subgroups.map(s => viewLi('subgroup', group, s, `${escHtml(s)} <span style="color:#555;font-size:11px">(${subgrouped[group][s].length})</span>`, 'subgroup')).join('');
    return;
  }

  const groups = Object.keys(grouped);
  ul.innerHTML = viewLi('favorites', null, null, `♥ Favoritos <span style="color:#555;font-size:11px">(${favoritesCount})</span>`)
    + viewLi('all', null, null, '🎬 Todos')
    + groups.map(g => viewLi('group', g, null, `${escHtml(g)} <span style="color:#555;font-size:11px">(${grouped[g].length})</span>`)).join('');
}

function viewLi(type, group, subgroup, label, extraClass = '') {
  const active = isCurrentView(type, group, subgroup) ? ' active' : '';
  const klass = `${active}${extraClass ? ' ' + extraClass : ''}`.trim();
  return `<li${klass ? ` class="${klass}"` : ''} onclick="selectView(${jsArg(type)}, ${jsArg(group)}, ${jsArg(subgroup)}, this)">${label}</li>`;
}

function isCurrentView(type, group, subgroup) {
  return currentView.type === type && currentView.group === group && currentView.subgroup === subgroup;
}

function selectView(type, group, subgroup, el) {
  currentView = { type, group, subgroup };
  document.querySelectorAll('#group-list li').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (window.innerWidth <= 640) sidebarEl.classList.remove('open');
  renderGroups();
  renderCurrentView();
}

function renderCurrentView() {
  const q = document.getElementById('search').value.trim();
  if (q) { onSearch(q); return; }
  const channels = getCurrentChannels();
  renderGrid(currentView, channels);
}

function getCurrentChannels() {
  if (currentView.type === 'favorites') return getFavoriteChannels();
  if (currentView.type === 'all') return allChannels;
  if (currentView.type === 'subgroup') return subgrouped[currentView.group]?.[currentView.subgroup] || [];
  if (currentView.type === 'group') return grouped[currentView.group] || [];
  return allChannels;
}

function renderGrid(view, channels) {
  const content = document.getElementById('content');
  const hero = liveHeroHtml(view, channels);
  if (!channels.length) {
    content.innerHTML = `${hero}<section class="live-section"><div class="empty-state">Sin canales en esta selección.</div></section>`;
    return;
  }

  if (view.type === 'all') {
    const groups = Object.keys(grouped);
    content.innerHTML = hero + groups.map(g => `
      <section class="live-section">
        <div class="section-heading"><h3>${escHtml(g)}</h3><span>${grouped[g].length} canales</span></div>
        <div class="channel-grid">${grouped[g].map(ch => cardHtml(ch)).join('')}</div>
      </section>`).join('');
  } else if (view.type === 'favorites') {
    content.innerHTML = `${hero}<section class="live-section"><div class="section-heading"><h3>Favoritos</h3><span>${channels.length} canales</span></div><div class="channel-grid">${channels.map(ch => cardHtml(ch)).join('')}</div></section>`;
  } else if (view.type === 'subgroup') {
    content.innerHTML = `${hero}<section class="live-section"><div class="section-heading"><h3>${escHtml(view.group)} / ${escHtml(view.subgroup)}</h3><span>${channels.length} canales</span></div><div class="channel-grid">${channels.map(ch => cardHtml(ch)).join('')}</div></section>`;
  } else {
    content.innerHTML = `${hero}<section class="live-section"><div class="section-heading"><h3>${escHtml(view.group)}</h3><span>${channels.length} canales</span></div><div class="channel-grid">${channels.map(ch => cardHtml(ch)).join('')}</div></section>`;
  }
}

function liveHeroHtml(view, channels) {
  const title = liveViewTitle(view);
  const subtitle = liveViewSubtitle(view, channels);
  const sampleChannels = channels.slice(0, 4);
  const chips = liveGroupChipsHtml();
  const preview = sampleChannels.length
    ? `<div class="live-hero-preview">${sampleChannels.map(livePreviewHtml).join('')}</div>`
    : '';
  return `<section class="live-hero">
    <div class="live-hero-copy">
      <div class="vod-kicker">Directo</div>
      <h2>${escHtml(title)}</h2>
      <p class="vod-overview">${escHtml(subtitle)}</p>
      ${chips}
    </div>
    ${preview}
  </section>`;
}

function liveViewTitle(view) {
  if (view.type === 'favorites') return 'Tus canales guardados';
  if (view.type === 'all') return 'Todos los directos';
  if (view.type === 'search') return 'Buscar directos';
  if (view.type === 'subgroup') return view.subgroup;
  return view.group || 'Directos';
}

function liveViewSubtitle(view, channels) {
  const count = channels.length;
  if (view.type === 'favorites') return count ? `${count} canales listos para abrir en directo.` : 'Marca canales como favoritos para tenerlos siempre arriba.';
  if (view.type === 'search') return `${count} coincidencias encontradas en la lista actual de canales.`;
  if (view.type === 'subgroup') return `${count} canales dentro de ${view.group}, manteniendo la clasificación actual.`;
  if (view.type === 'group') return `${count} canales en esta categoría. Usa los subgrupos para afinar la lista.`;
  return `${allChannels.length} canales disponibles, organizados por categorías y subgrupos.`;
}

function liveGroupChipsHtml() {
  const groups = Object.keys(grouped).slice(0, 8);
  if (!groups.length) return '';
  return `<div class="live-chip-row">${groups.map(group => `<button class="live-chip" type="button" onclick="selectView('group', ${jsArg(group)}, null)">${escHtml(group)}</button>`).join('')}</div>`;
}

function livePreviewHtml(ch) {
  const logo = ch.logo
    ? `<img src="${escHtml(ch.logo)}" alt="" onerror="this.style.display='none'">`
    : '<span>TV</span>';
  return `<button class="live-preview-card" type="button" onclick="playChannel(${jsArg(ch)})">
    ${logo}
    <span>${escHtml(ch.name)}</span>
  </button>`;
}

function cardHtml(ch) {
  const favorite = isFavorite(ch);
  const logo = ch.logo
    ? `<img class="ch-logo" src="${escHtml(ch.logo)}" alt="" onerror="this.outerHTML='<div class=ch-logo-placeholder>📺</div>'">`
    : `<div class="ch-logo-placeholder">📺</div>`;
  return `<div class="channel-card" onclick="playChannel(${jsArg(ch)})">
    <button class="favorite-btn${favorite ? ' active' : ''}" type="button" title="${favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}" aria-label="${favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}" onclick="toggleFavorite(event, ${jsArg(ch)})">${favorite ? '♥' : '♡'}</button>
    ${logo}
    <div class="ch-name">${escHtml(ch.name)}</div>
  </div>`;
}

function onSearch(q) {
  if (appMode === 'vod') {
    clearTimeout(vodSearchTimer);
    vodSearchTimer = setTimeout(() => searchVod(q), 250);
    return;
  }

  const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('channel-count').textContent = `${filtered.length} canales`;
  if (!q) { renderCurrentView(); return; }
  const content = document.getElementById('content');
  content.innerHTML = `${liveHeroHtml({ type: 'search', group: null, subgroup: null }, filtered)}
    <section class="live-section">
      <div class="section-heading"><h3>Resultados: "${escHtml(q)}"</h3><span>${filtered.length} canales</span></div>
      <div class="channel-grid">${filtered.map(ch => cardHtml(ch)).join('')}</div>
    </section>`;
}

async function searchVod(q) {
  const query = q.trim();
  const home = document.getElementById('vod-home');
  if (!query) {
    if (vodHomeSections.length) renderVodHome(vodHomeSections);
    home.style.display = vodLoaded ? 'block' : 'none';
      document.getElementById('channel-count').textContent = vodLoaded ? 'Catálogo VOD' : 'VOD legal';
    return;
  }

  home.style.display = 'block';
  home.innerHTML = `<div id="vod-loading"><div class="spinner"></div>Buscando…</div>`;
  try {
    const res = await fetch(`/api/vod/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    document.getElementById('channel-count').textContent = `${data.results.length} resultados`;
    home.innerHTML = `<section class="vod-section">
      <h3>Resultados: "${escHtml(query)}"</h3>
      <div class="vod-row">${data.results.map(vodCardHtml).join('')}</div>
    </section>`;
  } catch (e) {
    document.getElementById('channel-count').textContent = 'Error VOD';
    home.innerHTML = `<div id="vod-error">No se pudo buscar.<br><small>${escHtml(e.message)}</small></div>`;
  }
}

function onSearchKeydown(event) {
  if (appMode === 'vod') return;
  if (event.key === 'Enter' && looksLikeAceInput(event.currentTarget.value)) {
    event.preventDefault();
    loadCustomChannel();
  }
}

async function loadCustomChannel() {
  const input = document.getElementById('search');
  const button = document.getElementById('custom-btn');
  const rawId = input.value.trim();
  if (!rawId) return;

  button.disabled = true;
  document.getElementById('channel-count').textContent = 'Cargando canal...';

  try {
    const res = await fetch('/api/custom-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rawId })
    });
    const ch = await res.json();
    if (!res.ok || ch.error) throw new Error(ch.error || `HTTP ${res.status}`);

    const existing = customChannels.find(c => c.contentId === ch.contentId);
    if (!existing) customChannels.unshift(ch);
    syncCustomGroup();
    input.value = '';
    currentView = { type: 'group', group: 'Custom', subgroup: null };
    renderGroups();
    renderCurrentView();
    document.getElementById('channel-count').textContent = `${allChannels.length} canales`;
    playChannel(ch);
  } catch (e) {
    document.getElementById('channel-count').textContent = e.message;
  } finally {
    button.disabled = false;
  }
}

function syncCustomGroup() {
  const regularChannels = allChannels.filter(ch => ch.group !== 'Custom' || !ch.contentId);
  allChannels = [...customChannels, ...regularChannels];
  if (customChannels.length) {
    grouped.Custom = customChannels;
    subgrouped.Custom = { Manual: customChannels };
  } else {
    delete grouped.Custom;
    delete subgrouped.Custom;
  }
}

function looksLikeAceInput(value) {
  const q = value.trim();
  return /^[a-fA-F0-9]{40}$/.test(q) || /^acestream:\/\//i.test(q) || /(?:[?&](?:id|infohash)=|\/(?:content_id|pid|infohash)\/)/i.test(q);
}

function loadFavoriteKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    const keys = new Set();
    if (Array.isArray(parsed)) {
      parsed.forEach(key => {
        const value = String(key || '');
        if (!value) return;
        keys.add(value);
      });
    }
    return keys;
  } catch {
    return new Set();
  }
}

function saveFavoriteKeys() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteKeys]));
}

function channelFavoriteKey(ch) {
  if (ch.streamId) return `stream:${ch.streamId}`;
  if (ch.contentId) return `content:${ch.contentId}`;
  if (ch.tvgId) return `tvg:${String(ch.tvgId).trim().toLowerCase()}`;
  if (ch.name) return `name:${exactFavoriteName(ch.name)}`;
  return null;
}

function exactFavoriteName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function isFavorite(ch) {
  const key = channelFavoriteKey(ch);
  return Boolean(key && favoriteKeys.has(key));
}

function getFavoriteChannels() {
  return allChannels.filter(ch => isFavorite(ch));
}

function toggleFavorite(event, chJson) {
  event.stopPropagation();
  const ch = chJson;
  const key = channelFavoriteKey(ch);
  if (!key) return;
  if (favoriteKeys.has(key)) favoriteKeys.delete(key);
  else favoriteKeys.add(key);
  saveFavoriteKeys();
  renderGroups();
  renderCurrentView();
}

function playChannel(chJson) {
  const ch = chJson;
  activeChannel = ch;
  userClosedPlayer = false;
  const overlay = document.getElementById('player-overlay');
  overlay.classList.add('open');
  document.getElementById('player-title').textContent = ch.name;
  document.getElementById('player-status').textContent = '⏳ Iniciando…';
  const logoEl = document.getElementById('player-logo');
  if (ch.logo) { logoEl.src = ch.logo; logoEl.style.display = ''; }
  else logoEl.style.display = 'none';

  const hlsUrl = `/stream/${encodeURIComponent(ch.streamId)}/index.m3u8`;
  if (hls) { hls.destroy(); hls = null; }
  videoEl.removeAttribute('controls');
  videoEl.muted = false;
  updateMuteButton();
  hideStreamError();
  showStreamLoader();
  startLiveStateTimer();
  showPlayerControls();

  if (Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: true });
    hls.on(Hls.Events.MANIFEST_LOADING, () => updateStreamLoader(20));
    hls.on(Hls.Events.MANIFEST_LOADED, () => updateStreamLoader(45));
    hls.on(Hls.Events.FRAG_LOADING, () => updateStreamLoader(72));
    hls.on(Hls.Events.FRAG_LOADED, () => updateStreamLoader(84));
    hls.on(Hls.Events.FRAG_BUFFERED, () => updateStreamLoader(92));
    hls.loadSource(hlsUrl);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      updateStreamLoader(65);
      goLive();
      videoEl.play();
      document.getElementById('player-status').textContent = '● En directo';
    });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!activeChannel || activeChannel.streamId !== ch.streamId) return;
      if (d.fatal) {
        hideStreamLoader(true);
        showStreamError('El canal no ha respondido o no se ha podido abrir el manifiesto.');
        document.getElementById('player-status').textContent = '❌ ' + d.details;
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    updateStreamLoader(20);
    videoEl.src = hlsUrl;
    goLive();
    videoEl.play();
  }
}

function closePlayer() {
  userClosedPlayer = true;
  activeChannel = null;
  document.getElementById('player-overlay').classList.remove('open');
  if (hls) { hls.destroy(); hls = null; }
  stopLiveStateTimer();
  stopControlsHideTimer();
  hideStreamLoader(true);
  hideStreamError();
  playerShellEl.classList.remove('controls-hidden');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
}

function seekBack10() {
  if (!videoEl.seekable.length) return;
  const start = videoEl.seekable.start(0);
  videoEl.currentTime = Math.max(start, videoEl.currentTime - 10);
  updateLiveState();
  showPlayerControls();
}

function goLive() {
  const edge = liveEdge();
  if (edge === null) return;
  videoEl.currentTime = Math.max(0, edge - 0.5);
  videoEl.play();
  updateLiveState();
  showPlayerControls();
}

function liveEdge() {
  if (!videoEl.seekable.length) return null;
  return videoEl.seekable.end(videoEl.seekable.length - 1);
}

function updateLiveState() {
  const edge = liveEdge();
  const isLive = edge === null || edge - videoEl.currentTime < 3;
  const badge = document.getElementById('live-badge');
  const goLiveBtn = document.getElementById('go-live-btn');
  badge.hidden = !isLive;
  goLiveBtn.hidden = isLive;
}

function startLiveStateTimer() {
  stopLiveStateTimer();
  updateLiveState();
  liveStateTimer = setInterval(updateLiveState, 1000);
}

function stopLiveStateTimer() {
  if (!liveStateTimer) return;
  clearInterval(liveStateTimer);
  liveStateTimer = null;
}

function toggleMute() {
  videoEl.muted = !videoEl.muted;
  updateMuteButton();
  showPlayerControls();
}

function updateMuteButton() {
  document.getElementById('mute-btn').textContent = videoEl.muted || videoEl.volume === 0 ? '🔇' : '🔊';
}

function toggleFullscreen() {
  const shell = document.getElementById('player-shell');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (shell.requestFullscreen) shell.requestFullscreen();
  else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();
  showPlayerControls();
}

function showPlayerControls() {
  playerShellEl.classList.remove('controls-hidden');
  stopControlsHideTimer();
  controlsHideTimer = setTimeout(() => {
    playerShellEl.classList.add('controls-hidden');
  }, 2500);
}

function stopControlsHideTimer() {
  if (!controlsHideTimer) return;
  clearTimeout(controlsHideTimer);
  controlsHideTimer = null;
}

function showStreamLoader() {
  streamLoadProgress = 0;
  streamLoadStartedAt = Date.now();
  streamLoaderEl.hidden = false;
  updateStreamLoader(8);
  stopStreamLoadTimer();
  streamLoadTimer = setInterval(() => {
    if (streamLoaderEl.hidden) return;
    const elapsed = Math.floor((Date.now() - streamLoadStartedAt) / 1000);
    if (elapsed >= 12 && streamLoadProgress < 92) {
      updateStreamLoader(streamLoadProgress);
    }
  }, 1000);
}

function updateStreamLoader(percent) {
  streamLoadProgress = Math.max(streamLoadProgress, Math.min(100, percent));
  document.getElementById('loader-percent').textContent = `${streamLoadProgress}%`;
}

function hideStreamLoader(immediate = false) {
  stopStreamLoadTimer();
  if (immediate) {
    streamLoaderEl.hidden = true;
    return;
  }
  updateStreamLoader(100);
  setTimeout(() => { streamLoaderEl.hidden = true; }, 250);
}

function stopStreamLoadTimer() {
  if (!streamLoadTimer) return;
  clearInterval(streamLoadTimer);
  streamLoadTimer = null;
}

function showStreamError(message) {
  stopStreamLoadTimer();
  streamErrorEl.hidden = false;
  document.getElementById('stream-error-msg').textContent = message;
  showPlayerControls();
}

function hideStreamError() {
  streamErrorEl.hidden = true;
}

function reloadActiveChannel() {
  if (userClosedPlayer || !activeChannel) return;
  document.getElementById('player-status').textContent = '⏳ Reconectando...';
  hideStreamError();
  showStreamLoader();
  const channel = activeChannel;
  setTimeout(() => {
    if (!userClosedPlayer && activeChannel) playChannel(channel);
  }, 600);
}

document.getElementById('player-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closePlayer(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closePlayer();
});
playerShellEl.addEventListener('mousemove', showPlayerControls);
playerShellEl.addEventListener('touchstart', showPlayerControls, { passive: true });
playerShellEl.addEventListener('click', showPlayerControls);
videoEl.addEventListener('timeupdate', updateLiveState);
videoEl.addEventListener('volumechange', updateMuteButton);
videoEl.addEventListener('loadedmetadata', () => updateStreamLoader(68));
videoEl.addEventListener('canplay', () => updateStreamLoader(95));
videoEl.addEventListener('playing', () => hideStreamLoader());
videoEl.addEventListener('ended', reloadActiveChannel);
videoEl.addEventListener('error', () => {
  if (!activeChannel) return;
  hideStreamLoader(true);
  showStreamError('El reproductor no ha podido abrir este directo.');
});
videoEl.addEventListener('waiting', () => {
  if (!streamLoaderEl.hidden) updateStreamLoader(streamLoadProgress);
});

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

function vodDetailUrl(item) {
  const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
  return `/vod/${encodeURIComponent(mediaType)}/${encodeURIComponent(item.tmdb_id)}`;
}

function vodMetaHtml(item) {
  return `<span>${item.media_type === 'tv' ? 'Serie' : 'Película'}</span><span>${escHtml(vodYear(item) || 'Sin fecha')}</span><span>${vodRating(item)}</span>`;
}

function shortText(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function jsArg(value) { return escHtml(JSON.stringify(value)); }

loadChannels();
if (window.location.hash === '#vod') setAppMode('vod');
