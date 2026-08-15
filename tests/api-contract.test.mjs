import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_API,
  apiSupportsVersion,
  parseApiMessage,
  isReadMethod,
  isControlMethod,
  validateControl,
  clampSeekSeconds,
  normalizeVideo,
  normalizePlaybackState,
  normalizeQueue,
  normalizeChapters,
  apiOk,
  apiError,
} from '../src/youtube-core.mjs';

// These tests freeze API v1 behaviour. A consumer written against v1 must keep working
// if a field becomes unavailable, the player is closed, the queue is absent, signed-in
// state changes, or YouTube changes internally — so every assertion pins a stable default.

test('API version is 1 and supports exactly 1..current', () => {
  assert.equal(PLAYER_API.version, 1);
  assert.equal(PLAYER_API.plugin, 'youtube-float');
  assert.equal(apiSupportsVersion(1), true);
  assert.equal(apiSupportsVersion(0), false);
  assert.equal(apiSupportsVersion(2), false); // v2 does not exist yet
  assert.equal(apiSupportsVersion('1'), false); // non-integer rejected
  assert.equal(apiSupportsVersion(null), false);
  assert.equal(apiSupportsVersion(NaN), false);
});

test('v1 exposes exactly the frozen read and control method names', () => {
  assert.deepEqual(
    [...PLAYER_API.readMethods].sort(),
    ['getAccountState', 'getApiInfo', 'getChapters', 'getCurrentVideo', 'getPlaybackState', 'getQueue'].sort(),
  );
  assert.deepEqual([...PLAYER_API.controlMethods].sort(), ['next', 'pause', 'play', 'previous', 'seekTo'].sort());
  for (const m of PLAYER_API.readMethods) assert.equal(isReadMethod(m), true);
  for (const m of PLAYER_API.controlMethods) assert.equal(isControlMethod(m), true);
  assert.equal(isReadMethod('destroy'), false);
  assert.equal(isControlMethod('eject'), false);
});

test('message envelope: version, method, params validation', () => {
  assert.equal(parseApiMessage(null).ok, false);
  assert.equal(parseApiMessage('x').ok, false);
  assert.equal(parseApiMessage({ method: 5 }).ok, false);
  assert.equal(parseApiMessage({ method: 'getApiInfo', params: [] }).ok, false); // params must be object
  assert.equal(parseApiMessage({ v: 9, method: 'play' }).error, 'unsupported api version');
  const ok = parseApiMessage({ v: 1, id: 'r1', method: 'seekTo', params: { seconds: 5 } });
  assert.equal(ok.ok, true);
  assert.equal(ok.version, 1);
  assert.equal(ok.id, 'r1');
  assert.equal(ok.method, 'seekTo');
  assert.deepEqual(ok.params, { seconds: 5 });
});

test('seekTo rejects unsafe values and clamps to duration', () => {
  assert.equal(clampSeekSeconds(5).ok, true);
  assert.equal(clampSeekSeconds('10').seconds, 10);
  assert.equal(clampSeekSeconds(NaN).ok, false);
  assert.equal(clampSeekSeconds(Infinity).ok, false);
  assert.equal(clampSeekSeconds(-Infinity).ok, false);
  assert.equal(clampSeekSeconds(-1).error, 'seekTo must be non-negative');
  assert.equal(clampSeekSeconds('abc').ok, false);
  assert.equal(clampSeekSeconds(999, 120).seconds, 120); // clamped to duration
  assert.equal(clampSeekSeconds(null).ok, false);
  assert.equal(clampSeekSeconds(undefined).ok, false);
  assert.equal(clampSeekSeconds({}).ok, false);
  assert.equal(clampSeekSeconds(0).seconds, 0); // valid: seek to start
});

test('control validation rejects malformed/missing params', () => {
  assert.equal(validateControl('play', {}).ok, true);
  assert.equal(validateControl('pause', undefined).ok, true);
  assert.equal(validateControl('next', null).ok, true);
  assert.equal(validateControl('previous', { junk: 1 }).ok, true); // extra params ignored
  assert.equal(validateControl('seekTo', {}).ok, false); // missing seconds
  assert.equal(validateControl('seekTo', { seconds: NaN }).ok, false);
  assert.equal(validateControl('seekTo', { seconds: Infinity }).ok, false);
  assert.equal(validateControl('seekTo', { seconds: '50' }).seconds, 50);
  assert.equal(validateControl('play', { seconds: 5 }).ok, true); // play ignores seconds
  assert.equal(validateControl('fly', {}).error, 'unknown method: fly');
});

