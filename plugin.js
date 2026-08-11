import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v31-quality-captions-real'
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
  return videoId ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1' : 'about:blank'
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

const stripScript = '(' + function () {
  const css = `
    html,body,ytd-app,#content,#page-manager,ytd-watch-flexy{background:#000!important;margin:0!important;padding:0!important;overflow:hidden!important}
    ytd-masthead,#masthead-container,tp-yt-app-header,#header,#country-code,#secondary,#comments,#related,#chat,ytd-merch-shelf-renderer{display:none!important}
    ytd-watch-flexy #columns,ytd-watch-flexy #primary,ytd-watch-flexy #primary-inner{margin:0!important;padding:0!important;width:100vw!important;max-width:none!important}
    #movie_player,.html5-video-player,.html5-video-container{width:100vw!important;height:100vh!important;max-height:100vh!important;min-width:0!important}
    html,body,ytd-app{pointer-events:none!important;user-select:none!important}
  `
  let st = document.getElementById('hermes-yt-strip')
  if (!st) { st = document.createElement('style'); st.id = 'hermes-yt-strip'; document.documentElement.appendChild(st) }
  st.textContent = css
  // Hide ALL in-player chrome/overlays EXCEPT the video frames, re-applied on every DOM change.
  // (More robust than naming classes: whatever overlay YouTube injects is killed on arrival.)
  if (!window.__hermesSniper) {
    window.__hermesSniper = true
    const snipe = () => {
      const vid = document.querySelector('video')
      document.querySelectorAll('body *').forEach(el => {
        if (el.classList && (el.classList.contains('ytp-caption-window') || el.classList.contains('ytp-caption-window-container'))) return
        if (!vid) { try { el.style.setProperty('visibility', 'hidden', 'important') } catch (e) {}; return }
        const inPath = el === vid || (vid.contains && vid.contains(el)) || (el.contains && el.contains(vid))
        if (inPath) return
        try { el.style.setProperty('visibility', 'hidden', 'important') } catch (e) {}
      })
      let a = vid, n = 0
      while (a && n < 40) { try { a.style.setProperty('visibility', 'visible', 'important') } catch (e) {}; a = a.parentElement; n++ }
    }
    snipe()
    new MutationObserver(snipe).observe(document.documentElement, { childList: true, subtree: true })
    setInterval(snipe, 800)
  }
  return { ok: true }
}.toString() + ')()'

function driveScript(action, value) {
  return '(' + function (payload) {
    const p = document.getElementById('movie_player')
    const v = document.querySelector('video')
    if (payload.action === 'loop' && v) v.loop = Boolean(payload.value)
    const pausedOf = () => {
      if (p && typeof p.getPlayerState === 'function') return p.getPlayerState() === 2
      if (p && typeof p.isPaused === 'function') return p.isPaused()
      return v ? v.paused : true
    }
    if (p && typeof p.getCurrentTime === 'function') {
      if (payload.action === 'playPause') { pausedOf() ? p.playVideo() : p.pauseVideo() }
      else if (payload.action === 'seek') p.seekTo(Number(payload.value), true)
      else if (payload.action === 'rewind') p.seekTo(p.getCurrentTime() - 10, true)
      else if (payload.action === 'forward') p.seekTo(p.getCurrentTime() + 10, true)
      else if (payload.action === 'quality' && payload.value !== 'auto') {
        try { p.setPlaybackQualityRange(payload.value, payload.value); p.setPlaybackQuality(payload.value) } catch (e) { try { p.setPlaybackQuality(payload.value) } catch (e2) {} }
      }
      else if (payload.action === 'quality' && payload.value === 'auto') {
        try { p.setPlaybackQualityRange('auto'); p.setPlaybackQuality('auto') } catch (e) {}
      }
      else if (payload.action === 'caption') {
        for (const tr of (v && v.textTracks ? v.textTracks : [])) tr.mode = payload.value && (tr.language === payload.value || tr.label === payload.value) ? 'showing' : 'disabled'
        try {
          if (payload.value === 'off') { p.setOption('captions', 'track', {}); p.setOption('captions', 'reload', true) }
          else {
            const tl = (p.getOption('captions', 'tracklist') || {}).tracks || []
            const t = tl.find(x => x.languageCode === payload.value || x.displayName === payload.value)
            if (t) { p.setOption('captions', 'track', { languageCode: t.languageCode }); p.setOption('captions', 'reload', true) }
          }
        } catch (e) {}
      }
      return { ok: true, current: p.getCurrentTime() || 0, duration: p.getDuration() || 0, paused: pausedOf() }
    }
    if (v) {
      if (payload.action === 'playPause') v.paused ? v.play() : v.pause()
      else if (payload.action === 'seek') v.currentTime = Math.max(0, Math.min(v.duration || payload.value, Number(payload.value) || 0))
      else if (payload.action === 'rewind') v.currentTime = Math.max(0, v.currentTime - 10)
      else if (payload.action === 'forward') v.currentTime = Math.min(v.duration || v.currentTime + 10, v.currentTime + 10)
      else if (payload.action === 'caption') { for (const t of v.textTracks || []) t.mode = payload.value && (t.language === payload.value || t.label === payload.value) ? 'showing' : 'disabled' }
      return { ok: true, current: v.currentTime, duration: v.duration || 0, paused: v.paused }
    }
    return { ok: false }
  }.toString() + ')(' + JSON.stringify({ action, value }) + ')'
}

