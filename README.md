<h1 align="center">Hermes YouTube Player Plugin</h1>

<p align="center">
  The definitive native YouTube player for <strong>Hermes Desktop</strong>: dock it, float it, search YouTube, play signed-in feeds, chain playlists, resume across layout switches, and control playback without leaving your workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Hermes-Desktop-6f42c1" alt="Hermes Desktop">
  <img src="https://img.shields.io/badge/Current-v3.68-blue" alt="Current v3.68">
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="License">
</p>

<p align="center">
  <img src="assets/feature-video.png" alt="Hermes YouTube Player Plugin playing a real YouTube watch page inside a native Hermes media pane" width="680">
</p>

---

## Demo

26 seconds of the player doing the thing:

<p align="center">
  <img src="assets/demo.gif" alt="Demo of Hermes YouTube Player Plugin searching, playing, and controlling YouTube inside Hermes Desktop" width="520">
</p>

---

## What this is

This is not a toy embed and it is not a browser tab with a YouTube page thrown into it.

It is a native Hermes Desktop media player that uses YouTube's real watch-page player where that matters, then wraps it in Hermes-native controls, panes, status chips, persistence, search, account feeds, and dock/floating lifecycle management.

If you want YouTube inside Hermes without losing your workspace, fighting browser chrome, or rebuilding a player from broken scraped streams, this is the one.

---

## Why this is hard

YouTube inside an Electron desktop plugin is easy until you try to make it good.

- Normal embeds fail or throw player configuration errors.
- Scraped direct streams can play audio with black video.
- YouTube's page chrome fights your UI.
- Search results, Shorts, playlists, signed-in feeds, captions, and quality controls all come from different YouTube surfaces.
- Hermes panes have their own lifecycle: docked, floating, closed, reopened, moved, remounted.
- A media player must survive all of that without hijacking chat typing, duplicating panes, losing state, or randomly autoplaying on app reopen.

This plugin does the boring hard work: real YouTube playback, native Hermes controls, safe persistence, signed-in account support, fast pin/unpin resume, and single-active-pane behavior.

---

## Current feature set

### Native Hermes integration

- Docked Hermes pane.
- Floating Hermes pane.
- One-click pin/unpin beside the timeline.
- Single active player instance: no duplicate docked/floating copies.
- `/youtube` route and sidebar entry.
- Command palette opener.
- Status-bar chip with open/closed and docked/floating state.
- Safe close/reopen behavior from docked tab, floating header, and status chip.

### Real YouTube playback

- Uses YouTube's own watch-page player in a persistent webview partition.
- Plugin-owned transport controls: Prev, Next, -10s, +10s, Play/Pause.
- Dominant scrub timeline with live time/duration.
- Volume popover.
- Quality dropdown powered by YouTube's available quality levels.
- Subtitle/caption control using YouTube's caption tracks.
- Loop modes: off, once, infinite.
- OS media controls via Media Session.
- No global keyboard shortcuts that steal Space/J/K/L/arrow keys from Hermes chat.

### Search, queues, and feeds

- Search YouTube videos.
- Search Shorts.
- Search playlists.
- Open playlist rows into an autoplaying queue.
- Shorts chaining with drift protection.
- Signed-in account mode.
- Signed-in feeds: History, Subscriptions, Watch Later, Your Playlists.
- Account webview stays locked down outside explicit account/login mode.

### Persistence that does not surprise you

- Persists safe preferences: size, volume, loop, quality, captions, placement.
- Persists YouTube session through the shared webview partition.
- Pin/unpin and pane remounts resume the current video quickly.
- Does not persist current video as a long-term app-reopen autoplay trap.

### Layout and polish

- Mini / Small / Medium / Large size modes.
- Pin button left of the timeline, volume right of the timeline.
- Docked and floating close controls use Hermes chrome where possible.
- Status chip tells you whether the player is open, closed, docked, or floating.
- Raw YouTube account/feed panes are covered while scraping so the plugin stays a media player, not a random browser window.

---

## Screenshots

### Native Hermes media pane

Real YouTube playback inside a Hermes-native player shell: timeline, transport controls, account entry point, quality, captions, loop, dock/floating placement, and status-aware chrome.

<p align="center">
  <img src="assets/feature-video.png" alt="Native Hermes YouTube player pane with real YouTube playback and plugin-owned transport controls" width="620">
</p>

### Shorts without browser chaos

Shorts search and playback stay inside the same controlled media pane. The plugin chains Shorts deliberately and guards against YouTube drifting into unrelated long-form autoplay.

<p align="center">
  <img src="assets/feature-shorts.png" alt="Shorts search and playback inside the Hermes YouTube Player Plugin" width="620">
</p>

### Playlists as queues

Playlist results open into a playable queue, autoplay the first item, and roll through the list without dumping you into a full YouTube browser page.

<p align="center">
  <img src="assets/feature-playlists.png" alt="Playlist queue playback inside the Hermes YouTube Player Plugin" width="620">
</p>

---

## Install

1. Clone or download this repo.
2. From PowerShell in the repo folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-youtube-float-v3.68.ps1
```

3. Fully quit and reopen Hermes Desktop.
4. Confirm the pane title shows **YouTube v3.68 ★**.

The installer writes to both `%LOCALAPPDATA%\hermes\desktop-plugins` and `%USERPROFILE%\.hermes\desktop-plugins`, plus profile plugin folders when present.

---

## Roadmap

Before the dashboard:

- Better responsive scaling for very wide docked panes. *(shipped v3.41)*
- Persist the signed-in account label across player remounts so the Account button reflects the real logged-in session immediately. *(shipped v3.41)*

Next major feature:

- Replace the current `/youtube` route with a proper native YouTube dashboard: account-aware sections, feed shortcuts, recent queues, and player actions — not just a giant duplicate player.

---

## Development

- `plugin.js` — the runtime plugin, loaded directly by Hermes Desktop.
- `install-youtube-float.ps1` — current installer.
- `docs/versions/` and `CHANGELOG.md` — release history.
- Runtime imports stay limited to `@hermes/plugin-sdk`, `react`, and `react/jsx-runtime`.

Checks used before release:

```bash
node --check plugin.js
```

A small runtime import harness is also used during development to catch module-scope plugin load failures that syntax checks miss.

---

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
