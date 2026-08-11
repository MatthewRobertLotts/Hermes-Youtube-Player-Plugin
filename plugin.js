import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v20-native-in-webview'
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

// Inject our own full-viewport <video> into the webview (same session => cookies => plays).
function injectVideoScript(url) {
  return '(' + function (u) {
    try {
      const yt = document.getElementById('movie_player')
      if (yt) yt.style.display = 'none'
      document.querySelectorAll('ytd-app, #page-manager, #primary, #columns, ytd-watch-flexy, ytd-player').forEach(e => { if (e) e.style.cssText = 'background:#000!important;margin:0!important;padding:0!important;overflow:hidden!important' })
      let v = document.getElementById('hermes-v')
      if (!v) {
        v = document.createElement('video')
        v.id = 'hermes-v'
        v.controls = false
        v.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;object-fit:contain!important;background:#000!important;margin:0!important;padding:0!important;'
        document.documentElement.appendChild(v)
      }
      v.src = u
      v.loop = !!v.dataset.loop
      v.muted = false
      v.play().catch(() => undefined)
      return { ok: true, width: window.innerWidth || 0, height: window.innerHeight || 0 }
    } catch (e) { return { ok: false, error: String(e) } }
  }.toString() + ')(' + JSON.stringify(url) + ')'
}

const videoStateScript = '(' + function () {
  const v = document.getElementById('hermes-v')
  if (!v) return { ok: false }
  return { ok: true, current: v.currentTime, duration: v.duration || 0, paused: v.paused, loop: v.loop }
}.toString() + ')()'

function nativeCommand(action, value) {
  return '(' + function (p) {
    const v = document.getElementById('hermes-v')
    if (!v) return { ok: false }
    if (p.action === 'playPause') v.paused ? v.play() : v.pause()
    if (p.action === 'seek') v.currentTime = Math.max(0, Math.min(v.duration || p.value, Number(p.value) || 0))
    if (p.action === 'rewind') v.currentTime = Math.max(0, v.currentTime - 10)
    if (p.action === 'forward') v.currentTime = Math.min(v.duration || v.currentTime + 10, v.currentTime + 10)
    if (p.action === 'loop') v.loop = Boolean(p.value)
    return { ok: true, current: v.currentTime, duration: v.duration || 0, paused: v.paused }
  }.toString() + ')(' + JSON.stringify({ action, value }) + ')'
}

function setSrcScript(url, currentTime) {
  return '(' + function (u, t) {
    const v = document.getElementById('hermes-v')
    if (!v) return false
    v.src = u
    if (t && t > 1) v.currentTime = t
    v.play().catch(() => undefined)
    return true
  }.toString() + ')(' + JSON.stringify(url) + ',' + JSON.stringify(currentTime || 0) + ')'
}

