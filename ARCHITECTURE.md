# Architecture

Hermes YouTube Player is a single-file shipped Hermes Desktop plugin plus small development-only helpers and tests.

## Shipped runtime

The installed runtime is:

```text
plugin.js
manifest.json
```

`src/`, `tests/`, and `scripts/` are repository tooling. Keep `plugin.js` self-contained unless the Hermes Desktop loader and release package are changed together.

## Runtime areas

### Hermes registration and lifecycle

`export default.register(ctx)` wires the plugin into Hermes. It registers the docked/floating player panes, `/youtube` dashboard route, sidebar item, command palette entry, and status chip. Module-scope state tracks the one active player pane so docked/floating handoff does not create duplicate players.

### Player adapter

The player adapter owns the real YouTube watch-page webview. It builds watch/playlist URLs, strips YouTube chrome, drives playback through `executeJavaScript`, polls state, applies captions/quality/volume/loop, and reports progress to Hermes-owned controls.

### Search adapter

`searchSrc()` and `scrapeSearchScript` load YouTube search/feed pages in hidden webviews and extract video, Shorts, and playlist result rows. Search is offline-tested only at the helper/contract level; live YouTube markup is intentionally not required in CI.

### Dashboard adapter

`YouTubeDashboard` renders `/youtube`, starts background shelf loading, shows the compact player/status area, and opens cards in the player. The shelf cluster is intentionally locked: Recommended, History, Subscriptions, Watch Later, Shorts, Playlists.

### Account/session adapter

The Account pane temporarily exposes YouTube login/account UI inside the same persistent YouTube partition. Normal playback returns to the locked media-player surface when Account is closed. Only safe display state is stored by the plugin.

### History adapter

History uses signed-in YouTube browse data with `browseId: FEhistory` from the current YouTube webview session. Signed-out fallback uses local play history and filters Shorts out of normal History.

### Subscriptions adapter

Subscriptions load `https://www.youtube.com/feed/subscriptions` in the signed-in partition and scrape normal video rows into the dashboard shelf.

### Watch Later adapter

Watch Later loads `https://www.youtube.com/playlist?list=WL` in the signed-in partition and scrapes playlist-view rows.

### Playlist adapter

Playlist rows may be bare playlist IDs or first-video rows with a `list=` value. The runtime treats those as playlist entries, loads the watch page with the playlist ID, scrapes the active playlist panel, and advances within that list.

### Shorts handling

Shorts are detected separately, shown in the Shorts shelf, and auto-advance only to another Short. They are filtered away from signed-in/local History so rows do not pollute each other.

### Queue and state management

React state tracks current video, playlist, queue mode, result list, index, progress, loop mode, quality, captions, volume, placement, and debug mode. Module refs mirror state into polling callbacks to avoid stale closures. v3.122 parity tests lock the shipped helper behavior against `src/youtube-core.mjs`.

### Docked/floating handoff

Docked and floating panes use separate contribution IDs. Switching placement disposes the old contribution, registers the new one, and reopens from module-scope live player state. Current playback is resumed with a timestamped watch URL instead of long-term autoplay persistence.

### Persistent YouTube webview/session

All YouTube webviews use:

```text
persist:hermes-youtube-float-player
```

This partition keeps the YouTube account/session selected by the user. The plugin must not read or export cookies/tokens from it.

### Media Session integration

The player registers browser Media Session handlers for play, pause, previous, next, seek backward, and seek forward. Handlers call the same runtime controls as the visible UI.

### Diagnostics

Debug diagnostics are opt-in. `diag()` records bounded labelled events and `diagnosticPayload()` redacts sensitive-looking keys before copying. Diagnostics are for support, not telemetry.

### Updater and release logic

The in-plugin update check calls GitHub Releases latest metadata, validates the tagged zip artifact, downloads it only into memory for validation, and falls back to the release page unless Hermes exposes an explicit updater/write bridge. Repository scripts build the zip, generate release notes from CHANGELOG, validate consistency, and dry-run publication.

## Trust boundary

### YouTube web content

YouTube pages are untrusted web content loaded in webviews. Treat their DOM, initial data, and renderer shapes as volatile compatibility inputs.

### `executeJavaScript`

`executeJavaScript` crosses from Hermes plugin code into YouTube pages. Scripts should return playback/feed metadata only. Never request cookies, local storage dumps, auth headers, tokens, or credentials.

### Persistent partition

The persistent partition belongs to the user’s YouTube session. The plugin may depend on it for signed-in feeds, but must not inspect or leak session secrets.

### Local plugin storage

Plugin storage is for safe preferences and display state: size, placement, volume, loop, quality, caption, debug flag, local history/search rows, and account display label. It is not a secret store.

### Hermes renderer/plugin privileges

The plugin runs with Hermes renderer/plugin privileges and can register UI, routes, panes, commands, and status entries. Keep web content inside webviews and keep plugin-owned UI outside YouTube DOM.

## Adding YouTube compatibility fixes

1. Identify the affected adapter: player, search, dashboard, account, History, subscriptions, Watch Later, playlists, or Shorts.
2. Patch the smallest parser/selector in that adapter.
3. Reuse shared constants in `src/youtube-core.mjs` where possible.
4. If a helper is duplicated in `plugin.js` because the shipped plugin must stay self-contained, add a parity test in `tests/plugin-runtime-parity.test.mjs`.
5. Do not add selectors to unrelated render/UI code.
6. Keep tests deterministic and offline; live YouTube is for UAT, not CI.

## Known coverage limits

Automated tests cover deterministic helpers, release tooling, and runtime parity contracts. They do not launch Hermes Desktop, Electron webviews, or live YouTube pages.


## YouTube compatibility hotspots

Volatile YouTube dependencies are isolated to adapters:

- `scrapeSearchScript`: `ytInitialData`, renderer names, fallback DOM anchors.
- `historyApiScript`: `ytcfg`, Innertube `/youtubei/v1/browse`, `FEhistory`, fallback initial data traversal.
- `stateScript`, `driveScript`, `readPlayerScript`, `readCaptionsScript`: undocumented player methods and `ytInitialPlayerResponse`.
- `playlistFillScript`: playlist panel renderers and playlist lockups.
- Dashboard background loading: each shelf runs independently and records its own state.

Compatibility fixes should patch one adapter and add an offline fixture or parity test. A broken shelf must degrade to an empty/unavailable state and must not break playback or other shelves.

## Manual playback reliability testing

Live Hermes/Electron/YouTube behavior is tracked in `docs/release-tests/v3.127-playback-reliability.md`. Keep CI deterministic; do not pretend live webview behavior is covered by unit tests.

### Docked/Floating lifecycle

See `docs/release-tests/v3.127-docked-floating-lifecycle.md`. In-UI placement swaps and close/reopen are the signature feature; keep them regression-checked manually in real Hermes.
