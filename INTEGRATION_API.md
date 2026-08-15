# Player Integration API (v1)

The Hermes YouTube Player exposes a small, stable surface that **another Hermes Desktop
plugin** can consume without knowing anything about YouTube's DOM, `ytInitialData`, `youtubei`,
Electron webviews, or player internals. The player remains the authority for media state.

This is **player-side infrastructure only**. It deliberately exposes no transcripts, LLM, search,
embeddings, summaries, or Q&A — those belong in a separate consumer plugin.

## Transport

Runtime desktop plugins are plain ESM evaluated in the **same Hermes renderer realm** and share
`window`. The SDK has no plugin-to-plugin RPC, so the supported mechanism is a **versioned
`window` CustomEvent channel** (the same surface the player already uses internally).

| Channel | Direction | Meaning |
|---------|-----------|---------|
| `hermes:youtube:api` | consumer → player | a request (`method`, optional `id`, `params`) |
| `hermes:youtube:api:response` | player → consumer | the reply correlated by `id` (`ok`, `value`/`error`, `code`) |
| `hermes:youtube:api:event` | player → consumer | pushed events (`type`, payload) |

### Request envelope

```js
window.dispatchEvent(new CustomEvent('hermes:youtube:api', {
  detail: { v: 1, id: 'req-1', method: 'getCurrentVideo', params: {} }
}))
```

