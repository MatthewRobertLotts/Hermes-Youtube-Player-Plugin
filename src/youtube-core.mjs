export const YOUTUBE_COMPAT = Object.freeze({
  historyBrowseId: 'FEhistory',
  playlistIdPattern: '^(PL|RD|OLAK5uy|UU|FL|LL|WL)',
  trustedHosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  webviewPartition: 'persist:hermes-youtube-float-player',
});

const PLAYLIST_ID_RE = new RegExp(YOUTUBE_COMPAT.playlistIdPattern);
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function videoIdFrom(input) {
  const text = String(input || '').trim();
  if (VIDEO_ID_RE.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null;
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.match(/\/(embed|shorts|watch)\/?([a-zA-Z0-9_-]{11})/)?.[2] || null;
  } catch {}
  return null;
}

export function playlistIdFrom(input) {
  try {
    const url = new URL(String(input || '').trim());
    return url.searchParams.get('list') || null;
  } catch {}
  return null;
}

export function isShortUrl(input) {
  try { return new URL(String(input || '').trim()).pathname.includes('/shorts/'); } catch { return false; }
}

export function startSecondsFrom(input) {
  try {
    const url = new URL(String(input || '').trim());
    const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
    const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
    if (m && (m[1] || m[2] || m[3])) return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
    return Math.max(0, Math.floor(Number(t) || 0));
  } catch { return 0; }
}

export function watchUrl(videoId, playlistId, startAt = 0) {
  if (!videoId) return 'about:blank';
  const start = Math.max(0, Math.floor(Number(startAt) || 0));
  if (PLAYLIST_ID_RE.test(videoId)) return 'https://www.youtube.com/playlist?list=' + encodeURIComponent(videoId) + '&autoplay=1' + (start > 1 ? '&t=' + start + 's' : '');
  const base = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1' + (start > 1 ? '&t=' + start + 's' : '');
  return playlistId ? base + '&list=' + encodeURIComponent(playlistId) : base;
}

export function normaliseDashboardRow(key, items, currentVideoId = '') {
  const clean = (Array.isArray(items) ? items : []).filter(v => v?.id && v?.title);
  if (key === 'playlists') return clean
    .filter(i => PLAYLIST_ID_RE.test(i.id) || PLAYLIST_ID_RE.test(i.list || '') || i.type === 'playlist')
    .map(i => ({ ...i, id: PLAYLIST_ID_RE.test(i.id) ? i.id : (i.list || i.id), type: 'playlist' }));
  if (key === 'shorts') return clean.filter(i => i.type === 'short').map(i => ({ ...i, type: 'short' }));
  if (key === 'history') return clean.filter(i => i.type === 'video' && i.id !== currentVideoId);
  return clean;
}

export function nextQueueItem(args) {
  return autoAdvanceQueueItem(args);
}


export function versionParts(version) {
  return String(version || '').replace(/^v/, '').split('.').map(n => Number(n) || 0);
}

