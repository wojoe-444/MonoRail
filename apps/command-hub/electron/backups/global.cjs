// The global backup folder (Settings > Backups).
//
// One folder and one frequency for the whole app. When it is turned on and a
// folder is set, it is the default root for every page's backups, each page in
// its own subfolder (<folder>/github-plus, <folder>/jira-plus, ...), so the
// folder itself never fills up with loose files. A page's own folder or
// frequency, when the user sets one, still wins.
//
// Changing the folder only affects backups made from then on: MonoRail never
// moves, copies or deletes backups already made in an earlier folder (it only
// prunes old backups of its own in the folder it is writing to).
//
// "Back up before updating" (`beforeUpdate`, on by default): when the global
// folder is on, the settings backend backs up every item into
// <folder>/before-update/ before an update installs (service.cjs
// runBeforeUpdate). With no folder set it does nothing and never blocks the
// update.
//
// Stored in %APPDATA%\MonoRail\modules\backups\settings.json (the user's own
// paths stay in AppData, never in the repo). No Electron here: GitHub+'s
// scheduler and tests read it straight from disk.

const fs = require('node:fs/promises')
const path = require('node:path')

const { writeAtomic } = require('../cache/files.cjs')
const { validateFrequency } = require('./schedule.cjs')

const FOLDER = ['modules', 'backups']
const SETTINGS_FILE = 'settings.json'
const STATE_FILE = 'state.json'

/** Pages that back up into the global folder, in display order. Each gets <folder>/<id>. */
const PAGES = Object.freeze([
  { id: 'github-plus', title: 'GitHub+', what: 'Repositories you set to use the global folder on their Backups tab.' },
  { id: 'jira-plus', title: 'Jira+', what: 'Your private projects (the local git repo), as one .bundle file.' },
  { id: 'flashcards', title: 'Flashcards', what: 'All decks, cards and study history, as one .json file.' },
  { id: 'notes', title: 'Notes', what: 'All notes with their history (the local git repo), as one .bundle file.' },
  { id: 'flows', title: 'Flows', what: 'All flows with their versions (the local git repo), as one .bundle file.' },
])
/** Pages the global schedule backs up itself (GitHub+ runs its own per-repo schedules). */
const GLOBAL_ITEMS = Object.freeze(['jira-plus', 'flashcards', 'notes', 'flows'])

const DEFAULTS = Object.freeze({
  enabled: false,
  folder: '',
  times: 1,
  unit: 'day',
  keep: 14,
  items: Object.freeze({ 'jira-plus': true, flashcards: true, notes: true, flows: true }),
  beforeUpdate: true,
})

/** Subfolder of the global folder for the backups made just before an update. */
const BEFORE_UPDATE_DIR = 'before-update'
/** How many before-update backups of each item are kept. */
const BEFORE_UPDATE_KEEP = 5

const globalDir = (userData) => path.join(userData, ...FOLDER)

/** The saved global settings, with defaults for anything missing. Never throws. */
async function readGlobal(userData) {
  let raw
  try {
    raw = JSON.parse(await fs.readFile(path.join(globalDir(userData), SETTINGS_FILE), 'utf8'))
  } catch {
    raw = undefined
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS, items: { ...DEFAULTS.items } }
  let freq
  try {
    freq = validateFrequency({ times: raw.times ?? DEFAULTS.times, unit: raw.unit ?? DEFAULTS.unit, keep: raw.keep ?? DEFAULTS.keep })
  } catch {
    freq = { times: DEFAULTS.times, unit: DEFAULTS.unit, keep: DEFAULTS.keep }
  }
  const folder = typeof raw.folder === 'string' && path.isAbsolute(raw.folder) ? raw.folder : ''
  const items = { ...DEFAULTS.items }
  for (const id of GLOBAL_ITEMS) if (typeof raw.items?.[id] === 'boolean') items[id] = raw.items[id]
  const beforeUpdate = typeof raw.beforeUpdate === 'boolean' ? raw.beforeUpdate : DEFAULTS.beforeUpdate
  return { enabled: !!raw.enabled && !!folder, folder, ...freq, items, beforeUpdate }
}

/** Validate and save the global settings. Returns what was saved. */
async function writeGlobal(userData, input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup settings')
  const freq = validateFrequency(input)
  let folder = ''
  if (input.folder) {
    if (typeof input.folder !== 'string' || !path.isAbsolute(input.folder)) throw new Error('Pick a backup folder')
    folder = path.normalize(input.folder)
  }
  if (input.enabled && !folder) throw new Error('Pick a backup folder first')
  const items = {}
  for (const id of GLOBAL_ITEMS) items[id] = input.items?.[id] === undefined ? DEFAULTS.items[id] : !!input.items[id]
  const beforeUpdate = input.beforeUpdate === undefined ? DEFAULTS.beforeUpdate : !!input.beforeUpdate
  const saved = { enabled: !!input.enabled, folder, ...freq, items, beforeUpdate }
  await writeAtomic(path.join(globalDir(userData), SETTINGS_FILE), JSON.stringify(saved, null, 2))
  return saved
}

/** <folder>/<pageId> when the global folder is on, else null. */
function pageRoot(global, pageId) {
  if (!PAGES.some((p) => p.id === pageId)) throw new Error(`Unknown backup page: ${pageId}`)
  return global?.enabled && global.folder ? path.join(global.folder, pageId) : null
}

/** <folder>/before-update when the global folder is on and backing up before updates is too, else null. */
function beforeUpdateRoot(global) {
  return global?.enabled && global.folder && global.beforeUpdate ? path.join(global.folder, BEFORE_UPDATE_DIR) : null
}

/** The short summary pages show next to "Use the global backup folder". */
const summary = (g) => ({ enabled: g.enabled, folder: g.folder, times: g.times, unit: g.unit, keep: g.keep })

module.exports = { PAGES, GLOBAL_ITEMS, DEFAULTS, BEFORE_UPDATE_DIR, BEFORE_UPDATE_KEEP, beforeUpdateRoot, SETTINGS_FILE, STATE_FILE, globalDir, readGlobal, writeGlobal, pageRoot, summary }