- `v` — API version (optional; defaults to the player's current version). Unknown/unsupported/future
  versions are **ignored** (no reply) so an older player never gaslights a newer consumer.
- `id` — optional correlation token echoed in the response. Omit for one-way; include for a reply
  you can match. If omitted, the reply carries `id: null`.
- `method` — one of the methods below.
- `params` — object; validated strictly (see Controls).

### Response envelope

```js
// ok
{ v: 1, id: 'req-1', ok: true, value: {...} }
// error
{ v: 1, id: 'req-1', ok: false, code: 'player_closed' | 'invalid_argument' | 'unknown_method' | 'player_error', error: 'human-readable' }
```

## Versioning & backward compatibility

- `apiVersion = 1`. The player plugin release (e.g. `v3.141`) and the API version are **independent**:
  `getApiInfo()` reports both.
- **Compatibility policy:** within API v1, existing fields are never removed or renamed and their
  types never change. New fields may be *added*. A consumer written for v1 keeps working.
- **Field guarantee ladder:**
  - **Guaranteed** — always present, always the documented type; `null`/`0`/`false` when
    unavailable. Never throws.
  - **Optional** — present when relevant, omitted otherwise (see per-method notes).
  - **Nullable** — can be `null` (e.g. `title` before metadata loads).
  - **Best-effort** — derived from live YouTube data and may be `null` or `[]` even when playing
    (chapters, exact duration of a live stream).
- If a field becomes temporarily unavailable, the player returns the stable default (`null`/`0`/
  `false`/`[]`), never a throw and never a missing key on a guaranteed field.
- If the consumer is on an older/newer API version, the player either answers at v1 semantics or,
  for an unsupported version, stays silent (the consumer should treat silence as "unsupported").

## Read methods

### `getApiInfo` — guaranteed mirror
```js
{ plugin: 'youtube-float', apiVersion: 1, playerVersion: 'v3.141' }
```

### `getCurrentVideo` — guaranteed
```js
{
  videoId: 'abcDEF12345' | null,      // guaranteed
  canonicalUrl: 'https://www.youtube.com/watch?v=...' | null, // guaranteed (null when no video)
  title: string | null,               // nullable
  channel: string | null,             // nullable
  currentTime: number,                // guaranteed, >= 0
  duration: number,                   // guaranteed, >= 0 (0 until known; best-effort for live)
  description: string | null,         // nullable
  chapters: Array<{startTime,endTime,title}>, // guaranteed, [] when none (best-effort)
  isShort: boolean,                   // guaranteed
  isLive: boolean,                    // guaranteed
  playlistId: string | null           // nullable
}
```
When nothing is loaded (`videoId === null`), `currentTime`/`duration` are `0` and the rest are
`null`/`false`/`[]` — the consumer must not assume a video is playing.

### `getPlaybackState` — guaranteed
```js
{
  videoId: string | null,
  paused: boolean,
  currentTime: number,   // >= 0
  duration: number,      // >= 0
  playing: boolean,      // videoId present AND not paused
  playerOpen: boolean,
  placement: 'docked' | 'floating'
}
```
Auto-advance is the player's job; the consumer reads state on demand rather than depending on a
high-frequency `timeUpdated`.

### `getQueue` — guaranteed
```js
{
  mode: 'search' | 'playlist',
  items: Array<{ id, title, type: 'video'|'short'|'playlist', duration? }>, // bounded to 200
  index: number,          // -1 when none
  playlistId: string | null
}
```
When there is no queue, the player returns `{ mode: 'search', items: [], index: -1, playlistId:
null }` — it never errors on "queue does not exist".

### `getAccountState` — guaranteed, minimal
```js
{ signedIn: boolean, name: string | null }
```
No cookies, tokens, headers, or session internals. This exists only so a consumer can know whether
it is operating against a signed-in account; treat `name` as best-effort.

### `getChapters` — guaranteed
```js
{ chapters: Array<{ startTime: number, endTime: number | null, title: string | null }> }
```
Best-effort: returns `[]` unless the current video exposes chapters.

## Controls (safe)

| Method | params | Behaviour |
|--------|--------|-----------|
| `play` | `{}` | Resume playback |
| `pause` | `{}` | Pause playback |
| `seekTo` | `{ seconds: number }` | Seek; **clamped** to `[0, duration]` |
| `next` | `{}` | Advance the queue |
| `previous` | `{}` | Step back in the queue |

Validation:
- `seekTo` rejects `NaN`, `Infinity`, negative values, non-numeric strings, and missing `seconds`
  with `code: 'invalid_argument'`. Valid finite values are clamped to the current duration.
- Unknown methods return `code: 'unknown_method'`.
- When the player is closed, controls return `code: 'player_closed'` and do **not** open it.
- `play`/`pause`/`next`/`previous` ignore extra params.

The API never exposes or accepts arbitrary player-window code, `executeJavaScript`, raw webview
handles, cookies, session tokens, or credentials.

## Events (pushed on `hermes:youtube:api:event`)

```js
{ v: 1, type: 'videoChanged', videoId, playlistId }
{ v: 1, type: 'playbackStateChanged', paused }
{ v: 1, type: 'queueChanged', mode, index, count }
{ v: 1, type: 'playerOpened', placement }
{ v: 1, type: 'playerClosed' }
{ v: 1, type: 'ready' }   // emitted once when the integration bridge activates
```

There is deliberately **no** `timeUpdated` event — polling + `getPlaybackState` replaces it to avoid
wasteful cross-plugin traffic. All events are degraded-safe: when the player is closed or nothing
is loaded, a consumer that relied on an event simply receives no further events and must rely on
`getPlaybackState`/`getCurrentVideo` reading the closed/no-video defaults.

## Consumer lifecycle

- **Subscribe:** `window.addEventListener('hermes:youtube:api:response'|'hermes:youtube:api:event', fn)`.
- **Unsubscribe:** remove the listener (`window.removeEventListener(..., fn)`) exactly as any DOM
  listener. The player never reaches into a consumer and never leaks its own listeners — the
  channel is passive.
- **Disposal:** removing the listener is the whole contract; there is no resource to leak.
- **Plugin close/reload:** when the player plugin is disabled/reloaded, its listeners are torn down
  and `playerClosed` fires. The consumer must tolerate absence (its requests get no reply) and
  re-issue `getApiInfo` after a `ready` event to renegotiate.

## Failure behaviour summary

| Condition | Result |
|-----------|--------|
| Player closed | Controls → `player_closed`; reads → closed defaults (`videoId:null`, `paused:true`, `playerOpen:false`) |
| Nothing loaded | Reads → null/0/false defaults; controls mostly no-ops via player guards |
| Video changes mid-request | Reads snapshot current state; no torn partial object |
| Queue absent | `getQueue` → empty search queue; never errors |
| Signed-in state changes | `getAccountState` reflects live state; other reads unaffected |
| Unsupported/unknown API version | No reply (silence) — never a wrong-shaped answer |
| YouTube changes internally | Player adapters isolate it; API shape unchanged |

## What is intentionally NOT exposed

- cookies, session tokens, authorization headers, YouTube credentials
- raw webview handles or `executeJavaScript` access
- `ytInitialData` / DOM / renderer internals
- implementation-specific convenience fields
- intelligence: transcripts, LLM calls, semantic search, embeddings, summaries, Q&A

## Permissions / trust assumptions

A Hermes desktop plugin runs in the renderer with the same app-wide authority as core; the disk
door is local-only. The integration API does **not** add a trust boundary or grant new privileges:
it is a narrow, validated read/control channel that already-existing same-renderer plugins can use.
It never hands a caller something that would let it escalate (no secret material, no code
execution, no webview handle).

## Example consumer (mock)

See `docs/api-example-consumer.md` for a ready-to-paste mock plugin that subscribes, queries, and
sends a control — safe, minimal, and free of real secrets.