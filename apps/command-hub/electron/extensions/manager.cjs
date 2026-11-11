// The extension manager: what is installed, what is enabled, what was granted.
//
// On disk, all under app.getPath('userData') (never the repo):
//   extensions/<id>/          installed extension files (replaced on update)
//   extensions/.staging/      packages waiting for the user's approval
//   extensions/state.json     enabled flags, sources, granted permissions and folders,
//                             and the version that last used each data folder (dataVersions, for migrate)
//   extension-secrets/<id>.json  ctx.secrets, encrypted with safeStorage (secrets.cjs)
//   extension-data/<id>/      the extension's private data (kept across updates)
//
// Extensions loaded "for development" are not copied: state.json records the
// folder and MonoRail reads it in place, so a rebuild plus Reload picks it up.
//
// This file has no Electron imports so it can be tested with plain Node;
// index.cjs wires it to IPC, dialogs and the network.

const fs = require('node:fs')
const path = require('node:path')

const {
  API_VERSION,
  apiCompatible,
  addedPermissions,
  compareVersions,
  describePermissions,
  permissionsKey,
  resolveInside,
  ID_RE,
} = require('./manifest.cjs')
const install = require('./install.cjs')
const { ExtensionCallError } = require('./errors.cjs')

const STAGE_TTL_MS = 30 * 60 * 1000

class ExtensionManager {
  /**
   * @param {object} opts
   * @param {string} opts.userData MonoRail's data folder
   * @param {import('./host.cjs').BackendHost} opts.host
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {() => void} [opts.onChange] called when the installed set or a status changes
   * @param {import('./secrets.cjs').SecretStore} [opts.secretStore]
   */
  constructor({ userData, host, fetchImpl = globalThis.fetch, onChange = () => {}, secretStore }) {
    this.secretStore = secretStore
    this.root = path.join(userData, 'extensions')
    this.dataRoot = path.join(userData, 'extension-data')
    this.stagingRoot = path.join(this.root, '.staging')
    this.stateFile = path.join(this.root, 'state.json')
    this.host = host
    this.fetchImpl = fetchImpl
    this.onChange = onChange
    this.pending = new Map()
    this.updates = new Map()
    this.revisions = new Map()
    this.state = { version: 1, extensions: {} }
  }

  // -------------------------------------------------------------- state --

