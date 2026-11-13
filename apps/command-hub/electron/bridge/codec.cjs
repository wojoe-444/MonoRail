// JSON encoding for the HTTP bridge (electron/bridge/server.cjs). IPC carries
// structured clones, so backends may return Dates and binary data; plain JSON would turn those into
// strings and objects. Tag them here and restore them in the page (the decoder
// in vite.config.ts mirrors decode() below).

const TAG = '__monorailBridge'

function encode(value) {
  return JSON.stringify(value, function replacer(key, v) {
    const raw = this[key]
    if (raw instanceof Date) return { [TAG]: 'date', v: raw.toISOString() }
    if (raw instanceof Uint8Array) return { [TAG]: 'bytes', v: Buffer.from(raw).toString('base64') }
    if (raw instanceof ArrayBuffer) return { [TAG]: 'bytes', v: Buffer.from(raw).toString('base64') }
    if (raw instanceof Map) return { [TAG]: 'map', v: [...raw.entries()] }
    if (raw instanceof Set) return { [TAG]: 'set', v: [...raw] }
    if (typeof raw === 'bigint') return { [TAG]: 'bigint', v: raw.toString() }
    return v
  })
}

function decode(text) {
  return JSON.parse(text, (_key, v) => {
    if (!v || typeof v !== 'object' || typeof v[TAG] !== 'string') return v
    switch (v[TAG]) {
      case 'date':
        return new Date(v.v)
      case 'bytes':
        return new Uint8Array(Buffer.from(v.v, 'base64'))
      case 'map':
        return new Map(v.v)
      case 'set':
        return new Set(v.v)
      case 'bigint':
        return BigInt(v.v)
      default:
        return v
    }
  })
}

module.exports = { encode, decode, TAG }
