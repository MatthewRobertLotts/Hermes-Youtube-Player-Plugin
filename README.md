<p align="center">
  <img src="assets/feature-video.png" alt="Real YouTube playback" width="680">
</p>

<h1 align="center">Hermes YouTube Player Plugin</h1>

<p align="center">
  A native-style floating YouTube player for <strong>Hermes Desktop</strong> — watch, search, chain Shorts, and play whole playlists without ever leaving your coding workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Hermes-Desktop-6f42c1" alt="Hermes Desktop">
  <img src="https://img.shields.io/badge/Current-v3.0%E2%98%85-22498e" alt="Current v3.0">
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="License">
</p>

---

## Demo

The player in action — 26 seconds:

<p align="center">
  <video controls width="560" poster="https://raw.githubusercontent.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/main/assets/feature-video.png">
    <source src="https://raw.githubusercontent.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/main/assets/demo.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</p>

<p align="center">
  <em>No player? Here's the same clip as a GIF:</em>
  <br>
  <img src="assets/demo.gif" alt="Hermes YouTube Player Plugin demo" width="480">
</p>

---

## What it is

A floating desktop pane that brings YouTube straight into Hermes Desktop. It runs YouTube's own real player (not a hacky custom `<video>`), keeps all the transport controls you expect, and adds smart **Videos / Shorts / Playlists** search so you can watch, queue, and binge without tabbing away from your work.

---

## Features

### 🎬 Real YouTube player
Uses YouTube's own watch-page webview and player API — quality, subtitles, playback speed and loop with none of the "black frame / audio only" nonsense that plagues custom players. The pane sizes to **Large / Medium / Small** presets and keeps video at a clean 16:9.

### ⌨️ Full transport controls
`Prev` · `-10s` · **Play/Pause** · `+10s` · `Next`, a responsive scrubbing timeline, and Quality / Loop / Subs dropdowns.

### 📺 Search modes: Videos, Shorts, Playlists
Pick a mode, type, and search. Results come straight from YouTube's own data — accurate thumbnails, durations, badges and playlist counts.

### ⏩ Shorts chaining
Open a Short and the next one plays automatically. Drift detection snaps you back if YouTube tries to sneak in something you didn't ask for; pausing never advances.

### 📋 Playlist playthrough
Click a playlist to load its full episode list, then let it **autoplay the first item and roll through to the end** — perfect for a long compilation or a full series binge.

### 🤖 Ask about what's playing *(roadmap)*
The player knows exactly what's on screen — title, channel, timestamp. A planned upgrade lets Hermes **recognize what you're playing and answer questions about it**, right from the pane.

---

## Screenshots

Search for and play a normal-length video:

<p align="center">
  <img src="assets/feature-video.png" alt="Video search + playback — Akira (1988) Trailer" width="620">
</p>

Shorts search &amp; chaining — find a tutorial, play it, let the next one roll:

<p align="center">
  <img src="assets/feature-shorts.png" alt="Shorts search + play — Hermes Agent Tutorial" width="620">
</p>

Playlists — search, open a playlist, and chain through every episode:

<p align="center">
  <img src="assets/feature-playlists.png" alt="Playlist hero — The Ricky Gervais Show" width="620">
</p>

---

## Install

1. Clone (or download) the repo.
2. From a PowerShell prompt in the repo, run the bundled installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-youtube-float-v3.0.ps1
```

3. **Fully quit and reopen Hermes Desktop.** The pane title should show **YouTube v3.0 ★**.

> The installer writes the plugin into both `%LOCALAPPDATA%\hermes\desktop-plugins` and `%USERPROFILE%\.hermes\desktop-plugins`.

---

## What's next

- **Aware playback** — let Hermes recognize the video / channel / timestamp and answer questions about what's on screen.
- More playback-session and queue controls.
- Tighter integration with Hermes chat for "continue the episode", "skip to scene", style commands.

## Development

- `plugin.js` — the entire plugin (ES module, loaded directly by Hermes Desktop).
- `install-youtube-float.ps1` — current installer.
- `docs/versions/` / `CHANGELOG.md` — release history.
- Independent player webview (`persist:hermes-youtube-float-player`) + a hidden search webview; controls drive YouTube's own JS player API.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).