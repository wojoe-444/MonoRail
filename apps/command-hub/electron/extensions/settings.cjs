// Settings declared in an extension's manifest ("settings": [...], API 1.1).
//
// MonoRail owns the values: it renders the form (Settings > Extensions),
// validates what the user enters against the manifest, and stores it outside
// the extension's sandbox:
//   extension-settings/<id>.json            plain values (string, text, number, boolean, select)
//   extension-secrets/<id>.settings.json    "secret" fields, encrypted (secrets.cjs)
// The backend reads them with ctx.settings.get() (secrets included); pages
// read them with monorail.getSettings() (secrets left out: only whether one is set).
//
// No Electron imports, so tests run it with plain Node.

const fs = require('node:fs')
const path = require('node:path')

const { settingValueError } = require('./manifest.cjs')

class SettingsError extends Error {
  constructor(message, field) {
    super(message)
    this.name = 'SettingsError'
    this.code = 'EXT_INVALID_SETTINGS'
    if (field) this.details = { field }
  }
}

class SettingsStore {
  /** @param {{ root: string, secretStore?: import('./secrets.cjs').SecretStore }} opts root = <userData>/extension-settings */
  constructor({ root, secretStore }) {
    this.root = root
    this.secretStore = secretStore
  }

  file(id) {
    return path.join(this.root, `${id}.json`)
  }

  readStored(id) {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file(id), 'utf8'))
      return parsed && typeof parsed.values === 'object' && parsed.values ? parsed.values : {}
    } catch {
      return {}
    }
  }

  secrets(id) {
    return this.secretStore?.forExtension(id, 'settings')
  }

  /**
   * Values for the page: every non-secret field (stored value, else default,
   * else null) and, per secret field, whether one is set.
   */
  publicValues(manifest) {
    const stored = this.readStored(manifest.id)
    const setSecrets = new Set(this.secretStore ? Object.keys(this.secretStore.read(manifest.id, 'settings')) : [])
    const values = {}
    const secrets = {}
    for (const f of manifest.settings ?? []) {
      if (f.type === 'secret') secrets[f.key] = setSecrets.has(f.key)
      else values[f.key] = valueOf(f, stored)
    }
    return { values, secrets }
  }

  /** Values for the backend: everything, secrets decrypted (null when not set). */
  async backendValues(manifest) {
    const { values } = this.publicValues(manifest)
    const store = this.secrets(manifest.id)
    for (const f of manifest.settings ?? []) {
      if (f.type === 'secret') values[f.key] = store ? await store.get(f.key) : null
    }
    return values
  }

  /** Required fields that have no value yet, by title (for "needs setup"). */
  missing(manifest) {
    const { values, secrets } = this.publicValues(manifest)
    return (manifest.settings ?? [])
      .filter((f) => f.required && (f.type === 'secret' ? !secrets[f.key] : values[f.key] === null || values[f.key] === ''))
      .map((f) => f.title)
  }

  /**
   * Save what the user entered. `input` maps keys to values; a missing key
   * keeps the current value, null resets it to the default (or clears a
   * secret). Unknown keys are refused.
   */
  async save(manifest, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SettingsError('Settings must be an object')
    const fields = new Map((manifest.settings ?? []).map((f) => [f.key, f]))
    for (const k of Object.keys(input)) if (!fields.has(k)) throw new SettingsError(`${manifest.name} has no setting "${k}"`, k)

    const stored = this.readStored(manifest.id)
    const store = this.secrets(manifest.id)
    const secretWrites = []
    for (const [key, value] of Object.entries(input)) {
      const f = fields.get(key)
      if (value === null || value === undefined || (value === '' && f.type !== 'boolean')) {
        if (f.type === 'secret') secretWrites.push(() => store?.delete(key))
        else delete stored[key]
        continue
      }
      const err = settingValueError(f, value)
      if (err) throw new SettingsError(`${f.title} ${err}`, key)
      if (f.type === 'secret') {
        if (!store) throw Object.assign(new SettingsError('Secret storage is not available'), { code: 'EXT_SECRETS_UNAVAILABLE' })
        secretWrites.push(() => store.set(key, value))
      } else stored[key] = value
    }

    // Validate everything before writing anything.
    const merged = Object.fromEntries([...fields.values()].filter((f) => f.type !== 'secret').map((f) => [f.key, valueOf(f, stored)]))
    for (const f of fields.values()) {
      if (f.type === 'secret' || !f.required) continue
      if (merged[f.key] === null || merged[f.key] === '') throw new SettingsError(`${f.title} is required`, f.key)
    }
    for (const w of secretWrites) await w()
    fs.mkdirSync(this.root, { recursive: true })
    const file = this.file(manifest.id)
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ version: 1, values: stored }, null, 2))
    fs.renameSync(`${file}.tmp`, file)
  }

  /** Forget an extension's settings (on "Remove" with "Also delete its data"; secrets go with the secret store). */
  clear(id) {
    fs.rmSync(this.file(id), { force: true })
  }
}

/** A stored value that still fits the field, else the default, else null. */
function valueOf(field, stored) {
  if (Object.hasOwn(stored, field.key) && !settingValueError(field, stored[field.key])) return stored[field.key]
  return field.default ?? (field.type === 'boolean' ? false : null)
}

module.exports = { SettingsStore, SettingsError }