  init() {
    fs.mkdirSync(this.root, { recursive: true })
    fs.rmSync(this.stagingRoot, { recursive: true, force: true })
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'))
      if (parsed && typeof parsed.extensions === 'object') this.state = parsed
    } catch {
      /* first run or unreadable: start empty */
    }
    for (const rec of this.records()) {
      if (rec.status === 'active' && rec.manifest.backend?.activation === 'startup') {
        this.host.ensure(this.spec(rec)).catch(() => {})
      }
    }
  }

  save() {
    fs.mkdirSync(this.root, { recursive: true })
    const tmp = `${this.stateFile}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
    fs.renameSync(tmp, this.stateFile)
  }

  entry(id) {
    const e = Object.hasOwn(this.state.extensions, id) ? this.state.extensions[id] : undefined
    if (!e) throw new Error(`No extension with id "${id}" is installed`)
    return e
  }

  extensionDir(id, e = this.entry(id)) {
    return e.source?.type === 'dev' ? e.source.path : path.join(this.root, id)
  }

  dataDir(id) {
    return path.join(this.dataRoot, id)
  }

  /** Everything known about one installed extension, read fresh from disk. */
  record(id) {
    const e = this.entry(id)
    const extensionDir = this.extensionDir(id, e)
    let manifest
    let error
    try {
      manifest = install.readManifest(extensionDir)
      if (manifest.id !== id) throw new Error(`Its monorail.json now says id "${manifest.id}"; expected "${id}"`)
    } catch (err) {
      error = err.message
    }
    let status
    if (error) status = 'broken'
    else if (!apiCompatible(manifest)) {
      status = 'incompatible'
      error = `Built for extension API ${manifest.apiRange}; this MonoRail provides ${API_VERSION}. Update the extension or MonoRail.`
    } else if (!e.enabled) status = 'disabled'
    else if (permissionsKey(manifest.permissions) !== permissionsKey(e.granted)) status = 'needs-approval'
    else status = 'active'
    return { id, entry: e, manifest, extensionDir, status, error }
  }

  records() {
    return Object.keys(this.state.extensions).sort().map((id) => this.record(id))
  }

  spec(rec) {
    return {
      manifest: rec.manifest,
      extensionDir: rec.extensionDir,
      dataDir: this.dataDir(rec.id),
      folders: rec.entry.folders ?? [],
      dataVersion: this.state.dataVersions?.[rec.id] ?? null,
    }
  }

  /** The backend's migrate() finished: its data folder is now at `version`. */
  recordDataVersion(id, version) {
    // Kept apart from the install record: a Remove that keeps the data keeps this too.
    this.state.dataVersions = { ...this.state.dataVersions, [id]: version }
    this.save()
  }

  /** An active extension, or a clear error. */
  active(id) {
    const rec = this.record(id)
    if (rec.status === 'active') return rec
    const why = {
      disabled: 'is turned off',
      'needs-approval': 'is waiting for you to approve its new permissions on the Extensions page',
      incompatible: 'is not compatible with this version of MonoRail',
      broken: `could not be loaded (${rec.error})`,
    }[rec.status]
    throw new ExtensionCallError('EXT_NOT_ACTIVE', `${rec.manifest?.name ?? id} ${why}`)
  }

  /** The folder served as monorail-ext://<id>/, if the extension is active and has a UI. */
  uiRoot(id) {
    if (!ID_RE.test(id) || !Object.hasOwn(this.state.extensions, id)) return undefined
    const rec = this.record(id)
    if (rec.status !== 'active' || !rec.manifest.ui) return undefined
    return resolveInside(rec.extensionDir, rec.manifest.ui)
  }

  /** The icon file of an extension, or of one of its contributions (falls back to the extension's icon). */
  iconFile(id, contributionId) {
    if (!ID_RE.test(id) || !Object.hasOwn(this.state.extensions, id)) return undefined
    const rec = this.record(id)
    if (!rec.manifest) return undefined
    const c = [...rec.manifest.contributes.modules, ...rec.manifest.contributes.apps].find((x) => x.id === contributionId)
    const rel = c?.icon ?? rec.manifest.icon
    return rel ? resolveInside(rec.extensionDir, rel) : undefined
  }

  // ------------------------------------------------------- what the UI sees --

  /** Plain-JSON summary for the renderer (Extensions page and nav). */
  list() {
    return {
      apiVersion: API_VERSION,
      extensions: this.records().map((rec) => this.summary(rec)),
    }
  }

  summary(rec) {
    const m = rec.manifest
    const e = rec.entry
    return {
      id: rec.id,
      name: m?.name ?? rec.id,
      version: m?.version ?? e.version ?? '',
      description: m?.description ?? '',
      publisher: m?.publisher ?? '',
      repository: m?.repository,
      apiRange: m?.apiRange,
      hasIcon: !!m?.icon,
      source: e.source,
      enabled: !!e.enabled,
      status: rec.status,
      error: rec.error,
      installedAt: e.installedAt,
      updatedAt: e.updatedAt,
      revision: this.revisions.get(rec.id) ?? 0,
      permissions: m ? describePermissions(m.permissions) : [],
      newPermissions: m && rec.status === 'needs-approval' ? addedPermissions(e.granted, m.permissions) : [],
      canPickFolders: !!m?.permissions.filesystem.pickFolders,
      folders: e.folders ?? [],
      contributes: m?.contributes ?? { modules: [], apps: [] },
      backend: m?.backend ? { activation: m.backend.activation, ...this.host.status(rec.id) } : undefined,
      update: this.updates.get(rec.id),
      dataDir: this.dataDir(rec.id),
      extensionDir: rec.extensionDir,
    }
  }

  // ---------------------------------------------------------------- install --

  /**
   * Stage a package and describe it for the consent dialog. Nothing runs and
   * nothing is installed until confirm(token).
   * source: { kind: 'folder' | 'zip' | 'dev', path } | { kind: 'github', repo }
   */
  async inspect(source) {
    fs.mkdirSync(this.stagingRoot, { recursive: true })
    let staged
    let src
    switch (source?.kind) {
      case 'folder':
        staged = install.stageFolder(this.stagingRoot, source.path)
        src = { type: 'folder', path: source.path }
        break
      case 'zip':
        staged = install.stageZip(this.stagingRoot, source.path)
        src = { type: 'zip', path: source.path }
        break
      case 'dev':
        staged = { token: `dev-${Date.now().toString(36)}`, root: path.resolve(source.path), manifest: install.readManifest(source.path) }
        src = { type: 'dev', path: path.resolve(source.path) }
        break
      case 'github':
        staged = await install.stageGitHub(this.stagingRoot, source.repo, this.fetchImpl)
        src = { type: 'github', repo: staged.repo, tag: staged.release.tag }
        break
      default:
        throw new Error('Unknown install source')
    }
    const m = staged.manifest
    this.pending.set(staged.token, { ...staged, source: src, at: Date.now() })
    this.prunePending()

    const existing = Object.hasOwn(this.state.extensions, m.id) ? this.state.extensions[m.id] : undefined
    let installedVersion
    if (existing) {
      try {
        installedVersion = install.readManifest(this.extensionDir(m.id, existing)).version
      } catch {
        installedVersion = existing.version
      }
    }
    return {
      token: staged.token,
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      publisher: m.publisher,
      repository: m.repository,
      source: src,
      compatible: apiCompatible(m),
      apiRange: m.apiRange,
      apiVersion: API_VERSION,
      installedVersion,
      downgrade: installedVersion ? compareVersions(m.version, installedVersion) < 0 : false,
      permissions: describePermissions(m.permissions),
      newPermissions: existing ? addedPermissions(existing.granted, m.permissions) : describePermissions(m.permissions),
      contributes: m.contributes,
      hasBackend: !!m.backend,
    }
  }

  prunePending() {
    const now = Date.now()
    for (const [token, p] of this.pending) {
      if (now - p.at < STAGE_TTL_MS) continue
      this.pending.delete(token)
      if (p.source.type !== 'dev') fs.rmSync(path.join(this.stagingRoot, token), { recursive: true, force: true })
    }
  }

  cancel(token) {
    const p = this.pending.get(token)
    if (!p) return
    this.pending.delete(token)
    if (p.source.type !== 'dev') fs.rmSync(path.join(this.stagingRoot, token), { recursive: true, force: true })
  }

  /** Install (or update) a staged package and grant the permissions it asked for. */
  async confirm(token) {
    const p = this.pending.get(token)
    if (!p) throw new Error('That install expired. Start it again.')
    this.pending.delete(token)
    const m = p.manifest
    if (!apiCompatible(m)) throw new Error(`${m.name} needs extension API ${m.apiRange}; this MonoRail provides ${API_VERSION}`)

    await this.host.stop(m.id)
    const prev = Object.hasOwn(this.state.extensions, m.id) ? this.state.extensions[m.id] : undefined
    if (p.source.type !== 'dev') {
      const target = path.join(this.root, m.id)
      const old = path.join(this.stagingRoot, `${token}-old`)
      if (fs.existsSync(target)) fs.renameSync(target, old)
      try {
        fs.renameSync(p.root, target)
      } catch (err) {
        if (fs.existsSync(old)) fs.renameSync(old, target)
        throw err
      }
      fs.rmSync(path.join(this.stagingRoot, token), { recursive: true, force: true })
      fs.rmSync(old, { recursive: true, force: true })
    } else if (prev && prev.source?.type !== 'dev') {
      // Switching an installed copy to a development folder: drop the copy.
      fs.rmSync(path.join(this.root, m.id), { recursive: true, force: true })
    }
    const now = new Date().toISOString()
    this.state.extensions[m.id] = {
      enabled: true,
      version: m.version,
      source: p.source,
      granted: m.permissions,
      // Keep granted folders across updates unless the extension stopped asking for them.
      folders: m.permissions.filesystem.pickFolders ? (prev?.folders ?? []) : [],
      installedAt: prev?.installedAt ?? now,
      updatedAt: now,
    }
    this.updates.delete(m.id)
    this.bump(m.id)
    this.save()
    fs.mkdirSync(this.dataDir(m.id), { recursive: true })
    if (m.backend?.activation === 'startup') this.host.ensure(this.spec(this.record(m.id))).catch(() => {})
    this.onChange()
    return this.summary(this.record(m.id))
  }

  async uninstall(id, { deleteData = false } = {}) {
    const e = this.entry(id)
    await this.host.stop(id)
    if (e.source?.type !== 'dev') fs.rmSync(path.join(this.root, id), { recursive: true, force: true })
    if (deleteData) {
      fs.rmSync(this.dataDir(id), { recursive: true, force: true })
      this.secretStore?.clear(id)
      if (this.state.dataVersions) delete this.state.dataVersions[id]
    }
    delete this.state.extensions[id]
    this.updates.delete(id)
    this.save()
    this.onChange()
  }

  async setEnabled(id, enabled) {
    const e = this.entry(id)
    e.enabled = !!enabled
    if (!enabled) await this.host.stop(id)
    this.bump(id)
    this.save()
    if (enabled) {
      const rec = this.record(id)
      if (rec.status === 'active' && rec.manifest.backend?.activation === 'startup') this.host.ensure(this.spec(rec)).catch(() => {})
    }
    this.onChange()
    return this.summary(this.record(id))
  }

  /** Grant the permissions an extension's current manifest asks for (after a dev reload changed them). */
  async approve(id) {
    const rec = this.record(id)
    if (!rec.manifest) throw new Error(rec.error)
    await this.host.stop(id)
    rec.entry.granted = rec.manifest.permissions
    if (!rec.manifest.permissions.filesystem.pickFolders) rec.entry.folders = []
    this.bump(id)
    this.save()
    this.onChange()
    return this.summary(this.record(id))
  }

  /** Restart the backend and reload open pages (picks up a rebuilt development folder). */
  async reload(id) {
    this.entry(id)
    await this.host.stop(id)
    this.bump(id)
    const rec = this.record(id)
    if (rec.status === 'active' && rec.manifest.backend?.activation === 'startup') this.host.ensure(this.spec(rec)).catch(() => {})
    this.onChange()
    return this.summary(rec)
  }

  bump(id) {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1)
  }

  // ---------------------------------------------------------------- updates --

  /** Check GitHub-installed extensions for newer releases. */
  async checkUpdates() {
    const results = []
    for (const rec of this.records()) {
      if (rec.entry.source?.type !== 'github') continue
      try {
        const rel = await install.latestRelease(rec.entry.source.repo, this.fetchImpl)
        const current = rec.manifest?.version ?? rec.entry.version
        if (compareVersions(rel.version, current) > 0) this.updates.set(rec.id, { version: rel.version, notes: rel.notes, publishedAt: rel.publishedAt })
        else this.updates.delete(rec.id)
        results.push({ id: rec.id, ok: true })
      } catch (err) {
        results.push({ id: rec.id, ok: false, error: err.message })
      }
    }
    this.onChange()
    return { checkedAt: new Date().toISOString(), results }
  }

  /** Stage the newest release of a GitHub-installed extension; confirm(token) applies it. */
  async stageUpdate(id) {
    const e = this.entry(id)
    if (e.source?.type !== 'github') throw new Error('Only extensions installed from GitHub can update themselves. Install the new version from its folder or .zip.')
    return this.inspect({ kind: 'github', repo: e.source.repo })
  }

  // ---------------------------------------------------------------- folders --

  /** Record a folder the user picked for this extension, then restart its backend with access to it. */
  async grantFolder(id, folderPath, write) {
    const rec = this.active(id)
    if (!rec.manifest.permissions.filesystem.pickFolders)
      throw new Error(`${rec.manifest.name} did not ask to use folders you pick ("filesystem.pickFolders")`)
    const abs = path.resolve(folderPath)
    const folders = (rec.entry.folders ?? []).filter((f) => f.path !== abs)
    folders.push({ path: abs, write: !!write })
    rec.entry.folders = folders
    this.save()
    await this.host.stop(id)
    this.onChange()
    return { path: abs, write: !!write }
  }

  async revokeFolder(id, folderPath) {
    const e = this.entry(id)
    e.folders = (e.folders ?? []).filter((f) => f.path !== folderPath)
    this.save()
    await this.host.stop(id)
    this.onChange()
    return this.summary(this.record(id))
  }

  // ---------------------------------------------------------------- backend --

  async invoke(id, method, args) {
    const rec = this.active(id)
    if (!rec.manifest.backend) throw new ExtensionCallError('EXT_NO_BACKEND', `${rec.manifest.name} has no backend`)
    return this.host.invoke(this.spec(rec), method, args)
  }

  logs(id) {
    this.entry(id)
    return this.host.getLogs(id)
  }
}

module.exports = { ExtensionManager }
