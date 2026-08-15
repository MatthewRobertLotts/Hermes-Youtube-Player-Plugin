# Security and Privacy

## Security reporting

Please report security issues privately to the repository owner rather than opening a public issue with exploit details.

## YouTube session model

This plugin uses a persistent Electron webview partition for YouTube:

```text
persist:hermes-youtube-float-player
```

That lets YouTube keep the signed-in session, account selection, subscriptions, History, Watch Later, and playlists between Hermes launches.

The plugin does **not** directly handle YouTube login credentials. Login happens inside YouTube's own web page in the webview.

## What is stored locally

The plugin stores small local preference/state values only:

- player size
- docked/floating placement
- volume
- loop mode
- selected quality/caption preference
- safe account display state such as signed-in boolean/name
- local recent/search lists used by the UI
- optional diagnostics when Debug mode is enabled

## What is not stored

The plugin should not store, print, copy, or intentionally expose:

- YouTube cookies
- OAuth/session tokens
- passwords
- raw credential fields
- full browser session dumps
- private webview storage contents

CI guards block obvious cookie/session access patterns in `plugin.js`.

## Integration API trust boundary (v1)

The player exposes a small read/control surface to other Hermes Desktop plugins over a shared
`window` `CustomEvent` channel (`hermes:youtube:api` / `:response` / `:event`), contract-versioned
at `v1`.

- This API is **not a new privilege boundary.** A Hermes plugin already runs in the renderer with
  app-wide authority; the API only narrows *what the player hands out* to external callers.
- It exposes normalized read state and validated controls only. It never hands out:
  - cookies, OAuth/session tokens, authorization headers, YouTube credentials;
  - raw webview handles or unrestricted `executeJavaScript` access;
  - `ytInitialData`, DOM, renderer, or player implementation internals.
- Controls are validated before acting (`seekTo` rejects NaN/Infinity/negative/missing; unknown
  methods/versions are refused), so a caller cannot drive the player into an unsafe state or abuse
  it as a code-execution point.
- The trust assumption is: **any consumer is considered as trusted as any plugin on the same
  renderer** (the disk door is local-user-only). The API adds no remote-callable surface.

## `executeJavaScript` boundary

The plugin uses `webview.executeJavaScript` to talk to YouTube pages because YouTube data is rendered inside the signed-in webview session.

Rules for that boundary:

- scripts are scoped to YouTube playback/feed pages used by the plugin;
- scripts return video/feed metadata, not cookies or auth/session values;
- diagnostic output is scrubbed before copy/export;
- account/feed webviews are covered while loading so normal use remains a media-player surface.

## Navigation and external links

Trusted YouTube surfaces are limited to normal YouTube hosts and paths used by the player/dashboard/feed flows. Description links open externally with `noopener,noreferrer`.

The locked, non-browsable playback surface is intentional product design: it keeps Hermes as a media player/dashboard instead of a general browser.

## Debug diagnostics

Debug mode is off by default. When enabled, diagnostics record labelled plugin events such as `History -> youtubei -> parser failed`. Diagnostics include plugin version and platform/user-agent context, and redact sensitive-looking keys before copying.

Never paste diagnostics publicly if you manually add private information to them.


## Updater trust model

The in-plugin updater checks GitHub Releases only. It does not update from `main` or arbitrary URLs.

Before any replacement path may run, updater logic validates:

- latest stable tag is a version tag;
- release URL is under the expected GitHub repository;
- artifact name matches `youtube-float-desktop-plugin-<version>.zip`;
- artifact URL is under the matching release tag;
- artifact size is positive and below the strict maximum;
- downloaded plugin metadata has the expected plugin ID and version;
- downloaded plugin source looks like the Hermes YouTube Player plugin.

The current Hermes plugin runtime does not expose a documented filesystem/update bridge to this plugin. Without that explicit bridge, the updater validates the release and opens the GitHub Release page for manual installer use. It must not hack around the sandbox or overwrite files directly.

Failures leave the existing installed version untouched and log redacted diagnostics.
