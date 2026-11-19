// GitHub+ app backend: GitHub-style browsing for local git repositories.
// Ported from wojoe-444/Local-Repo-UI (src/main/index.ts).
//
// Private data rule: the list of recently opened repo paths is kept in
// %APPDATA%\MonoRail\apps\github-plus\recents.json (ctx.dataDir). Repos other
// MonoRail apps created (Tasks' private projects) are listed next to them
// without being stored there (linked.cjs). Local issues are
// stored inside each repo under refs/local-issues (issues.cjs).
//
// github.com (github.cjs) is reached only once the user has set up the
// GitHub connection on the Connections page: then the home page lists their
// repositories on GitHub (in memory only), a repo can be cloned into a
// folder they pick, and a new issue can also be created on GitHub when they
// turn that on for that issue (off by default, so issues stay local).
// Otherwise the only process this runs is the local `git` CLI.

const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { BrowserWindow, dialog, shell } = require('electron')

const git = require('./git.cjs')
const search = require('./search.cjs')
const { createBackupService } = require('./backup.cjs')
const inApp = require('../../scheduled/in-app.cjs')
const folderInit = require('./init.cjs')
const issues = require('./issues.cjs')
const { linkedRepos, mergeRecents } = require('./linked.cjs')
const { createGitHubService, pickGitHubRemote, htmlUrl, cloneUrl, NAME_RE } = require('./github.cjs')

const connectionsLib = () => require('../../connections/index.cjs')
const gh = createGitHubService({
  hasConnection: () => connectionsLib().hasConnection('github'),
  getCredentials: () => connectionsLib().getCredentials('github'),
})
const CLONE_TIMEOUT_MS = 15 * 60_000

// tasks linked to repos (electron/apps/jira-plus/repo-links.cjs). Tasks
// owns the links; GitHub+ only reads them, from Tasks' data folder, which
// sits next to its own (<userData>\apps\<id>).
const jiraPlus = () => require('../jira-plus/index.cjs')
const jiraCtx = (ctx) => ({ dataDir: path.resolve(ctx.dataDir, '..', 'jira-plus') })

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

// Home dashboard rows by repo path, kept in memory for the session and reused
// while the repo's refs (every branch, tag, remote, the issues ref and which
// branch is checked out) are unchanged. Checking that is one git process per
// repo instead of about a dozen for a full summary.
const activityCache = new Map()

/** Name and badge for a repo another MonoRail app created, by path. */
async function linkedInfo(ctx, p) {
  const l = (await linkedRepos(ctx.dataDir)).find((x) => x.path === p)
  return l ? { name: l.name, linked: { app: l.app, label: l.label } } : {}
}

async function repoActivity(p) {
  const fp = await git.refsFingerprint(p).catch(() => null)
  const hit = activityCache.get(p)
  if (fp !== null && hit?.fp === fp) return hit.value
  const [activity, open, remotes] = await Promise.all([
    git.recentActivity(p).catch((e) => ({ path: p, name: path.basename(p), error: e.message, commits: [], branches: [] })),
    issues.listIssues(p, 'open').catch(() => []),
    git.remotes(p).catch(() => []),
  ])
  const value = { ...activity, path: p, openIssues: open.length, issues: open.slice(0, 5), github: pickGitHubRemote(remotes) }
  if (fp !== null && !activity.error) activityCache.set(p, { fp, value })
  else activityCache.delete(p)
  return value
}

/** The repos Home lists (stored recents, then linked), as { path, name, linked }; never paths from the page. */
async function homeRepos(ctx) {
  const [recents, linked] = await Promise.all([readRecents(ctx), linkedRepos(ctx.dataDir)])
  const byPath = new Map(linked.map((l) => [l.path, l]))
  return mergeRecents(recents, linked).map((p) => {
    const l = byPath.get(p)
    return { path: p, name: l?.name ?? path.basename(p), ...(l ? { linked: { app: l.app, label: l.label } } : {}) }
  })
}

