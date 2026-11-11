// Extension manifest (monorail.json): parsing, validation and the API version.
//
// An extension is a folder (or a .zip of one) with a monorail.json at its root.
// It can contribute modules (pages inside the hub) and apps (full-screen),
// whose UI is static HTML served from the extension's `ui` folder into a
// sandboxed iframe, plus an optional Node backend that runs in its own
// restricted process (see host.cjs and runner.cjs).
//
// The extension API is versioned with semver. An extension states the range it
// was built for in `engines.monorail`, e.g. "^1.0.0". A new minor version of the
// API only adds things; a new major version may break extensions, which then
// stay installed but are not loaded until they are updated.

const path = require('node:path')

/** The extension API this build of MonoRail implements. */
const API_VERSION = '1.0.0'
const MANIFEST_FILE = 'monorail.json'
const MANIFEST_VERSION = 1

const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const HOST_RE = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/i
const COMMAND_RE = /^[A-Za-z0-9._-]+$/
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

class ManifestError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ManifestError'
  }
}

// ---------------------------------------------------------------- semver --

function parseVersion(v) {
  const m = SEMVER_RE.exec(String(v ?? '').trim())
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? '' }
}

/** Compare two versions: -1, 0 or 1. Invalid versions sort first. */
function compareVersions(a, b) {
  const x = parseVersion(a)
  const y = parseVersion(b)
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1 // 1.0.0 > 1.0.0-beta
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

/**
 * Does `version` satisfy `range`? Supports what manifests need: "^1.2.0",
 * "~1.2.0", ">=1.2.0", "1.2.0", "1", "1.x" and "*".
 */
function satisfies(version, range) {
  const v = parseVersion(version)
  if (!v) return false
  const r = String(range ?? '').trim()
  if (r === '*' || r === '') return true
  let m
  if ((m = /^(\d+)(?:\.x)?$/.exec(r))) return v.major === +m[1]
  if ((m = /^(\d+)\.(\d+)(?:\.x)?$/.exec(r))) return v.major === +m[1] && v.minor === +m[2]
  const op = /^(\^|~|>=)?\s*(.+)$/.exec(r)
  const base = parseVersion(op[2])
  if (!base) return false
  const cmp = compareVersions(version, op[2])
  switch (op[1]) {
    case '^':
      if (cmp < 0) return false
      if (base.major > 0) return v.major === base.major
      return v.major === 0 && v.minor === base.minor
    case '~':
      return cmp >= 0 && v.major === base.major && v.minor === base.minor
    case '>=':
      return cmp >= 0
    default:
      return cmp === 0
  }
}

// ------------------------------------------------------------ validation --

function str(obj, key, where, { required = true, max = 200 } = {}) {
  const v = obj[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ManifestError(`${where}.${key} is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new ManifestError(`${where}.${key} must be a string`)
  if (v.length > max) throw new ManifestError(`${where}.${key} is longer than ${max} characters`)
  return v
}

/** A path inside the extension folder: relative, forward slashes, no "..". */
function relPath(value, where) {
  if (typeof value !== 'string' || !value) throw new ManifestError(`${where} must be a relative path`)
  const clean = value.replace(/\\/g, '/').replace(/^\.\//, '')
  if (clean.startsWith('/') || /^[A-Za-z]:/.test(clean) || clean.split('/').includes('..'))
    throw new ManifestError(`${where} must stay inside the extension folder`)
  return clean
}

function contribution(c, i, kind) {
  const where = `contributes.${kind}[${i}]`
  if (!c || typeof c !== 'object') throw new ManifestError(`${where} must be an object`)
  const id = str(c, 'id', where, { max: 40 })
  if (!ID_RE.test(id)) throw new ManifestError(`${where}.id must be kebab-case (a-z, 0-9, -)`)
  const entry = str(c, 'entry', where, { max: 300 })
  const [file, hash = ''] = entry.split('#')
  const out = {
    id,
    title: str(c, 'title', where, { max: 60 }),
    description: str(c, 'description', where, { required: false, max: 200 }) ?? '',
    entry: relPath(file, `${where}.entry`) + (hash ? `#${hash}` : ''),
    icon: c.icon === undefined ? undefined : relPath(c.icon, `${where}.icon`),
  }
  if (kind === 'modules') {
    const nav = c.nav ?? {}
    out.nav = {
      section: typeof nav.section === 'string' && nav.section ? nav.section.slice(0, 40) : 'Extensions',
      order: Number.isFinite(nav.order) ? nav.order : 100,
    }
  }
  return out
}

function stringList(value, where, re, label) {
  if (!Array.isArray(value) || value.length === 0) throw new ManifestError(`${where} must be true or a non-empty list`)
  return [...new Set(value.map((v) => {
    if (typeof v !== 'string' || !re.test(v)) throw new ManifestError(`${where} has an invalid ${label}: ${JSON.stringify(v)}`)
    return v.toLowerCase()
  }))].sort()
}

/**
 * Normalize the permissions block. Every field is opt-in; an extension that
 * declares nothing can only use its own data folder and talk to its own UI.
 *
 *   network:    true (any host) | ["api.example.com", "*.example.com", "localhost:25565"]
 *   process:    true (any program) | ["git", "java"]   (running programs = full trust)
 *   filesystem: { read: ["~/.minecraft"], write: ["~/x"], pickFolders: true }
 */
function normalizePermissions(p = {}) {
  if (typeof p !== 'object' || Array.isArray(p)) throw new ManifestError('permissions must be an object')
  const known = new Set(['network', 'process', 'filesystem'])
  for (const k of Object.keys(p)) if (!known.has(k)) throw new ManifestError(`Unknown permission "${k}"`)

  const out = { network: false, process: false, filesystem: { read: [], write: [], pickFolders: false } }
  if (p.network !== undefined && p.network !== false)
    out.network = p.network === true ? true : stringList(p.network, 'permissions.network', HOST_RE, 'host')
  if (p.process !== undefined && p.process !== false)
    out.process = p.process === true ? true : stringList(p.process, 'permissions.process', COMMAND_RE, 'program name')

  const fsp = p.filesystem ?? {}
  if (typeof fsp !== 'object' || Array.isArray(fsp)) throw new ManifestError('permissions.filesystem must be an object')
  for (const k of Object.keys(fsp))
    if (!['read', 'write', 'pickFolders'].includes(k)) throw new ManifestError(`Unknown filesystem permission "${k}"`)
  const paths = (key) => {
    const list = fsp[key] ?? []
    if (!Array.isArray(list)) throw new ManifestError(`permissions.filesystem.${key} must be a list`)
    return [...new Set(list.map((v) => {
      if (typeof v !== 'string' || !(v.startsWith('~/') || v === '~'))
        throw new ManifestError(`permissions.filesystem.${key} paths must start with ~/ (the user's home folder)`)
      if (v.split('/').includes('..')) throw new ManifestError(`permissions.filesystem.${key} paths must not contain ".."`)
      return v.replace(/\/+$/, '') || '~'
    }))].sort()
  }
  out.filesystem.write = paths('write')
  out.filesystem.read = paths('read').filter((r) => !out.filesystem.write.includes(r))
  out.filesystem.pickFolders = fsp.pickFolders === true
  return out
}

/** Stable string form, used to tell whether an update asks for new permissions. */
function permissionsKey(p) {
  return JSON.stringify(p)
}

/** Permissions in `next` that `prev` did not grant (for "this update asks for more" prompts). */
function addedPermissions(prev, next) {
  if (!prev) return describePermissions(next)
  const was = new Set(describePermissions(prev).map((d) => d.key))
  return describePermissions(next).filter((d) => !was.has(d.key))
}

/** Human-readable list for the consent dialog, with a risk level per line. */
function describePermissions(p) {
  const out = []
  if (p.network === true) out.push({ key: 'net:*', kind: 'network', risk: 'medium', label: 'Connect to any server on the internet or your network' })
  else if (Array.isArray(p.network))
    for (const h of p.network) out.push({ key: `net:${h}`, kind: 'network', risk: 'low', label: `Connect to ${h}` })
  if (p.process === true) out.push({ key: 'proc:*', kind: 'process', risk: 'high', label: 'Run any program on this computer' })
  else if (Array.isArray(p.process))
    for (const c of p.process) out.push({ key: `proc:${c}`, kind: 'process', risk: 'high', label: `Run the program "${c}"` })
  for (const r of p.filesystem.read) out.push({ key: `read:${r}`, kind: 'filesystem', risk: 'medium', label: `Read files in ${r}` })
  for (const w of p.filesystem.write) out.push({ key: `write:${w}`, kind: 'filesystem', risk: 'high', label: `Read and change files in ${w}` })
  if (p.filesystem.pickFolders)
    out.push({ key: 'pick', kind: 'filesystem', risk: 'low', label: 'Ask you for access to folders you choose' })
  return out
}

/**
 * Validate a parsed monorail.json. Returns a normalized manifest or throws
 * ManifestError with a message fit to show the user.
 */
function validateManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ManifestError(`${MANIFEST_FILE} must be a JSON object`)
  if (raw.manifestVersion !== MANIFEST_VERSION)
    throw new ManifestError(`manifestVersion must be ${MANIFEST_VERSION} (this MonoRail reads manifest version ${MANIFEST_VERSION})`)

  const id = str(raw, 'id', 'manifest', { max: 40 })
  if (!ID_RE.test(id)) throw new ManifestError('id must be kebab-case: lowercase letters, digits and dashes')
  const version = str(raw, 'version', 'manifest', { max: 40 })
  if (!parseVersion(version)) throw new ManifestError(`version "${version}" is not a semver version like 1.0.0`)

  const engines = raw.engines ?? {}
  const apiRange = typeof engines.monorail === 'string' ? engines.monorail : undefined
  if (!apiRange) throw new ManifestError('engines.monorail is required, e.g. "^1.0.0"')

  let repository
  if (raw.repository !== undefined) {
    const r = String(raw.repository).replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '')
    if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r)) throw new ManifestError('repository must be a GitHub "owner/name"')
    repository = r
  }

  const contributes = raw.contributes ?? {}
  const modules = (contributes.modules ?? []).map((c, i) => contribution(c, i, 'modules'))
  const apps = (contributes.apps ?? []).map((c, i) => contribution(c, i, 'apps'))
  const ids = new Set()
  for (const c of [...modules, ...apps]) {
    if (ids.has(c.id)) throw new ManifestError(`Two contributions use the id "${c.id}"`)
    ids.add(c.id)
  }

  let backend
  if (raw.backend !== undefined) {
    if (!raw.backend || typeof raw.backend !== 'object') throw new ManifestError('backend must be an object')
    const activation = raw.backend.activation ?? 'onDemand'
    if (!['onDemand', 'startup'].includes(activation)) throw new ManifestError('backend.activation must be "onDemand" or "startup"')
    backend = { main: relPath(raw.backend.main, 'backend.main'), activation }
  }

  if (modules.length + apps.length === 0 && !backend)
    throw new ManifestError('The extension contributes nothing: add contributes.modules, contributes.apps or a backend')

  return {
    manifestVersion: MANIFEST_VERSION,
    id,
    name: str(raw, 'name', 'manifest', { max: 60 }),
    version,
    description: str(raw, 'description', 'manifest', { required: false, max: 300 }) ?? '',
    publisher: str(raw, 'publisher', 'manifest', { required: false, max: 60 }) ?? '',
    repository,
    apiRange,
    icon: raw.icon === undefined ? undefined : relPath(raw.icon, 'icon'),
    ui: raw.ui === undefined ? (modules.length + apps.length ? 'ui' : undefined) : relPath(raw.ui, 'ui'),
    contributes: { modules, apps },
    backend,
    permissions: normalizePermissions(raw.permissions),
  }
}

/** Is this manifest's API range one this MonoRail can load? */
function apiCompatible(manifest) {
  return satisfies(API_VERSION, manifest.apiRange)
}

/** Resolve a path from the manifest inside the extension folder, refusing escapes. */
function resolveInside(root, rel) {
  const full = path.resolve(root, rel)
  const base = path.resolve(root)
  if (full !== base && !full.startsWith(base + path.sep)) throw new ManifestError(`Path escapes the extension folder: ${rel}`)
  return full
}

module.exports = {
  API_VERSION,
  MANIFEST_FILE,
  ManifestError,
  validateManifest,
  normalizePermissions,
  describePermissions,
  addedPermissions,
  permissionsKey,
  apiCompatible,
  parseVersion,
  compareVersions,
  satisfies,
  resolveInside,
  ID_RE,
}