function captionScript(capUrl, lang) {
  return '(' + function (u, l) {
    const v = document.getElementById('hermes-v')
    if (!v) return
    for (const tr of v.textTracks || []) tr.mode = 'disabled'
    if (!u) return
    let tr = Array.from(v.children || []).find(c => c && c.tagName === 'TRACK')
    if (!tr) { tr = document.createElement('track'); tr.kind = 'subtitles'; tr.srclang = l || 'en'; v.appendChild(tr) }
    tr.src = u + (u.indexOf('&') !== -1 ? '&' : '?') + 'fmt=vtt&lang=' + encodeURIComponent(l || 'en')
    tr.mode = 'showing'
  }.toString() + ')(' + JSON.stringify(capUrl || '') + ',' + JSON.stringify(lang || 'en') + ')'
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
  const [streams, setStreams] = useState([])
  const [native, setNative] = useState(false)
  const searchRef = useRef(null)
  const playerRef = useRef(null)
  const rootRef = useRef(null)
  const nativeRef = useRef(false)

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
    nativeRef.current = false
    setStreams([])
    setStatus('Loading…')
  }

  // Playback pipeline: webview loads watch page (for session), we extract a
  // direct stream URL and inject our own full-size <video> into that webview.
  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined
    const ready = async () => {
      try {
        const r = await webview.executeJavaScript(extractStreamScript, true)
        if (!r || !r.ok || !Array.isArray(r.muxed) || !r.muxed.length) { setStatus('Using web player (stream unavailable)'); return }
        setStreams(r.muxed)
        if (Array.isArray(r.muxed)) setQualities(['auto', ...r.muxed.map(m => 'h' + m.height)])
        if (Array.isArray(r.captions) && r.captions.length) setCaptions(r.captions)
        setNative(true)
        nativeRef.current = true
        await webview.executeJavaScript(injectVideoScript(r.muxed[0].url), true)
        if (r.title) setStatus(r.title)
      } catch (e) { setStatus('Using web player') }
    }
    webview.addEventListener('dom-ready', ready)
    const fallback = window.setTimeout(() => { if (!nativeRef.current) setStatus('Using web player') }, 6000)
    return () => { webview.removeEventListener('dom-ready', ready); window.clearTimeout(fallback) }
  }, [videoId])

  // Poll progress from the injected video (or webview fallback).
  useEffect(() => {
    if (!videoId) return undefined
    const timer = window.setInterval(async () => {
      const w = playerRef.current
      if (!w) return
      if (nativeRef.current) {
        try { const r = await w.executeJavaScript(videoStateScript, true); if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused }) } catch {}
      } else {
        try { const r = await w.executeJavaScript(webviewCommand('state', null), true); if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused }) } catch {}
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [videoId, native])

  const runCommand = async (action, value) => {
    const w = playerRef.current
    if (!w) return
    if (nativeRef.current) {
      try {
        if (action === 'quality') {
          const m = streams.find(s => 'h' + s.height === value)
          if (m) { const st = await w.executeJavaScript(videoStateScript, true); await w.executeJavaScript(setSrcScript(m.url, st && st.ok ? st.current : 0), true) }
          return
        }
        if (action === 'caption') { const cap = captions.find(c => c.lang === value); await w.executeJavaScript(captionScript(action === 'caption' && value !== 'off' ? (cap && cap.url) : '', value && cap ? cap.lang : 'en'), true); return }
        const r = await w.executeJavaScript(nativeCommand(action, value), true)
        if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused })
      } catch {}
    } else {
      try { const r = await w.executeJavaScript(webviewCommand(action, value), true); if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused }) } catch {}
    }
  }

  // Fallback webview player driver (only used when native extraction fails).
  function webviewCommand(action) {
    return '(' + function () {
      const video = document.querySelector('video')
      if (!video) return { ok: false }
      return { ok: true, current: video.currentTime, duration: video.duration || 0, paused: video.paused }
    }.toString() + ')()'
  }

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
    if (exact) { setResults([]); capture(exact); return }
    setStatus('Searching YouTube…')
    setResults([])
    setSearchUrl(searchSrc(next, filter) + '&_=' + Date.now())
  }
  const play = (result, index) => { capture(result.id); setCurrentIndex(index) }
  const playOffset = delta => { const next = results[currentIndex + delta]; if (next) play(next, currentIndex + delta) }
  const pill = active => cn('rounded-full border px-2.5 py-1 text-xs transition', active ? 'border-(--ui-accent) bg-(--ui-accent) text-(--ui-accent-contrast)' : 'border-(--ui-border-muted) text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)')
  const cfg = () => PLAYER_SIZES[playerSize] || PLAYER_SIZES.large

  return jsxs('div', { className: 'relative flex h-full min-h-0 flex-col bg-black/20', ref: rootRef, children: [
    jsx('div', {
      className: 'relative shrink-0 bg-black',
      style: { height: cfg().player },
      children: videoId
        ? jsx('webview', { allowpopups: 'true', className: 'absolute inset-0 h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: watchUrl(videoId) })
        : jsx('div', { className: 'absolute inset-0 grid place-items-center px-3 text-center text-xs text-white/60', children: `${VERSION}: Search, then pick a result below.` })
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
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs disabled:opacity-50', disabled: !videoId, onChange: e => { setCaption(e.currentTarget.value); void runCommand('caption', e.currentTarget.value) }, value: caption, children: [jsx('option', { value: 'off', children: 'Subs off' }, 'off'), ...captions.map(c => jsx('option', { value: c.lang, children: c.label }, c.lang))] })
      ] })
    ] }),
    jsxs('form', { className: 'flex shrink-0 gap-1.5 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-2', onSubmit: submit, children: [
      jsx('select', { className: 'rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 text-xs', onChange: e => setFilter(e.currentTarget.value), value: filter, children: SEARCH_FILTERS.map(([v, label]) => jsx('option', { value: v, children: label }, v)) }),
      jsx('input', { 'aria-label': 'Search YouTube or paste a video URL', className: cn('min-w-0 flex-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1.5 text-xs text-(--ui-text-primary) outline-none', 'placeholder:text-(--ui-text-quaternary) focus:border-(--ui-accent)'), onChange: e => setDraft(e.currentTarget.value), placeholder: 'Search YouTube or paste URL…', value: draft }),
      jsx('button', { className: 'rounded-md bg-(--ui-accent) px-2.5 py-1.5 text-xs font-medium text-(--ui-accent-contrast) hover:brightness-110', type: 'submit', children: status === 'Searching YouTube…' ? 'Searching…' : 'Search' })
    ] }),
    results.length ? jsx('div', { className: 'max-h-[30vh] min-h-0 shrink-0 overflow-auto border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1', children: results.map((result, index) => jsxs('button', { className: cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)', result.id === videoId ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'), onClick: () => play(result, index), title: result.title, type: 'button', children: [jsx('img', { alt: '', className: 'h-11 w-20 shrink-0 rounded object-cover bg-black', src: result.thumb || 'https://i.ytimg.com/vi/' + result.id + '/mqdefault.jpg' }), jsx('span', { className: 'min-w-0 flex-1 truncate', children: result.title }), result.duration ? jsx('span', { className: 'shrink-0 text-[10px] text-(--ui-text-tertiary)', children: result.duration }) : null, result.id === videoId ? jsx('span', { className: 'shrink-0 text-[10px]', children: 'Playing' }) : null] }, result.id)) }) : jsx('div', { className: 'min-h-0 flex-1 border-t border-white/10 px-2 py-2 text-[11px] text-(--ui-text-quaternary)', children: status === 'Searching YouTube…' ? 'Searching… results will appear here.' : status })
  ] })
}

export default { id: 'youtube-float', name: 'YouTube Float', description: 'Floating YouTube player pane showing a native full-size <video> injected into the YouTube session webview.', register(ctx) { ctx.register({ id: 'player', area: 'panes', title: 'YouTube v20', data: { placement: 'floating', anchor: 'top-right', width: PLAYER_SIZES.large.width, height: PLAYER_SIZES.large.height }, render: () => jsx(YouTubeFloat, {}) }) } }
