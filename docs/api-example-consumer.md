# Example: reference mock consumer of the Player Integration API v1

A minimal, self-contained Hermes Desktop plugin that consumes the YouTube player's API v1 as an
external third-party plugin would. This is **not** the intelligence product — it is a safe mock
that proves the read/control surface and the event lifecycle, and a starting point for tests.

Only SDK specifiers are imported, so it loads as a normal disk plugin.

## Full mock consumer (`plugin.js`)

```js
// ~/.hermes/desktop-plugins/youtube-float-consumer/plugin.js
import { host } from '@hermes/plugin-sdk'
import { jsx } from 'react/jsx-runtime'

const CHANNEL = 'hermes:youtube:api'
const RESPONSE = 'hermes:youtube:api:response'
const EVENT = 'hermes:youtube:api:event'
let seq = 0

function send(method, params = {}) {
  const id = 'c' + (++seq)
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { v: 1, id, method, params } }))
  return id
}

export default {
  id: 'youtube-float-consumer',
  name: 'YouTube Float Consumer (mock)',
  description: 'Reference consumer proving the player integration API v1.',
  register(ctx) {
    // --- replies ---
    const onResponse = e => {
      const d = e && e.detail
      host.notify({ kind: 'info', message: 'player replied: ' + JSON.stringify(d) })
    }
    // --- pushed events ---
    const onEvent = e => {
      const d = e && e.detail
      if (d && d.type) console.log('[youtube-float-consumer] event', d.type, d)
    }
    window.addEventListener(RESPONSE, onResponse)
    window.addEventListener(EVENT, onEvent)

    // Lifecycle: player unsubscribes by removing these on teardown. Here we also expose a button
    // to query + control so you can drive it by hand in Hermes.
    ctx.register({
      id: 'pane',
      area: 'panes',
      title: 'YT consumer',
      data: { placement: 'right', width: '260px' },
      render: () => jsx('div', {
        className: 'flex h-full flex-col gap-2 p-3 text-sm',
        children: [
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('getApiInfo'), children: 'getApiInfo' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('getCurrentVideo'), children: 'getCurrentVideo' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('getPlaybackState'), children: 'getPlaybackState' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('getQueue'), children: 'getQueue' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('play'), children: 'play' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('pause'), children: 'pause' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-white', onClick: () => send('seekTo', { seconds: 30 }), children: 'seek 30' }),
        ]
      })
    })

    // NOTE: a Hermes plugin's `register` return value is not auto-cleanup. A consumer's listeners
    // live for the plugin's loaded lifetime; when this plugin is disabled/reloaded Hermes tears the
    // module down and the listeners die with it. The removal calls below are shown for symmetry and
    // for a consumer that wires its own lifecycle, not because Hermes invokes this return value.
    return () => { window.removeEventListener(RESPONSE, onResponse); window.removeEventListener(EVENT, onEvent) }
  }
}
```

## What it proves

- Versioned request via the shared `window` CustomEvent channel with `id` correlation.
- Listens to replies and pushed events; unsubscribes by removing listeners.
- Uses only `@hermes/plugin-sdk` + `react/jsx-runtime` (the allowed specifiers).
- Never touches cookies/tokens/webviews/`executeJavaScript`.

## Contract tests

Deterministic behaviour is frozen in `tests/api-contract.test.mjs` (pure functions) and
`tests/plugin-runtime-parity.test.mjs` (shipped `plugin.js` bridge must carry the same v1 methods
and must not leak secrets). The mock above is for manual live verification in Hermes Desktop.