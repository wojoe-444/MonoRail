// Malloy's own settings: the models folder, the project queries are billed to,
// the BigQuery location, "Run queries on BigQuery" and the scan limit. Malloy
// ships with MonoRail, so these live with its backend (settings.json in the
// `malloy` module's data folder), not in a Connections entry. No Electron
// here, so tests can drive it.
//
// - Nothing is read from the models folder until the user picks one.
// - Running queries is off and the scan limit 1 GB until the user changes them.
// - Older versions kept these in a "Malloy" connection. Until settings.json
//   exists, those values are read from connections.json (read only; the old
//   entry is never changed or removed). The first save writes settings.json.
// - A damaged settings.json is never overwritten: saving refuses until the
//   user resets it.

const fs = require('node:fs/promises')
const path = require('node:path')

const SETTINGS_FILE = 'settings.json'
const GB = 1024 ** 3
const SCAN_GB = ['0.1', '1', '5', '10', '50']
const PROJECT_RE = /^([\w.-]+:)?[a-z][a-z0-9-]{4,61}[a-z0-9]$/
const LOCATION_RE = /^[A-Za-z][A-Za-z0-9-]{1,30}$/

/** Plain values with defaults: { folder, project, location, run, maxScanGb }. */
function clean(values = {}) {
  const gb = String(values.maxScanGb ?? '1')
  return {
    folder: String(values.folder ?? '').trim(),
    project: String(values.project ?? '').trim(),
    location: String(values.location ?? '').trim(),
    run: values.run === 'on' ? 'on' : 'off',
    maxScanGb: SCAN_GB.includes(gb) ? gb : '1',
  }
}

/** What malloy-lib reads, or undefined until a folder is picked. */
function settingsOf(values) {
  const v = clean(values)
  if (!v.folder) return undefined
  return {
    folder: v.folder,
    project: v.project || undefined,
    location: v.location || undefined,
    maxBytes: Math.round(Number(v.maxScanGb) * GB),
    run: v.run,
  }
}

function validate(values) {
  const v = clean(values)
  if (v.folder && !path.isAbsolute(v.folder)) throw new Error('The models folder must be a full path.')
  if (v.project && !PROJECT_RE.test(v.project)) throw new Error('That is not a Google Cloud project id (lowercase letters, digits and dashes).')
  if (v.location && !LOCATION_RE.test(v.location)) throw new Error('That is not a BigQuery location, such as US, EU or europe-west2.')
  return v
}

/**
 * The settings store. dir: Malloy's data folder; legacyDir: the Connections
 * folder, read only for a "Malloy" connection saved by older versions.
 */
function createSettingsStore({ dir, legacyDir, fsp = fs }) {
  const file = path.join(dir, SETTINGS_FILE)

  async function readOwn() {
    let text
    try {
      text = await fsp.readFile(file, 'utf8')
    } catch (e) {
      if (e?.code === 'ENOENT') return { missing: true }
      throw e
    }
    try {
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object')
      return { values: clean(data) }
    } catch {
      return { damaged: true }
    }
  }

  async function readLegacy() {
    if (!legacyDir) return undefined
    try {
      const data = JSON.parse(await fsp.readFile(path.join(legacyDir, 'connections.json'), 'utf8'))
      const values = data?.connections?.malloy?.values
      return values && typeof values === 'object' ? clean(values) : undefined
    } catch {
      return undefined
    }
  }

  /** { values, damaged?, fromConnection? }: values always has every field. */
  async function read() {
    const own = await readOwn()
    if (own.damaged) return { values: clean(), damaged: true }
    if (own.values) return { values: own.values }
    const legacy = await readLegacy()
    return legacy ? { values: legacy, fromConnection: true } : { values: clean() }
  }

  /** Merges a change into the current values and writes settings.json atomically. */
  async function save(change) {
    const cur = await read()
    if (cur.damaged) throw new Error('Malloy’s settings file is damaged. Reset the settings first.')
    const next = validate({ ...cur.values, ...change })
    await fsp.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(next, null, 2))
    await fsp.rename(tmp, file)
    return next
  }

  /** Puts the defaults back (keeps the damaged file as .damaged.bak). */
  async function reset() {
    const own = await readOwn()
    if (own.damaged) await fsp.rename(file, `${file}.damaged.bak`).catch(() => {})
    else await fsp.rm(file, { force: true })
    await fsp.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(clean(), null, 2))
    await fsp.rename(tmp, file)
    return clean()
  }

  return { read, save, reset, file }
}

module.exports = { createSettingsStore, settingsOf, validate, clean, SETTINGS_FILE, SCAN_GB, GB }
