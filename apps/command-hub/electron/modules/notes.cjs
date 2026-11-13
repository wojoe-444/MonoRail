// Notes backend: the page's calls go to notes-store.cjs (Markdown files in a
// local git repo in this module's data folder). Nothing leaves the computer.

const { createNotesStore } = require('./notes-store.cjs')

const stores = new Map()
function store(ctx) {
  let s = stores.get(ctx.dataDir)
  if (!s) stores.set(ctx.dataDir, (s = createNotesStore(ctx.dataDir, { log: ctx.log })))
  return s
}

// "Open in GitHub+" needs the path the way git names it (forward slashes on
// Windows), like every repo GitHub+ lists. Without a git install the plain
// folder is still right for this computer.
const gitPaths = new Map()
async function gitPath(dir) {
  if (!gitPaths.has(dir)) {
    const p = require('../apps/github-plus/git.cjs')
      .openRepo(dir)
      .then((info) => info.path, () => dir)
    gitPaths.set(dir, p)
  }
  return gitPaths.get(dir)
}

module.exports = {
  id: 'notes',

  /** Commit anything the last run left uncommitted (app closed within a minute of typing, or edits made outside). */
  start(ctx) {
    setTimeout(() => void store(ctx).flush().catch((e) => ctx.log('flush failed', e?.message)), 5_000).unref?.()
  },

  methods: {
    async list(ctx, args) {
      const r = await store(ctx).list(args?.query)
      return { ...r, repoPath: await gitPath(r.repoPath) }
    },
    get: (ctx, args) => store(ctx).get(args?.id),
    create: (ctx, args) => store(ctx).create(args?.body ?? ''),
    save: (ctx, args) => store(ctx).save(args?.id, args?.body),
    flush: (ctx) => store(ctx).flush(),
    remove: (ctx, args) => store(ctx).remove(args?.id),
    history: (ctx, args) => store(ctx).history(args?.id),
    version: (ctx, args) => store(ctx).version(args?.id, args?.oid),
  },
}
