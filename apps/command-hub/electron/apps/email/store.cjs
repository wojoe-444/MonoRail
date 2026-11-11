// Email app storage, all under ctx.dataDir (%APPDATA%\MonoRail\apps\email):
//
//   config.json    per-connector setup (e.g. the Google OAuth client). Secret
//                  fields are encrypted.
//   accounts.json  connected inboxes. Each account's credentials (refresh
//                  token) are encrypted.
//
// Encryption is Electron safeStorage (Windows DPAPI, key in the userData
// folder's Local State). If it is unavailable nothing secret is written:
// saving fails with a clear message instead of falling back to plain text.
// Mail itself is never written to disk; it is fetched on demand.

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const CONFIG_FILE = 'config.json'
const ACCOUNTS_FILE = 'accounts.json'

function createStore(dataDir, cipher) {
  const file = (name) => path.join(dataDir, name)

  async function readJson(name, fallback) {
    try {
      return JSON.parse(await fs.readFile(file(name), 'utf8'))
    } catch {
      return fallback
    }
  }
  async function writeJson(name, value) {
    const tmp = `${file(name)}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(value, null, 2))
    await fs.rename(tmp, file(name))
  }

  const encrypt = (plain) => {
    if (!cipher.isAvailable()) throw new Error('Windows could not provide encryption for saved secrets, so MonoRail will not store them.')
    return cipher.encrypt(plain)
  }
  const decrypt = (enc) => cipher.decrypt(enc)

  return {
    /** { values: non-secret fields, secrets: decrypted secret fields } for one connector. */
    async getConfig(kind) {
      const all = await readJson(CONFIG_FILE, {})
      const c = all[kind] ?? {}
      const secrets = {}
      for (const [k, v] of Object.entries(c.secrets ?? {})) {
        try {
          secrets[k] = decrypt(v)
        } catch {
          /* unreadable (e.g. copied from another PC): treat as unset */
        }
      }
      return { values: c.values ?? {}, secrets }
    },

    /** The page's view: non-secret values plus which secrets are set. */
    async describeConfig(kind) {
      const { values, secrets } = await this.getConfig(kind)
      return { values, secretsSet: Object.fromEntries(Object.keys(secrets).map((k) => [k, true])) }
    },

    /**
     * Save setup fields. Empty secret fields keep the stored value unless
     * listed in clearSecrets.
     */
    async saveConfig(kind, fields, { values: input = {}, clearSecrets = [] } = {}) {
      const all = await readJson(CONFIG_FILE, {})
      const prev = all[kind] ?? {}
      const values = {}
      const secrets = { ...(prev.secrets ?? {}) }
      for (const f of fields) {
        const v = typeof input[f.key] === 'string' ? input[f.key].trim() : ''
        if (f.secret) {
          if (clearSecrets.includes(f.key)) delete secrets[f.key]
          else if (v) secrets[f.key] = encrypt(v)
        } else values[f.key] = v
      }
      all[kind] = { values, secrets }
      await writeJson(CONFIG_FILE, all)
    },

    /** Accounts without credentials (safe to show). */
    async listAccounts() {
      const list = await readJson(ACCOUNTS_FILE, [])
      return Array.isArray(list) ? list.map(({ credentials: _c, ...a }) => a) : []
    },

    async getCredentials(accountId) {
      const list = await readJson(ACCOUNTS_FILE, [])
      const a = list.find((x) => x.id === accountId)
      if (!a) throw new Error('That inbox is no longer connected.')
      return JSON.parse(decrypt(a.credentials))
    },

    /** Add, or replace credentials of an account with the same kind and address. */
    async upsertAccount({ kind, address, name }, credentials) {
      const list = await readJson(ACCOUNTS_FILE, [])
      const enc = encrypt(JSON.stringify(credentials))
      const existing = list.find((a) => a.kind === kind && a.address?.toLowerCase() === String(address).toLowerCase())
      let account
      if (existing) {
        Object.assign(existing, { name, credentials: enc, updatedAt: new Date().toISOString() })
        account = existing
      } else {
        account = { id: crypto.randomUUID(), kind, address, name, addedAt: new Date().toISOString(), credentials: enc }
        list.push(account)
      }
      await writeJson(ACCOUNTS_FILE, list)
      const { credentials: _c, ...safe } = account
      return safe
    },

    async updateCredentials(accountId, credentials) {
      const list = await readJson(ACCOUNTS_FILE, [])
      const a = list.find((x) => x.id === accountId)
      if (!a) return
      a.credentials = encrypt(JSON.stringify(credentials))
      await writeJson(ACCOUNTS_FILE, list)
    },

    async removeAccount(accountId) {
      const list = await readJson(ACCOUNTS_FILE, [])
      await writeJson(
        ACCOUNTS_FILE,
        list.filter((a) => a.id !== accountId),
      )
    },
  }
}

/** safeStorage as a cipher (base64 strings on disk). */
function safeStorageCipher(safeStorage) {
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (s) => safeStorage.decryptString(Buffer.from(s, 'base64')),
  }
}

module.exports = { createStore, safeStorageCipher }
