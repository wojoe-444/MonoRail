// Connections storage: one JSON file in the Connections module's data folder
// (%APPDATA%\MonoRail\modules\connections\connections.json).
//
//   { "connections": { "<kind>": { values, secrets, addedAt, updatedAt } } }
//
// `values` are plain settings (a site URL, a Credential Manager entry name).
// `secrets` are encrypted with Electron safeStorage (Windows DPAPI). When
// encryption is unavailable nothing secret is written: saving fails with a
// clear message instead of falling back to plain text. Secrets are never
// returned to the page; describe() only says which ones are set.

const fs = require('node:fs/promises')
const path = require('node:path')

const FILE = 'connections.json'

/** cipher: { isAvailable(), encrypt(plain) -> string, decrypt(string) -> plain } */
function createStore(dataDir, cipher) {
  const file = path.join(dataDir, FILE)

  async function readAll() {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'))
      return data && typeof data.connections === 'object' && data.connections ? data : { connections: {} }
    } catch {
      return { connections: {} }
    }
  }

  async function writeAll(data) {
    await fs.mkdir(dataDir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(data, null, 2))
    await fs.rename(tmp, file)
  }

  function decryptAll(secrets) {
    const out = {}
    for (const [k, v] of Object.entries(secrets ?? {})) {
      try {
        out[k] = cipher.decrypt(v)
      } catch {
        /* unreadable (e.g. copied from another PC): treat as unset */
      }
    }
    return out
  }

  return {
    /** Every saved connection: { kind, values, secretsSet, addedAt, updatedAt }. Never secrets. */
    async describe() {
      const { connections } = await readAll()
      return Object.entries(connections).map(([kind, c]) => ({
        kind,
        values: c.values ?? {},
        secretsSet: Object.fromEntries(Object.keys(decryptAll(c.secrets)).map((k) => [k, true])),
        addedAt: c.addedAt,
        updatedAt: c.updatedAt,
      }))
    },

    /** One connection with decrypted secrets, for the main process only. */
    async get(kind) {
      const { connections } = await readAll()
      const c = connections[kind]
      if (!c) return undefined
      return { kind, values: c.values ?? {}, secrets: decryptAll(c.secrets) }
    },

    /**
     * Add or update a connection. Only the listed fields are kept. An empty
     * secret keeps the stored one unless it is named in clearSecrets.
     */
    async save(kind, fields, { values: input = {}, secrets: secretInput = {}, clearSecrets = [] } = {}) {
      const data = await readAll()
      const prev = data.connections[kind] ?? {}
      const values = {}
      const secrets = { ...(prev.secrets ?? {}) }
      for (const f of fields) {
        if (f.type === 'secret') {
          const v = typeof secretInput[f.key] === 'string' ? secretInput[f.key].trim() : ''
          if (clearSecrets.includes(f.key)) delete secrets[f.key]
          else if (v) {
            if (!cipher.isAvailable()) throw new Error('Windows could not provide encryption for saved secrets, so MonoRail will not store them.')
            secrets[f.key] = cipher.encrypt(v)
          }
        } else {
          const v = input[f.key]
          values[f.key] = typeof v === 'string' ? v.trim() : ''
        }
      }
      const now = new Date().toISOString()
      data.connections[kind] = { values, secrets, addedAt: prev.addedAt ?? now, updatedAt: now }
      await writeAll(data)
    },

    async remove(kind) {
      const data = await readAll()
      if (!data.connections[kind]) return false
      delete data.connections[kind]
      await writeAll(data)
      return true
    },
  }
}

module.exports = { createStore }
