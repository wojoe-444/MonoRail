// GitHub+ app backend: GitHub-style browsing for local git repositories.
// Ported from wojoe-444/Local-Repo-UI (src/main/index.ts).
//
// Private data rule: the list of recently opened repo paths is kept in
// %APPDATA%\Command Hub\apps\github-plus\recents.json (ctx.dataDir). Nothing
// is sent anywhere; the only process this runs is the local `git` CLI.

const fs = require('node:fs/promises')
const path = require('node:path')
const { BrowserWindow, dialog } = require('electron')

const git = require('./git.cjs')
const { createBackupService } = require('./backup.cjs')
const folderInit = require('./init.cjs')

const RECENTS_FILE = 'recents.json'
const SETTINGS_FILE = 'settings.json'
const DEFAULT_SETTINGS = { autoInitFolders: false }
const MAX_RECENTS = 12

let dataDir
const backups = createBackupService(
  () => dataDir,
  (...a) => console.log('[github-plus]', ...a),
)

/** Repos the user has explicitly opened this session; every other call refuses any other path. */
const openedRepos = new Set()

function guard(repo) {
  if (!openedRepos.has(repo)) throw new Error('Repository has not been opened')
  return repo
}

async function readRecents(ctx) {
  try {
    const list = JSON.parse(await fs.readFile(path.join(ctx.dataDir, RECENTS_FILE), 'utf8'))
    return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

async function writeRecents(ctx, list) {
  await fs.writeFile(path.join(ctx.dataDir, RECENTS_FILE), JSON.stringify(list.slice(0, MAX_RECENTS), null, 2))
}

async function readSettings(ctx) {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(await fs.readFile(path.join(ctx.dataDir, SETTINGS_FILE), 'utf8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

module.exports = {
  id: 'github-plus',
  /** Called once at startup: runs the backup scheduler inside Command Hub. */
  start(ctx) {
    dataDir = ctx.dataDir
    backups.start()
  },
  methods: {
    async pickRepoFolder() {
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Open a local git repository', properties: ['openDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : r.filePaths[0]
    },
    async pickBackupFolder() {
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Choose where backups go', properties: ['openDirectory', 'createDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : r.filePaths[0]
    },
    async openRepo(ctx, { dir } = {}) {
      const info = await git.openRepo(dir)
      openedRepos.add(info.path)
      const recents = await readRecents(ctx)
      await writeRecents(ctx, [info.path, ...recents.filter((p) => p !== info.path)])
      return info
    },
    /** What making a plain folder into a repo would snapshot (nothing is written). */
    previewFolder: (_ctx, { dir } = {}) => folderInit.previewFolder(dir),
    /** git init + .gitignore + first commit, then open it like any repo. */
    async initRepo(ctx, { dir, excludeLarge, excludeSensitive } = {}) {
      const { path: root } = await folderInit.initRepo(dir, { excludeLarge, excludeSensitive })
      return module.exports.methods.openRepo(ctx, { dir: root })
    },
    getSettings: (ctx) => readSettings(ctx),
    async saveSettings(ctx, { settings } = {}) {
      const next = { ...(await readSettings(ctx)), autoInitFolders: !!settings?.autoInitFolders }
      await fs.writeFile(path.join(ctx.dataDir, SETTINGS_FILE), JSON.stringify(next, null, 2))
      return next
    },
    /**
     * Home dashboard: activity across the recently opened repos. Reads only
     * paths from the stored recents list, never paths sent by the page.
     */
    async getActivity(ctx) {
      const recents = await readRecents(ctx)
      return Promise.all(
        recents.map(async (p) => {
          const [activity, backup] = await Promise.all([
            git.recentActivity(p).catch((e) => ({ path: p, name: path.basename(p), error: e.message, commits: [], branches: [] })),
            backups.get(p).catch(() => null),
          ])
          return { ...activity, path: p, backup: backup?.schedule ? { schedule: backup.schedule, lastResult: backup.lastResult, nextDueAt: backup.nextDueAt } : null }
        }),
      )
    },
    async getRecents(ctx) {
      return readRecents(ctx)
    },
    async removeRecent(ctx, { path: p } = {}) {
      const next = (await readRecents(ctx)).filter((x) => x !== p)
      await writeRecents(ctx, next)
      return next
    },
    listRefs: (_ctx, { repo } = {}) => git.listRefs(guard(repo)),
    listTree: (_ctx, { repo, ref, path: p } = {}) => git.listTree(guard(repo), ref, p),
    readBlob: (_ctx, { repo, ref, path: p } = {}) => git.readBlob(guard(repo), ref, p),
    getLog: (_ctx, { repo, opts } = {}) => git.getLog(guard(repo), opts),
    countCommits: (_ctx, { repo, ref } = {}) => git.countCommits(guard(repo), ref),
    getCommit: (_ctx, { repo, sha } = {}) => git.getCommit(guard(repo), sha),
    compareRefs: (_ctx, { repo, base, head } = {}) => git.compareRefs(guard(repo), base, head),
    getBackup: (_ctx, { repo } = {}) => backups.get(guard(repo)),
    saveBackup: (_ctx, { repo, schedule } = {}) => backups.save(guard(repo), schedule),
    removeBackup: (_ctx, { repo } = {}) => backups.remove(guard(repo)),
    runBackup: async (_ctx, { repo } = {}) => {
      await backups.run(guard(repo))
      return backups.get(repo)
    },
  },
}
