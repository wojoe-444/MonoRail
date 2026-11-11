import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'

import type { Message } from '../types'
import { linkify, prepareHtml } from '../util'

/**
 * A message body. HTML mail renders in a sandboxed iframe: no scripts, no
 * forms, links open in the browser, and remote images stay blocked until
 * the user asks for them (they can track opens).
 */
export default function MessageBody({ message }: { message: Message }) {
  const [showImages, setShowImages] = useState(false)
  if (!message.html) return <PlainBody text={message.text || message.snippet} />
  return <HtmlBody html={message.html} showImages={showImages} onShowImages={() => setShowImages(true)} />
}

function PlainBody({ text }: { text: string }) {
  const parts = useMemo(() => linkify(text), [text])
  return (
    <div className="eml-plain">
      {parts.map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">{p.text}</a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  )
}

function HtmlBody({ html, showImages, onShowImages }: { html: string; showImages: boolean; onShowImages: () => void }) {
  const { doc, blockedImages } = useMemo(() => prepareHtml(html, { showImages }), [html, showImages])
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    let observer: ResizeObserver | undefined
    const onLoad = () => {
      const body = frame.contentDocument?.body
      if (!body) return
      const measure = () => setHeight(Math.max(40, Math.ceil(frame.contentDocument!.documentElement.scrollHeight)))
      measure()
      observer?.disconnect()
      observer = new ResizeObserver(measure)
      observer.observe(body)
    }
    frame.addEventListener('load', onLoad)
    return () => {
      frame.removeEventListener('load', onLoad)
      observer?.disconnect()
    }
  }, [doc])

  return (
    <div className="eml-html">
      {blockedImages > 0 && (
        <div className="eml-images-note">
          <ImageOff /> Remote images are hidden to protect your privacy.
          <button className="eml-link-btn" onClick={onShowImages}>Show images</button>
        </div>
      )}
      <div className="eml-frame">
      <iframe
        ref={ref}
        title="Message"
        srcDoc={doc}
        // No allow-scripts: same-origin only lets the reader measure the height.
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ height }}
      />
      </div>
    </div>
  )
}
