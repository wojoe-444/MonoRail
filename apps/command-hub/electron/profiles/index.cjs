// Profiles: whose settings and data a backend reads (docs/profiles.md).
//
// A profile is a person's settings and data inside one copy of MonoRail. There
// are no passwords and no sign-in: a profile is a name and a folder. Today
// every install has exactly one, the default profile, and its folder IS the
// data folder MonoRail has always used (electron/userData.cjs). Nothing is
// moved, renamed or copied to make that true: the default profile reads every
// existing file in place.
//
// Data is in one of two scopes:
//   machine  belongs to this copy of MonoRail on this computer, whoever uses
//            it: installed extensions, updates, Chromium's own files and the
//            safeStorage key, caches of this computer's agent logs, drive
//            measurements, and profiles.json itself.
//   profile  belongs to the person: appearance, connections and secrets,
//            backups, Flashcards decks, Jira+ / GitHub+ / Email data, Chat's
//            allowed folders and flags, Agent access consent.
//
// Folders:
//   machineDir                      the data folder (%APPDATA%\MonoRail)
//   machineDir\profiles.json        the profile list (written only when the
//                                   user changes a profile; absent = default)
//   profileDir(default)             = machineDir (existing data, in place)
//   profileDir(<id>)                = machineDir\profiles\<id> (future profiles)
// A backend folder such as 'modules/flashcards' resolves under profileDir or
// machineDir by its scope in SCOPES. Every backend folder must be listed there
// (a test checks), so new data always has a declared owner.
//
// No Electron dependency: the MCP server (electron/mcp) reads profiles too.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const DEFAULT_PROFILE_ID = 'default'
/**
 * Developer Mode's test profile: hidden from profile lists, and wiped to a
 * blank slate every time it is switched to (docs/profiles.md, "New User").
 * Its folder is always machineDir\profiles\new-user; nothing else is ever
 * deleted.
 */
const NEW_USER_ID = 'new-user'
const NEW_USER_NAME = 'New User'
const PROFILES_FILE = 'profiles.json'
const PROFILES_DIR = 'profiles'
const VERSION = 1
const MAX_NAME = 60
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/

/**
 * Scope of every backend data folder, relative to a data root. 'profile'
 * folders live in the active profile's folder, 'machine' folders in the
 * machine folder. Root-level folders that are not backend folders are listed
 * too, so the whole data folder is accounted for.
 */
const SCOPES = Object.freeze({
  // Module backends (electron/modules)
  'modules/agent-catalog': 'machine', // backup copies of subagent files, which live machine-wide in ~/.claude and ~/.pi
  'modules/agent-chat': 'profile', // allowed folders, chat flags, prompts, costs
  'modules/agents': 'profile', // keeps no files
  'modules/backups': 'profile', // global backup folder and schedule
  'modules/claude-stats': 'machine', // report built from this computer's agent logs
  'modules/connections': 'profile', // accounts and encrypted secrets
  'modules/developer': 'machine', // Developer Mode tools; keeps no files
  'modules/extensions': 'machine', // keeps no files; extensions are machine-wide
  'modules/flashcards': 'profile', // decks, cards, study history
  'modules/flows': 'profile', // the Flows page's local git repo and run metadata
  'modules/home': 'profile', // keeps no files
  'modules/jira': 'profile', // Jira+'s legacy folder (read in place)
  'modules/mcp': 'profile', // per-agent consent and the activity log
  'modules/notes': 'profile', // the Notes page's local git repo
  'modules/profiles': 'machine', // keeps no files; profiles.json is at the root
  'modules/settings': 'machine', // app version and updates; keeps no files
  'modules/storage': 'machine', // drive and folder sizes of this computer
  'modules/docker': 'machine', // this computer's Docker; keeps no files
  'modules/semantic': 'profile', // dbt project and MetricFlow (settings in Connections); keeps no files
  'modules/remote': 'machine', // Remote access: this PC's server, paired devices, activity
  // App backends (electron/apps)
  'apps/email': 'profile', // accounts and encrypted tokens
  'apps/github-plus': 'profile', // recents and backup schedules
  'apps/jira-plus': 'profile', // private projects repo, links, JQL
  // Root-level folders (not backends)
  extensions: 'machine', // installed extension files and state.json
  'extension-data': 'machine', // phase 2: per profile (docs/profiles.md)
  'extension-settings': 'machine', // phase 2: per profile
  'extension-secrets': 'machine', // phase 2: per profile
})

class ProfileError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

function defaultProfile() {
  return { id: DEFAULT_PROFILE_ID, name: '', createdAt: null }
}

function cleanName(name) {
  if (typeof name !== 'string') throw new ProfileError('A profile name must be text.', 'invalid')
  // Control characters out, whitespace collapsed.
  // oxlint-disable-next-line no-control-regex
  const v = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (v.length > MAX_NAME) throw new ProfileError(`A profile name can be at most ${MAX_NAME} characters.`, 'invalid')
  return v
}

