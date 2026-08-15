# Troubleshooting

## First checks

1. Install the latest release zip from GitHub Releases.
2. Fully quit and reopen Hermes Desktop.
3. Confirm the pane title shows `YouTube v3.126 ★`.
4. If reporting a bug, turn on **Debug**, reproduce it, then click **Copy diagnostics**.

Do not paste cookies, passwords, tokens, or private account data.

## Installer says it worked, but the old version still opens

Run the installer again, then fully quit Hermes Desktop, not just close the pane.

The Windows installer writes both common plugin roots:

```text
%LOCALAPPDATA%\hermes\desktop-plugins
%USERPROFILE%\.hermes\desktop-plugins
```

The shell installer writes Linux/macOS/HERMES_HOME/profile plugin roots when present.

## `/youtube` does not open

Use the sidebar item or command palette entry, then restart Hermes if it still fails. If the route stays missing, the active plugin install is stale; reinstall the latest zip.

## Signed-in shelves are empty

Open **Account**, sign in on YouTube, then return with **Done**. Some shelves hydrate slowly; wait a few seconds before filing an issue.

## History shows wrong or missing videos

History uses YouTube signed-in browse data for the currently selected YouTube account/channel. Check the selected account in the Account pane first.

## Shorts or Playlists look mixed up

Install the latest release first. Shorts and Playlists have separate parsers, but YouTube markup changes can still break private feed surfaces.

## Big Screen does not cover the Windows taskbar

Expected for now. Current Big Screen is plugin-owned. True taskbar-covering fullscreen needs Hermes Desktop host support.

## Update check fails

Use the latest release page directly:

```text
https://github.com/MatthewRobertLotts/Hermes-Youtube-Player-Plugin/releases/latest
```

The in-plugin update check is informational only; it does not download or replace files.

## What to include in a bug report

- Plugin version from the pane title.
- Where it happened: docked player, floating player, `/youtube`, History, Shorts, Playlists, installer/update.
- Steps to reproduce.
- Expected result and actual result.
- Debug diagnostics if available.
- Screenshot if the issue is visual.
