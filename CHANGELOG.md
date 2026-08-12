# Changelog

## v3.28
- Removed in-app keyboard shortcuts because they intercepted normal Hermes typing.
- Kept OS/browser Media Session controls only.
- Kept v3.27 preference persistence.

## v3.27
- Persisted safe preferences: Size, volume, loop mode, quality choice, and caption choice.
- Deliberately did not persist videos/search/account feeds, so reopen does not autoplay or scrape account pages.

## v3.26
- Added keyboard shortcuts: Space/K play-pause, J/Left rewind, L/Right forward, Up/Down volume, M mute.
- Added Media Session handlers for OS/media-key play, pause, previous, next, rewind, and forward.

## v3.25
- Mini mode now keeps the Size dropdown visible on the left of the timeline, so you can leave Mini without reinstalling.

## v3.24
- Moved Mini into the existing Size dropdown; removed the separate Mini/Full button.
- Made Mini less tiny: 420×310 with a 236px player so the control row fits.

## v3.23
- Added **Mini** mode: shrinks the floating pane to video, timeline, volume, and a Full button.
- Cleaned account-feed loading text and removed the dead playlist channel resolver from the failed v3.21 approach.
- Window-size persistence intentionally left out for the separate pass.

## v3.22
- **Subscriptions/Watch Later auto-load:** fixed account feed cache-busting URLs so dropdown selection uses valid `?`/`&` URLs; no manual blank search should be needed.
- **Your Playlists:** now loads YouTube's signed-in `You` page directly and scrapes rendered playlist tiles, avoiding fragile channel URL resolution.
- Kept search field blank; no built-in default search term.

## v3.21

- **Your Playlists:** broader channel lookup (guide + avatar anchors) with retries while the home page renders.
- Removed the placeholder default search term.


## v3.20

- **Your Playlists:** new search-mode that resolves the signed-in user's channel, loads its `/playlists` tab in a visible pane, and lists their own playlists — picks open and play them.


## v3.19

- Covered the History pane's raw browser flash with an opaque "Loading your YouTube history…" overlay while it scrapes.


## v3.18

- **History rebuilt:** opens a real visible/interactive history webview in the player area (the same trust surface as the login pane), scrapes the rendered rows, then locks back down — this sidesteps YouTube's anti-bot stub served to the hidden 1px webview.


## v3.17

- Empty-history status now reports the page title / URL / `ytInitialData` presence, to pinpoint whether history hits a consent wall or a real (empty) watch-history page.


## v3.16

- **History reworked:** loads `/feed/history` and DOM-scrapes with a patient retry until YouTube hydrates the items (dropped the fragile browse-API approach).


## v3.15

- Removed the hardcoded fallback API key — the request uses only the live `ytcfg` key from the page.


## v3.14

- **History fix:** browse request now uses the page's **live API key + client version** from `ytcfg` (not a hardcoded one YouTube rejects as stale), plus the `?key=` param.


## v3.13

