// MIME helpers shared by connectors: build an RFC 5322 message for sending,
// and read headers and bodies out of a parsed MIME tree (Gmail's "payload"
// shape: { mimeType, filename, headers: [{name, value}], body: {data,
// attachmentId, size}, parts: [...] }). Pure functions, covered by tests.

/** Header values must never carry a line break (header injection). */
const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim()

const isAscii = (s) => /^[\x20-\x7e]*$/.test(s)

/** RFC 2047 encoded-word for non-ASCII header text (e.g. subjects). */
function encodeHeaderText(s) {
  const v = clean(s)
  if (isAscii(v)) return v
  return `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`
}

/** Split "a@x.com, Name <b@y.com>" into address strings; drops blanks. */
function splitAddresses(list) {
  if (Array.isArray(list)) return list.map(clean).filter(Boolean)
  const out = []
  let cur = ''
  let quoted = false
  let angle = false
  for (const ch of String(list ?? '')) {
    if (ch === '"') quoted = !quoted
    else if (ch === '<' && !quoted) angle = true
    else if (ch === '>' && !quoted) angle = false
    if ((ch === ',' || ch === ';') && !quoted && !angle) {
      if (cur.trim()) out.push(clean(cur))
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(clean(cur))
  return out
}

/** The bare address in "Name <a@b.c>" (lower-cased). */
function addressOf(s) {
  const m = /<([^>]+)>/.exec(String(s ?? ''))
  return (m ? m[1] : String(s ?? '')).trim().toLowerCase()
}

/** The display name in "Name <a@b.c>", else the address. */
function nameOf(s) {
  const v = String(s ?? '').trim()
  const m = /^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/.exec(v)
  return (m && m[1].trim()) || addressOf(v)
}

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/

function validateAddresses(list, field) {
  for (const a of list) if (!EMAIL_RE.test(addressOf(a))) throw new Error(`"${a}" in ${field} is not an email address.`)
}

/** Encode an address header, keeping non-ASCII display names readable to clients. */
function encodeAddressList(list) {
  return list
    .map((a) => {
      const addr = addressOf(a)
      const name = nameOf(a)
      if (!name || name === addr) return addr
      return `${isAscii(name) ? `"${name.replace(/["\\]/g, '')}"` : encodeHeaderText(name)} <${addr}>`
    })
    .join(', ')
}

const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').trimEnd()

/**
 * Build a plain-text RFC 5322 message. draft: { from, to, cc, bcc, subject,
 * body, inReplyTo, references }. Returns the message as a string with CRLF
 * line endings. Throws on missing or invalid recipients.
 */
function buildMessage(draft, { date = new Date(), messageIdDomain } = {}) {
  const to = splitAddresses(draft.to)
  const cc = splitAddresses(draft.cc)
  const bcc = splitAddresses(draft.bcc)
  if (to.length + cc.length + bcc.length === 0) throw new Error('Add at least one recipient.')
  validateAddresses(to, 'To')
  validateAddresses(cc, 'Cc')
  validateAddresses(bcc, 'Bcc')

  const headers = []
  if (draft.from) headers.push(`From: ${encodeAddressList([clean(draft.from)])}`)
  if (to.length) headers.push(`To: ${encodeAddressList(to)}`)
  if (cc.length) headers.push(`Cc: ${encodeAddressList(cc)}`)
  if (bcc.length) headers.push(`Bcc: ${encodeAddressList(bcc)}`)
  headers.push(`Subject: ${encodeHeaderText(draft.subject ?? '')}`)
  headers.push(`Date: ${date.toUTCString().replace('GMT', '+0000')}`)
  if (messageIdDomain) headers.push(`Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${clean(messageIdDomain)}>`)
  if (draft.inReplyTo) headers.push(`In-Reply-To: ${clean(draft.inReplyTo)}`)
  if (draft.references) headers.push(`References: ${clean(draft.references)}`)
  headers.push('MIME-Version: 1.0')
  headers.push('Content-Type: text/plain; charset="UTF-8"')
  headers.push('Content-Transfer-Encoding: base64')

  const body = String(draft.body ?? '').replace(/\r?\n/g, '\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${wrap76(Buffer.from(body, 'utf8').toString('base64'))}\r\n`
}

/** "Re: " once, however many the original had. */
function replySubject(subject) {
  const s = String(subject ?? '').trim()
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

/** Base64url (Gmail) or base64 to a UTF-8 string. */
function decodeBase64(data) {
  if (!data) return ''
  return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function header(headers, name) {
  const lower = name.toLowerCase()
  return (headers ?? []).find((h) => h.name?.toLowerCase() === lower)?.value ?? ''
}

/** Decode RFC 2047 encoded words that a provider left in a header. */
function decodeHeaderText(s) {
  return String(s ?? '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_m, _cs, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8')
      const bytes = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16)))
      return Buffer.from(bytes, 'latin1').toString('utf8')
    } catch {
      return text
    }
  })
}

/**
 * Walk a MIME tree and pull out the best text and HTML bodies plus the
 * attachment list. Prefers the first text/plain and text/html outside
 * attachments.
 */
function extractBodies(payload) {
  let text = ''
  let html = ''
  const attachments = []
  const walk = (part) => {
    if (!part) return
    const type = String(part.mimeType ?? '').toLowerCase()
    const disposition = header(part.headers, 'Content-Disposition').toLowerCase()
    const isAttachment = !!part.filename || disposition.startsWith('attachment')
    if (isAttachment && !type.startsWith('multipart/')) {
      attachments.push({
        id: part.body?.attachmentId ?? '',
        filename: part.filename || 'attachment',
        mimeType: type,
        size: part.body?.size ?? 0,
      })
      return
    }
    if (type === 'text/plain' && !text) text = decodeBase64(part.body?.data)
    else if (type === 'text/html' && !html) html = decodeBase64(part.body?.data)
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return { text, html, attachments }
}

module.exports = {
  addressOf,
  buildMessage,
  clean,
  decodeBase64,
  decodeHeaderText,
  encodeHeaderText,
  extractBodies,
  header,
  nameOf,
  replySubject,
  splitAddresses,
}
