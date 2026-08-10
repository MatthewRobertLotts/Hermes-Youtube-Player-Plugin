import { cn } from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = 'v6-syntaxfix'
const DEFAULT_QUERY = 'king boomer'

function videoIdFrom(input) {
  const text = input.trim()

  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text

  try {
    const url = new URL(text)
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null
    if (url.hostname.includes('youtube.com')) {
      return (
        url.searchParams.get('v') ||
        url.pathname.match(/\/(embed|shorts|watch)\/?([a-zA-Z0-9_-]{11})/)?.[2] ||
        null
      )
    }
  } catch {
    return null
  }

  return null
}

function playerSrc(videoId) {
  if (!videoId) return 'about:blank'
  const params = new URLSearchParams({
    autoplay: '1',
    enablejsapi: '1',
    modestbranding: '1',
    origin: 'https://www.youtube.com',
    playsinline: '1',
    rel: '0',
    widget_referrer: 'https://www.youtube.com/'
  })

  // ponytail: Hermes Electron stamps Referer only on persist:hermes-embed; pair with youtube-nocookie.
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

function searchSrc(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

const scrapeSearchScript = `new Promise(resolve => {
  setTimeout(() => {
    const seen = new Set()
    const out = []
    for (const row of document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer')) {
      const link = row.querySelector('a#video-title') || row.querySelector('a[href*=\"/watch?v=\"]')
      if (!link) continue
      const id = new URL(link.href, location.href).searchParams.get('v')
      if (!id || seen.has(id)) continue
      const titleNode = row.querySelector('#video-title') || link
      const title = (titleNode.getAttribute('title') || titleNode.textContent || '').replace(/\\s+/g, ' ').trim()
      if (!title || /now playing/i.test(title) || /^\d+:\d+/.test(title)) continue
      seen.add(id)
      const img = row.querySelector('img')
      const thumb = img?.src || img?.getAttribute('data-thumb') || 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'
      out.push({ id, title, thumb })
      if (out.length >= 8) break
    }
    resolve(out)
  }, 1500)
})`

function YouTubeFloat() {
  const [draft, setDraft] = useState(DEFAULT_QUERY)
  const [videoId, setVideoId] = useState(null)
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('Search for a video')
  const [searchUrl, setSearchUrl] = useState(null)
  const searchRef = useRef(null)
  const watchSrc = useMemo(() => playerSrc(videoId), [videoId])

  const play = result => {
    setVideoId(result.id)
    setStatus(result.title)
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
        if (clean[0]) play(clean[0])
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
      play({ id: exact, title: next })
      return
    }

    setStatus('Searching YouTube…')
    setSearchUrl(searchSrc(next))
  }

  return jsxs('div', {
    className: 'relative flex h-full min-h-0 flex-col bg-black/20',
    children: [
      videoId
        ? jsx('webview', {
            className: 'min-h-0 flex-1 bg-black',
            allowfullscreen: 'true',
            partition: 'persist:hermes-embed',
            referrerpolicy: 'strict-origin-when-cross-origin',
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
            children: results.map(result =>
              jsxs(
                'button',
                {
                  className: cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-(--chrome-action-hover)',
                    result.id === videoId ? 'text-(--ui-accent)' : 'text-(--ui-text-secondary)'
                  ),
                  onClick: () => play(result),
                  title: result.title,
                  type: 'button',
                  children: [
                    jsx('img', { alt: '', className: 'h-9 w-16 shrink-0 rounded object-cover bg-black', src: result.thumb || `https://i.ytimg.com/vi/${result.id}/mqdefault.jpg` }),
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
  description: 'Floating YouTube player pane with a dedicated YouTube search box under the video.',
  register(ctx) {
    ctx.register({
      id: 'player',
      area: 'panes',
      title: 'YouTube v6',
      data: { placement: 'floating', anchor: 'top-right', width: '500px', height: '420px' },
      render: () => jsx(YouTubeFloat, {})
    })
  }
}
