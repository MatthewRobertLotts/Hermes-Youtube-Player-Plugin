# Contributing

Thanks for helping keep Hermes YouTube Player boring and dependable.

## Scope

This repo is the Hermes YouTube media-player plugin. Do not add transcript, LLM, video-understanding, semantic-search, recommendation AI, or intelligence features here; those belong in a separate future plugin.

## Development install

Build or download the release zip, then install it into Hermes Desktop:

```bash
python3 scripts/build-release-zip.py --output /tmp/youtube-float.zip --check
unzip -o /tmp/youtube-float.zip -d /tmp/youtube-float
sh /tmp/youtube-float/install-youtube-float-v3.129.sh
```

Windows PowerShell:

```powershell
Expand-Archive -Force .\youtube-float-desktop-plugin-v3.129.zip $env:TEMP\youtube-float-v3.129
cd $env:TEMP\youtube-float-v3.129
powershell -ExecutionPolicy Bypass -File .\install-youtube-float-v3.129.ps1
```

The installers copy `plugin.js` and `manifest.json` into the Hermes desktop plugin roots. The runtime plugin is intentionally self-contained; `src/` and `tests/` are development files, not installed runtime dependencies.

## Reloading the plugin

1. Run the installer.
2. Fully quit Hermes Desktop.
3. Reopen Hermes Desktop.
4. Confirm the pane title shows `YouTube v3.129 ★`.

Closing only the pane is not a full reload.

## Checks

Run the cheap checks first:

```bash
node --check plugin.js
node --test tests/*.test.mjs
node scripts/check-release.mjs
python3 -m py_compile scripts/*.py
python3 scripts/build-release-zip.py --output /tmp/youtube-float.zip --check
python3 scripts/changelog-release-notes.py > /tmp/youtube-float-release-notes.md
python3 scripts/publish-release.py --dry-run
sh -n install-youtube-float.sh
sh -n install-youtube-float-v3.129.sh
```

If available, also run:

```bash
shellcheck install-youtube-float.sh install-youtube-float-v3.129.sh
pwsh -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw install-youtube-float.ps1)) | Out-Null"
```

## Diagnostics and debug mode

Debug mode is off by default. In the player, click **Debug**, reproduce the issue, then click **Copy diagnostics**. Diagnostics contain plugin events, version, platform and user-agent context, and scrub sensitive-looking keys before copying.

Do not ask for, paste, or store YouTube cookies, auth headers, OAuth tokens, passwords, or raw session dumps.

## Safe bug reports

A useful bug report includes:

- plugin version from the pane title;
- Hermes version;
- OS;
- whether the user is signed into YouTube;
- where it happened: docked, floating, `/youtube`, History, Shorts, Playlists, installer/update;
- reproduction steps;
- expected vs actual result;
- Debug → Copy diagnostics output if available.

## YouTube compatibility fixes

Keep compatibility fixes close to the adapter they affect. Use the labelled sections in `plugin.js` and shared constants/helpers in `src/youtube-core.mjs`. If runtime code must stay inside `plugin.js`, add a parity or contract test instead of silently duplicating logic.

Do not scatter new selectors through unrelated UI rendering code.
