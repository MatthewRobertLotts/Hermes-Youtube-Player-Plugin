import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v10-no-autoplay-search'
const DEFAULT_QUERY = 'king boomer'
const SEARCH_FILTERS = [
  ['videos', 'Videos'],
  ['shorts', 'Shorts'],
  ['playlists', 'Playlists']
]
const QUALITY_LABELS = { auto: 'Auto', tiny: '144p', small: '240p', medium: '360p', large: '480p', hd720: '720p', hd1080: '1080p', hd1440: '1440p', hd2160: '4K' }
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

function playerSrc(videoId) {
  // ponytail: embeds are blocked by YouTube in Electron; use watch page, then strip chrome in-page.
  return videoId ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1' : 'about:blank'
}

function searchSrc(query, filter) {
  const suffix = filter === 'shorts' ? ' shorts' : filter === 'playlists' ? ' playlist' : ''
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + suffix)
}

const focusPlayerScript = '(' + function () {
  const css = `
    html, body, ytd-app, #content, #page-manager, ytd-watch-flexy { background:#000!important; margin:0!important; padding:0!important; overflow:hidden!important; min-width:0!important; }
    ytd-masthead, #masthead-container, #secondary, #comments, #meta, #info, #below, #chat, ytd-merch-shelf-renderer, ytd-engagement-panel-section-list-renderer, .ytp-chrome-top { display:none!important; }
    ytd-watch-flexy #columns, ytd-watch-flexy #primary, ytd-watch-flexy #primary-inner { margin:0!important; padding:0!important; width:100vw!important; max-width:none!important; }
    #player, #player-container-outer, #player-container-inner, #player-container, #movie_player, .html5-video-player, .html5-video-container { position:fixed!important; left:0!important; top:0!important; right:0!important; bottom:0!important; width:100vw!important; height:100vh!important; max-height:none!important; min-width:0!important; transform:none!important; z-index:2147483647!important; background:#000!important; }
    video { position:fixed!important; left:0!important; top:0!important; width:100vw!important; height:100vh!important; object-fit:contain!important; background:#000!important; transform:none!important; }
    .ytp-chrome-bottom, .ytp-gradient-bottom, .ytp-pause-overlay, .ytp-ce-element { opacity:0!important; pointer-events:none!important; }
  `
  let style = document.getElementById('hermes-youtube-float-style')
  if (!style) {
    style = document.createElement('style')
    style.id = 'hermes-youtube-float-style'
    document.documentElement.appendChild(style)
  }
  style.textContent = css
  const video = document.querySelector('video')
  if (video) {
    video.controls = false
    video.play().catch(() => undefined)
  }
  const player = document.getElementById('movie_player')
  const levels = player?.getAvailableQualityLevels?.() || []
  const captions = [...(video?.textTracks || [])].map((track, i) => ({ id: track.language || String(i), label: track.label || track.language || `Track ${i + 1}` }))
  return { captions, current: video?.currentTime || 0, duration: video?.duration || 0, levels, paused: video?.paused ?? true }
}.toString() + ')()'

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

function commandScript(action, value) {
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
      try { player?.setOption?.('captions', 'track', payload.value ? { languageCode: payload.value } : {}) } catch {}
    }
    const captions = [...(video.textTracks || [])].map((track, i) => ({ id: track.language || track.label || String(i), label: track.label || track.language || `Track ${i + 1}` }))
    return { captions, current: video.currentTime, duration: video.duration || 0, levels: player?.getAvailableQualityLevels?.() || [], loop: video.loop, ok: true, paused: video.paused }
  }.toString() + ')(' + JSON.stringify({ action, value }) + ')'
}

