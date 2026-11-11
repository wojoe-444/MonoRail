// The one declared place for every cache and every file in a backend's data
// folder (docs/caching.md explains the rules).
//
// CACHES: each entry is a cache that the primitives in electron/cache open by
// id. Its time limits live here and nowhere else, and a test checks them.
//   id          '<owner>.<name>'
//   folder      data folder under userData ('modules/<id>' or 'apps/<id>')
//   tier        what kind of result it holds:
//                 report       expensive build, saved to disk, rebuilt on a schedule
//                 check        a keyed check result (connector, sign-in)
//                 list         a short-lived keyed list, cleared on change
//                 incremental  per-file state of a growing file, read from the byte reached
//                 reading      an expensive on-demand reading, retaken only when the user asks
//                 summary      a small file Home reads (written after each report build)
//                 history      snapshots of a periodic scan (NOT rebuildable: keeps history)
//   storage     'disk' | 'memory'
//   file        file name in the folder (disk). Its '.status.json', '.lock' and
//               temporary '.tmp' siblings belong to it.
//   version     format version; a file with another version is rebuilt, never misread
//   ttlMs       reuse a good result this long, then it is stale
//   failureTtlMs  after a failed build or a failed check, wait this long before
//               trying again (kept apart from ttlMs). Infinity = only when asked.
//   scheduleMs  rebuild in the background this often while the app runs
//   waitMs      how long a second request waits for a running build before it
//               reports that the build is still under way
//   timeoutMs   a build that runs longer than this fails (frees the lock)
//   content     what is stored: 'derived' (counts, totals, status; no message
//               text) or 'messages' (message text; then `coverage` must say what
//               the cache does not cover, and the page must say so too)
//   policy      one sentence: what the cache is for and what it never stores
//
// DATA_FILES: every other file a backend keeps in its data folder (settings,
// encrypted tokens, state). A cache's own files come from CACHES. auditDataDir()
// reports anything else, and a test fails on an undeclared *_FILE constant.

const MIN = 60 * 1000
const HOUR = 60 * MIN

/** @type {readonly CacheDeclaration[]} */
const CACHES = Object.freeze([
  {
    id: 'claude-stats.usage',
    folder: 'modules/claude-stats',
    tier: 'report',
    storage: 'disk',
    file: 'usage.json',
    version: 3,
    ttlMs: 15 * MIN,
    failureTtlMs: 1 * HOUR,
    scheduleMs: 15 * MIN,
    waitMs: 20 * 1000,
    timeoutMs: 6 * MIN,
    content: 'derived',
    policy:
      'Usage report built from local agent logs (ccusage plus the log scanner): token counts, costs, models, projects and session ids. Never stores prompt or reply text.',
  },
  {
    id: 'claude-stats.summary',
    folder: 'modules/claude-stats',
    tier: 'summary',
    storage: 'disk',
    file: 'summary.json',
    version: 1,
    ttlMs: 15 * MIN,
    content: 'derived',
    policy: 'Small summary of the last good usage report for Home: daily cost, total and top models.',
  },
  {
    id: 'agent-chat.recent',
    folder: 'modules/agent-chat',
    tier: 'list',
    storage: 'memory',
    version: 1,
    ttlMs: 10 * 1000,
    failureTtlMs: 0,
    content: 'derived',
    policy: 'The list of recent chats, reused for 10 seconds and cleared when the allowed folders change. Kept in memory only.',
  },
  {
    id: 'connections.connector-check',
    folder: 'modules/connections',
    tier: 'check',
    storage: 'memory',
    version: 1,
    ttlMs: 15 * MIN,
    failureTtlMs: 15 * MIN,
    content: 'derived',
    policy: 'Result of a connector check (state and summary, no secrets), keyed by a hash of the connector definition.',
  },
  {
    id: 'connections.summary',
    folder: 'modules/connections',
    tier: 'summary',
    storage: 'disk',
    file: 'summary.json',
    version: 1,
    ttlMs: 1 * HOUR,
    content: 'derived',
    policy:
      'The last check result per added connection (state, one-line summary, hint, time), for Home and the MCP server. Never stores secrets, tokens or check details.',
  },
  {
    id: 'storage.history',
    folder: 'modules/storage',
    tier: 'history',
    storage: 'disk',
    file: 'history.json',
    version: 1,
    ttlMs: 6 * HOUR,
    keep: 500,
    content: 'derived',
    policy:
      'Storage Manager snapshots for the over-time view: free space per drive (sampled every 6 hours while the app runs) and, after each scan the user starts, the size, file count, local path and largest children of each known folder. Never reads or stores file contents.',
  },
  {
    id: 'connections.sign-in',
    folder: 'modules/connections',
    tier: 'check',
    storage: 'memory',
    version: 1,
    ttlMs: 15 * MIN,
    failureTtlMs: 2 * MIN,
    content: 'derived',
    policy: 'Result of a sign-in check: reused 15 minutes after a success and 2 minutes after a failure, so a fix shows quickly.',
  },
])

