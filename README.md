<h1 align="center">Hermes YouTube Player Plugin</h1>

<p align="center">
  A polished native YouTube player and dashboard for <strong>Hermes Desktop</strong>: dock it, float it, open <code>/youtube</code>, play real YouTube watch pages, and browse signed-in shelves without turning Hermes into a browser.
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

## Demo

<p align="center">
  <img src="assets/demo.gif" alt="Demo of Hermes YouTube Player Plugin searching, playing, and controlling YouTube inside Hermes Desktop" width="520">
</p>

## What it does

Hermes YouTube Player Plugin is a native-feeling YouTube media player for Hermes Desktop. It keeps YouTube playback in a real watch-page webview, then wraps it with Hermes-native controls, dock/floating placement, account-aware shelves, a dashboard route, and safe close/reopen behavior.

It is not a generic browser tab. Normal playback stays locked down; account/feed pages are used only where needed and covered while data loads.

## Current features

### Native Hermes integration

- Docked and floating player panes.
- Fast pin/unpin placement switching.
- `/youtube` dashboard route and sidebar entry.
- Status-bar chip and command-palette opener.
- Safe close/reopen behavior.
- Shared signed-in YouTube session partition.

### Real YouTube playback

- Real YouTube watch-page player.
- Plugin-owned timeline, Play/Pause, -10s, +10s, Prev/Next.
- Big Screen plugin fullscreen mode with taskbar-visible desktop behavior.
- Size modes including Mini.
- Volume popover, quality selector, captions, loop controls.
- OS media controls; no in-app shortcuts that steal Hermes chat typing.

### Dashboard

- Compact native `/youtube` dashboard.
- Locked shelf cluster: Recommended, History, Subscriptions, Watch Later, Shorts, Playlists.
- Background shelf loading.
- Cards open directly in the player.
- Top media-control bar with contained thumbnail, Show-first controls, timeline, stats, channel, views, source, and scrollable description.
- Clickable highlighted description links.

### Account-aware shelves

- Recommended from YouTube Home.
- Signed-in Subscriptions and Watch Later.
- Shorts from a dedicated Shorts source.
- Playlists filtered to real playlist IDs.
- History through YouTube's signed-in browse API so it follows the selected YouTube account/channel.

## Install

Download the latest plugin zip, then run:

```powershell
cd "$env:USERPROFILE\Downloads"
Expand-Archive -Force ".\youtube-float-desktop-plugin-v3.107.zip" "$env:TEMP\youtube-float-v3.107"
cd "$env:TEMP\youtube-float-v3.107"
powershell -ExecutionPolicy Bypass -File ".\install-youtube-float-v3.107.ps1"
```

Fully quit and reopen Hermes Desktop. The pane title should show **YouTube v3.107 ★**.

## Version history

See [`CHANGELOG.md`](CHANGELOG.md) and [`docs/versions`](docs/versions).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
