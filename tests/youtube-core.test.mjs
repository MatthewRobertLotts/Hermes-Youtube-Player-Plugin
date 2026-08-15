import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adapterState,
  YOUTUBE_COMPAT,
  autoAdvanceQueueItem,
  captionChoice,
  clampTime,
  compareVersions,
  isShortUrl,
  lifecycleStatus,
  loopAction,
  nextQueueItem,
  dedupeQueue,
  normaliseDashboardRow,
  normalisePrefs,
  parseYouTubeItems,
  playlistIdFrom,
  qualityChoice,
  queueState,
  previousQueueItem,
  seekBy,
  startSecondsFrom,
  UPDATE_CONTRACT,
  updateState,
  updaterPlan,
  validateDownloadedPlugin,
  validateRelease,
  videoIdFrom,
  rendererCounts,
  watchUrl,
} from '../src/youtube-core.mjs';

const id = 'dQw4w9WgXcQ';
const other = 'abcDEF12345';

const fixtures = await import('./fixtures/youtube-structures.mjs');

test('extracts video IDs from common YouTube URL shapes', () => {
  assert.equal(videoIdFrom(id), id);
  assert.equal(videoIdFrom(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(videoIdFrom(`https://m.youtube.com/watch?v=${id}`), id);
  assert.equal(videoIdFrom(`https://youtu.be/${id}?t=42`), id);
  assert.equal(videoIdFrom(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(videoIdFrom(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(videoIdFrom(`https://www.youtube.com/live/${id}`), null); // runtime does not support /live yet
  assert.equal(videoIdFrom('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoIdFrom('not a url'), null);
  assert.equal(videoIdFrom(''), null);
});

test('extracts playlist IDs and timestamps', () => {
  assert.equal(playlistIdFrom(`https://www.youtube.com/watch?v=${id}&list=PLabc123`), 'PLabc123');
  assert.equal(playlistIdFrom('https://www.youtube.com/playlist?list=WL'), 'WL');
  assert.equal(playlistIdFrom('bad'), null);
  assert.equal(startSecondsFrom(`https://youtu.be/${id}?t=1h2m3s`), 3723);
  assert.equal(startSecondsFrom(`https://youtu.be/${id}?t=90s`), 90);
  assert.equal(startSecondsFrom(`https://youtu.be/${id}?start=91`), 91);
  assert.equal(startSecondsFrom(`https://youtu.be/${id}?t=-1`), 0);
  assert.equal(startSecondsFrom('bad'), 0);
});

test('builds watch and playlist URLs safely', () => {
  assert.equal(watchUrl('', null), 'about:blank');
  assert.equal(watchUrl(id, null, 0), `https://www.youtube.com/watch?v=${id}&autoplay=1`);
  assert.equal(watchUrl(id, 'PLabc123', 42), `https://www.youtube.com/watch?v=${id}&autoplay=1&t=42s&list=PLabc123`);
  assert.equal(watchUrl('PLabc123', null, 2), 'https://www.youtube.com/playlist?list=PLabc123&autoplay=1&t=2s');
});

test('detects Shorts URLs', () => {
  assert.equal(isShortUrl(`https://www.youtube.com/shorts/${id}`), true);
  assert.equal(isShortUrl(`https://www.youtube.com/watch?v=${id}`), false);
});

test('normalises dashboard shelves by source', () => {
  const items = [
    { id: 'video111111', title: 'Video', type: 'video' },
    { id: 'short111111', title: 'Short', type: 'short' },
    { id: 'notPlaylist', list: 'PLabc123', title: 'List item', type: 'video' },
    { id: 'PLreal123', title: 'Playlist', type: 'playlist' },
    { id: '', title: 'Bad', type: 'video' },
    { id: other, title: '', type: 'video' },
  ];
  assert.deepEqual(normaliseDashboardRow('history', items, 'video111111').map(i => i.id), ['notPlaylist']);
  assert.deepEqual(normaliseDashboardRow('shorts', items).map(i => i.id), ['short111111']);
  assert.deepEqual(normaliseDashboardRow('playlists', items).map(i => [i.id, i.type]), [['PLabc123', 'playlist'], ['PLreal123', 'playlist']]);
});

test('advances queues like the plugin runtime', () => {
  const shorts = [{ id: 'a', type: 'short' }, { id: 'b', type: 'video' }, { id: 'c', type: 'short', list: 'shorts' }];
  assert.deepEqual(autoAdvanceQueueItem({ list: shorts, index: 0, queueMode: 'search', playlistId: null }), { next: shorts[2], playlist: 'shorts', index: 2 });
  assert.deepEqual(nextQueueItem({ list: shorts, index: 2, queueMode: 'search', playlistId: null }), { next: shorts[0], playlist: undefined, index: 0 });
  const playlist = [{ id: 'a', type: 'video' }, { id: 'b', type: 'video' }];
  assert.deepEqual(autoAdvanceQueueItem({ list: playlist, index: 0, queueMode: 'playlist', playlistId: 'PLx' }), { next: playlist[1], playlist: 'PLx', index: 1 });
  assert.deepEqual(autoAdvanceQueueItem({ list: playlist, index: 1, queueMode: 'playlist', playlistId: 'PLx' }), { next: null, playlist: null, index: -1 });
  assert.deepEqual(previousQueueItem({ list: playlist, index: 1 }), { previous: playlist[0], index: 0 });
  assert.deepEqual(previousQueueItem({ list: playlist, index: 0 }), { previous: null, index: -1 });
});

test('documents loop modes used by the runtime', () => {
  assert.equal(loopAction('once'), 'loop-once');
  assert.equal(loopAction('inf'), 'loop-all');
  assert.equal(loopAction('off'), 'loop-off');
  assert.equal(loopAction('weird'), 'loop-off');
});

test('normalises persisted prefs used by player boot', () => {
  assert.deepEqual(normalisePrefs({ playerSize: 'small', placement: 'floating', volume: 2, loopMode: 'once', quality: 'auto' }), { playerSize: 'small', placement: 'floating', volume: 1, loopMode: 'once', quality: 'auto' });
  assert.deepEqual(normalisePrefs({ playerSize: 'bad', placement: 'bad', volume: 'nope', loopMode: 'bad' }), { playerSize: 'large', placement: 'docked', volume: 0.9, loopMode: 'off' });
});

test('compatibility constants document YouTube boundaries', () => {
  assert.equal(YOUTUBE_COMPAT.historyBrowseId, 'FEhistory');
  assert.equal(YOUTUBE_COMPAT.webviewPartition, 'persist:hermes-youtube-float-player');
  assert.equal(new RegExp(YOUTUBE_COMPAT.playlistIdPattern).test('PLabc123'), true);
  assert.equal(YOUTUBE_COMPAT.trustedHosts.includes('youtu.be'), true);
});

test('compares release versions and update state', () => {
  assert.equal(compareVersions('v3.115', 'v3.114'), 1);
  assert.equal(compareVersions('v3.114.1', 'v3.114'), 1);
  assert.equal(compareVersions('v3.114', 'v3.114.0'), 0);
  assert.equal(compareVersions('v3.113', 'v3.114'), -1);
  assert.deepEqual(updateState('v3.114', { tag_name: 'v3.115', html_url: 'https://example.test/release' }), { current: 'v3.114', latest: 'v3.115', state: 'available', url: 'https://example.test/release' });
  assert.deepEqual(updateState('v3.115', { tag_name: 'v3.115' }), { current: 'v3.115', latest: 'v3.115', state: 'current', url: '' });
});


test('validates safe updater contracts', () => {
  const asset = tag => ({ name: `youtube-float-desktop-plugin-${tag}.zip`, browser_download_url: `https://github.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/releases/download/${tag}/youtube-float-desktop-plugin-${tag}.zip`, size: 37000 });
  const release = tag => ({ tag_name: tag, html_url: `https://github.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/releases/tag/${tag}`, assets: [asset(tag)] });
  assert.equal(validateRelease('v3.124', release('v3.124')).state, 'current');
  assert.equal(validateRelease('v3.123', release('v3.124')).state, 'available');
  assert.equal(validateRelease('v3.125', release('v3.124')).state, 'newer-installed');
  assert.equal(validateRelease('v3.123', {}).reason, 'malformed release response');
  assert.equal(validateRelease('v3.123', { ...release('v3.124'), html_url: 'https://evil.test/releases/tag/v3.124' }).reason, 'invalid source');
  assert.equal(validateRelease('v3.123', { ...release('v3.124'), assets: [{ ...asset('v3.124'), size: UPDATE_CONTRACT.maxBytes + 1 }] }).reason, 'oversized download');
  assert.equal(validateDownloadedPlugin({ manifest: { id: 'wrong', version: 'v3.124' }, pluginSource: 'x'.repeat(2000), expectedVersion: 'v3.124' }).reason, 'wrong plugin ID');
  assert.equal(validateDownloadedPlugin({ manifest: { id: UPDATE_CONTRACT.pluginId, version: 'v3.123' }, pluginSource: 'x'.repeat(2000), expectedVersion: 'v3.124' }).reason, 'wrong downloaded version');
  assert.equal(validateDownloadedPlugin({ manifest: { id: UPDATE_CONTRACT.pluginId, version: 'v3.124' }, pluginSource: "const VERSION = 'v3.124'\nexport default {}\n".repeat(80), expectedVersion: 'v3.124' }).ok, true);
  assert.equal(updaterPlan({ current: 'v3.123', release: release('v3.124'), hasWriteBridge: false }).action, 'fallback');
  assert.equal(updaterPlan({ current: 'v3.123', release: release('v3.124'), hasWriteBridge: true, writeOk: false }).reason, 'failed write');
});


test('parses resilient offline YouTube fixtures', () => {
  const items = parseYouTubeItems(fixtures.mixedInitialData, { source: 'recommended' });
  assert.deepEqual(items.map(i => [i.id, i.type]), [[fixtures.ids.video, 'video'], [fixtures.ids.short, 'short'], [fixtures.ids.playlist, 'playlist']]);
  assert.deepEqual(parseYouTubeItems(fixtures.mixedInitialData, { source: 'playlists' }).map(i => i.id), [fixtures.ids.playlist]);
  assert.deepEqual(parseYouTubeItems(fixtures.partialInitialData, { source: 'history' }).map(i => i.id), [fixtures.ids.other]);
  assert.deepEqual(parseYouTubeItems(fixtures.emptyInitialData), []);
  assert.deepEqual(parseYouTubeItems(fixtures.malformedMetadata), []);
});

test('classifies adapter states independently', () => {
  assert.equal(adapterState({ loading: true }), 'loading');
  assert.equal(adapterState({ signedIn: false }), 'signed-out');
  assert.equal(adapterState({ network: true }), 'network-failure');
  assert.equal(adapterState({ error: 'renderer changed' }), 'compatibility-failure');
  assert.equal(adapterState({ unavailable: true }), 'unavailable');
  assert.equal(adapterState({ items: [] }), 'empty');
  assert.equal(adapterState({ items: [{ id: 'x' }] }), 'ready');
  assert.equal(rendererCounts(fixtures.mixedInitialData).videoRenderer, 1);
});


test('hardens deterministic playback controls', () => {
  assert.equal(clampTime(-5, 100), 0);
  assert.equal(clampTime(500, 120), 120);
  assert.equal(clampTime(30, 0), 30);
  assert.equal(seekBy(3, -10, 100), 0);
  assert.equal(seekBy(118, 10, 120), 120);
  assert.equal(seekBy(3600, 10, 7200), 3610);
  assert.equal(qualityChoice('hd720', ['auto', 'hd720']), 'hd720');
  assert.equal(qualityChoice('hd2160', ['auto', 'hd720']), 'auto');
  assert.equal(captionChoice('en', [{ lang: 'en', label: 'English' }]), 'en');
  assert.equal(captionChoice('fr', [{ lang: 'en', label: 'English' }]), 'off');
});

test('hardens queue boundaries and duplicate/unavailable rows', () => {
  const list = [{ id: 'a', type: 'video' }, { id: 'a', type: 'video' }, { id: 'b', type: 'video' }, { id: '', type: 'video' }];
  assert.deepEqual(dedupeQueue(list).map(i => i.id), ['a', 'b']);
  assert.equal(queueState([], -1), 'empty');
  assert.equal(queueState([{ id: 'a' }], 0), 'first');
  assert.equal(queueState([{ id: 'a' }, { id: 'b' }], 1), 'last');
  assert.equal(queueState([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 1), 'middle');
  assert.deepEqual(previousQueueItem({ list: [{ id: 'a' }], index: 0 }), { previous: null, index: -1 });
  assert.deepEqual(autoAdvanceQueueItem({ list: [{ id: 's', type: 'short' }], index: 0, queueMode: 'search' }), { next: null, playlist: null, index: -1 });
});


test('hardens docked/floating lifecycle bookkeeping', () => {
  const restore = lifecycleStatus({ registered: true, playerOpen: true, placement: 'floating', queueItems: [{ id: 'a' }, { id: 'b' }], queueIndex: 1, log: ['1 dispose', '2 register', '3 queue restored', '3 resume video a', '1 decode:v_a'] });
  assert.equal(restore.registered, true);
  assert.equal(restore.placement, 'floating');
  assert.equal(restore.queueRestored, true);
  assert.equal(restore.simultaneousDecoders, 1);
  const dupeDecode = lifecycleStatus({ log: ['1 decode:v_a', '1 decode:v_a', '2 decode:v_a'] });
  assert.equal(dupeDecode.simultaneousDecoders, 1);
  assert.equal(lifecycleStatus({ registered: false }).registered, false);
  assert.equal(lifecycleStatus({ placement: 'garbage' }).placement, 'docked');
  assert.equal(lifecycleStatus({ queueItems: [{ id: 'a' }], queueIndex: 4, log: ['x resume'] }).queueRestored, false);
});