const readPlayerScript = '(' + function () {
  const p = document.getElementById('movie_player')
  const v = document.querySelector('video')
  let levels = []
  try { levels = (p && typeof p.getAvailableQualityLevels === 'function' && p.getAvailableQualityLevels()) || [] } catch (e) {}
  const seen = new Set()
  const tracks = []
  for (const t of ((v && v.textTracks) || [])) {
    const lang = t.language || ''; const label = t.label || t.language
    if (!label || seen.has(label)) continue
    seen.add(label)
    tracks.push({ lang, label })
  }
  return { levels, tracks }
}.toString() + ')()'

const readCaptionsScript = '(' + function () {
  try {
    let pr = window.ytInitialPlayerResponse
    if (!pr) {
      const t = Array.from(document.scripts).map(s => s.textContent).find(x => x && x.indexOf('ytInitialPlayerResponse') !== -1)
      const m = t && t.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s)
      if (m) { try { pr = JSON.parse(m[1]) } catch (e) {} }
    }
    const caps = ((pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks) || [])
      .map(t => ({ lang: t.languageCode || '', label: (t.name && t.name.simpleText) || t.languageCode || '', url: t.baseUrl || '' }))
      .filter(c => c.label)
    const seen = new Set()
    const out = []
    for (const c of caps) { if (!seen.has(c.lang)) { seen.add(c.lang); out.push(c) } }
    return { ok: true, tracks: out }
  } catch (e) { return { ok: false, tracks: [] } }
}.toString() + ')()'

function captionApplyScript(capUrl, lang) {
  return '(' + function (u, l) {
    const video = document.querySelector('video')
    if (!video) return false
    for (const tr of video.textTracks || []) tr.mode = 'disabled'
    if (!u) return true
    const vttUrl = u.indexOf('fmt=') !== -1 ? u.replace(/fmt=\w+/, 'fmt=vtt') : u + '&fmt=vtt'
    fetch(vttUrl).then(r => r.text()).then(vtt => {
      const blob = new Blob([vtt], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      let tr = Array.from(video.children || []).find(c => c && c.tagName === 'TRACK')
      if (!tr) { tr = document.createElement('track'); tr.kind = 'subtitles'; tr.srclang = l || 'en'; video.appendChild(tr) }
      tr.src = url
      tr.mode = 'showing'
    }).catch(() => undefined)
    return true
  }.toString() + ')(' + JSON.stringify(capUrl || '') + ',' + JSON.stringify(lang || 'en') + ')'
}

const stateScript = '(' + function () {
  const p = document.getElementById('movie_player')
  const v = document.querySelector('video')
  if (p && typeof p.getCurrentTime === 'function') {
    return { ok: true, current: p.getCurrentTime() || 0, duration: p.getDuration() || 0, paused: p.isPaused ? p.isPaused() : (v ? v.paused : true) }
  }
  return { ok: true, current: (v && v.currentTime) || 0, duration: (v && v.duration) || 0, paused: v ? v.paused : true }
}.toString() + ')()'

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

  // Player loads the watch page; we strip chrome, default captions off, and read the subtitle list.
  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined
    const ready = async () => {
      try {
        await webview.executeJavaScript(stripScript, true)
        await webview.executeJavaScript(driveScript('caption', 'off'), true)
        const r = await webview.executeJavaScript(readPlayerScript, true)
        if (r) {
          if (Array.isArray(r.levels) && r.levels.length) setQualities(['auto', ...r.levels])
          if (Array.isArray(r.tracks) && r.tracks.length) setCaptions(r.tracks)
        }
        try {
          const c = await webview.executeJavaScript(readCaptionsScript, true)
          if (c && c.ok && Array.isArray(c.tracks) && c.tracks.length) setCaptions(c.tracks)
        } catch {}
      } catch {}
    }
    webview.addEventListener('dom-ready', ready)
    return () => webview.removeEventListener('dom-ready', ready)
  }, [videoId])

  // Poll progress from YouTube's own player.
  useEffect(() => {
    if (!videoId) return undefined
    const timer = window.setInterval(async () => {
      try { const r = await playerRef.current?.executeJavaScript(stateScript, true); if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused }) } catch {}
    }, 500)
    return () => window.clearInterval(timer)
  }, [videoId])

  const runCommand = async (action, value) => {
    try {
      if (action === 'caption') {
        const cap = captions.find(c => c.lang === value || c.label === value)
        await playerRef.current?.executeJavaScript(captionApplyScript(value === 'off' ? '' : (cap && cap.url), value === 'off' ? '' : (cap && cap.lang)), true)
        return
      }
      const r = await playerRef.current?.executeJavaScript(driveScript(action, value), true)
      if (r && r.ok) setProgress({ current: r.current, duration: r.duration, paused: r.paused })
    } catch {}
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
        ? jsx('webview', { key: videoId, className: 'pointer-events-none absolute inset-0 h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: watchUrl(videoId) })
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

export default { id: 'youtube-float', name: 'YouTube Float', description: 'Floating YouTube player pane showing a native full-size <video> injected into the YouTube session webview.', register(ctx) { ctx.register({ id: 'player', area: 'panes', title: 'YouTube v31', data: { placement: 'floating', anchor: 'top-right', width: PLAYER_SIZES.large.width, height: PLAYER_SIZES.large.height }, render: () => jsx(YouTubeFloat, {}) }) } }