function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id)
}

/**
 * Parse profiles.json. Returns { state, damaged }. A missing file is the
 * implicit default profile; a damaged one is reported so it is never
 * overwritten, and the default profile is used meanwhile.
 */
function parseProfiles(text) {
  if (text == null) return { state: { version: VERSION, activeId: DEFAULT_PROFILE_ID, profiles: [defaultProfile()] }, damaged: false }
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    raw = null
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.profiles)) {
    return { state: parseProfiles(null).state, damaged: true }
  }
  const profiles = []
  const seen = new Set()
  for (const p of raw.profiles) {
    if (!p || !isValidId(p.id) || seen.has(p.id)) continue
    seen.add(p.id)
    let name = ''
    try {
      name = cleanName(typeof p.name === 'string' ? p.name : '')
    } catch {
      name = String(p.name).slice(0, MAX_NAME)
    }
    const entry = { id: p.id, name, createdAt: typeof p.createdAt === 'string' ? p.createdAt : null }
    // The New User profile is always hidden and blank, whatever the file says.
    if (p.id === NEW_USER_ID) Object.assign(entry, { hidden: true, blank: true })
    profiles.push(entry)
  }
  // The default profile always exists: it owns the data that was there first.
  if (!seen.has(DEFAULT_PROFILE_ID)) profiles.unshift(defaultProfile())
  const known = (id) => id === DEFAULT_PROFILE_ID || seen.has(id)
  const activeId = known(raw.activeId) ? raw.activeId : DEFAULT_PROFILE_ID
  const state = { version: VERSION, activeId, profiles }
  // Where "Switch back" goes from a blank test profile.
  if (known(raw.previousId) && raw.previousId !== NEW_USER_ID) state.previousId = raw.previousId
  // A blank profile waiting to be wiped at the next start (only ever new-user).
  if (raw.pendingReset === NEW_USER_ID && seen.has(NEW_USER_ID)) state.pendingReset = NEW_USER_ID
  return { state, damaged: false }
}