export function compareVersions(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const diff = (aa[i] || 0) - (bb[i] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function updateState(current, latestRelease) {
  const latest = latestRelease?.tag_name || latestRelease?.name || '';
  if (!latest) return { current, latest: '', state: 'unknown', url: '' };
  return {
    current,
    latest,
    state: compareVersions(latest, current) > 0 ? 'available' : 'current',
    url: latestRelease.html_url || '',
  };
}


export function previousQueueItem({ list, index }) {
  const items = Array.isArray(list) ? list : [];
  const prev = items[index - 1] || null;
  return { previous: prev, index: prev ? index - 1 : -1 };
}

export function autoAdvanceQueueItem({ list, index, queueMode, playlistId }) {
  const items = Array.isArray(list) ? list : [];
  const cur = items[index];
  let next = null;
  if (cur?.type === 'short') {
    next = items.slice(index + 1).find(i => i?.type === 'short') || items.find((i, iIndex) => i?.type === 'short' && iIndex !== index) || null;
  } else if (queueMode === 'playlist' && items[index + 1]) {
    next = items[index + 1];
  }
  if (!next) return { next: null, playlist: null, index: -1 };
  const nextIndex = items.indexOf(next);
  return { next, playlist: queueMode === 'playlist' ? playlistId : next.list, index: nextIndex };
}

export function clampTime(value, duration = 0) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  const d = Math.max(0, Math.floor(Number(duration) || 0));
  return d ? Math.min(n, d) : n;
}

export function seekBy(current, delta, duration = 0) {
  return clampTime((Number(current) || 0) + (Number(delta) || 0), duration);
}

export function qualityChoice(requested, available = []) {
  if (requested === 'auto') return 'auto';
  return Array.isArray(available) && available.includes(requested) ? requested : 'auto';
}

export function captionChoice(requested, tracks = []) {
  if (!requested || requested === 'off') return 'off';
  return (Array.isArray(tracks) ? tracks : []).some(t => t?.lang === requested || t?.label === requested) ? requested : 'off';
}

export function dedupeQueue(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    const key = item?.id ? `${item.type || 'video'}:${item.id}:${item.list || ''}` : '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function queueState(items = [], index = -1) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 'empty';
  if (index <= 0) return 'first';
  if (index >= list.length - 1) return 'last';
  return 'middle';
}

export function loopAction(mode) {
  if (mode === 'once') return 'loop-once';
  if (mode === 'inf') return 'loop-all';
  return 'loop-off';
}

export function normalisePrefs(prefs = {}) {
  const size = ['mini', 'small', 'medium', 'large'].includes(prefs.playerSize) ? prefs.playerSize : 'large';
  const placement = prefs.placement === 'floating' ? 'floating' : 'docked';
  const volume = Math.max(0, Math.min(1, Number.isFinite(Number(prefs.volume)) ? Number(prefs.volume) : 0.9));
  const loopMode = ['off', 'once', 'inf'].includes(prefs.loopMode) ? prefs.loopMode : 'off';
  return { ...prefs, playerSize: size, placement, volume, loopMode };
}


export const UPDATE_CONTRACT = Object.freeze({
  artifactPrefix: 'youtube-float-desktop-plugin-',
  artifactSuffix: '.zip',
  maxBytes: 2_000_000,
  pluginId: 'youtube-float',
  releaseOrigin: 'https://github.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin',
});

export function releaseAssetFor(release, contract = UPDATE_CONTRACT) {
  const tag = release?.tag_name || '';
  const expectedName = `${contract.artifactPrefix}${tag}${contract.artifactSuffix}`;
  return (Array.isArray(release?.assets) ? release.assets : []).find(asset => asset?.name === expectedName) || null;
}

export function validateRelease(current, release, contract = UPDATE_CONTRACT) {
  const latest = release?.tag_name || '';
  const url = release?.html_url || '';
  if (!latest || !/^v\d+(?:\.\d+){1,3}$/.test(latest)) return { ok: false, state: 'invalid', reason: 'malformed release response' };
  if (!url.startsWith(contract.releaseOrigin + '/releases/tag/')) return { ok: false, state: 'invalid', reason: 'invalid source' };
  const cmp = compareVersions(latest, current);
  if (cmp === 0) return { ok: true, state: 'current', latest, url };
  if (cmp < 0) return { ok: true, state: 'newer-installed', latest, url };
  const asset = releaseAssetFor(release, contract);
  if (!asset) return { ok: false, state: 'invalid', reason: 'missing release artifact', latest, url };
  if (!String(asset.browser_download_url || '').startsWith(contract.releaseOrigin + '/releases/download/' + latest + '/')) return { ok: false, state: 'invalid', reason: 'invalid source', latest, url };
  if (!String(asset.name || '').endsWith(contract.artifactSuffix)) return { ok: false, state: 'invalid', reason: 'invalid file type', latest, url };
  if (!Number.isFinite(asset.size) || asset.size <= 0 || asset.size > contract.maxBytes) return { ok: false, state: 'invalid', reason: 'oversized download', latest, url };
  return { ok: true, state: 'available', latest, url, asset };
}

export function validateDownloadedPlugin({ manifest, pluginSource, expectedVersion, contract = UPDATE_CONTRACT }) {
  if (manifest?.id !== contract.pluginId) return { ok: false, reason: 'wrong plugin ID' };
  if (manifest?.version !== expectedVersion) return { ok: false, reason: 'wrong downloaded version' };
  if (typeof pluginSource !== 'string' || pluginSource.length < 1000 || pluginSource.length > contract.maxBytes) return { ok: false, reason: 'invalid plugin content' };
  if (!pluginSource.includes(`const VERSION = '${expectedVersion}'`) || !pluginSource.includes('export default')) return { ok: false, reason: 'invalid plugin content' };
  return { ok: true };
}

export function updaterPlan({ current, release, hasWriteBridge = false, writeOk = true, contract = UPDATE_CONTRACT }) {
  const validation = validateRelease(current, release, contract);
  if (!validation.ok) return { action: 'fallback', reason: validation.reason, validation };
  if (validation.state !== 'available') return { action: 'none', reason: validation.state, validation };
  if (!hasWriteBridge) return { action: 'fallback', reason: 'manual update required', validation };
  if (!writeOk) return { action: 'fallback', reason: 'failed write', validation };
  return { action: 'install', reason: 'validated', validation };
}


export const YOUTUBE_RENDERERS = Object.freeze({
  historyBrowse: YOUTUBE_COMPAT.historyBrowseId,
  playlist: ['playlistRenderer', 'compactPlaylistRenderer', 'gridPlaylistRenderer', 'radioRenderer', 'playlistPanelVideoRenderer'],
  shorts: ['reelItemRenderer', 'shortsLockupViewModel'],
  video: ['videoRenderer', 'playlistVideoRenderer', 'lockupViewModel'],
});

export function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.simpleText || (Array.isArray(value.runs) ? value.runs.map(r => r.text || '').join('') : '');
}