function YouTubeFloat() {
  const [draft, setDraft] = useState(DEFAULT_QUERY)
  const [filter, setFilter] = useState('videos')
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
  const searchRef = useRef(null)
  const playerRef = useRef(null)
  const watchSrc = useMemo(() => playerSrc(videoId), [videoId])

  const syncState = result => {
    if (!result) return
    if (Array.isArray(result.levels) && result.levels.length) setQualities(['auto', ...result.levels])
    if (Array.isArray(result.captions)) setCaptions(result.captions)
    setProgress({ current: result.current || 0, duration: result.duration || 0, paused: Boolean(result.paused) })
  }
  const runPlayer = async (action, value) => {
    try { syncState(await playerRef.current?.executeJavaScript(commandScript(action, value), true)) } catch {}
  }
  const play = (result, index = results.findIndex(r => r.id === result.id)) => { setVideoId(result.id); setCurrentIndex(index); setStatus(result.title) }

  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined
    const ready = async () => {
      try {
        syncState(await webview.executeJavaScript(focusPlayerScript, true))
        await webview.executeJavaScript(commandScript('loop', loop), true)
        if (quality !== 'auto') await webview.executeJavaScript(commandScript('quality', quality), true)
        if (caption !== 'off') await webview.executeJavaScript(commandScript('caption', caption), true)
      } catch { setStatus('Loaded, but controls could not attach') }
    }
    webview.addEventListener('dom-ready', ready)
    const timer = window.setInterval(() => void runPlayer('state'), 1000)
    return () => { webview.removeEventListener('dom-ready', ready); window.clearInterval(timer) }
  }, [videoId, loop, quality, caption])

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
    webview.addEventListener('dom-ready', done, { once: true })
    return () => { cancelled = true; webview.removeEventListener('dom-ready', done) }
  }, [searchUrl])

  const submit = event => {
    event.preventDefault()
    const next = draft.trim()
    if (!next) return
    const exact = videoIdFrom(next)
    if (exact) { setResults([]); play({ id: exact, title: next }, -1); return }
    setStatus('Searching YouTube…')
    setSearchUrl(searchSrc(next, filter))
  }
  const playOffset = delta => { const next = results[currentIndex + delta]; if (next) play(next, currentIndex + delta) }
  const pill = active => cn('rounded-full border px-2.5 py-1 text-xs transition', active ? 'border-(--ui-accent) bg-(--ui-accent) text-(--ui-accent-contrast)' : 'border-(--ui-border-muted) text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)')

  return jsxs('div', { className: 'relative flex h-full min-h-0 flex-col bg-black/20', children: [
    jsx('div', { className: 'shrink-0 bg-black', style: { height: 'min(52vh, 58vw)', minHeight: 220 }, children: videoId ? jsx('webview', { allowpopups: 'true', className: 'block h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: watchSrc }) : jsx('div', { className: 'grid h-full place-items-center bg-black text-xs text-white/60', children: `${VERSION}: ${status}` }) }),
    searchUrl ? jsx('webview', { className: 'pointer-events-none absolute h-px w-px opacity-0', partition: 'persist:hermes-youtube-float-search', ref: searchRef, src: searchUrl }) : null,
    jsxs('div', { className: 'shrink-0 border-t border-white/10 bg-(--ui-bg-elevated)/95 px-3 py-2', children: [
      jsxs('div', { className: 'mb-1 flex items-center gap-2 text-[11px] text-(--ui-text-tertiary)', children: [jsx('span', { children: fmt(progress.current) }), jsx('input', { className: 'h-1 flex-1 accent-(--ui-accent)', max: progress.duration || 0, min: 0, onChange: e => { const v = Number(e.currentTarget.value); setProgress({ ...progress, current: v }); void runPlayer('seek', v) }, type: 'range', value: Math.min(progress.current, progress.duration || progress.current) }), jsx('span', { children: fmt(progress.duration) })] }),
      jsxs('div', { className: 'flex flex-wrap items-center justify-center gap-1.5', children: [
        jsx('button', { className: pill(false), onClick: () => playOffset(-1), type: 'button', children: '⏮' }),
        jsx('button', { className: pill(!progress.paused), onClick: () => runPlayer('playPause'), type: 'button', children: progress.paused ? '▶ Play' : '⏸ Pause' }),
        jsx('button', { className: pill(false), onClick: () => playOffset(1), type: 'button', children: '⏭' }),
        jsx('button', { className: pill(loop), onClick: () => { const next = !loop; setLoop(next); void runPlayer('loop', next) }, type: 'button', children: loop ? 'Loop ✓' : 'Loop' }),
        jsx('button', { className: pill(false), onClick: () => runPlayer('rewind'), type: 'button', children: '-10s' }),
        jsx('button', { className: pill(false), onClick: () => runPlayer('forward'), type: 'button', children: '+10s' }),
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs', onChange: e => { setQuality(e.currentTarget.value); void runPlayer('quality', e.currentTarget.value) }, value: quality, children: qualities.map(q => jsx('option', { value: q, children: QUALITY_LABELS[q] || q }, q)) }),
        jsx('select', { className: 'rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1 text-xs', onChange: e => { setCaption(e.currentTarget.value); void runPlayer('caption', e.currentTarget.value === 'off' ? '' : e.currentTarget.value) }, value: caption, children: [jsx('option', { value: 'off', children: 'Subs off' }, 'off'), ...captions.map(c => jsx('option', { value: c.id, children: c.label }, c.id))] })
      ] })
    ] }),
    jsxs('form', { className: 'flex shrink-0 gap-1.5 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-2', onSubmit: submit, children: [
      jsx('select', { className: 'rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 text-xs', onChange: e => setFilter(e.currentTarget.value), value: filter, children: SEARCH_FILTERS.map(([v, label]) => jsx('option', { value: v, children: label }, v)) }),
      jsx('input', { 'aria-label': 'Search YouTube or paste a video URL', className: cn('min-w-0 flex-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1.5 text-xs text-(--ui-text-primary) outline-none', 'placeholder:text-(--ui-text-quaternary) focus:border-(--ui-accent)'), onChange: e => setDraft(e.currentTarget.value), placeholder: 'Search YouTube or paste URL…', value: draft }),
      jsx('button', { className: 'rounded-md bg-(--ui-accent) px-2.5 py-1.5 text-xs font-medium text-(--ui-accent-contrast) hover:brightness-110', type: 'submit', children: 'Search' })
    ] }),
    results.length ? jsx('div', { className: 'min-h-0 flex-1 overflow-auto border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1', children: results.map((result, index) => jsxs('button', { className: cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)', result.id === videoId ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'), onClick: () => play(result, index), title: result.title, type: 'button', children: [jsx('img', { alt: '', className: 'h-11 w-20 shrink-0 rounded object-cover bg-black', src: result.thumb || 'https://i.ytimg.com/vi/' + result.id + '/mqdefault.jpg' }), jsx('span', { className: 'min-w-0 flex-1 truncate', children: result.title }), result.duration ? jsx('span', { className: 'shrink-0 text-[10px] text-(--ui-text-tertiary)', children: result.duration }) : null, result.id === videoId ? jsx('span', { className: 'shrink-0 text-[10px]', children: 'Playing' }) : null] }, result.id)) }) : jsx('div', { className: 'shrink-0 truncate border-t border-white/10 px-2 py-1 text-[11px] text-(--ui-text-quaternary)', children: `${VERSION}: ${status}` })
  ] })
}

export default { id: 'youtube-float', name: 'YouTube Float', description: 'Floating YouTube player pane with native-ish controls over a stripped YouTube watch page.', register(ctx) { ctx.register({ id: 'player', area: 'panes', title: 'YouTube v10', data: { placement: 'floating', anchor: 'top-right', width: '760px', height: '720px' }, render: () => jsx(YouTubeFloat, {}) }) } }