function readProfilesSync(machineDir) {
  let text = null
  try {
    text = fs.readFileSync(path.join(machineDir, PROFILES_FILE), 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') return { state: parseProfiles(null).state, damaged: true }
  }
  return parseProfiles(text)
}

/** Root folder of a profile's data. The default profile's is the machine folder itself. */
function profileDir(machineDir, id) {
  if (id === DEFAULT_PROFILE_ID) return machineDir
  if (!isValidId(id)) throw new ProfileError(`Not a profile id: ${id}`, 'invalid')
  return path.join(machineDir, PROFILES_DIR, id)
}

function scopeOf(folder) {
  const scope = Object.hasOwn(SCOPES, folder) ? SCOPES[folder] : undefined
  if (!scope) throw new ProfileError(`No scope declared for data folder "${folder}" (add it to SCOPES in electron/profiles/index.cjs)`, 'undeclared')
  return scope
}

/**
 * The data layout for one profile: where each folder lives. Pure; creates
 * nothing. `folder('modules/flashcards')` returns the absolute path.
 */
function createLayout(machineDir, profileId = DEFAULT_PROFILE_ID) {
  const pDir = profileDir(machineDir, profileId)
  return Object.freeze({
    machineDir,
    profileDir: pDir,
    profileId,
    folder(rel) {
      const parts = rel.split('/')
      return path.join(scopeOf(rel) === 'profile' ? pDir : machineDir, ...parts)
    },
  })
}

/**
 * Where a folder lives, for code that accepts either a plain data root (a
 * string, the single-profile layout used by tests and older callers) or a
 * layout from createLayout.
 */
function folderOf(root, rel) {
  if (typeof root === 'string') return path.join(root, ...rel.split('/'))
  return root.folder(rel)
}

/** The layout of the active profile, read from profiles.json (sync, read-only). */
function activeLayout(machineDir) {
  const { state } = readProfilesSync(machineDir)
  return createLayout(machineDir, state.activeId)
}

async function writeAtomic(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await fsp.rename(tmp, file)
}

/**
 * The profile store over a machine folder. Reads are cached in memory and
 * never create files; profiles.json is written only by an explicit change
 * (rename), atomically, and never over a damaged file.
 */
function createProfileStore(machineDir, { now = () => new Date() } = {}) {
  let cached
  // The profile this run started with. A switch takes effect at the next
  // start, so until then every backend keeps reading the profile it began in.
  let running

  function load() {
    cached ??= readProfilesSync(machineDir)
    running ??= cached.state.activeId
    return cached
  }

  function describe(p, activeId) {
    return {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      active: p.id === activeId,
      isDefault: p.id === DEFAULT_PROFILE_ID,
      hidden: !!p.hidden,
      blank: !!p.blank,
    }
  }

  function active() {
    const { state } = load()
    return state.profiles.find((p) => p.id === running) ?? defaultProfile()
  }

  return {
    machineDir,
    /** The active profile: { id, name, createdAt }. */
    active,
    layout() {
      return createLayout(machineDir, active().id)
    },
    /** Profiles for the page, with where their data lives. */
    list() {
      const { state, damaged } = load()
      return {
        activeId: running,
        /** The profile the next start opens, when a switch is waiting for a restart. */
        nextId: state.activeId !== running ? state.activeId : null,
        previousId: state.previousId ?? null,
        damaged,
        profiles: state.profiles.map((p) => ({ ...describe(p, running), dataDir: profileDir(machineDir, p.id) })),
      }
    },
    /** Set a profile's display name (empty = no name). The first change creates profiles.json. */
    async rename(id, name) {
      const clean = cleanName(name)
      cached = undefined
      const { state, damaged } = load()
      if (damaged) {
        throw new ProfileError(`${PROFILES_FILE} in the data folder cannot be read, so MonoRail will not overwrite it. Fix or remove the file, then try again.`, 'damaged')
      }
      const p = state.profiles.find((x) => x.id === id)
      if (!p) throw new ProfileError(`No profile "${id}".`, 'not-found')
      const next = {
        ...state,
        profiles: state.profiles.map((x) => (x.id === id ? { ...x, name: clean, createdAt: x.createdAt ?? now().toISOString() } : x)),
      }
      await writeAtomic(path.join(machineDir, PROFILES_FILE), next)
      cached = { state: next, damaged: false }
      return describe(next.profiles.find((x) => x.id === id), running)
    },
    /**
     * Make a profile the active one from the next start. Switching to the New
     * User profile creates it on first use and marks it to be wiped to a blank
     * slate at that start (resetBlankProfile), so it is empty every time.
     * Writes profiles.json atomically, never over a damaged file. The caller
     * restarts the app: every backend reads the active profile when it starts.
     */
    async switchTo(id) {
      cached = undefined
      const { state, damaged } = load()
      if (damaged) {
        throw new ProfileError(`${PROFILES_FILE} in the data folder cannot be read, so MonoRail will not overwrite it. Fix or remove the file, then try again.`, 'damaged')
      }
      let list = state.profiles
      if (id === NEW_USER_ID && !list.some((p) => p.id === NEW_USER_ID)) {
        list = [...list, { id: NEW_USER_ID, name: NEW_USER_NAME, createdAt: now().toISOString(), hidden: true, blank: true }]
      }
      const target = list.find((p) => p.id === id)
      if (!target) throw new ProfileError(`No profile "${id}".`, 'not-found')
      const next = { version: VERSION, activeId: id, profiles: list }
      // Remember the person's own profile so the test profile can switch back.
      const from = state.activeId !== NEW_USER_ID ? state.activeId : state.previousId
      if (id === NEW_USER_ID) {
        if (from) next.previousId = from
        next.pendingReset = NEW_USER_ID
      }
      await writeAtomic(path.join(machineDir, PROFILES_FILE), next)
      cached = { state: next, damaged: false }
      return describe(target, running)
    },
    /** Forget the in-memory copy (tests, or after another process wrote the file). */
    reload() {
      cached = undefined
      running = undefined
    },
  }
}

/**
 * At start-up, before any backend opens a file: if the New User profile is
 * active and marked for a reset, delete its folder (and only that folder) so
 * it starts blank, then clear the mark. Returns true when it wiped the folder.
 * Never touches the default profile or any other profile's data.
 */
function resetBlankProfile(machineDir) {
  const file = path.join(machineDir, PROFILES_FILE)
  const { state, damaged } = readProfilesSync(machineDir)
  if (damaged || state.activeId !== NEW_USER_ID || state.pendingReset !== NEW_USER_ID) return false
  const dir = profileDir(machineDir, NEW_USER_ID)
  // Belt and braces: the folder must be exactly <machineDir>/profiles/new-user.
  const expected = path.join(path.resolve(machineDir), PROFILES_DIR, NEW_USER_ID)
  if (path.resolve(dir) !== expected || expected === path.resolve(machineDir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  const next = { ...state }
  delete next.pendingReset
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, file)
  return true
}

// ---------- the app's instance (main process) ----------

let instance
/** The profile store over app.getPath('userData'). Main process only. */
function profiles() {
  if (instance) return instance
  const { app } = require('electron')
  instance = createProfileStore(app.getPath('userData'))
  return instance
}

/** The active profile's layout in the main process. */
function appLayout() {
  return profiles().layout()
}

module.exports = {
  DEFAULT_PROFILE_ID,
  NEW_USER_ID,
  NEW_USER_NAME,
  PROFILES_FILE,
  PROFILES_DIR,
  SCOPES,
  ProfileError,
  activeLayout,
  appLayout,
  cleanName,
  createLayout,
  createProfileStore,
  folderOf,
  isValidId,
  parseProfiles,
  profileDir,
  profiles,
  readProfilesSync,
  resetBlankProfile,
  scopeOf,
}
