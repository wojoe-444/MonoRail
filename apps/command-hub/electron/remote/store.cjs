// Remote access files, in the machine-wide `modules/remote` data folder
// (docs/remote-access.md). No Electron dependency, so tests run under Node.
//
//   settings.json  { enabled, port, allowedLogins[], agentFromPhone }
//   devices.json   [{ id, name, agent, keyHash, pairedAt, lastSeen }]  (sha-256 of each key, never the key)
//   audit.jsonl    one line per remote call worth showing: device, module, method, outcome, ms
//
// A damaged settings or devices file is never overwritten: it reads as
// "off / no devices" and the page says it is damaged.

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { writeAtomic } = require('../cache/files.cjs')

const SETTINGS_FILE = 'settings.json'
const DEVICES_FILE = 'devices.json'
const AUDIT_FILE = 'audit.jsonl'
const DEFAULT_PORT = 5170
const AUDIT_MAX_BYTES = 512 * 1024
const AUDIT_KEEP_LINES = 1000
const MAX_DEVICES = 20
const MAX_LOGINS = 10
const LOGIN_RE = /^[^\s@]{1,64}@[^\s@]{1,190}$|^[\w.-]{1,64}@github$/

const DEFAULTS = Object.freeze({ enabled: false, port: DEFAULT_PORT, allowedLogins: [], agentFromPhone: false })

async function readJson(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return { missing: true }
    return { damaged: true }
  }
  try {
    return { value: JSON.parse(text) }
  } catch {
    return { damaged: true }
  }
}

function cleanLogin(login) {
  const s = String(login ?? '').trim().toLowerCase()
  return LOGIN_RE.test(s) ? s : undefined
}

function cleanSettings(v) {
  const s = v && typeof v === 'object' ? v : {}
  const port = Number.isInteger(s.port) && s.port >= 1024 && s.port <= 65535 ? s.port : DEFAULT_PORT
  const logins = Array.isArray(s.allowedLogins) ? [...new Set(s.allowedLogins.map(cleanLogin).filter(Boolean))].slice(0, MAX_LOGINS) : []
  return { enabled: s.enabled === true, port, allowedLogins: logins, agentFromPhone: s.agentFromPhone === true }
}

