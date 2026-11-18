/** What the address bar turns typed text into: a web address, or a web search. */
export function toAddress(text: string): string | undefined {
  const v = text.trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v)) {
    try {
      return new URL(v).href
    } catch {
      return undefined
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^(localhost|[\w-]+(\.[\w-]+)+):\d/i.test(v)) return undefined // other schemes
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/|$)/i.test(v)
  const looksLikeHost = !/\s/.test(v) && (local || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v))
  if (looksLikeHost) {
    try {
      return new URL(`${local ? 'http' : 'https'}://${v}`).href
    } catch {
      // Fall through to a search.
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`
}