export function walkYouTube(value, visit, limit = 2000) {
  let seen = 0;
  const walk = node => {
    if (!node || seen >= limit) return;
    seen += 1;
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (typeof node !== 'object') return;
    visit(node);
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(value);
}

export function rendererCounts(data) {
  const counts = {};
  walkYouTube(data, node => {
    for (const key of Object.keys(node)) if (/Renderer|ViewModel$/.test(key) && node[key] && typeof node[key] === 'object') counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function parseYouTubeItems(data, { source = 'search', currentVideoId = '' } = {}) {
  const out = [];
  const seen = new Set();
  const push = item => {
    const id = item?.id;
    const title = String(item?.title || '').replace(/\s+/g, ' ').trim();
    if (!id || !title || seen.has(id) || /now playing/i.test(title)) return;
    seen.add(id);
    out.push({ duration: item.duration || '', id, list: item.list || null, thumb: item.thumb || '', title, type: item.type || 'video' });
  };
  const firstThumb = obj => {
    try { return JSON.stringify(obj || '').match(/"url":"(https:[^"]{10,})"/)?.[1] || ''; } catch { return ''; }
  };
  const playlistFromEndpoint = ep => {
    try {
      const raw = ep?.watchEndpoint?.playlistId || ep?.commandMetadata?.webCommandMetadata?.url || '';
      if (PLAYLIST_ID_RE.test(raw)) return raw;
      return String(raw).match(/[?&]list=([^&]+)/)?.[1] || '';
    } catch { return ''; }
  };
  walkYouTube(data, node => {
    const vr = node.videoRenderer;
    if (vr?.videoId) {
      const url = vr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || '';
      if (source === 'history' && url.includes('/shorts/')) return;
      push({ id: vr.videoId, title: textOf(vr.title), thumb: firstThumb(vr.thumbnail), duration: textOf(vr.lengthText), type: url.includes('/shorts/') ? 'short' : 'video', list: url.match(/list=([^&]+)/)?.[1] || null });
    }
    const pvr = node.playlistVideoRenderer;
    if (pvr?.videoId) push({ id: pvr.videoId, title: textOf(pvr.title), thumb: firstThumb(pvr.thumbnail), duration: textOf(pvr.lengthText), type: 'video' });
    const reel = node.reelItemRenderer;
    if (reel?.videoId) push({ id: reel.videoId, title: textOf(reel.headline) || 'Short', type: 'short' });
    const shorts = node.shortsLockupViewModel;
    if (shorts?.videoId) push({ id: shorts.videoId, title: String(shorts.accessibilityText || 'Short').replace(/,?\s*\d[\d,.]*\s*(million|billion|k)?\s*views\s*[–-]\s*play\s*short$/i, ''), thumb: firstThumb(shorts.thumbnail), type: 'short' });
    const lockup = node.lockupViewModel;
    if (lockup?.contentId) {
      let title = lockup.metadata?.lockupMetadataViewModel?.title?.content || '';
      if (PLAYLIST_ID_RE.test(lockup.contentId)) push({ id: lockup.contentId, list: lockup.contentId, title, thumb: firstThumb(lockup.contentImage), type: 'playlist' });
      else if (String(lockup.contentType || '').includes('SHORT')) push({ id: lockup.contentId, title, thumb: firstThumb(lockup.contentImage), type: 'short' });
      else push({ id: lockup.contentId, title, thumb: firstThumb(lockup.contentImage), type: 'video' });
    }
    const pr = node.playlistRenderer;
    if (pr?.playlistId) push({ id: pr.playlistId, list: pr.playlistId, title: textOf(pr.title) || 'Playlist', type: 'playlist' });
    for (const key of ['compactPlaylistRenderer', 'gridPlaylistRenderer', 'radioRenderer']) {
      const rr = node[key];
      const list = rr && (rr.playlistId || playlistFromEndpoint(rr.navigationEndpoint));
      if (list) push({ id: list, list, title: textOf(rr.title) || textOf(rr.shortBylineText) || 'Playlist', thumb: firstThumb(rr.thumbnail), type: 'playlist' });
    }
    const list = playlistFromEndpoint(node.navigationEndpoint);
    if (list) push({ id: list, list, title: textOf(node.title) || node.metadata?.lockupMetadataViewModel?.title?.content || 'Playlist', thumb: firstThumb(node.thumbnail || node.contentImage), type: 'playlist' });
  });
  return normaliseDashboardRow(source === 'recommended' ? 'videos' : source, out, currentVideoId);
}

export function adapterState({ signedIn = true, items = [], loading = false, error = '', network = false, unavailable = false } = {}) {
  if (loading) return 'loading';
  if (!signedIn) return 'signed-out';
  if (network) return 'network-failure';
  if (error) return 'compatibility-failure';
  if (unavailable) return 'unavailable';
  if (!items.length) return 'empty';
  return 'ready';
}


export function lifecycleStatus({ registered = false, playerOpen = true, placement = 'docked', queueItems = [], queueIndex = -1, log = [] } = {}) {
  const live = Array.isArray(log) ? log : [];
  const nonce = live.length ? new Set(live.map(line => String(line).split(' ')[0])).size : 0;
  // Count distinct video IDs that are being decoded at the same lifecycle tick; more than one
  // means two players could be decoding the same/extra video (a duplicate-audio risk).
  const decode = (String(live.join('\n')).match(/decode[s]?:\s*([^;\s]+)/g) || []).map(x => x.replace(/^decode[s]?:\s*/, ''));
  return {
    ok: registered && playerOpen,
    registered,
    playerOpen,
    placement: placement === 'floating' ? 'floating' : 'docked',
    queueRestored: Array.isArray(queueItems) && queueItems.length > queueIndex && queueIndex >= 0 && String(live.join('\n')).includes('queue restored'),
    uniqueMediaLifecycleOps: nonce,
    simultaneousDecoders: decode.length ? new Set(decode).size : 1,
  };
}
