import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v19-native-player'
const DEFAULT_QUERY = 'king boomer'
const SEARCH_FILTERS = [
  ['videos', 'Videos'],
  ['shorts', 'Shorts'],
  ['playlists', 'Playlists']
]
const PLAYER_SIZES = {
  small: { label: 'Small', width: '500px', height: '500px', player: '281px' },
  medium: { label: 'Medium', width: '640px', height: '610px', player: '360px' },
  large: { label: 'Large', width: '760px', height: '720px', player: '427px' }
}
const QUALITY_LABELS = { auto: 'Auto', tiny: '144p', small: '240p', medium: '360p', large: '480p', hd720: '720p', hd1080: '1080p' }
const fmt = seconds => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function videoIdFrom(input) {
  const text = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text
  try {
    const url = new URL(text)
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.match(/\/(embed|shorts|watch)\/?([a-zA-Z0-9_-]{11})/)?.[2] || null
  } catch {}
  return null
}

function watchUrl(videoId) {
  return videoId ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=0' : 'about:blank'
}
function searchSrc(query, filter) {
  const suffix = filter === 'shorts' ? ' shorts' : filter === 'playlists' ? ' playlist' : ''
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + suffix)
}

const scrapeSearchScript = '(' + function () {
  return new Promise(resolve => {
    setTimeout(() => {
      const seen = new Set()
      const out = []
      for (const row of document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer, ytd-reel-item-renderer, ytd-playlist-renderer')) {
        const link = row.querySelector('a#video-title') || row.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]')
        if (!link) continue
        const url = new URL(link.href, location.href)
        const id = url.searchParams.get('v') || url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)?.[1]
        if (!id || seen.has(id)) continue
        const titleNode = row.querySelector('#video-title') || link
        const title = (titleNode.getAttribute('title') || titleNode.textContent || '').replace(/\s+/g, ' ').trim()
        if (!title || /now playing/i.test(title) || /^\d+:\d+/.test(title)) continue
        seen.add(id)
        const img = row.querySelector('img')
        const thumb = img?.src || img?.getAttribute('data-thumb') || 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'
        const duration = (row.querySelector('ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer')?.textContent || '').replace(/\s+/g, ' ').trim()
        out.push({ duration, id, title, thumb })
        if (out.length >= 14) break
      }
      resolve(out)
    }, 1500)
  })
}.toString() + ')()'

const extractStreamScript = '(' + function () {
  try {
    let pr = window.ytInitialPlayerResponse
    if (!pr) {
      const t = Array.from(document.scripts).map(s => s.textContent).find(x => x && x.indexOf('ytInitialPlayerResponse') !== -1)
      const m = t && t.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s)
      if (m) { try { pr = JSON.parse(m[1]) } catch (e) { pr = null } }
    }
    if (!pr) return { ok: false, error: 'no player response' }
    const sd = pr.streamingData || {}
    // Muxed formats carry both audio+video -> single <video src>.
    const muxed = (sd.formats || []).filter(f => f && f.url && f.mimeType && f.mimeType.indexOf('video/mp4') !== -1)
      .map(f => ({ url: f.url, height: f.height || 0, itag: f.itag || 0 }))
      .sort((a, b) => b.height - a.height)
    const caps = ((pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks) || [])
      .map(t => ({ lang: t.languageCode || '', label: (t.name && t.name.simpleText) || t.languageCode || '', url: t.baseUrl || '' }))
    return { ok: muxed.length > 0, muxed, captions: caps, title: (pr.videoDetails && pr.videoDetails.title) || '' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}.toString() + ')()'

function webviewCommand(action, value) {
  return '(' + function (payload) {
    const video = document.querySelector('video')
    const player = document.getElementById('movie_player')
    if (!video) return { ok: false }
    if (payload.action === 'playPause') video.paused ? video.play() : video.pause()
    if (payload.action === 'seek') video.currentTime = Math.max(0, Math.min(video.duration || payload.value, Number(payload.value) || 0))
    if (payload.action === 'rewind') video.currentTime = Math.max(0, video.currentTime - 10)
    if (payload.action === 'forward') video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10)
    if (payload.action === 'loop') video.loop = Boolean(payload.value)
    if (payload.action === 'quality' && payload.value !== 'auto') { player?.setPlaybackQualityRange?.(payload.value); player?.setPlaybackQuality?.(payload.value) }
    if (payload.action === 'quality' && payload.value === 'auto') player?.setPlaybackQualityRange?.('auto')
    if (payload.action === 'caption') {
      for (const track of video.textTracks || []) track.mode = payload.value && (track.language === payload.value || track.label === payload.value) ? 'showing' : 'disabled'
    }
    return { current: video.currentTime, duration: video.duration || 0, paused: video.paused }
  }.toString() + ')(' + JSON.stringify({ action, value }) + ')'
}

