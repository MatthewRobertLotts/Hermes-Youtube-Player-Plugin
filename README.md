<h1 align="center">Hermes YouTube Player Plugin</h1>

<p align="center">
  The definitive native YouTube player and dashboard for <strong>Hermes Desktop</strong>: dock it, float it, open <code>/youtube</code>, browse signed-in shelves, play real YouTube watch pages, and control playback without leaving your workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Hermes-Desktop-6f42c1" alt="Hermes Desktop">
  <img src="https://img.shields.io/badge/Current-v3.107-blue" alt="Current v3.107">
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

It is a native Hermes Desktop media player and account-aware YouTube dashboard. Playback stays on YouTube's real watch-page player, while Hermes owns the controls, dock/floating panes, `/youtube` route, dashboard shelves, status chip, safe persistence, and close/reopen lifecycle.

If you want YouTube inside Hermes without losing your workspace, exposing browser chrome, or rebuilding playback from broken scraped streams, this is the one.

---

## Why this is hard

YouTube inside an Electron desktop plugin is easy until you try to make it good.

- Normal embeds fail or throw player configuration errors.
- Scraped direct streams can play audio with black video.
- YouTube's page chrome fights your UI.
- Search results, Shorts, playlists, signed-in feeds, History, captions, and quality controls all come from different YouTube surfaces.
- Hermes panes have their own lifecycle: docked, floating, closed, reopened, moved, remounted.
- A media player must survive all of that without hijacking chat typing, duplicating panes, losing state, or randomly autoplaying on app reopen.

This plugin does the boring hard work: real YouTube playback, native Hermes controls, safe persistence, signed-in account support, `/youtube` dashboard shelves, fast pin/unpin resume, and single-active-pane behavior.

---

## Current feature set

### Native Hermes integration

- Docked Hermes pane.
- Floating Hermes pane.
- One-click pin/unpin beside the timeline.
- Single active player instance: no duplicate docked/floating copies.
- `/youtube` route and sidebar entry.
- Native `/youtube` dashboard with account-aware shelves.
- Command palette opener.
- Status-bar chip with open/closed and docked/floating state.
- Safe close/reopen behavior from docked tab, floating header, and status chip.

### Real YouTube playback

- Uses YouTube's own watch-page player in a persistent webview partition.
- Plugin-owned transport controls: Show, Prev, Next, -10s, +10s, Play/Pause.
- Dominant scrub timeline with live time/duration.
- Volume popover.
- Quality dropdown powered by YouTube's available quality levels.
- Subtitle/caption control using YouTube's caption tracks.
- Loop modes: off, once, infinite.
- Plugin-only Big Screen mode using the real watch page.
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
- `/youtube` dashboard shelves: Recommended, History, Subscriptions, Watch Later, Shorts, Playlists.
- Recommended loads from YouTube Home, not a stale search term.
- Dashboard cards open directly in the player.
- Account webview stays locked down outside explicit account/login mode.
- History loads through YouTube signed-in browse data for the selected account/channel.

### Persistence that does not surprise you

- Persists safe preferences: size, volume, loop, quality, captions, placement.
- Persists YouTube session through the shared webview partition.
- Pin/unpin and pane remounts resume the current video quickly.
- Does not persist current video as a long-term app-reopen autoplay trap.

### Layout and polish

- Mini / Small / Medium / Large size modes.
- Pin button left of the timeline, volume right of the timeline.
- Compact dashboard media-control bar with contained thumbnail and Show-first controls.
- Dashboard stats panel: channel, duration, views, source, row counts, and scrollable description.
- Highlighted/clickable description links.
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
powershell -ExecutionPolicy Bypass -File .\install-youtube-float-v3.107.ps1
```

3. Fully quit and reopen Hermes Desktop.
4. Confirm the pane title shows **YouTube v3.107 ★**.

The installer writes to both `%LOCALAPPDATA%\hermes\desktop-plugins` and `%USERPROFILE%\.hermes\desktop-plugins`, plus profile plugin folders when present.

---

## Known bugs / limitations

- True taskbar-covering fullscreen needs Hermes Desktop host support; current Big Screen stays plugin-owned and keeps the Windows taskbar visible.
- YouTube signed-in feeds can take a few seconds to hydrate before shelves populate.
- History depends on YouTube's signed-in web session and internal browse data; if YouTube changes that surface, the shelf may need another scraper/API adjustment.
- Account/login mode is intentionally temporary: normal playback stays locked down, not browsable.

---

## Roadmap

Shipped recently:

- Docked/floating placement, fast pin/unpin resume, close/reopen lifecycle, and account-label persistence.
- Native `/youtube` dashboard with locked shelves: Recommended, History, Subscriptions, Watch Later, Shorts, Playlists.
- Dashboard top media bar with contained thumbnail, Show-first controls, stats, scrollable description, and clickable links.
- History source fixed to follow the selected signed-in YouTube account/channel.

Coming soon:

- Proper host-owned fullscreen once Hermes Desktop exposes a safe native fullscreen API.
- Better dashboard visuals/screenshots for the new `/youtube` surface.
- Smarter "ask about what's playing" integration from the current title/channel/timestamp.
- More resilient feed diagnostics if YouTube changes signed-in shelf markup again.

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
