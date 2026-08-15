# Release checklist

Use this before tagging a stable release.

## Version

- [ ] Pick one canonical version, e.g. `v3.116`.
- [ ] `manifest.json` version matches.
- [ ] `plugin.js` `VERSION` matches and has no suffix.
- [ ] README badge/install commands match.
- [ ] CHANGELOG top entry matches.
- [ ] Installer filenames match.

## Checks

- [ ] `node scripts/check-release.mjs`
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

- [ ] Create GitHub Release from the tag.
- [ ] Attach `youtube-float-desktop-plugin-<version>.zip`.
- [ ] Include concise release notes and changelog link.