/** Home repos narrowed by the query's repo: values (name or folder contains, case-insensitive). */
function pickRepos(list, q) {
  if (!q.repos.length) return list
  const want = q.repos.map((r) => r.toLowerCase())
  return list.filter((r) => want.some((w) => r.name.toLowerCase().includes(w) || r.path.toLowerCase().replace(/\\/g, '/').endsWith('/' + w)))
}

/** Where a search looks when the query names no ref: the working folder (null) or a ref. */
function defaultRefOf(opts) {
  const v = opts?.in
  if (typeof v !== 'string' || !v || /^(working|worktree)$/i.test(v)) return null
  return git.assertRef(v)
}

/** Linked tasks whose key or summary matches, for a repo search's Issues results. */
async function matchingTasks(ctx, repo, q) {
  if (!q.text || q.def) return []
  const low = q.text.toLowerCase()
  const github = pickGitHubRemote(await git.remotes(repo).catch(() => []))
  const tasks = await jiraPlus().tasksForRepo(jiraCtx(ctx), { path: repo, github }).catch(() => [])
  return tasks.filter((t) => !t.error && (t.key.toLowerCase().includes(low) || String(t.summary ?? '').toLowerCase().includes(low))).slice(0, 20)
}

// Saved-search counts by repo, refs fingerprint and query: only for queries
// that name committed refs, since the working folder can change any time.
const countCache = new Map()

function focused() {
  return BrowserWindow.getFocusedWindow() ?? undefined
}

