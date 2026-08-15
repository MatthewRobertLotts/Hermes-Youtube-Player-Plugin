# Performance & Long-Session Stability

## Where time/memory actually goes

- Hidden webviews are expensive: each persisted YouTube page keeps a real renderer (session, DOM,
  network). Keep hidden webviews to a small fixed set and keep their `src` **stable**.
- The player progress poll runs every 450ms during playback for end/drift detection and backs off
  to 1000ms when idle.
- Caches are bounded: diagnostic log (120), local history (50), dashboard rows/queues per shelf.
- `MediaSession` handlers are (re)registered per effect and nulled on teardown -- no accumulation.
- `statusListeners` is a `Set`; each subscriber removes itself on unmount.

## Regression gate

- Persistent hidden webviews must use `stableSource(...)`; only one-shot panes / fresh searches
  use `cacheBust(...)`.
- Every `setInterval`/`setTimeout` needs a cleanup and every effect must remove its listeners.
  If you add one, add a parity assertion in `tests/plugin-runtime-parity.test.mjs`.

## Measuring

Profile in a real Hermes/Electron session:

1. Devtools (`Ctrl+Shift+I`) -> Performance panel.
2. Playback CPU: keep a video playing and read CPU%; idle CPU: pause, wait 10s.
3. Memory: `performance.memory.usedJSHeapSize` in the plugin tab console, or the OS process
   manager "Memory" column. Record at: launch, after 10 searches, after 10 dashboard refreshes
   (toggle account/history/subscriptions), after 20 docked<->floating swaps, and after 2h mixed
   idle+playback.
4. If it grows across refreshes, check webview count: one per hidden shelf (home, history, subs,
   watch-later, playlists, shorts) plus one player webview. Growth = leak; find it and add the
   parity assertion.

## Intended cost

The home/history/... hidden shelves stay mounted to feed the dashboard live. Deliberate -- do not
yank them for minuscule savings.
