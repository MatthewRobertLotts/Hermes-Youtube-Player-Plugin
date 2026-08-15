<h1 align="center">Hermes YouTube Player Plugin</h1>

<p align="center">
  The definitive native YouTube player and dashboard for <strong>Hermes Desktop</strong>: dock it, float it, open <code>/youtube</code>, browse signed-in shelves, play real YouTube watch pages, and control playback without leaving your workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Hermes-Desktop-6f42c1" alt="Hermes Desktop">
  <img src="https://img.shields.io/badge/Current-v3.117-blue" alt="Current v3.117">
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="License">
  <img src="https://github.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/actions/workflows/check.yml/badge.svg" alt="Check">
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

### 🧭 Native Hermes integration

- **Docked + floating player panes** with one active player instance — no duplicate dock/floating copies.
- **Fast pin/unpin switching** beside the timeline, with current video state carried across placement changes.
- **`/youtube` route + sidebar entry** for the native dashboard surface.
- **Command palette opener** and **status-bar chip** with open/closed and docked/floating state.
- **Safe close/reopen lifecycle** from docked tab, floating header, and status chip.

### ▶️ Real YouTube playback

- **Real YouTube watch-page player** in a persistent webview partition — not a broken stream scrape.
- **Hermes-owned controls**: Show, Prev, Next, -10s, +10s, Play/Pause.
- **Dominant scrub timeline** with live time/duration.
- **Volume popover**, quality selector, captions, and loop modes.
- **Plugin-only Big Screen mode** using the real watch page.
- **OS media controls** via Media Session.
- **No chat-stealing shortcuts**: Hermes typing stays safe.

### 📺 Native `/youtube` dashboard

- **Locked shelf cluster**: Recommended, History, Subscriptions, Watch Later, Shorts, Playlists.
- **Recommended from YouTube Home**, not a stale search term.
- **Background shelf loading** so rows fill without driving the main player view.
- **Cards open directly in the player** across videos, Shorts, and playlists.
- **Compact media-control top bar** with contained thumbnail, Show-first controls, timeline, and stats.
- **Stats panel** with channel, duration, views, source, row counts, and scrollable description.
- **Highlighted/clickable description links**.

### 🔐 Signed-in account feeds

- **Signed-in History, Subscriptions, Watch Later, and Your Playlists**.
- **History follows the selected YouTube account/channel** through signed-in YouTube browse data.
- **Shorts source is isolated** so Shorts do not pollute History.
- **Playlists are filtered to real playlist IDs** so History videos do not leak into Playlist rows.
- **Account/login mode is intentionally temporary**; normal playback returns to the locked media-player surface.

### 💾 Persistence that does not surprise you

- Persists safe preferences: size, volume, loop, quality, captions, placement.
- Persists YouTube session through the shared webview partition.
- Pin/unpin and pane remounts resume the current video quickly.
- Does **not** persist current video as a long-term app-reopen autoplay trap.

### ✨ Layout and polish

- Mini / Small / Medium / Large size modes.
- Pin button left of the timeline, volume right of the timeline.
- Thumbnail uses contained/full-image scaling in the dashboard top bar.
- Docked and floating close controls use Hermes chrome where possible.
- Raw account/feed panes are covered while loading so the plugin stays a media player, not a random browser window.

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
2. Run the installer for your platform from the repo folder.

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install-youtube-float-v3.117.ps1
```

Writes to `%LOCALAPPDATA%\hermes\desktop-plugins` and `%USERPROFILE%\.hermes\desktop-plugins`, plus profile plugin folders when present.

### macOS / Linux

```bash
chmod +x ./install-youtube-float-v3.117.sh
./install-youtube-float-v3.117.sh
```

Writes to `~/.hermes/desktop-plugins`, `$HERMES_HOME/desktop-plugins` when set, macOS `~/Library/Application Support/hermes/desktop-plugins`, and profile plugin folders when present.

3. Fully quit and reopen Hermes Desktop.
4. Confirm the pane title shows **YouTube v3.117 ★**.

---

## Privacy and security

- Uses a persistent YouTube webview session so signed-in shelves work.
- Login happens inside YouTube; the plugin does not directly handle YouTube passwords.
- Stores small local preferences and safe UI state only.
- Does not intentionally store/copy cookies, auth tokens, passwords, or raw session data.
- Debug diagnostics are off by default and redact sensitive-looking keys before copying.
- See [`SECURITY.md`](SECURITY.md) for the full security/privacy model.
- See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for install, shelf, update, and reporting fixes.

---

## Known bugs / limitations

- **True taskbar-covering fullscreen** needs Hermes Desktop host support; current Big Screen is plugin-owned and keeps the Windows taskbar visible.
- **YouTube signed-in feeds can hydrate slowly**; some shelves may take a few seconds before rows appear.
- **YouTube can change private feed surfaces**; History currently works through signed-in browse data, but future YouTube markup/API changes may need maintenance.

---

## Roadmap

Coming soon:

- **Host-owned true fullscreen** once Hermes Desktop exposes a safe native fullscreen API.
- **Fresh dashboard screenshots** showing the final `/youtube` shelves and media-control top bar.
- **Ask about what's playing**: Hermes-aware title/channel/timestamp context for questions about the current video.
- **Feed resilience tools**: clearer diagnostics if YouTube changes signed-in shelf data again.
- **Optional shortcut mode** behind an explicit toggle, if keyboard controls return without interfering with Hermes chat.

---

## Releases and updates

Stable builds are published from versioned tags and GitHub Releases. Download the latest `youtube-float-desktop-plugin-<version>.zip`, run the installer for your platform, then fully quit and reopen Hermes Desktop.

Release hygiene lives in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md). CI must be green before a stable release is published.

Bug reports use a diagnostics-first GitHub issue template so failures arrive with version, surface, repro steps, and optional redacted Debug output. See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) first for common fixes.

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
