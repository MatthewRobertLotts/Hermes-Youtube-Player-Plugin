import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compareVersions, normalisePrefs, videoIdFrom, watchUrl } from '../src/youtube-core.mjs';

const plugin = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = plugin.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists in plugin.js`);
  let depth = 0;
  let seen = false;
  for (let i = start; i < plugin.length; i += 1) {
    if (plugin[i] === '{') { depth += 1; seen = true; }
    if (plugin[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return plugin.slice(start, i + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const sandbox = { URL, Math, Number, String, encodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(`
const YT_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YT_PLAYLIST_ID_RE = /^(PL|RD|OLAK5uy|UU|FL|LL|WL)/;
const PLAYER_SIZES = { mini: {}, small: {}, medium: {}, large: {} };
${functionSource('videoIdFrom')}
${functionSource('watchUrl')}
const versionParts = v => String(v || '').replace(/^v/, '').split('.').map(n => Number(n) || 0);
globalThis.compareVersions = ${plugin.match(/const compareVersions = \(a, b\) => \{[\s\S]*?\n\}/)?.[0].replace('const compareVersions = ', '')};
globalThis.normalisePrefs = ${plugin.match(/const normalisePrefs = (.*)/)?.[1]};
`, sandbox);

const id = 'dQw4w9WgXcQ';

test('plugin.js URL helpers stay in parity with src/youtube-core.mjs', () => {
  for (const input of [
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?t=42`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    'not a url',
  ]) {
    assert.equal(sandbox.videoIdFrom(input), videoIdFrom(input), input);
  }
  assert.equal(sandbox.watchUrl(id, null, 0), watchUrl(id, null, 0));
  assert.equal(sandbox.watchUrl(id, 'PLabc123', 42), watchUrl(id, 'PLabc123', 42));
  assert.equal(sandbox.watchUrl('PLabc123', null, 2), watchUrl('PLabc123', null, 2));
});

test('plugin.js release comparison stays in parity with src/youtube-core.mjs', () => {
  for (const [a, b] of [['v3.122', 'v3.121'], ['v3.121.1', 'v3.121'], ['v3.121', 'v3.121.0'], ['v3.120', 'v3.121']]) {
    assert.equal(sandbox.compareVersions(a, b), compareVersions(a, b), `${a} vs ${b}`);
  }
});

test('plugin.js persisted preference normaliser stays in parity with src/youtube-core.mjs', () => {
  for (const prefs of [
    { playerSize: 'small', placement: 'floating', volume: 2, loopMode: 'once', quality: 'auto' },
    { playerSize: 'bad', placement: 'bad', volume: 'nope', loopMode: 'bad' },
  ]) assert.equal(JSON.stringify(sandbox.normalisePrefs(prefs)), JSON.stringify(normalisePrefs(prefs)));
});

test('plugin.js keeps the runtime queue semantics the helper tests document', () => {
  assert.match(plugin, /const playOffset = delta => \{ const next = results\[currentIndex \+ delta\]; if \(next\) play\(next, currentIndex \+ delta\) \}/);
  assert.match(plugin, /cur && cur\.type === 'short'/);
  assert.match(plugin, /qm === 'playlist' && list\[indexRef\.current \+ 1\]/);
  assert.match(plugin, /setStatus\('End of list — paused'\)/);
});


test('plugin.js safe updater falls back without an explicit Hermes write bridge', () => {
  assert.match(plugin, /const safeUpdateBridge = null/);
  assert.match(plugin, /UPDATE_MAX_BYTES = 2000000/);
  assert.match(plugin, /EXPECTED_PLUGIN_ID = 'youtube-float'/);
  assert.match(plugin, /manual install required/);
  assert.match(plugin, /current version untouched/);
});


test('plugin.js keeps dashboard compatibility resilience boundaries', () => {
  assert.match(plugin, /liveDashboardStates/);
  assert.match(plugin, /DASHBOARD_STATE_MESSAGES/);
  assert.match(plugin, /extract start/);
  assert.match(plugin, /extract success/);
  assert.match(plugin, /extract failed/);
  assert.match(plugin, /adapter: key/);
});


test('plugin.js playback reliability clamps seek and Shorts advance', () => {
  assert.match(plugin, /p\.seekTo\(Math\.max\(0, Math\.min\(p\.getDuration\(\)/);
  assert.match(plugin, /p\.seekTo\(Math\.max\(0, p\.getCurrentTime\(\) - 10\)/);
  assert.match(plugin, /p\.seekTo\(Math\.min\(p\.getDuration\(\)/);
  assert.match(plugin, /list\.slice\(indexRef\.current \+ 1\)\.find\(i => i\?\.type === 'short'\)/);
});


test('plugin.js lifecycle cleanup prevents duplicate players and handlers', () => {
  assert.match(plugin, /if \(disposePlayer\) disposePlayer\(\)/);
  assert.match(plugin, /setActionHandler\(a, null\)/);
  assert.match(plugin, /removesEventListener|removeEventListener/);
  assert.match(plugin, /liveQueueState/);
  assert.match(plugin, /queueResume/);
});
