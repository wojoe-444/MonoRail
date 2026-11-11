/** Display name from "Name <a@b.c>" (else the address). */
export function nameOf(s: string): string {
  const v = s.trim()
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(v)
  return (m && (m[1].trim() || m[2])) || v
}

export function addressOf(s: string): string {
  const m = /<([^>]+)>/.exec(s)
  return (m ? m[1] : s).trim().toLowerCase()
}

export function initials(s: string): string {
  const name = nameOf(s)
  if (name.includes('@')) return (name[0] ?? '?').toUpperCase()
  const n = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim()
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase()
}

/** A stable hue per address, for avatar tiles. */
export function hueOf(s: string): number {
  let h = 0
  for (const ch of addressOf(s)) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

/** Short date for the thread list: time today, "Mar 3" this year, else "3/3/24". */
export function listDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' })
}

export function fullDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function replySubject(s: string): string {
  const v = s.trim()
  return /^re:/i.test(v) ? v : `Re: ${v}`
}

/** Plain-text quote of a message for a reply body. */
export function quote(from: string, date: string | null, text: string): string {
  const when = date ? new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'earlier'
  const body = text.trim().split('\n').map((l) => `> ${l}`).join('\n')
  return `\n\nOn ${when}, ${nameOf(from)} wrote:\n${body}`
}

/** Text of an HTML body, for quoting a message that has no plain-text part. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'))
  doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4').forEach((b) => b.append('\n'))
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Prepare an HTML email for a sandboxed iframe: drop active content and
 * forms, force links to open outside, and set a CSP that blocks every remote
 * load unless the user chose to show images. Returns the document and how
 * many remote images were blocked.
 */
export function prepareHtml(html: string, { showImages }: { showImages: boolean }): { doc: string; blockedImages: number } {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.querySelectorAll('script, iframe, frame, frameset, object, embed, form, base, meta[http-equiv], link').forEach((n) => n.remove())
  let blockedImages = 0
  parsed.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
      else if (/^(href|src|action|formaction|xlink:href)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noreferrer noopener')
    }
    if (el.tagName === 'IMG' && /^\s*https?:/i.test(el.getAttribute('src') ?? '')) blockedImages++
  })
  const img = showImages ? 'data: https: http:' : 'data:'
  const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'; font-src data:`
  // Mail is written for a white page; in dark mode the reader frames it as a light card.
  const base = `<meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#1f2430;font:14px/1.55 'Segoe UI',system-ui,sans-serif;overflow-wrap:anywhere}body{padding:2px}img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:0 0 0 8px;padding-left:12px;border-left:3px solid #d5d9e2;color:#555}pre{white-space:pre-wrap}</style>`
  return { doc: `<!doctype html><html><head><meta charset="utf-8">${base}${parsed.head.innerHTML}</head><body>${parsed.body.innerHTML}</body></html>`, blockedImages: showImages ? 0 : blockedImages }
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/g

/** Split plain text into text and link pieces. */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], href: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** How an account is named in the UI: its name, else its address. */
export function accountLabel(a: { name?: string; address?: string } | null | undefined): string {
  return a?.name || a?.address || 'Inbox'
}

/** What an account's avatar tile is drawn from (address when there is one). */
export function accountAvatar(a: { name?: string; address?: string } | null | undefined): string {
  return a?.address || a?.name || '?'
}
