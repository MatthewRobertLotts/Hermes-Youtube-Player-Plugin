import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v3.10-feedpagediag'
const DEFAULT_QUERY = 'king boomer'
const SEARCH_FILTERS = [
  ['videos', 'Videos'],
  ['shorts', 'Shorts'],
  ['playlists', 'Playlists'],
  ['history', 'History'],
  ['subscriptions', 'Subscriptions'],
  ['watchlater', 'Watch Later']
]
const HISTORY_KEY = 'hermes-yt-history'
const HISTORY_MAX = 50
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

// Module-scope so it keeps a stable type: re-renders only touch THIS subtree, never the
// dropdown controls (native select popups get killed by unrelated DOM churn in Electron).
function Timeline({ current, duration, onSeek, videoId }) {
  return jsxs('div', { className: 'mb-1 flex min-w-0 flex-1 items-center gap-2 text-[11px] text-(--ui-text-tertiary)', children: [
    jsx('span', { className: 'shrink-0 tabular-nums', children: fmt(current) }),
    jsx('input', { className: 'h-2 min-w-0 flex-1 accent-(--ui-accent)', disabled: !videoId, max: duration || 0, min: 0, onChange: e => onSeek(Number(e.currentTarget.value)), onPointerUp: e => e.currentTarget.blur(), type: 'range', value: Math.min(current, duration || current) }),
    jsx('span', { className: 'shrink-0 tabular-nums', children: fmt(duration) })
  ] })
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

function watchUrl(videoId, playlistId) {
  if (!videoId) return 'about:blank'
  if (/^(PL|RD|OLAK5uy|UU|FL|LL|WL)/.test(videoId)) return 'https://www.youtube.com/playlist?list=' + encodeURIComponent(videoId) + '&autoplay=1'
  const base = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1'
  return playlistId ? base + '&list=' + encodeURIComponent(playlistId) : base
}
const SP_FILTERS = { shorts: 'EgIQCQ%253D%253D', playlists: 'EgIQAw%253D%253D' }
// Signed-in feeds (only meaningful when the player partition is logged in).
const ACCOUNT_FEEDS = {
  subscriptions: 'https://www.youtube.com/feed/subscriptions',
  watchlater: 'https://www.youtube.com/playlist?list=WL',
  history: 'https://www.youtube.com/feed/history'
}
function searchSrc(query, filter) {
  const sp = SP_FILTERS[filter]
  if (ACCOUNT_FEEDS[filter]) return ACCOUNT_FEEDS[filter] + '?persist_ts=' + Date.now()
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + (sp ? '&sp=' + sp : '')
}
const probeLoginScript = '(' + function () {
  // The signed-in state shows an avatar button (#avatar-btn) in the masthead; signed-out shows
  // a "Sign in" button instead. Check the persistent player/session webview.
  const avatar = document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn, button[aria-label*="account"]')
  const signIn = Array.from(document.querySelectorAll('a,button')).some(el => /sign\s*in/i.test(el.textContent || '') && el.offsetParent !== null)
  return { signedIn: !!avatar || !signIn, name: (avatar && (avatar.getAttribute('aria-label') || '')) || '' }
}.toString() + ')()'

const scrapeSearchScript = '(' + function () {
  const out = []
  const seen = new Set()
  const keyCount = {}
  const push = (id, title, thumb, duration, type, list) => {
    if (!id || seen.has(id) || !title || /now playing/i.test(title)) return
    seen.add(id)
    out.push({ duration, id, list: list || null, title, thumb, type })
  }
  const txt = x => (x && (x.simpleText || ((x.runs || [{ text: '' }]).map(r => r.text).join('')))) || ''
  const firstThumb = obj => { if (!obj) return ''; try { const m = JSON.stringify(obj).match(/"url":"(https:[^"]{10,})"/); return m ? m[1] : '' } catch (e) { return '' } }
  const badge = obj => { if (!obj) return ''; try { const m = JSON.stringify(obj).match(/"text":"([^"]{1,24}?(?:videos?|episodes?))"/i); return m ? m[1] : '' } catch (e) { return '' } }
  const walk = o => {
    if (out.length >= 14 || !o) return
    if (Array.isArray(o)) { for (const x of o) walk(x); return }
    if (typeof o !== 'object') return
    if (o.constructor && o.constructor.name === 'Object') {
      for (const k in o) { if (/Renderer|ViewModel$/.test(k) && typeof o[k] === 'object') keyCount[k] = (keyCount[k] || 0) + 1 }
    }
    const vr = o.videoRenderer
    if (vr && vr.videoId) {
      const url = (vr.navigationEndpoint && vr.navigationEndpoint.commandMetadata && vr.navigationEndpoint.commandMetadata.webCommandMetadata && vr.navigationEndpoint.commandMetadata.webCommandMetadata.url) || ''
      const list = url.indexOf('list=') !== -1 ? ((url.match(/list=([^&]+)/) || [])[1] || null) : null
      const img = vr.thumbnail && vr.thumbnail.thumbnails
      push(vr.videoId, txt(vr.title).replace(/\s+/g, ' ').trim(), img && img[img.length - 1] ? img[img.length - 1].url : '', txt(vr.lengthText).trim(), url.indexOf('/shorts/') !== -1 ? 'short' : 'video', list)
    }
    const rr = o.reelItemRenderer
    if (rr && rr.videoId) push(rr.videoId, txt(rr.headline).replace(/\s+/g, ' ').trim(), '', '', 'short', null)
    // Watch Later / playlist-view pages carry items as playlistVideoRenderer (not videoRenderer).
    const pvr = o.playlistVideoRenderer
    if (pvr && pvr.videoId) {
      const img = pvr.thumbnail && pvr.thumbnail.thumbnails
      push(pvr.videoId, txt(pvr.title).replace(/\s+/g, ' ').trim(), img && img[img.length - 1] ? img[img.length - 1].url : '', txt(pvr.lengthText).trim(), 'video', null)
    }
    const slv = o.shortsLockupViewModel
    if (slv && slv.videoId) {
      let t = String(slv.accessibilityText || '')
      t = t.replace(/,?\s*\d[\d,.]*\s*(million|billion|k)?\s*views\s*[–-]\s*play\s*short$/i, '').replace(/\s*[–-]\s*play\s*short$/i, '').replace(/\s+/g, ' ').trim()
      const img = slv.thumbnail && slv.thumbnail.thumbnails
      push(slv.videoId, t, img && img[0] ? img[0].url : '', '', 'short', null)
    }
    const lv = o.lockupViewModel
    if (lv && lv.contentId) {
      const ct = lv.contentType || ''
      let title = ''
      try { title = lv.metadata.lockupMetadataViewModel.title.content || '' } catch (e) {}
      const thumb = firstThumb(lv.contentImage)
      const id = lv.contentId
      // Types vary (PLAYLIST, PODCAST, sometimes both) — the id prefix is the reliable playlist
      // signal; contentType alone can't be trusted.
      if (/^(PL|RD|OLAK5uy|UU|FL|LL|WL)/.test(id)) push(id, String(title).replace(/\s+/g, ' ').trim(), thumb, badge(lv.contentImage), 'playlist', id)
      else if (ct.indexOf('SHORT') !== -1) push(id, String(title).replace(/\s+/g, ' ').trim(), thumb, '', 'short', null)
      else {
        let dur = ''
        try { const ov = lv.contentImage.thumbnailViewModel.overlays; dur = (ov || []).map(x => x.thumbnailBottomOverlayViewModel && x.thumbnailBottomOverlayViewModel.badges && x.thumbnailBottomOverlayViewModel.badges[0] && x.thumbnailBottomOverlayViewModel.badges[0].thumbnailBadgeViewModel && x.thumbnailBottomOverlayViewModel.badges[0].thumbnailBadgeViewModel.text || '').find(Boolean) || '' } catch (e) {}
        push(id, String(title).replace(/\s+/g, ' ').trim(), thumb, String(dur).trim(), 'video', null)
      }
    }
    const pr = o.playlistRenderer
    if (pr && pr.playlistId) {
      let first = ''
      try { first = (pr.navigationEndpoint && pr.navigationEndpoint.watchEndpoint && pr.navigationEndpoint.watchEndpoint.videoId) || '' } catch (e) {}
      push(first || pr.playlistId, txt(pr.title).replace(/\s+/g, ' ').trim(), '', '', 'playlist', pr.playlistId)
    }
    // History/feed items are often wrapped in richItemRenderer with the video nested in .content
    // under a wrapper key; unwrap to the inner object so the specific renderers above can catch it.
    const ri = o.richItemRenderer && o.richItemRenderer.content
    if (ri) { for (const key in ri) { const inner = ri[key]; if (inner && typeof inner === 'object' && !inner.videoId) walk(inner) } }
    for (const k in o) walk(o[k])
  }
  try { walk(window.ytInitialData) } catch (e) {}
  return { items: out, renderers: keyCount, page: { title: document.title || '', url: location.href || '', hasData: !!window.ytInitialData, bodyLen: (document.body ? document.body.innerHTML.length : 0), ytLen: window.ytInitialData ? JSON.stringify(window.ytInitialData).length : 0 } }
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
      if (vid && !vid.__hermesEnded) { vid.__hermesEnded = 1; vid.addEventListener('ended', () => { window.__hermesEnded = Date.now() }) }
      document.querySelectorAll('body *').forEach(el => {
        if (el.classList && (el.classList.contains('ytp-caption-window') || el.classList.contains('ytp-caption-window-container') || Array.from(el.classList).some(c => c.indexOf('caption') !== -1))) return
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
    if (payload.action === 'volume') {
      const vol = Math.max(0, Math.min(1, Number(payload.value) || 0))
      if (v) { v.volume = vol; v.muted = vol === 0 }
      try { if (p && typeof p.setVolume === 'function') p.setVolume(vol * 100) } catch (e) {}
    }
    if (payload.action === 'loop') {
      // off | once | inf
      if (window.__hermesLoopOnce && v) { try { v.removeEventListener('ended', window.__hermesLoopOnce) } catch (e) {} }
      if (v) v.loop = payload.value === 'inf'
      try { if (typeof p.setLoop === 'function') p.setLoop(payload.value === 'inf') } catch (e) {}
      if (payload.value === 'once') {
        const h = () => { const vv = document.querySelector('video'); if (!vv) return; vv.removeEventListener('ended', h); vv.currentTime = 0; vv.play().catch(() => undefined) }
        window.__hermesLoopOnce = h
        const vv = document.querySelector('video')
        if (vv) vv.addEventListener('ended', h)
      }
    }
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
        const wantOn = payload.value !== 'off'
        // Primary: click YouTube's own CC toggle (this is how userscripts turn captions on).
        try {
          const cc = p.querySelector('.ytp-subtitles-button')
          if (cc) {
            const on = cc.getAttribute('aria-pressed') === 'true'
            if (wantOn && !on) cc.click()
            else if (!wantOn && on) cc.click()
          }
        } catch (e) {}
        // Secondary: drive the captions API (loadModule + full track entry + reload).
        try {
          if (typeof p.loadModule === 'function') { try { p.loadModule('captions') } catch (e) {} }
          const tl = (p.getOption('captions', 'tracklist') || {}).tracks || []
          if (!wantOn) { p.setOption('captions', 'track', {}) }
          else {
            const t = tl.find(x => x.languageCode === payload.value || x.displayName === payload.value)
            if (t) p.setOption('captions', 'track', t)
          }
          p.setOption('captions', 'reload', true)
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
      const show = () => { tr.mode = 'showing' }
      if (tr.readyState >= 2) show()
      else tr.addEventListener('load', show, { once: true })
      window.setTimeout(show, 350)
    }).catch(() => undefined)
    return true
  }.toString() + ')(' + JSON.stringify(capUrl || '') + ',' + JSON.stringify(lang || 'en') + ')'
}

const stateScript = '(' + function () {
  const v = document.querySelector('video')
  // Self-healing ended marker: attach the listener here every tick so a too-fast page
  // (or a replaced <video> element) can never leave us deaf to playback end.
  if (v && !v.__hermesEnded) { v.__hermesEnded = 1; v.addEventListener('ended', () => { window.__hermesEnded = Date.now() }) }
  const raw = window.__hermesEnded || 0
  if (raw && Date.now() - raw > 15000) window.__hermesEnded = 0
  const flag = raw ? window.__hermesEnded : 0
  if (flag) window.__hermesEnded = 0
  const p = document.getElementById('movie_player')
  const ended = v ? v.ended : false
  let vid = ''
  try { vid = (p && typeof p.getVideoData === 'function' && p.getVideoData().video_id) || '' } catch (e) {}
  if (!vid) { const m = location.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || location.pathname.match(/\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/); vid = m ? m[1] : '' }
  if (p && typeof p.getCurrentTime === 'function') {
    return { ok: true, current: p.getCurrentTime() || 0, duration: p.getDuration() || 0, paused: p.isPaused ? p.isPaused() : (v ? v.paused : true), ended, endedFlag: flag, videoId: vid }
  }
  return { ok: true, current: (v && v.currentTime) || 0, duration: (v && v.duration) || 0, paused: v ? v.paused : true, ended, endedFlag: flag, videoId: vid }
}.toString() + ')()'

const playlistFillScript = '(' + function () {
  const out = []
  const seen = new Set()
  // Watch pages carry the list in the "Up next" playlist panel; raw /playlist pages carry it as
  // video lockups. Use whichever page we're on — never mix in recommended-video lockups.
  const onWatch = location.href.indexOf('/watch') !== -1
  const push = (id, title, duration, thumb) => {
    if (!id || seen.has(id) || !title) return
    seen.add(id)
    out.push({ duration, id, thumb, title })
  }
  const txt = x => (x && (x.simpleText || ((x.runs || [{ text: '' }]).map(r => r.text).join('')))) || ''
  const walk = o => {
    if (out.length >= 120 || !o) return
    if (Array.isArray(o)) { for (const x of o) walk(x); return }
    if (typeof o !== 'object') return
    const pp = o.playlistPanelVideoRenderer
    if (pp && pp.videoId && pp.title && onWatch) {
      const th = pp.thumbnail && pp.thumbnail.thumbnails
      push(pp.videoId, txt(pp.title).replace(/\s+/g, ' ').trim(), txt(pp.lengthText).trim(), th && th[th.length - 1] ? th[th.length - 1].url : '')
    }
    const lv = o.lockupViewModel
    if (lv && lv.contentId && !onWatch && /^[a-zA-Z0-9_-]{11}$/.test(lv.contentId)) {
      let title = ''
      try { title = lv.metadata.lockupMetadataViewModel.title.content || '' } catch (e) {}
      push(lv.contentId, String(title).replace(/\s+/g, ' ').trim(), '', '')
    }
    for (const k in o) walk(o[k])
  }
  try { walk(window.ytInitialData) } catch (e) {}
  return out
}.toString() + ')()'

function YouTubeFloat() {
  const [draft, setDraft] = useState(DEFAULT_QUERY)
  const [filter, setFilter] = useState('videos')
  const [playerSize, setPlayerSize] = useState('large')
  const [videoId, setVideoId] = useState(null)
  const [playlist, setPlaylist] = useState(null)
  const [queueMode, setQueueMode] = useState('search')
  const [results, setResults] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [status, setStatus] = useState('Search for a video')
  const [searchUrl, setSearchUrl] = useState(null)
  const [loopMode, setLoopMode] = useState('off')
  const [quality, setQuality] = useState('auto')
  const [qualities, setQualities] = useState(['auto'])
  const [caption, setCaption] = useState('off')
  const captionRef = useRef('off')
  const [captions, setCaptions] = useState([])
  const [progress, setProgress] = useState({ current: 0, duration: 0, paused: true })
  const [volume, setVolume] = useState(1)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [loginPane, setLoginPane] = useState(false)
  const loginPaneRef = useRef(loginPane)
  loginPaneRef.current = loginPane
  const [signedIn, setSignedIn] = useState(false)
  const [accountName, setAccountName] = useState('')
  const signedInRef = useRef(signedIn)
  signedInRef.current = signedIn
  // Probe the persistent session webview for login state. Tries the player and search webviews
  // (either may be mounted depending on state).
  const probeLogin = async () => {
    for (const ref of [playerRef, searchRef]) {
      try {
        const r = await ref.current?.executeJavaScript(probeLoginScript, true)
        if (r && typeof r.signedIn === 'boolean') { setSignedIn(r.signedIn); setAccountName(r.name || ''); return }
      } catch (e) {}
    }
  }
  useEffect(() => {
    if (loginPane) {
      const t = window.setTimeout(probeLogin, 1600)
      return () => window.clearTimeout(t)
    }
    probeLogin()
    return undefined
  }, [loginPane, videoId])
  const [streams, setStreams] = useState([])
  const [native, setNative] = useState(false)
  const searchRef = useRef(null)
  const playerRef = useRef(null)
  const rootRef = useRef(null)
  const nativeRef = useRef(false)
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch (e) { return [] } })
  const historyRef = useRef(history)
  historyRef.current = history
  const remember = (result, index) => {
    if (!result || !result.id) return
    if (result.type === 'playlist' && /^(PL|RD|OLAK5uy|UU|FL|LL|WL)/.test(result.id)) return
    const entry = { id: result.id, title: result.title, thumb: result.thumb || '', duration: result.duration || '', type: result.type || 'video', at: Date.now() }
    const next = [entry, ...historyRef.current.filter(h => h.id !== entry.id)].slice(0, HISTORY_MAX)
    historyRef.current = next
    setHistory(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch (e) {}
  }
  const showHistory = () => {
    // Signed in: pull the account's real watch history feed (scraped via the shared session webview).
    if (signedIn) {
      setQueueMode('search')
      setStatus('Loading YouTube history…')
      setResults([])
      setSearchUrl(ACCOUNT_FEEDS.history + '&_=' + Date.now())
      return
    }
    setQueueMode('search')
    setSearchUrl(null)
    setResults(historyRef.current)
    setCurrentIndex(-1)
    setStatus(historyRef.current.length ? 'History (local) — pick a result' : 'No local history yet. Sign in to see your YouTube history.')
  }
  // Load an account feed (Subscriptions / Watch Later / History) without needing a search term.
  // Auto-probes login so the mode resolves correctly as soon as it's picked.
  const loadFeed = filter => {
    if (filter === 'history') { showHistory(); return }
    const label = (SEARCH_FILTERS.find(f => f[0] === filter) || [])[1] || filter
    if (!ACCOUNT_FEEDS[filter]) { setSearchUrl(null); return }
    if (!signedInRef.current) { setResults([]); setSearchUrl(null); setStatus('Sign in first (Account button) to use ' + label); return }
    setQueueMode('search')
    setResults([])
    setStatus('Loading ' + label + '…')
    setSearchUrl(ACCOUNT_FEEDS[filter] + '&_=' + Date.now())
  }

  useEffect(() => {
    const cfg = PLAYER_SIZES[playerSize] || PLAYER_SIZES.large
    const pane = rootRef.current?.closest?.('[data-floating-pane]')
    if (!pane) return
    pane.style.width = cfg.width
    pane.style.height = cfg.height
    window.dispatchEvent(new Event('resize'))
  }, [playerSize])

  const capture = (vid, list) => {
    setVideoId(vid)
    setPlaylist(list || null)
    setVolumeOpen(false)
    setNative(false)
    nativeRef.current = false
    setStreams([])
    setStatus('Loading…')
    driftGuardRef.current = Date.now() + 2000
    autostartRef.current = 0
  }

  // Player loads the watch page; we strip chrome, default captions off, and read the subtitle
  // list. In playlist mode the playlist's video list is scraped from this SAME page — its
  // "Up next" playlist panel carries the full list — so no separate hidden webview is needed.
  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined
    let retryTimer = null
    let failTimer = null
    const fillPlaylist = async () => {
      if (queueModeRef.current !== 'playlist' || resultsRef.current.length) return true
      let items = []
      try { items = await webview.executeJavaScript(playlistFillScript, true) } catch (e) { }
      if (queueModeRef.current !== 'playlist' || resultsRef.current.length) return true
      const clean = Array.isArray(items) ? items.filter(i => i.id && i.title) : []
      if (clean.length) {
        setResults(clean.map(i => ({ ...i, type: 'playlist' })))
        setCurrentIndex(0)
        setStatus('Playlist loaded: ' + clean.length + ' videos — autoplaying to the end')
        return true
      }
      return false
    }
    const ready = async () => {
      if (loginPaneRef.current) return
      try {
        await webview.executeJavaScript(stripScript, true)
        await webview.executeJavaScript(driveScript('caption', captionRef.current), true)
        const r = await webview.executeJavaScript(readPlayerScript, true)
        if (r) {
          if (Array.isArray(r.levels) && r.levels.length) setQualities(['auto', ...r.levels])
          if (Array.isArray(r.tracks) && r.tracks.length) setCaptions(r.tracks)
        }
        try {
          const c = await webview.executeJavaScript(readCaptionsScript, true)
          if (c && c.ok && Array.isArray(c.tracks) && c.tracks.length) setCaptions(c.tracks)
        } catch {}
        if (!(await fillPlaylist())) {
          retryTimer = window.setInterval(() => { void fillPlaylist().then(done => { if (done && retryTimer) { window.clearInterval(retryTimer); retryTimer = null } }) }, 1200)
          failTimer = window.setTimeout(() => {
            if (retryTimer) { window.clearInterval(retryTimer); retryTimer = null }
            if (queueModeRef.current === 'playlist' && !resultsRef.current.length) {
              webview.executeJavaScript('({ t: document.title })', true).then(d => {
                setStatus('Playlist: could not load' + (d && d.t ? ' ("' + String(d.t).slice(0, 40) + '")' : '') + ' — report this text')
              }).catch(() => setStatus('Playlist: could not load its videos (0 rows) — report this'))
            }
          }, 6000)
        }
      } catch {}
    }
    webview.addEventListener('dom-ready', ready)
    // Captions state settles after the player initializes; enforce the chosen state late so the
    // session's remembered caption preference doesn't leak in.
    const settle = window.setTimeout(() => { try { webview.executeJavaScript(driveScript('caption', captionRef.current), true) } catch {} }, 2500)
    return () => { webview.removeEventListener('dom-ready', ready); window.clearTimeout(settle); if (retryTimer) window.clearInterval(retryTimer); if (failTimer) window.clearTimeout(failTimer) }
  // loginPane in deps: leaving the account pane back to the locked player must re-arm the strip
  // handler even when videoId is unchanged (see lock-down-after-login bug).
  }, [videoId, loginPane])

  // Deterministic lock-down: when the account pane closes with a video loaded, re-apply the
  // chrome strip directly (don't wait on dom-ready timing — that raced after login before).
  const prevLoginRef = useRef(loginPane)
  useEffect(() => {
    if (prevLoginRef.current && !loginPane && videoId) {
      const tryStrip = async () => {
        for (let i = 0; i < 5; i++) {
          try {
            const r = await playerRef.current?.executeJavaScript(stripScript, true)
            if (r && r.ok) return
          } catch (e) {}
          await new Promise(res => window.setTimeout(res, 400))
        }
      }
      void tryStrip()
    }
    prevLoginRef.current = loginPane
  }, [loginPane, videoId])

  // Poll progress from YouTube's own player; auto-advance in-context when media ends.
  const resultsRef = useRef(results)
  resultsRef.current = results
  const indexRef = useRef(currentIndex)
  indexRef.current = currentIndex
  const playlistStateRef = useRef(playlist)
  playlistStateRef.current = playlist
  const queueModeRef = useRef(queueMode)
  queueModeRef.current = queueMode
  // Window after a capture during which a mismatched player videoId is expected (page reload);
  // only treat mismatches as drift once it expires.
  const driftGuardRef = useRef(0)
  // Playlist autostart: the /playlist→watch redirect silently drops autoplay, and every
  // in-player kick (playVideo etc.) proved unreliable on the cued player. So: arm a window on a
  // playlist click; if the first video hasn't started when the list has loaded, reload the first
  // item via the proven /watch?v=<id>&list=<pl>&autoplay=1 path (same as clicking it).
  const autostartRef = useRef(0)
  const autostartReloadedRef = useRef(false)
  const autostartArmedAtRef = useRef(0)
  useEffect(() => {
    if (!videoId || loginPaneRef.current) return undefined
    const timer = window.setInterval(async () => {
      // While a dropdown/select popup is open, unrelated DOM churn kills it; while the user drags
      // the timeline, re-rendering fights the drag. So skip progress re-renders during
      // interaction — but still run end/drift detection so timeline use can't break chaining.
      const ae = document.activeElement
      const interacting = !!ae && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT')
      try {
        const r = await playerRef.current?.executeJavaScript(stateScript, true)
        if (!r || !r.ok) return
        if (!interacting) setProgress({ current: r.current, duration: r.duration, paused: r.paused, videoId: r.videoId })
        const list = resultsRef.current
        const expected = list[indexRef.current]?.id
        // YouTube's own up-next can start a video we never asked for before our poll notices the
        // end (shorts hand over in <450ms). Heard about it via the player's current video id.
        const drift = !!expected && !!r.videoId && r.videoId !== expected && Date.now() > driftGuardRef.current
        // Autostart the first playlist video: nothing playing shortly after the list fills →
        // replay item 0 via the reliable /watch?v=&autoplay=1 URL.
        if (queueModeRef.current === 'playlist' && autostartRef.current && Date.now() < autostartRef.current) {
          if (r.current > 1) { autostartRef.current = 0 }
          else if (!autostartReloadedRef.current && resultsRef.current.length && Date.now() - autostartArmedAtRef.current > 3500) {
            autostartRef.current = 0
            autostartReloadedRef.current = true
            const first = resultsRef.current[0]
            capture(first.id, playlistStateRef.current)
            return
          }
        }
        // Never advance while the user has the player paused: pausing takes manual control, and a
        // paused drifted video must stay put (hitting pause must not yank the next short in).
        if (r.paused || !(r.ended || r.endedFlag || (r.duration > 10 && r.current >= r.duration - 0.8) || drift)) return
        const cur = list[indexRef.current]
        const qm = queueModeRef.current
        const pl = playlistStateRef.current
        let next = null
        // 1) Shorts chain: only ever hand over to another short, wrapping around the shorts in the list.
        if (cur && cur.type === 'short') {
          const nxt = list[indexRef.current + 1]
          if (nxt && nxt.type === 'short') next = nxt
          else {
            const first = list.findIndex(i => i.type === 'short')
            if (first !== -1) next = list[first]
          }
        }
        // 2) Playlist mode: advance through the loaded playlist videos to the end of the list.
        else if (qm === 'playlist' && list[indexRef.current + 1]) {
          next = list[indexRef.current + 1]
        }
        if (next) {
          remember(next, indexRef.current + 1)
          capture(next.id, qm === 'playlist' ? pl : next.list)
          const idx = list.indexOf(next)
          if (idx !== -1) setCurrentIndex(idx)
          setStatus('Auto: advanced to "' + (next.title || '').slice(0, 40) + '"')
        } else {
          // Nothing valid to follow: stop playback rather than let YouTube pull in irrelevant content.
          await playerRef.current?.executeJavaScript('const v=document.querySelector("video"); if (v) v.pause()', true).catch(() => {})
          setStatus('End of list — paused')
        }
      } catch {}
    }, 450)
    return () => window.clearInterval(timer)
  }, [videoId])

  const runCommand = async (action, value) => {
    try {
      if (action === 'caption') {
        const cap = captions.find(c => c.lang === value || c.label === value)
        // 1) YouTube's own caption controller (renders in the whitelisted caption window).
        await playerRef.current?.executeJavaScript(driveScript('caption', value), true)
        // 2) Native <track> fallback (browser-rendered over the video).
        await playerRef.current?.executeJavaScript(captionApplyScript(value === 'off' ? '' : (cap && cap.url), value === 'off' ? '' : (cap && cap.lang)), true)
        return
      }
      // The webview can be mid-reload when a button lands on it (playlist→video transitions);
      // retry briefly so transport controls survive instead of silently dead.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await playerRef.current?.executeJavaScript(driveScript(action, value), true)
          if (r && r.ok) { setProgress({ current: r.current, duration: r.duration, paused: r.paused, videoId: r.videoId }); return }
        } catch {}
        await new Promise(res => window.setTimeout(res, 250))
      }
    } catch {}
  }

  useEffect(() => {
    const webview = searchRef.current
    if (!webview || !searchUrl) return undefined
    let cancelled = false
    const done = async () => {
      try {
        const res = await webview.executeJavaScript(scrapeSearchScript, true)
        if (cancelled || queueModeRef.current === 'playlist') return
        const found = res && Array.isArray(res.items) ? res.items : (Array.isArray(res) ? res : [])
        const clean = found.filter(v => v?.id && v?.title)
        setResults(clean)
        setCurrentIndex(-1)
        if (clean[0]) setStatus('Choose a result')
        else if (searchUrl && /feed\//.test(searchUrl)) {
          const rk = (res && res.renderers) ? Object.entries(res.renderers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k + '×' + n).join(', ') : 'none'
          const pg = res && res.page ? ' | page: ' + (res.page.title || '?').slice(0, 40) + ' hasData=' + res.page.hasData + ' body=' + res.page.bodyLen : ''
          setStatus('Feed empty (renderers: ' + rk + pg + ')')
        } else setStatus('No videos found')
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
    if (filter === 'history') { showHistory(); return }
    const next = draft.trim()
    if (!next && !ACCOUNT_FEEDS[filter]) return
    // Account-bound modes (Subscriptions / Watch Later) need a signed-in session.
    if (ACCOUNT_FEEDS[filter] && !signedIn) { setStatus('Sign in first (Account button) to use ' + (SEARCH_FILTERS.find(f => f[0] === filter) || [])[1]); return }
    const exact = !ACCOUNT_FEEDS[filter] && next ? videoIdFrom(next) : null
    if (exact) { setResults([]); capture(exact); return }
    setStatus(ACCOUNT_FEEDS[filter] ? 'Loading ' + ((SEARCH_FILTERS.find(f => f[0] === filter) || [])[1]) + '…' : 'Searching YouTube…')
    setResults([])
    setQueueMode('search')
    setSearchUrl(searchSrc(next, filter) + '&_=' + Date.now())
  }
  const play = (result, index) => {
    // Remember anything a user actually plays (skip bare playlist entry rows).
    remember(result, index)
    // "Playlist" rows come in two shapes: a playlist-id (PL...) as the row id, or a first-video id
    // with a list= param. Both are playlist ENTRIES; only bare video-id rows inside an opened
    // playlist are individual ITEMS.
    const entry = result.type === 'playlist' && (/^(PL|RD|OLAK5uy|UU|FL|LL|WL)/.test(result.id) || !!result.list)
    const item = result.type === 'playlist' && !entry
    if (entry) { setCurrentIndex(0); setResults([]) }
    else setCurrentIndex(index)
    capture(result.id, entry ? (result.list || result.id) : (item ? playlistStateRef.current : result.list))
    // Armed AFTER capture() — capture disarms the window, so it only lives for the playlist
    // entry itself and any later navigation (item click, chain advance) cancels it.
    autostartRef.current = entry ? Date.now() + 8000 : 0
    autostartReloadedRef.current = false
    autostartArmedAtRef.current = Date.now()
    setQueueMode(entry || item ? 'playlist' : 'search')
  }
  const playOffset = delta => { const next = results[currentIndex + delta]; if (next) play(next, currentIndex + delta) }
  const ctrlBtn = () => cn('h-6 min-w-[52px] rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2.5 text-xs text-(--ui-text-secondary) transition hover:border-(--ui-accent) hover:text-(--ui-text-primary) disabled:opacity-50')
  // Static-title select: value pinned to a disabled-capable placeholder option carrying the label,
  // so the button always shows e.g. "Subs". On focus we sync the DOM value to the real selection so
  // the native popup ticks the active option; on blur we restore the label. Inline width = fixed.
  const StaticSelect = ({ children, current, disabled, label, onChange, title, width = 68 }) => jsx('select', {
    className: 'h-6 min-w-0 cursor-pointer rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 text-xs text-(--ui-text-secondary) disabled:opacity-50',
    style: { width, maxWidth: width },
    disabled,
    onBlur: e => { e.currentTarget.value = '__title' },
    onChange: e => { if (e.currentTarget.value !== '__title') onChange(e) },
    onFocus: e => { if (current != null) e.currentTarget.value = current },
    title,
    value: '__title',
    children: [jsx('option', { value: '__title', children: label }, '__title'), ...children]
  })
  const cfg = () => PLAYER_SIZES[playerSize] || PLAYER_SIZES.large

  return jsxs('div', { className: 'relative flex h-full min-h-0 flex-col bg-black/20', ref: rootRef, children: [
    jsx('div', {
      className: 'relative shrink-0 bg-black',
      style: { height: cfg().player },
      children: loginPane
        ? jsx('webview', { className: 'absolute inset-0 h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: 'https://www.youtube.com' })
        : (videoId
          ? jsx('webview', { key: videoId + (loginPane ? 'L' : ''), className: 'pointer-events-none absolute inset-0 h-full w-full bg-black', partition: 'persist:hermes-youtube-float-player', ref: playerRef, src: watchUrl(videoId, playlist) })
          : jsx('div', { className: 'absolute inset-0 grid place-items-center px-3 text-center text-xs text-white/60', children: `${VERSION}: Search, then pick a result below.` }))
    }),
    searchUrl ? jsx('webview', { className: 'pointer-events-none absolute h-px w-px opacity-0', partition: 'persist:hermes-youtube-float-player', ref: searchRef, src: searchUrl }) : null,
    jsxs('div', { className: 'shrink-0 border-t border-white/10 bg-(--ui-bg-elevated)/95 px-3 py-2', children: [
      jsxs('div', { className: 'mb-1 flex items-center gap-2', children: [
        jsx(Timeline, { current: progress.current, duration: progress.duration, onSeek: v => { setProgress({ ...progress, current: v }); void runCommand('seek', v) }, videoId }),
        jsxs('div', { className: 'relative shrink-0', children: [
          jsx('button', { 'aria-label': 'Volume', className: 'grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-(--ui-border-muted) bg-(--ui-bg-editor) text-xs text-(--ui-text-secondary) hover:text-(--ui-text-primary)', disabled: !videoId, onClick: () => setVolumeOpen(o => !o), title: 'Volume', type: 'button', children: volume === 0 ? '🔇' : (volume < 0.5 ? '🔈' : '🔊') }),
          volumeOpen ? jsxs('div', { className: 'absolute bottom-7 right-0 z-10 flex flex-col items-center gap-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) p-2 shadow-lg', children: [
            jsx('input', { 'aria-label': 'Volume', className: 'h-16 w-1 cursor-pointer accent-(--ui-accent)', max: 1, min: 0, onChange: e => { const v = Number(e.currentTarget.value); setVolume(v); void runCommand('volume', v) }, orient: 'vertical', step: 0.05, type: 'range', value: volume }),
            jsx('span', { className: 'text-[10px] tabular-nums text-(--ui-text-tertiary)', children: Math.round(volume * 100) + '%' })
          ] }) : null
        ] })
      ] }),
      jsxs('div', { className: 'flex flex-wrap items-center justify-center gap-2', children: [
              jsxs('div', { className: 'flex min-w-0 flex-1 items-center justify-start gap-1.5', children: [
                        jsx(StaticSelect, { current: playerSize, label: 'Size', onChange: e => setPlayerSize(e.currentTarget.value), title: 'Window size', children: Object.entries(PLAYER_SIZES).map(([value, c]) => jsx('option', { value, children: c.label }, value)) }),
                        jsx(StaticSelect, { current: quality, label: 'Quality', onChange: e => { setQuality(e.currentTarget.value); void runCommand('quality', e.currentTarget.value) }, title: 'Video quality', width: 80, children: qualities.map(q => jsx('option', { value: q, children: QUALITY_LABELS[q] || q }, q)) })
                      ] }),
                            jsxs('div', { className: 'flex items-center gap-1.5', children: [
                jsx('button', { className: ctrlBtn(), disabled: !videoId, onClick: () => playOffset(-1), title: 'Previous video', type: 'button', children: 'Prev' }),
                jsx('button', { className: ctrlBtn(), disabled: !videoId, onClick: () => runCommand('rewind'), title: 'Rewind 10s', type: 'button', children: '-10s' }),
                jsx('button', { className: ctrlBtn(), disabled: !videoId, onClick: () => runCommand('playPause'), title: 'Play/Pause', type: 'button', children: progress.paused ? '▶ Play' : '⏸ Pause' }),
                jsx('button', { className: ctrlBtn(), disabled: !videoId, onClick: () => runCommand('forward'), title: 'Forward 10s', type: 'button', children: '+10s' }),
                jsx('button', { className: ctrlBtn(), disabled: !videoId, onClick: () => playOffset(1), title: 'Next video', type: 'button', children: 'Next' })
              ] }),
              jsxs('div', { className: 'flex min-w-0 flex-1 items-center justify-end gap-1.5', children: [
                        jsx(StaticSelect, { current: loopMode, label: 'Loop', onChange: e => { setLoopMode(e.currentTarget.value); void runCommand('loop', e.currentTarget.value) }, title: 'Loop mode', children: [jsx('option', { value: 'off', children: 'Off' }, 'off'), jsx('option', { value: 'once', children: 'Once' }, 'once'), jsx('option', { value: 'inf', children: '∞' }, 'inf')] }),
                                  jsx(StaticSelect, { current: caption, label: 'Subs', onChange: e => { captionRef.current = e.currentTarget.value; setCaption(e.currentTarget.value); void runCommand('caption', e.currentTarget.value) }, title: 'Subtitles', children: [jsx('option', { value: 'off', children: 'Off' }, 'off'), ...captions.map(c => jsx('option', { value: c.lang, children: c.label }, c.lang))] })
                      ] })
            ] }),
    ] }),
    /(^Playlist|^Auto:|^End of list)/.test(status) ? jsx('div', { className: 'shrink-0 border-t border-white/10 px-3 py-1 text-[10px] text-(--ui-text-quaternary)', children: status }) : null,
    jsxs('form', { className: 'flex shrink-0 gap-1.5 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-2', onSubmit: submit, children: [
      jsx('select', { className: 'rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 text-xs', onChange: e => { const v = e.currentTarget.value; setFilter(v); if (ACCOUNT_FEEDS[v] || v === 'history') loadFeed(v) }, value: filter, children: SEARCH_FILTERS.map(([v, label]) => jsx('option', { value: v, children: label }, v)) }),
      jsx('input', { 'aria-label': 'Search YouTube or paste a video URL', className: cn('min-w-0 flex-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1.5 text-xs text-(--ui-text-primary) outline-none', 'placeholder:text-(--ui-text-quaternary) focus:border-(--ui-accent)'), onChange: e => setDraft(e.currentTarget.value), placeholder: 'Search YouTube or paste URL…', value: draft }),
      jsx('button', { className: 'rounded-md bg-(--ui-accent) px-2.5 py-1.5 text-xs font-medium text-(--ui-accent-contrast) hover:brightness-110', type: 'submit', children: status === 'Searching YouTube…' ? 'Searching…' : 'Search' }),
      jsx('button', { className: 'shrink-0 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2.5 py-1.5 text-xs text-(--ui-text-secondary) hover:text-(--ui-text-primary)', onClick: () => { setLoginPane(p => !p); setVolumeOpen(false) }, title: loginPane ? 'Done — back to the locked player' : signedIn ? ('Signed in' + (accountName ? ' as ' + accountName : '')) : 'Sign in to your YouTube account', type: 'button', children: loginPane ? '✓ Done' : (signedIn ? (accountName ? '👤 ' + accountName.slice(0, 12) : '👤 Signed in') : 'Account') })
    ] }),
    results.length ? jsx('div', { className: 'max-h-[30vh] min-h-0 shrink-0 overflow-auto border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1', children: results.map((result, index) => jsxs('button', { className: cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)', (progress.videoId && result.id === progress.videoId) ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'), onClick: () => play(result, index), title: result.title, type: 'button', children: [jsx('img', { alt: '', className: 'h-11 w-20 shrink-0 rounded object-cover bg-black', src: result.thumb || 'https://i.ytimg.com/vi/' + result.id + '/mqdefault.jpg' }), result.type === 'playlist' ? jsx('span', { className: 'shrink-0 rounded bg-(--ui-accent)/20 px-1 py-0.5 text-[9px] font-medium text-(--ui-accent)', children: '▶ Playlist' }) : null, jsx('span', { className: 'min-w-0 flex-1 truncate', children: result.title }), result.duration ? jsx('span', { className: 'shrink-0 text-[10px] text-(--ui-text-tertiary)', children: result.duration }) : null, (progress.videoId && result.id === progress.videoId) ? jsx('span', { className: 'shrink-0 text-[10px]', children: 'Playing' }) : null] }, result.id)) }) : jsx('div', { className: 'min-h-0 flex-1 border-t border-white/10 px-2 py-2 text-[11px] text-(--ui-text-quaternary)', children: status === 'Searching YouTube…' ? 'Searching… results will appear here.' : status })
  ] })
}

export default { id: 'youtube-float', name: 'YouTube Float', description: 'Floating YouTube player pane showing a native full-size <video> injected into the YouTube session webview.', register(ctx) { ctx.register({ id: 'player', area: 'panes', title: 'YouTube v3.10 ★', data: { placement: 'floating', anchor: 'top-right', width: PLAYER_SIZES.large.width, height: PLAYER_SIZES.large.height }, render: () => jsx(YouTubeFloat, {}) }) } }