- **History auth fix:** the browse-API call now signs with the **SAPISID hash** (same auth header YouTube's own JS sends) plus client/visitor headers, so it's accepted as logged-in instead of rejected.


## v3.12

- **History fixed via YouTube browse API**: history items load through YouTube's own `/youtubei/v1/browse` endpoint (same origin, logged in) instead of the empty initial-page shell — the data that DevTools showed arriving in a separate AJAX call is now read directly.


## v3.11

- Feed diagnostics now include the **URL** the webview landed on — to distinguish consent walls / redirects / home from a real empty feed.


## v3.10

- Deeper feed diagnostics: empty signed-in feeds now report the page title, whether `ytInitialData` exists, and body size — to pinpoint consent/sign-in walls vs genuinely empty pages.


## v3.9

- **Deterministic lock-down** after leaving the account pane (strips directly instead of racing dom-ready).
- **Self-diagnosing feeds:** if a signed-in feed returns nothing, the status line reports the renderers the page actually contained, so we can fix the real cause instead of guessing.


## v3.8

- **Bug fix:** the player now locks back down immediately when you exit the account pane (previously it stayed unlocked until a new video was picked).
- **Bug fix:** signed-in **History** now parses the rich/feed renderers it previously missed.


## v3.7

- Fixed account feeds: **Subscriptions / Watch Later / History** now **auto-load on selection** (no blank Search needed), Watch Later/History parse their playlist renderers, and signed-out use prompts to sign in instead of silently failing.


## v3.6

- Added **account integration**: detects your signed-in account (👤 shows the account name). When signed in, **History** pulls your real YouTube watch history, and the video-type dropdown gains **Subscriptions** and **Watch Later** from your account. Signed-out History falls back to local viewing history.


## v3.5

- Added **Account / Sign in** — a button that temporarily makes the player area an interactive YouTube sign-in pane (session persists for playback), then **Done** returns to the locked media-player view.


## v3.4

- Volume is now a compact speaker-button popover — click the 🔊 icon to reveal a vertical volume slider; the timeline keeps the whole row.


## v3.3

- Made the **timeline** the dominant slider bar — fills the row, thicker thumb, volume stays compact on the right.


## v3.2

- Added **Volume** slider on the timeline row — sets YouTube player + video-element volume.


## v3.1

- Added **History** search mode — watched items recorded newest-first, persisted in localStorage (last 50), replayable from the dropdown.


## v0.1

- Initial floating YouTube pane package.

## v0.2

- Stabilise floating pane loading.

## v0.3

- Fix desktop plugin install path.

## v0.4

- Repair bundled plugin path handling.

## v0.5

- Fix plugin syntax and startup.

## v0.6

- Switch player to youtube watch page.

## v0.7

- Add player ui shell.

## v0.8

- Add playback controls.

## v0.9

- Disable search autoplay.

## v0.10

- Show first search result cleanly.

## v0.11

- Restore stable v9-style layout.

## v0.12

- Stabilise video player sizing.

## v0.13

- Fix module export syntax.

## v0.14

- Add player size presets.

## v0.15

- Resize floating pane from presets.

## v0.16

- Improve video fill behaviour.

## v0.17

- Harden full-size video layout.

## v0.18

- Test native video surface approach.

## v0.19

- Move native player experiment into webview.

## v0.20

- Repair player surface layering.

## v1.0

- Ship watch-page player architecture.

## v1.1

- V23 overlays gone.

## v1.2

- V24 overlays subs play.

## v1.3

- V25 revert overlay.

## v1.4

- V26 pause overlay gone.

## v1.5

- V27 sniper clean.

## v1.6

- V28 whitelist video.

## v1.7

- V29 next prev fix.

## v1.8

- V30 quality subs.

## v1.9

- V31 quality captions real.

## v1.10

- V32 captions dual path.

## v1.11

- V33 captions asr kind.

## v1.12

- V34 cc click.

## v1.13

- V35 captions default off.

## v1.14

- V36 controls layout.

## v1.15

- V37 compact controls.

## v1.16

- V38 static dropdowns.

## v1.17

- V39 static titles.

## v1.18

- V40 subs fixed width.

## v1.19

- V41 dropdown stays open.

## v1.20

- V42 popup survives.

## v1.21

- V43 quality tick.

## v1.22

- V44 subs loop swap.

## v1.23

- V45 revert swap.

## v1.24

- V46 solid dropdowns.

## v1.25

- V47 cluster solid.

## v1.26

- Balance control bar columns.

## v1.27

- Restore compact control layout.

## v2.0

- Lock player controls milestone.

## v2.1

- Add shorts and playlist result types.

## v2.2

- V52 sp filter params.

## v2.3

- V53 chip click filter.

## v2.4

- Parse verified youtube result models.

## v2.5

- V55 shorts chain playlist menu.

## v2.6

- V56 ended flag context advance.

## v2.7

- V57 json playlist self heal.

## v2.8

- Scrape modern youtube search json.

## v2.9

- V59 playlist to results.

## v2.10

- Fix playlist results startup crash.

## v2.11

- V61 playlist typing.

## v2.12

- V62 playlist retry.

## v2.13

- Load playlist videos from player page.

## v2.14

- V64 entry play.

## v2.15

- Guard playlist results from stale search writes.

## v2.16

- V66 autostart.

## v2.17

- V67 autostart fix.

## v3.0 ★

- Ship playlist autoplay milestone.
