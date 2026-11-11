// Secret storage for extension backends (ctx.secrets).
//
// Values are encrypted with Electron's safeStorage (the operating system's
// key store: DPAPI on Windows, Keychain on macOS, libsecret on Linux) and
// written to extension-secrets/<id>.json under MonoRail's data folder. That
// folder is outside every extension's sandbox, so a backend can only reach its
// secrets through MonoRail, and only its own. Saving refuses when the system
// offers no encryption: secrets are never written as plain text.
//
// No Electron imports here (index.cjs passes safeStorage in), so tests run it
// with plain Node and a fake cipher.

const fs = require('node:fs')
const path = require('node:path')

const { ExtensionCallError } = require('./errors.cjs')

const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/
const MAX_VALUE = 64 * 1024
const MAX_SECRETS = 100

/**
 * @typedef {{ isAvailable(): boolean, encrypt(text: string): Buffer, decrypt(data: Buffer): string }} Cipher
 * @typedef {{ get(name: string): Promise<string | null>, set(name: string, value: string): Promise<void>, delete(name: string): Promise<void>, list(): Promise<string[]> }} ExtensionSecrets
 */

class SecretStore {
  /** @param {{ root: string, cipher: Cipher }} opts root = <userData>/extension-secrets */
  constructor({ root, cipher }) {
    this.root = root
    this.cipher = cipher
  }

  /** ctx.secrets live in <id>.json, secret settings in <id>.settings.json (ids have no dots). */
  file(id, bucket) {
    return path.join(this.root, bucket ? `${id}.${bucket}.json` : `${id}.json`)
  }

  read(id, bucket) {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file(id, bucket), 'utf8'))
      return parsed && typeof parsed.secrets === 'object' ? parsed.secrets : {}
    } catch {
      return {}
    }
  }

  write(id, secrets, bucket) {
    fs.mkdirSync(this.root, { recursive: true })
    const file = this.file(id, bucket)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, secrets }, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  requireCipher() {
    if (!this.cipher?.isAvailable())
      throw new ExtensionCallError('EXT_SECRETS_UNAVAILABLE', 'This computer offers no encryption for stored secrets, so MonoRail will not save them')
  }

  /** The ctx.secrets API for one extension (or, with bucket "settings", its secret settings). */
  forExtension(id, bucket) {
    const checkName = (name) => {
      if (typeof name !== 'string' || !NAME_RE.test(name))
        throw new ExtensionCallError('EXT_INVALID_SECRET', 'A secret name is 1-100 characters of A-Z, a-z, 0-9, ".", "_" and "-"')
    }
    return {
      get: async (name) => {
        checkName(name)
        const all = this.read(id, bucket)
        if (!Object.hasOwn(all, name)) return null
        this.requireCipher()
        return this.cipher.decrypt(Buffer.from(all[name], 'base64'))
      },
      set: async (name, value) => {
        checkName(name)
        if (typeof value !== 'string' || value.length > MAX_VALUE)
          throw new ExtensionCallError('EXT_INVALID_SECRET', 'A secret value is a string of at most 64 KB')
        this.requireCipher()
        const all = this.read(id, bucket)
        if (!Object.hasOwn(all, name) && Object.keys(all).length >= MAX_SECRETS)
          throw new ExtensionCallError('EXT_INVALID_SECRET', `An extension can keep at most ${MAX_SECRETS} secrets`)
        all[name] = this.cipher.encrypt(value).toString('base64')
        this.write(id, all, bucket)
      },
      delete: async (name) => {
        checkName(name)
        const all = this.read(id, bucket)
        if (!Object.hasOwn(all, name)) return
        delete all[name]
        this.write(id, all, bucket)
      },
      list: async () => Object.keys(this.read(id, bucket)).sort(),
    }
  }

  /** Forget every secret of an extension (on "Remove" with "Also delete its data"). */
  clear(id) {
    fs.rmSync(this.file(id), { force: true })
    fs.rmSync(this.file(id, 'settings'), { force: true })
  }
}

/** safeStorage as a Cipher. */
function safeStorageCipher(safeStorage) {
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  }
}

module.exports = { SecretStore, safeStorageCipher }
