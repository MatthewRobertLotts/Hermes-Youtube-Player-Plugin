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

export function nextQueueItem({ list, index, queueMode, playlistId }) {
  const items = Array.isArray(list) ? list : [];
  const cur = items[index];
  let next = null;
  if (cur?.type === 'short') {
    next = items[index + 1]?.type === 'short' ? items[index + 1] : items.find(i => i.type === 'short') || null;
  } else if (queueMode === 'playlist') {
    next = items[index + 1] || null;
  }
  if (!next) return { next: null, playlist: null, index: -1 };
  const nextIndex = items.indexOf(next);
  return { next, playlist: queueMode === 'playlist' ? playlistId : next.list, index: nextIndex };
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