/** Non-cache files per data folder. Directories end with '/'. */
const DATA_FILES = Object.freeze({
  'modules/agent-chat': ['folders.json', 'costs.json', 'chat-state.json', 'system-prompts.json', 'coordinator/', 'turn-locks/'],
  'modules/connections': ['connections.json'],
  'modules/mcp': ['access.json', 'audit.jsonl'],
  'apps/github-plus': ['recents.json', 'settings.json', 'backups.json'],
  'apps/email': ['config.json', 'accounts.json'],
  'apps/jira-plus': ['connection.json', 'settings.json', 'local-repo/'],
})

/**
 * Sources whose content is deliberately NOT cached on disk, and why. Each
 * source states its policy here, in writing (A2 in docs/caching.md).
 */
const NOT_CACHED = Object.freeze({
  'apps/email': 'Mail is fetched on demand and never written to disk, by design.',
  'modules/agent-chat': 'Chat logs are read in place and never copied or cached to disk; only running cost numbers per session (costs.json) and list flags per chat id (chat-state.json: last seen, unread, archived) and the system prompt the user set per agent (system-prompts.json: Claude, pi, coordinator) are kept, plus one lock file per running turn (turn-locks/: process id and start time only) and the coordinator working folder (coordinator/), which MonoRail leaves empty.',
  'apps/jira-plus': 'Jira Cloud tickets are fetched on demand and not cached.',
})

const byId = new Map(CACHES.map((c) => [c.id, c]))
const testCaches = new Map()

/** Tests only (node --test): declare a fixture cache under 'test/...'. */
function declareForTest(d) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error('declareForTest is for tests only')
  if (!d.folder.startsWith('test/')) throw new Error('Test caches live in a test/ folder')
  testCaches.set(d.id, Object.freeze({ ...d }))
}

/** The declaration for a cache id; throws for an undeclared cache. */
function declaration(id) {
  const d = byId.get(id) ?? testCaches.get(id)
  if (!d) throw new Error(`Undeclared cache "${id}": add it to electron/cache/declared.cjs`)
  return d
}

/** Every file name a data folder may hold (cache files and their siblings, plus DATA_FILES). */
function declaredFiles(folder) {
  const names = new Set(DATA_FILES[folder] ?? [])
  for (const c of [...CACHES, ...testCaches.values()]) {
    if (c.folder !== folder || c.storage !== 'disk') continue
    names.add(c.file)
    names.add(`${c.file}.status.json`)
    names.add(`${c.file}.lock`)
    if (c.tier === 'history') names.add(c.file.replace(/\.[^.]+$/, '') + '.csv')
  }
  return names
}

/** Every data folder that has declarations. */
function declaredFolders() {
  return [...new Set([...Object.keys(DATA_FILES), ...CACHES.map((c) => c.folder)])]
}

module.exports = { CACHES, DATA_FILES, NOT_CACHED, declaration, declaredFiles, declaredFolders, declareForTest, MIN, HOUR }

/**
 * @typedef {object} CacheDeclaration
 * @property {string} id
 * @property {string} folder
 * @property {'report'|'check'|'list'|'incremental'|'reading'|'summary'|'history'} tier
 * @property {'disk'|'memory'} storage
 * @property {string} [file]
 * @property {number} version
 * @property {number} ttlMs
 * @property {number} [failureTtlMs]
 * @property {number} [scheduleMs]
 * @property {number} [waitMs]
 * @property {number} [timeoutMs]
 * @property {number} [keep]
 * @property {'derived'|'messages'} content
 * @property {string} [coverage]
 * @property {string} policy
 */
