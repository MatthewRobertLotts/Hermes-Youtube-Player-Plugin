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