test('normalizeVideo returns stable defaults when closed / nothing loaded', () => {
  const none = normalizeVideo(null, {});
  assert.equal(none.videoId, null);
  assert.equal(none.canonicalUrl, null);
  assert.equal(none.title, null);
  assert.equal(none.duration, 0);
  assert.equal(none.currentTime, 0);
  assert.equal(Array.isArray(none.chapters), true);
  assert.equal(none.isShort, false);
  assert.equal(none.isLive, false);
  assert.equal(none.playlistId, null);
  const full = normalizeVideo(
    { videoId: 'abcDEF12345', title: 'T', channel: 'C', duration: 120, description: 'D', playlistId: 'PLx' },
    { currentTime: 30 },
  );
  assert.equal(full.videoId, 'abcDEF12345');
  assert.match(full.canonicalUrl, /youtube\.com\/watch\?v=abcDEF12345/);
  assert.equal(full.currentTime, 30);
  assert.equal(full.channel, 'C');
  // non-string fields normalise to null, never throw
  assert.equal(normalizeVideo({ title: 5, channel: {} }).title, null);
});

test('normalizePlaybackState: closed player and bad numbers are safe', () => {
  const closed = normalizePlaybackState({});
  assert.equal(closed.videoId, null);
  assert.equal(closed.paused, true);
  assert.equal(closed.currentTime, 0);
  assert.equal(closed.duration, 0);
  assert.equal(closed.playerOpen, false);
  assert.equal(closed.playing, false);
  const bad = normalizePlaybackState({ currentTime: NaN, duration: Infinity, volume: 999, loopMode: 'weird' });
  assert.equal(bad.currentTime, 0);
  assert.equal(bad.duration, 0);
  assert.equal(bad.volume, 1); // clamped
  assert.equal(bad.loopMode, 'off');
  const playing = normalizePlaybackState({ videoId: 'x', paused: false, loopMode: 'inf', playerOpen: true, placement: 'floating' });
  assert.equal(playing.playing, true);
  assert.equal(playing.placement, 'floating');
});

test('normalizeQueue: absent queue and oversized lists degrade', () => {
  const none = normalizeQueue({ mode: 'none', items: [], index: -1 });
  assert.equal(none.mode, 'search');
  assert.deepEqual(none.items, []);
  assert.equal(none.index, -1);
  assert.equal(none.playlistId, null);
  const big = normalizeQueue({ mode: 'playlist', items: Array.from({ length: 500 }, (_, i) => ({ id: 'v', title: 'x' })), index: 2, playlistId: 'PLx' });
  assert.equal(big.items.length, 200); // bounded
  assert.equal(big.mode, 'playlist');
  assert.equal(big.playlistId, 'PLx');
  assert.equal(big.index, 2);
  assert.equal(normalizeQueue({ items: null }).items.length, 0);
});

test('normalizeChapters: malformed entries are filtered, never throw', () => {
  const r = normalizeChapters([{ startTime: 0, title: 'A' }, { startTime: 'bad' }, { startTime: 60, title: 'B', endTime: 90 }, null]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.chapters.map(c => c.title), ['A', 'B']);
  assert.equal(r.chapters[1].endTime, 90);
  assert.deepEqual(normalizeChapters('nope').chapters, []);
  assert.deepEqual(normalizeChapters(undefined).chapters, []);
});

test('apiOk/apiError keep id correlation', () => {
  assert.deepEqual(apiOk({ a: 1 }, 'r1'), { ok: true, value: { a: 1 }, id: 'r1' });
  assert.deepEqual(apiError('player_closed', 'closed', 'r2'), { ok: false, error: 'closed', code: 'player_closed', id: 'r2' });
});

// Contract guarantee: the core exposes NO secrets shape (no cookies/tokens/auth fields).
test('v1 exposes no authentication or session internals', () => {
  const payload = JSON.stringify({ v: normalizeVideo({ title: 't' }, {}), p: normalizePlaybackState({}), q: normalizeQueue({}) });
  for (const bad of ['cookie', 'token', 'session', 'authorization', 'credential']) {
    assert.equal(payload.toLowerCase().includes(bad), false, `exposed ${bad}`);
  }
});