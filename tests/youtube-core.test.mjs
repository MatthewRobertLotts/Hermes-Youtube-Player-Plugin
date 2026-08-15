import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YOUTUBE_COMPAT,
  autoAdvanceQueueItem,
  compareVersions,
  isShortUrl,
  loopAction,
  nextQueueItem,
  normaliseDashboardRow,
  normalisePrefs,
  playlistIdFrom,
  previousQueueItem,
  startSecondsFrom,
  updateState,
  videoIdFrom,
  watchUrl,
} from '../src/youtube-core.mjs';

const id = 'dQw4w9WgXcQ';
const other = 'abcDEF12345';

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
  assert.deepEqual(autoAdvanceQueueItem({ list: shorts, index: 0, queueMode: 'search', playlistId: null }), { next: shorts[0], playlist: undefined, index: 0 });
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
