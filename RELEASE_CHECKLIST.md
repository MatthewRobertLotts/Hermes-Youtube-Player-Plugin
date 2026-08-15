# Release checklist

Use this before tagging a stable release.

## Version

- [ ] Pick one canonical version, e.g. `v3.121`.
- [ ] `manifest.json` version matches.
- [ ] `plugin.js` `VERSION` matches and has no suffix.
- [ ] README badge/install commands match.
- [ ] CHANGELOG top entry matches.
- [ ] Installer filenames match.

## Checks

- [ ] `node scripts/check-release.mjs`
- [ ] `python3 scripts/build-release-zip.py --check`
- [ ] `python3 scripts/changelog-release-notes.py > /tmp/youtube-float-release-notes.md`
- [ ] `node --test tests/*.test.mjs`
- [ ] `sh -n install-youtube-float.sh`
- [ ] `sh -n install-youtube-float-<version>.sh`
- [ ] GitHub Actions is green on `main`.

## Install smoke

- [ ] Windows installer reviewed or tested.
- [ ] Linux/macOS shell installer smoke-tested.
- [ ] Upgrade install does not delete adjacent user state.
- [ ] Fresh install shows `YouTube <version> ★` after Hermes restart.

## Product smoke

- [ ] `/youtube` route opens.
- [ ] Docked player opens.
- [ ] Floating player opens.
- [ ] Search works.
- [ ] Shorts works.
- [ ] Playlists work.
- [ ] Signed-in shelves degrade gracefully if signed out.
- [ ] Debug diagnostics copy without cookies/tokens.

## Publish

- [ ] `python3 scripts/publish-release.py --dry-run`
- [ ] `python3 scripts/publish-release.py`
- [ ] Attach `youtube-float-desktop-plugin-<version>.zip`.
- [ ] Include concise release notes and changelog link.