function createRemoteStore(dir) {
  const file = (name) => path.join(dir, name)

  async function readSettings() {
    const r = await readJson(file(SETTINGS_FILE))
    if (r.damaged) return { ...DEFAULTS, damaged: true }
    return cleanSettings(r.value)
  }

  async function writeSettings(patch) {
    const r = await readJson(file(SETTINGS_FILE))
    if (r.damaged) throw new Error('The Remote access settings file is damaged. Delete it to start over.')
    const next = cleanSettings({ ...cleanSettings(r.value), ...patch })
    await fs.mkdir(dir, { recursive: true })
    await writeAtomic(file(SETTINGS_FILE), `${JSON.stringify(next, null, 2)}\n`)
    return next
  }

  async function readDevicesRaw() {
    const r = await readJson(file(DEVICES_FILE))
    if (r.damaged) return { damaged: true, devices: [] }
    const list = Array.isArray(r.value) ? r.value : []
    return {
      devices: list.filter((d) => d && typeof d.id === 'string' && typeof d.keyHash === 'string' && /^[0-9a-f]{64}$/.test(d.keyHash)),
    }
  }

  async function writeDevices(devices) {
    await fs.mkdir(dir, { recursive: true })
    await writeAtomic(file(DEVICES_FILE), `${JSON.stringify(devices, null, 2)}\n`)
  }

  async function mutateDevices(fn) {
    const r = await readDevicesRaw()
    if (r.damaged) throw new Error('The paired devices file is damaged. Delete it to start over.')
    const next = fn(r.devices)
    await writeDevices(next)
    return next
  }

  /** Devices without their key hashes (what the page sees). */
  async function listDevices() {
    const r = await readDevicesRaw()
    return { damaged: !!r.damaged, devices: r.devices.map(({ keyHash: _k, ...d }) => d) }
  }

  /** Pair a new device. Returns { device, key }; the key is shown to the device once, in a cookie. */
  async function addDevice({ name, agent }) {
    const key = crypto.randomBytes(32).toString('base64url')
    const now = new Date().toISOString()
    const device = {
      id: crypto.randomUUID(),
      name: cleanName(name) || 'Phone',
      agent: describeAgent(agent),
      keyHash: hashKey(key),
      pairedAt: now,
      lastSeen: now,
    }
    await mutateDevices((list) => {
      if (list.length >= MAX_DEVICES) throw new Error(`At most ${MAX_DEVICES} devices can be paired. Revoke one first.`)
      return [...list, device]
    })
    const { keyHash: _k, ...shown } = device
    return { device: shown, key }
  }

  /** The device a key belongs to, or undefined. */
  async function deviceForKey(key) {
    if (typeof key !== 'string' || key.length < 20 || key.length > 200) return undefined
    const h = hashKey(key)
    const r = await readDevicesRaw()
    const d = r.devices.find((x) => crypto.timingSafeEqual(Buffer.from(x.keyHash), Buffer.from(h)))
    if (!d) return undefined
    const { keyHash: _k, ...shown } = d
    return shown
  }

  async function touchDevice(id) {
    const now = new Date().toISOString()
    await mutateDevices((list) => list.map((d) => (d.id === id ? { ...d, lastSeen: now } : d)))
  }

  async function renameDevice(id, name) {
    const clean = cleanName(name)
    if (!clean) throw new Error('Give the device a name.')
    await mutateDevices((list) => list.map((d) => (d.id === id ? { ...d, name: clean } : d)))
  }

  async function revokeDevice(id) {
    await mutateDevices((list) => list.filter((d) => d.id !== id))
  }

  async function revokeAll() {
    const r = await readDevicesRaw()
    if (r.damaged) return
    await writeDevices([])
  }

  async function appendAudit(entry) {
    const f = file(AUDIT_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(f, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
    try {
      if ((await fs.stat(f)).size > AUDIT_MAX_BYTES) {
        const lines = (await fs.readFile(f, 'utf8')).split('\n').filter(Boolean)
        await writeAtomic(f, `${lines.slice(-AUDIT_KEEP_LINES).join('\n')}\n`)
      }
    } catch {
      // Trimming is best effort; the next call tries again.
    }
  }

  async function readAudit({ limit = 100 } = {}) {
    let text
    try {
      text = await fs.readFile(file(AUDIT_FILE), 'utf8')
    } catch {
      return []
    }
    const out = []
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      if (!lines[i]) continue
      try {
        out.push(JSON.parse(lines[i]))
      } catch {
        // A line cut by a crash: skip it.
      }
    }
    return out
  }

  async function clearAudit() {
    await fs.rm(file(AUDIT_FILE), { force: true })
  }

  return {
    dir,
    readSettings,
    writeSettings,
    listDevices,
    addDevice,
    deviceForKey,
    touchDevice,
    renameDevice,
    revokeDevice,
    revokeAll,
    appendAudit,
    readAudit,
    clearAudit,
  }
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function cleanName(name) {
  return String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 40)
}

/** "Chrome on Android" from a user agent; never the raw string. */
function describeAgent(ua) {
  const s = String(ua ?? '')
  const os = /iPhone/.test(s) ? 'iOS' : /iPad/.test(s) ? 'iPadOS' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : ''
  const browser = /EdgA?\//.test(s) ? 'Edge' : /Firefox|FxiOS/.test(s) ? 'Firefox' : /CriOS|Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : ''
  if (browser && os) return `${browser} on ${os}`
  return browser || os || 'Browser'
}

module.exports = { createRemoteStore, cleanLogin, describeAgent, hashKey, SETTINGS_FILE, DEVICES_FILE, AUDIT_FILE, DEFAULT_PORT }
