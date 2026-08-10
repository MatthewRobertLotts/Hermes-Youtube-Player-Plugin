import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v8-player-ui'
const DEFAULT_QUERY = 'king boomer'
const QUALITY_LABELS = {
  auto: 'Auto',
  tiny: '144p',
  small: '240p',
  medium: '360p',
  large: '480p',
  hd720: '720p',
  hd1080: '1080p',
  hd1440: '1440p',
  hd2160: '4K'
}

function videoIdFrom(input) {
  const text = input.trim()

  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text

  try {
    const url = new URL(text)
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null
    if (url.hostname.includes('youtube.com')) {
      return url.searchParams.get('v') || url.pathname.match(/\/(embed|shorts|watch)\/?([a-zA-Z0-9_-]{11})/)?.[2] || null
    }
  } catch {
    return null
  }

  return null
}

function playerSrc(videoId) {
  // ponytail: embeds are blocked by YouTube in Electron; use watch page, then strip chrome in-page.
  return videoId ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1' : 'about:blank'
}

function searchSrc(query) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
}

const focusPlayerScript = '(' + function () {
  const css = `
    html, body, ytd-app, #content, #page-manager, ytd-watch-flexy { background:#000!important; margin:0!important; overflow:hidden!important; }
    ytd-masthead, #masthead-container, #secondary, #comments, #meta, #info, #below, #chat, ytd-merch-shelf-renderer, ytd-engagement-panel-section-list-renderer { display:none!important; }
    ytd-watch-flexy #columns, ytd-watch-flexy #primary, ytd-watch-flexy #primary-inner { margin:0!important; padding:0!important; width:100vw!important; max-width:none!important; }
    #player, #player-container-outer, #player-container-inner, #player-container, #movie_player, .html5-video-player { position:fixed!important; inset:0!important; width:100vw!important; height:100vh!important; max-height:none!important; z-index:2147483647!important; background:#000!important; }
    video { width:100vw!important; height:100vh!important; object-fit:contain!important; background:#000!important; }
    .ytp-chrome-bottom, .ytp-gradient-bottom, .ytp-pause-overlay { opacity:0!important; pointer-events:none!important; }
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
    video.style.objectFit = 'contain'
    video.play().catch(() => undefined)
  }

  const player = document.getElementById('movie_player')
  const levels = player?.getAvailableQualityLevels?.() || []
  return { levels }
}.toString() + ')()'

const scrapeSearchScript = '(' + function () {
  return new Promise(resolve => {
    setTimeout(() => {
      const seen = new Set()
      const out = []
      for (const row of document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer')) {
        const link = row.querySelector('a#video-title') || row.querySelector('a[href*="/watch?v="]')
        if (!link) continue
        const id = new URL(link.href, location.href).searchParams.get('v')
        if (!id || seen.has(id)) continue
        const titleNode = row.querySelector('#video-title') || link
        const title = (titleNode.getAttribute('title') || titleNode.textContent || '').replace(/\s+/g, ' ').trim()
        if (!title || /now playing/i.test(title) || /^\d+:\d+/.test(title)) continue
        seen.add(id)
        const img = row.querySelector('img')
        const thumb = img?.src || img?.getAttribute('data-thumb') || 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'
        out.push({ id, title, thumb })
        if (out.length >= 8) break
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
    if (payload.action === 'rewind') video.currentTime = Math.max(0, video.currentTime - 10)
    if (payload.action === 'forward') video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10)
    if (payload.action === 'loop') video.loop = Boolean(payload.value)
    if (payload.action === 'quality' && payload.value !== 'auto') {
      player?.setPlaybackQualityRange?.(payload.value)
      player?.setPlaybackQuality?.(payload.value)
    }
    if (payload.action === 'quality' && payload.value === 'auto') player?.setPlaybackQualityRange?.('auto')

    return { ok: true, paused: video.paused, loop: video.loop, levels: player?.getAvailableQualityLevels?.() || [] }
  }.toString() + ')(' + JSON.stringify({ action, value }) + ')'
}

function YouTubeFloat() {
  const [draft, setDraft] = useState(DEFAULT_QUERY)
  const [videoId, setVideoId] = useState(null)
  const [results, setResults] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [status, setStatus] = useState('Search for a video')
  const [searchUrl, setSearchUrl] = useState(null)
  const [loop, setLoop] = useState(false)
  const [quality, setQuality] = useState('auto')
  const [qualities, setQualities] = useState(['auto'])
  const searchRef = useRef(null)
  const playerRef = useRef(null)
  const watchSrc = useMemo(() => playerSrc(videoId), [videoId])

  const runPlayer = async (action, value) => {
    try {
      const result = await playerRef.current?.executeJavaScript(commandScript(action, value), true)
      if (Array.isArray(result?.levels) && result.levels.length) setQualities(['auto', ...result.levels])
    } catch {
      // YouTube page owns failures; UI stays usable.
    }
  }

  const play = (result, index = results.findIndex(r => r.id === result.id)) => {
    setVideoId(result.id)
    setCurrentIndex(index)
    setStatus(result.title)
  }

  useEffect(() => {
    const webview = playerRef.current
    if (!webview || !videoId) return undefined

    const ready = async () => {
      try {
        const result = await webview.executeJavaScript(focusPlayerScript, true)
        if (Array.isArray(result?.levels) && result.levels.length) setQualities(['auto', ...result.levels])
        await webview.executeJavaScript(commandScript('loop', loop), true)
        if (quality !== 'auto') await webview.executeJavaScript(commandScript('quality', quality), true)
      } catch {
        setStatus('Loaded, but controls could not attach')
      }
    }

    webview.addEventListener('dom-ready', ready)
    return () => webview.removeEventListener('dom-ready', ready)
  }, [videoId, loop, quality])

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
        if (clean[0]) play(clean[0], 0)
        else setStatus('No videos found')
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : String(error))
      }
    }

    webview.addEventListener('dom-ready', done, { once: true })
    return () => {
      cancelled = true
      webview.removeEventListener('dom-ready', done)
    }
  }, [searchUrl])

  const submit = event => {
    event.preventDefault()
    const next = draft.trim()
    if (!next) return

    const exact = videoIdFrom(next)
    if (exact) {
      setResults([])
      play({ id: exact, title: next }, -1)
      return
    }

    setStatus('Searching YouTube…')
    setSearchUrl(searchSrc(next))
  }

  const playOffset = delta => {
    const next = results[currentIndex + delta]
    if (next) play(next, currentIndex + delta)
  }

  return jsxs('div', {
    className: 'relative flex h-full min-h-0 flex-col bg-black/20',
    children: [
      videoId
        ? jsx('webview', {
            className: 'min-h-0 flex-1 bg-black',
            allowpopups: 'true',
            partition: 'persist:hermes-youtube-float-player',
            ref: playerRef,
            src: watchSrc
          })
        : jsx('div', { className: 'grid min-h-0 flex-1 place-items-center bg-black text-xs text-white/60', children: `${VERSION}: ${status}` }),
      searchUrl
        ? jsx('webview', {
            className: 'pointer-events-none absolute h-px w-px opacity-0',
            partition: 'persist:hermes-youtube-float-search',
            ref: searchRef,
            src: searchUrl
          })
        : null,
      jsxs('div', {
        className: 'flex shrink-0 flex-wrap items-center gap-1 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1.5',
        children: [
          jsx('button', { className: 'rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover)', onClick: () => playOffset(-1), type: 'button', children: 'Prev' }),
          jsx('button', { className: 'rounded bg-(--ui-accent) px-2 py-1 text-xs font-medium text-(--ui-accent-contrast)', onClick: () => runPlayer('playPause'), type: 'button', children: 'Play/Pause' }),
          jsx('button', { className: 'rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover)', onClick: () => playOffset(1), type: 'button', children: 'Next' }),
          jsx('button', { className: cn('rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover)', loop && 'text-(--ui-accent)'), onClick: () => { const next = !loop; setLoop(next); void runPlayer('loop', next) }, type: 'button', children: loop ? 'Loop on' : 'Loop' }),
          jsx('button', { className: 'rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover)', onClick: () => runPlayer('rewind'), type: 'button', children: '-10s' }),
          jsx('button', { className: 'rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover)', onClick: () => runPlayer('forward'), type: 'button', children: '+10s' }),
          jsx('select', {
            className: 'ml-auto rounded border border-(--ui-border-muted) bg-(--ui-bg-editor) px-1 py-1 text-xs',
            onChange: event => { setQuality(event.currentTarget.value); void runPlayer('quality', event.currentTarget.value) },
            value: quality,
            children: qualities.map(q => jsx('option', { value: q, children: QUALITY_LABELS[q] || q }, q))
          })
        ]
      }),
      jsxs('form', {
        className: 'flex shrink-0 gap-1.5 border-t border-white/10 bg-(--ui-bg-elevated)/95 p-2',
        onSubmit: submit,
        children: [
          jsx('input', {
            'aria-label': 'Search YouTube or paste a video URL',
            className: cn(
              'min-w-0 flex-1 rounded-md border border-(--ui-border-muted) bg-(--ui-bg-editor) px-2 py-1.5 text-xs text-(--ui-text-primary) outline-none',
              'placeholder:text-(--ui-text-quaternary) focus:border-(--ui-accent)'
            ),
            onChange: event => setDraft(event.currentTarget.value),
            placeholder: 'Search YouTube or paste URL…',
            value: draft
          }),
          jsx('button', {
            className: 'rounded-md bg-(--ui-accent) px-2.5 py-1.5 text-xs font-medium text-(--ui-accent-contrast) hover:opacity-90',
            type: 'submit',
            children: 'Search'
          })
        ]
      }),
      results.length
        ? jsx('div', {
            className: 'max-h-24 shrink-0 overflow-auto border-t border-white/10 bg-(--ui-bg-elevated)/95 p-1',
            children: results.map((result, index) =>
              jsxs(
                'button',
                {
                  className: cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)',
                    result.id === videoId ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'
                  ),
                  onClick: () => play(result, index),
                  title: result.title,
                  type: 'button',
                  children: [
                    jsx('img', { alt: '', className: 'h-9 w-16 shrink-0 rounded object-cover bg-black', src: result.thumb || 'https://i.ytimg.com/vi/' + result.id + '/mqdefault.jpg' }),
                    jsx('span', { className: 'min-w-0 flex-1 truncate', children: result.title }),
                    result.id === videoId ? jsx('span', { className: 'shrink-0 text-[10px]', children: 'Playing' }) : null
                  ]
                },
                result.id
              )
            )
          })
        : jsx('div', { className: 'shrink-0 truncate border-t border-white/10 px-2 py-1 text-[11px] text-(--ui-text-quaternary)', children: `${VERSION}: ${status}` })
    ]
  })
}

export default {
  id: 'youtube-float',
  name: 'YouTube Float',
  description: 'Floating YouTube player pane with native-ish controls over a stripped YouTube watch page.',
  register(ctx) {
    ctx.register({
      id: 'player',
      area: 'panes',
      title: 'YouTube v8',
      data: { placement: 'floating', anchor: 'top-right', width: '640px', height: '560px' },
      render: () => jsx(YouTubeFloat, {})
    })
  }
}