/** git clone <https url> <target>, no prompts in a terminal, killed after CLONE_TIMEOUT_MS. */
function gitClone(url, target) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.fsmonitor=false', 'clone', '--', url, target], {
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let err = ''
    child.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    const timer = setTimeout(() => child.kill(), CLONE_TIMEOUT_MS)
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e.code === 'ENOENT' ? new Error('git was not found. Install Git for Windows and make sure it is on PATH.') : e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(err.trim().split(/\r?\n/).filter((l) => !/^Cloning into/.test(l)).pop() || `git clone exited with ${code}`))
    })
  })
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
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['pickRepoFolder', 'pickBackupFolder', 'cloneGitHubRepo', 'openOnGitHub', 'openInExplorer'],
  /** Called once at startup: runs the backup scheduler inside MonoRail. */
  start(ctx) {
    dataDir = ctx.dataDir
    backups.start()
    inApp.registerProvider({
      id: 'github-plus',
      title: 'GitHub+ backups',
      list: () => backups.jobRows(),
      run: (repo) => backups.run(repo),
    })
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
      return { ...info, ...(await linkedInfo(ctx, info.path)) }
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
     * Home dashboard: activity across the recently opened repos and the
     * repos other MonoRail apps created. Reads only paths from the stored
     * recents list and linked.cjs, never paths sent by the page.
     */
    async getActivity(ctx) {
      const [recents, linked] = await Promise.all([readRecents(ctx), linkedRepos(ctx.dataDir)])
      const byPath = new Map(linked.map((l) => [l.path, l]))
      return Promise.all(
        mergeRecents(recents, linked).map(async (p) => {
          const [activity, backup] = await Promise.all([repoActivity(p), backups.get(p).catch(() => null)])
          const l = byPath.get(p)
          return {
            ...activity,
            ...(l ? { name: l.name, linked: { app: l.app, label: l.label } } : {}),
            backup: backup?.schedule ? { schedule: backup.schedule, lastResult: backup.lastResult, nextDueAt: backup.nextDueAt } : null,
          }
        }),
      )
    },
    /**
     * Uncommitted work and unpushed commits per Home repo, by path: a second
     * call so the Home tables show first. Like getActivity it reads only the
     * stored recents and linked paths; a repo that cannot be read maps to null.
     */
    async getWorkingStates(ctx) {
      const [recents, linked] = await Promise.all([readRecents(ctx), linkedRepos(ctx.dataDir)])
      const paths = mergeRecents(recents, linked)
      const states = await Promise.all(paths.map((p) => git.workingState(p).catch(() => null)))
      return Object.fromEntries(paths.map((p, i) => [p, states[i]]))
    },
    /** The repo page's status strip: working state plus ahead/behind against main/master. */
    workingState: (_ctx, { repo } = {}) => git.workingState(guard(repo), { withBase: true }),
    /** Repos the user opened, most recent first (the first one is reopened when GitHub+ starts). */
    async getRecents(ctx) {
      return readRecents(ctx)
    },
    /** Repos other MonoRail apps created that exist now: [{ path, app, label, name }]. */
    getLinked: (ctx) => linkedRepos(ctx.dataDir),
    async removeRecent(ctx, { path: p } = {}) {
      activityCache.delete(p)
      const next = (await readRecents(ctx)).filter((x) => x !== p)
      await writeRecents(ctx, next)
      return next
    },
    /**
     * Show a repo's folder in the system file manager (File Explorer on
     * Windows). Only a repo opened this session, on the stored recents list or
     * linked (Jira+), and only a folder: shell.openPath would run a file.
     */
    async openInExplorer(ctx, { path: p } = {}) {
      if (typeof p !== 'string' || !(openedRepos.has(p) || (await readRecents(ctx)).includes(p) || (await linkedRepos(ctx.dataDir)).some((l) => l.path === p))) {
        throw new Error('Repository has not been opened')
      }
      const dir = path.normalize(p)
      const st = await fs.stat(dir).catch(() => null)
      if (!st?.isDirectory()) throw new Error('The folder no longer exists')
      const err = await shell.openPath(dir)
      if (err) throw new Error(err)
      return null
    },
    listRefs: (_ctx, { repo } = {}) => git.listRefs(guard(repo)),
    listTree: (_ctx, { repo, ref, path: p } = {}) => git.listTree(guard(repo), ref, p),
    treeLastCommits: (_ctx, { repo, ref, path: p } = {}) => git.treeLastCommits(guard(repo), ref, p),
    branchDivergence: (_ctx, { repo, base } = {}) => git.branchDivergence(guard(repo), base),
    readBlob: (_ctx, { repo, ref, path: p } = {}) => git.readBlob(guard(repo), ref, p),
    /** A file as it is in the working folder now, for results found there. */
    readWorkingBlob: (_ctx, { repo, path: p } = {}) => git.readWorkingBlob(guard(repo), p),
    /**
     * Search one opened repo (search.cjs). kinds: code, files, commits,
     * issues by default; history (the pickaxe) only when asked for. opts.in
     * is where to look when the query names no ref: 'working' (default) or a
     * ref. A newer search on the same channel cancels this one.
     */
    async search(ctx, { repo, query, kinds, opts, channel } = {}) {
      guard(repo)
      const q = search.parseQuery(query, opts)
      if (!search.hasTerms(q)) return { query: search.describe(q), results: {} }
      const ch = search.channel(channel)
      try {
        const results = await search.searchRepo(repo, q, { kinds, signal: ch.signal, defaultRef: defaultRefOf(opts) })
        if (results.issues && !results.issues.error) results.issues.tasks = await matchingTasks(ctx, repo, q)
        return { query: search.describe(q), results }
      } finally {
        ch.done()
      }
    },
    /**
     * Search every repo Home lists (stored recents and linked repos, never
     * paths from the page), narrowed by repo: in the query. Each repo gets a
     * smaller share of results. A repo that can't be read reports an error.
     */
    async searchAll(ctx, { query, kinds, opts, channel } = {}) {
      const q = search.parseQuery(query, opts)
      if (!search.hasTerms(q)) return { query: search.describe(q), repos: [] }
      const list = pickRepos(await homeRepos(ctx), q)
      const ch = search.channel(channel)
      try {
        const repos = await Promise.all(
          list.map(async (r) => {
            try {
              const results = await search.searchRepo(r.path, q, { kinds, limits: search.ALL_LIMITS, signal: ch.signal, defaultRef: null })
              return { ...r, results }
            } catch (e) {
              if (e.name === 'AbortError') throw e
              return { ...r, results: {}, error: e.message }
            }
          }),
        )
        return { query: search.describe(q), repos }
      } finally {
        ch.done()
      }
    },
    /**
     * Matching lines per saved search across Home's repos: [{ query, total,
     * repos, error }]. Committed-ref queries are reused while a repo's refs
     * are unchanged; working-folder ones are counted each time.
     */
    async searchCounts(ctx, { queries } = {}) {
      const list = (Array.isArray(queries) ? queries : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 8)
      const repos = await homeRepos(ctx)
      const out = []
      for (const raw of list) {
        const q = search.parseQuery(raw)
        const cacheable = q.refs.length > 0 && !q.refs.some((r) => /^(working|worktree|wt)$/i.test(r))
        let total = 0
        let hits = 0
        let error = null
        for (const r of pickRepos(repos, q)) {
          try {
            const fp = cacheable ? await git.refsFingerprint(r.path).catch(() => null) : null
            const key = `${r.path}\0${fp}\0${raw}`
            let n = fp !== null ? countCache.get(key) : undefined
            if (n === undefined) {
              n = await search.countCode(r.path, q)
              if (fp !== null) {
                countCache.set(key, n)
                if (countCache.size > 500) countCache.delete(countCache.keys().next().value)
              }
            }
            total += n
            if (n) hits++
          } catch (e) {
            error = e.message
          }
        }
        out.push({ query: raw, total, repos: hits, error })
      }
      return out
    },
    /** "Since when?": who last changed one line and every commit that changed it. */
    lineHistory: (_ctx, { repo, ref, path: p, line } = {}) => search.lineHistory(guard(repo), ref, p, line),
    getLog: (_ctx, { repo, opts } = {}) => git.getLog(guard(repo), opts),
    countCommits: (_ctx, { repo, ref } = {}) => git.countCommits(guard(repo), ref),
    getCommit: (_ctx, { repo, sha } = {}) => git.getCommit(guard(repo), sha),
    compareRefs: (_ctx, { repo, base, head } = {}) => git.compareRefs(guard(repo), base, head),
    listIssues: (_ctx, { repo, state } = {}) => issues.listIssues(guard(repo), state),
    issueCounts: (_ctx, { repo } = {}) => issues.issueCounts(guard(repo)),
    getIssue: (_ctx, { repo, number } = {}) => issues.getIssue(guard(repo), number),
    /**
     * A new local issue. With onGitHub it is first created on GitHub (the
     * repo's own github.com remote, never a repo named by the page), then
     * recorded locally with a link to it.
     */
    async createIssue(_ctx, { repo, title, body, onGitHub } = {}) {
      guard(repo)
      if (onGitHub !== true) return issues.createIssue(repo, { title, body })
      const t = issues.cleanTitle(title)
      const b = issues.cleanBody(body)
      const target = pickGitHubRemote(await git.remotes(repo))
      if (!target) throw new Error('This repository has no github.com remote, so the issue can only be created locally.')
      const link = await gh.createIssue(target, { title: t, body: b })
      try {
        return await issues.createIssue(repo, { title: t, body: b, github: link })
      } catch (e) {
        throw new Error(`The issue was created on GitHub (${link.url}), but saving the local copy failed: ${e.message}`)
      }
    },
    /** Where a new issue could also go on GitHub. Reads the repo's remotes; contacts nobody. */
    async githubTarget(_ctx, { repo } = {}) {
      const target = pickGitHubRemote(await git.remotes(guard(repo)))
      return { repo: target, connected: await connectionsLib().hasConnection('github') }
    },
    /** The user's repositories on github.com: { connected: false } until GitHub is set up on Connections. */
    githubRepos: (_ctx, { force } = {}) => gh.repos({ force: force === true }),
    /** Clone a repo from the GitHub list into a folder the user picks, then open it. */
    async cloneGitHubRepo(ctx, { fullName } = {}) {
      const r = gh.known(fullName)
      if (!r) throw new Error('That repository is not in your GitHub list. Refresh the list and try again.')
      const opts = { title: `Choose where to clone ${r.fullName}`, buttonLabel: 'Clone here', properties: ['openDirectory', 'createDirectory'] }
      const win = focused()
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (res.canceled || !res.filePaths[0]) return null
      const target = path.join(res.filePaths[0], r.name)
      if (await fs.stat(target).then(() => true, () => false)) throw new Error(`${target} already exists. Open it with "Open repository", or pick another folder.`)
      await gitClone(cloneUrl(r.fullName), target)
      return module.exports.methods.openRepo(ctx, { dir: target })
    },
    /** Open a repo or issue page on github.com in the system browser. Only github.com links. */
    async openOnGitHub(_ctx, { fullName, issue } = {}) {
      if (typeof fullName !== 'string' || !NAME_RE.test(fullName)) throw new Error('Invalid repository')
      const n = issue === undefined ? undefined : Number(issue)
      if (n !== undefined && (!Number.isInteger(n) || n < 1)) throw new Error('Invalid issue number')
      await shell.openExternal(n ? `${htmlUrl(fullName)}/issues/${n}` : htmlUrl(fullName))
      return null
    },
    updateIssue: (_ctx, { repo, number, title, body, state } = {}) => issues.updateIssue(guard(repo), number, { title, body, state }),
    addIssueComment: (_ctx, { repo, number, body } = {}) => issues.addComment(guard(repo), number, { body }),
    /** tasks linked to this repo, by its folder or its github.com remote. */
    async linkedTasks(ctx, { repo } = {}) {
      guard(repo)
      const github = pickGitHubRemote(await git.remotes(repo).catch(() => []))
      return jiraPlus().tasksForRepo(jiraCtx(ctx), { path: repo, github })
    },
    /** How many tasks are linked to this repo (the tab's counter). Reads the links file and the repo's remotes only. */
    async linkedTaskCount(ctx, { repo } = {}) {
      guard(repo)
      const github = pickGitHubRemote(await git.remotes(repo).catch(() => []))
      return (await jiraPlus().repoLinks(jiraCtx(ctx)).forRepo({ path: repo, github })).length
    },
    /** tasks linked to a repo on github.com that is not open here. Reads the links file only. */
    async linkedTasksOnGitHub(ctx, { fullName } = {}) {
      if (typeof fullName !== 'string' || !NAME_RE.test(fullName)) throw new Error('Invalid repository')
      return jiraPlus().tasksForRepo(jiraCtx(ctx), { github: fullName })
    },
    /** How many tasks each repo has, for the Home lists: { paths, github }. Reads the links file only. */
    linkCounts: (ctx) => jiraPlus().repoLinks(jiraCtx(ctx)).counts(),
    /** Unlink a task from this repo (the link is removed from Tasks' links file only). */
    async unlinkTask(ctx, { repo, source, key, linkId } = {}) {
      guard(repo)
      await jiraPlus().repoLinks(jiraCtx(ctx)).unlink({ source, key }, String(linkId ?? ''))
      return module.exports.methods.linkedTasks(ctx, { repo })
    },
    /** Link a task (by source and key) to this repo, from the GitHub+ side. */
    async linkTask(ctx, { repo, source, key } = {}) {
      guard(repo)
      const github = pickGitHubRemote(await git.remotes(repo).catch(() => []))
      await jiraPlus().repoLinks(jiraCtx(ctx)).link({ source, key }, { path: repo, name: path.basename(repo), github })
      return module.exports.methods.linkedTasks(ctx, { repo })
    },
    getBackup: (_ctx, { repo } = {}) => backups.get(guard(repo)),
    saveBackup: (_ctx, { repo, schedule } = {}) => backups.save(guard(repo), schedule),
    removeBackup: (_ctx, { repo } = {}) => backups.remove(guard(repo)),
    runBackup: async (_ctx, { repo } = {}) => {
      await backups.run(guard(repo))
      return backups.get(repo)
    },
  },
}