function YouTubeFloat() {
  const [draft, setDraft] = useState(DEFAULT_QUERY)
  const [filter, setFilter] = useState('videos')
  const [playerSize, setPlayerSize] = useState('large')
  const [videoId, setVideoId] = useState(null)
  const [results, setResults] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [status, setStatus] = useState('Search for a video')
  const [searchUrl, setSearchUrl] = useState(null)
  const [loop, setLoop] = useState(false)
  const [quality, setQuality] = useState('auto')
  const [qualities, setQualities] = useState(['auto'])
  const [caption, setCaption] = useState('off')
  const [captions, setCaptions] = useState([])
  const [progress, setProgress] = useState({ current: 0, duration: 0, paused: true })
  // Native player state
  const [streams, setStreams] = useState([])      // [{url,height,itag}]
  const [nativeUrl, setNativeUrl] = useState(null) // active src for our <video>
  const [native, setNative] = useState(false)      // true = using our <video>
  const searchRef = useRef(null)
  const playerRef = useRef(null)
  const videoRef = useRef(null)
  const rootRef = useRef(null)
  const pendingId = useRef(null)
  const nativeRef = useRef(false)

  // Resize the host floating card with the size preset.
  useEffect(() => {
    const cfg = PLAYER_SIZES[playerSize] || PLAYER_SIZES.large
    const pane = rootRef.current?.closest?.('[data-floating-pane]')
    if (!pane) return
    pane.style.width = cfg.width
    pane.style.height = cfg.height
    window.dispatchEvent(new Event('resize'))
  }, [playerSize])

  const capture = vid => {
    setVideoId(vid)
    setNative(false)
    setStreams([])
    setNativeUrl(null)
    nativeRef.current = false
    pendingId.current = vid
  }

  // When the fallback webview loads, try to extract a direct stream URL.
  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined
    const ready = async () => {
      try {
        const r = await webview.executeJavaScript(extractStreamScript, true)
        if (!r || !r.ok || !Array.isArray(r.muxed) || !r.muxed.length) { setStatus('Using web player (stream unavailable)'); return }
        if (Array.isArray(r.muxed)) {
          const qs = ['auto', ...r.muxed.map(m => 'h' + m.height)]
          setQualities(qs)
        }
        if (Array.isArray(r.captions)) setCaptions(r.captions)
        setStreams(r.muxed)
        setNative(true)
        nativeRef.current = true
        const best = r.muxed[0]
        setNativeUrl(best.url)
        setStatus(r.title || 'Playing')
        // Stop the webview so it can't double-play audio.
        try { webview.src = 'about:blank' } catch {}
      } catch (e) { setStatus('Using web player') }
    }
    webview.addEventListener('dom-ready', ready)
    const fallback = window.setTimeout(() => { if (!nativeRef.current) setStatus('Using web player') }, 6000)
    return () => { webview.removeEventListener('dom-ready', ready); window.clearTimeout(fallback) }
  }, [videoId])

  // Native player lifecycle: set quality on load, poll progress.
  useEffect(() => {
    if (!native || !nativeUrl) return undefined
    const v = videoRef.current
    if (!v) return undefined
    const applyTime = () => setProgress({ current: v.currentTime, duration: v.duration || 0, paused: v.paused })
    v.addEventListener('timeupdate', applyTime)
    v.addEventListener('loadedmetadata', applyTime)
    v.addEventListener('play', applyTime)
    v.addEventListener('pause', applyTime)
    v.addEventListener('ended', applyTime)
    const timer = window.setInterval(applyTime, 500)
    return () => { v.removeEventListener('timeupdate', applyTime); v.removeEventListener('loadedmetadata', applyTime); v.removeEventListener('play', applyTime); v.removeEventListener('pause', applyTime); v.removeEventListener('ended', applyTime); window.clearInterval(timer) }
  }, [native, nativeUrl])

  const runCommand = async (action, value) => {
    if (native) {
      const v = videoRef.current
      if (!v) return
      if (action === 'playPause') v.paused ? v.play() : v.pause()
      else if (action === 'seek') v.currentTime = Math.max(0, Math.min(v.duration || value, Number(value) || 0))
      else if (action === 'rewind') v.currentTime = Math.max(0, v.currentTime - 10)
      else if (action === 'forward') v.currentTime = Math.min(v.duration || v.currentTime + 10, v.currentTime + 10)
      else if (action === 'loop') v.loop = Boolean(value)
      else if (action === 'quality') {
        const m = streams.find(s => 'h' + s.height === value)
        if (m) { const t = v.currentTime; const p = !v.paused; setNativeUrl(m.url); v.src = m.url; v.currentTime = Math.min(t, v.duration || 0); if (p) v.play().catch(() => undefined) }
      }
      else if (action === 'caption') {
        // handled via track element below
      }
      setProgress({ current: v.currentTime, duration: v.duration || 0, paused: v.paused })
    } else {
      try { const r = await playerRef.current?.executeJavaScript(webviewCommand(action, value), true); if (r) setProgress({ current: r.current || 0, duration: r.duration || 0, paused: Boolean(r.paused) }) } catch {}
    }
  }

  // captions on native video: attach active track
  useEffect(() => {
    const v = videoRef.current
    if (!v || !native) return
    for (const tr of v.textTracks || []) tr.mode = 'disabled'
    if (caption === 'off' || (!nativeUrl && !native)) return
    let tr = Array.from(v.textTracks || []).find(t => t.label === 'hermes-caption')
    if (!tr) {
      tr = document.createElement('track')
      tr.kind = 'subtitles'
      tr.label = 'hermes-caption'
      tr.srclang = 'en'
      v.appendChild(tr)
    }
    const cap = captions.find(c => c.lang === caption || c.label === caption)
    if (cap && cap.url) { tr.src = cap.url + (cap.url.includes('&') ? '&' : '?') + 'fmt=vtt&lang=' + encodeURIComponent(cap.lang); tr.mode = 'showing' }
  }, [caption, native, nativeUrl, captions])

  useEffect(() => {
    const webview = searchRef.current
    if (!webview || !searchUrl) return undefined
    let cancelled = false
    const done = async () => {
      try {
        const found = await webview.executeJavaScript(scrapeSearchScript, true)
        if (cancelled) return
        const clean = Array.isArray(found) ? found.filter(v => v?.id && v?.title) : []
        setResults(clean)
        setCurrentIndex(-1)
        if (clean[0]) setStatus('Choose a result')
        else setStatus('No videos found')
      } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : String(error)) }
    }
    const finish = () => void done()
    webview.addEventListener('dom-ready', finish, { once: true })
    webview.addEventListener('did-finish-load', finish, { once: true })
    const fallback = window.setTimeout(finish, 3500)
    return () => { cancelled = true; window.clearTimeout(fallback); webview.removeEventListener('dom-ready', finish); webview.removeEventListener('did-finish-load', finish) }
  }, [searchUrl])

  const submit = event => {
    event.preventDefault()
    const next = draft.trim()
    if (!next) return
    const exact = videoIdFrom(next)
    if (exact) { setResults([]); capture(exact); setStatus('Loading…'); return }
    setStatus('Searching YouTube…')
    setResults([])
    setSearchUrl(searchSrc(next, filter) + '&_=' + Date.now())
  }
  const play = (result, index) => { capture(result.id); setCurrentIndex(index); setStatus('Loading…') }
  const playOffset = delta => { const next = results[currentIndex + delta]; if (next) play(next, currentIndex + delta) }
  const pill = active => cn('rounded-full border px-2.5 py-1 text-xs transition', active ? 'border-(--ui-accent) bg-(--ui-accent) text-(--ui-accent-contrast)' : 'border-(--ui-border-muted) text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)')
  const cfg = () => PLAYER_SIZES[playerSize] || PLAYER_SIZES.large

  return jsxs('div', { className: 'relative flex h-full min-h-0 flex-col bg-black/20', ref: rootRef, children: [
    jsx('div', {
      className: 'relative shrink-0 bg-black',
      style: { height: cfg().player },
      children: [
        // Fallback web player (also the stream-extraction source).
        videoId ? jsx('webview', { allowpopups: 'true', className: 'absolute inset-0 h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: watchUrl(videoId) }) : null,
        // Native player overlays and fills the box when a stream is available.
        native && nativeUrl ? jsx('video', {
          autoPlay: true,
          className: 'absolute inset-0 h-full w-full bg-black object-contain',
          controls: false,
          loop: loop,
          playsInline: true,
          ref: videoRef,
          src: nativeUrl
        }) : null,
        !videoId ? jsx('div', { className: 'absolute inset-0 grid place-items-center px-3 text-center text-xs text-white/60', children: `${VERSION}: Search, then pick a result below.` }) : null
      ]
    }),
    searchUrl ? jsx('webview', { className: 'pointer-events-none absolute h-px w-px opacity-0', partition: 'persist:hermes-youtube-float-search', ref: searchRef, src: searchUrl }) : null,
    jsxs('div', { className: 'shrink-0 border-t border-white/10 bg-(--ui-bg-elevated)/95 px-3 py-2', children: [
      jsxs('div', { className: 'mb-1 flex items-center gap-2 text-[11px] text-(--ui-text-tertiary)', children: [jsx('span', { children: fmt(progress.current) }), jsx('input', { className: 'h-1 flex-1 accent-(--ui-accent)', disabled: !videoId, max: progress.duration || 0, min: 0, onChange: e => { const v = Number(e.currentTarget.value); setProgress({ ...progress, current: v }); void runCommand('seek', v) }, type: 'range', value: Math.min(progress.current, progress.duration || progress.current) }), jsx('span', { children: fmt(progress.duration) })] }),
      jsxs('div', { className: 'flex flex-wrap items-center justify-center gap-1.5', children: [
        jsx('button', { className: pill(false), disabled: !videoId, onClick: () => playOffset(-1), type: 'button', children: '⏮' }),
        jsx('button', { className: pill(Boolean(videoId) && !progress.paused), disabled: !videoId, onClick: () => runCommand('playPause'), type: 'button', children: progress.paused ? '▶ Play' : '⏸ Pause' }),
        jsx('button', { className: pill(false), disabled: !videoId, onClick: () => playOffset(1), type: 'button', children: '⏭' }),
        jsx('button', { className: pill(loop), disabled: !videoId, onClick: () => { const next = !loop; setLoop(next); void runCommand('loop', next) }, type: 'button', children: loop ? 'Loop ✓' : 'Loop' }),
        jsx('button', { className: pill(false), disabled: !videoId, onClick: () => runCommand('rewind'), type: 'button', children: '-10s' }),
        jsx('button', { className: pill(false), disabled: !videoId, onClick: () => runCommand('forward'), type: 'button', children: '+10s' }),
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs', onChange: e => setPlayerSize(e.currentTarget.value), value: playerSize, children: Object.entries(PLAYER_SIZES).map(([value, c]) => jsx('option', { value, children: c.label }, value)) }),
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs disabled:opacity-50', disabled: !videoId, onChange: e => { setQuality(e.currentTarget.value); void runCommand('quality', e.currentTarget.value) }, value: quality, children: qualities.map(q => jsx('option', { value: q, children: QUALITY_LABELS[q] || q }, q)) }),
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs disabled:opacity-50', disabled: !videoId, onChange: e => setCaption(e.currentTarget.value), value: caption, children: [jsx('option', { value: 'off', children: 'Subs off' }, 'off'), ...captions.map(c => jsx('option', { value: c.lang, children: c.label }, c.lang))] })
      ] })
    ] }),
    jsxs('form', { className: 'flex shrink-0 gap-1.5 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-2', onSubmit: submit, children: [
      jsx('select', { className: 'rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 text-xs', onChange: e => setFilter(e.currentTarget.value), value: filter, children: SEARCH_FILTERS.map(([v, label]) => jsx('option', { value: v, children: label }, v)) }),
      jsx('input', { 'aria-label': 'Search YouTube or paste a video URL', className: cn('min-w-0 flex-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1.5 text-xs text-(--ui-text-primary) outline-none', 'placeholder:text-(--ui-text-quaternary) focus:border-(--ui-accent)'), onChange: e => setDraft(e.currentTarget.value), placeholder: 'Search YouTube or paste URL…', value: draft }),
      jsx('button', { className: 'rounded-md bg-(--ui-accent) px-2.5 py-1.5 text-xs font-medium text-(--ui-accent-contrast) hover:brightness-110', type: 'submit', children: status === 'Searching YouTube…' ? 'Searching…' : 'Search' })
    ] }),
    results.length ? jsx('div', { className: 'max-h-[30vh] min-h-0 shrink-0 overflow-auto border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1', children: results.map((result, index) => jsxs('button', { className: cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)', result.id === videoId ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'), onClick: () => play(result, index), title: result.title, type: 'button', children: [jsx('img', { alt: '', className: 'h-11 w-20 shrink-0 rounded object-cover bg-black', src: result.thumb || 'https://i.ytimg.com/vi/' + result.id + '/mqdefault.jpg' }), jsx('span', { className: 'min-w-0 flex-1 truncate', children: result.title }), result.duration ? jsx('span', { className: 'shrink-0 text-[10px] text-(--ui-text-tertiary)', children: result.duration }) : null, result.id === videoId ? jsx('span', { className: 'shrink-0 text-[10px]', children: native ? 'Playing' : 'Playing' }) : null] }, result.id)) }) : jsx('div', { className: 'min-h-0 flex-1 border-t border-white/10 px-2 py-2 text-[11px] text-(--ui-text-quaternary)', children: status === 'Searching YouTube…' ? 'Searching… results will appear here.' : status })
  ] })
}

export default { id: 'youtube-float', name: 'YouTube Float', description: 'Floating YouTube player pane with a native video element (direct stream) and plugin-owned controls.', register(ctx) { ctx.register({ id: 'player', area: 'panes', title: 'YouTube v19', data: { placement: 'floating', anchor: 'top-right', width: PLAYER_SIZES.large.width, height: PLAYER_SIZES.large.height }, render: () => jsx(YouTubeFloat, {}) }) } }
