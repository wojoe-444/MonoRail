// Flows: each flow is a JSON file in a local git repo in the Flows data folder.
//
//   <Flows data folder>\repo\          (%APPDATA%\MonoRail\modules\flows\repo)
//     README.md
//     flows/<id>.json                  one flow per file (flows-graph.cjs)
//
// Saving writes the file; commits are batched like Notes: one commit after a
// quiet minute, when the user leaves the flow, or at the next start. Each
// commit is a version the page can show and bring back. The repo never gets a
// remote and lives in AppData, never in the MonoRail checkout.
//
// No Electron here, so tests (and later the MCP server) can use it.

const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const git = require('isomorphic-git')

const { sleep, tryLock } = require('../cache/files.cjs')
const { cleanFlow } = require('./flows-graph.cjs')

const AUTHOR = { name: 'MonoRail', email: 'local@monorail.invalid' }
const FLOWS = 'flows'
const COMMIT_AFTER_MS = 60_000
const MAX_FILE_BYTES = 4 * 1024 * 1024
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

const README = `# MonoRail flows

Your flows from MonoRail's Flows page (Agents > Flows), one JSON file per flow in \`flows/\`.
MonoRail commits changes after a minute of quiet, so \`git log\` is each flow's version history.

This repository lives in your local AppData and has no remote. Do not push it anywhere.
`

const repoDirOf = (dataDir) => path.join(dataDir, 'repo')

function slugOf(name) {
  const s = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return s || 'flow'
}

function checkId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Unknown flow')
  return id
}

/** List row: no graph, just what the cards show. */
function summaryOf(flow, updated) {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    folder: flow.folder,
    kinds: flow.nodes.map((n) => n.kind).slice(0, 12),
    steps: flow.nodes.length,
    agentName: flow.nodes.find((n) => n.kind === 'agent' || n.kind === 'subagent')?.title ?? flow.name,
    updated,
  }
}

function createFlowsStore(dataDir, { commitAfterMs = COMMIT_AFTER_MS, log = () => {} } = {}) {
  const repoDir = repoDirOf(dataDir)
  const flowsDir = path.join(repoDir, FLOWS)
  const rel = (id) => `${FLOWS}/${id}.json`
  const abs = (id) => path.join(flowsDir, `${id}.json`)

  let ready
  let queue = Promise.resolve()
  let timer
  const pending = new Set()

  async function ensureRepo() {
    if (!ready) {
      ready = (async () => {
        await fsp.mkdir(flowsDir, { recursive: true })
        if (!fs.existsSync(path.join(repoDir, '.git', 'HEAD'))) {
          await git.init({ fs, dir: repoDir, defaultBranch: 'main' })
          await fsp.writeFile(path.join(repoDir, 'README.md'), README)
          await git.add({ fs, dir: repoDir, filepath: 'README.md' })
          await git.commit({ fs, dir: repoDir, message: 'Create flows repository', author: AUTHOR })
        }
      })().catch((e) => {
        ready = undefined
        throw e
      })
    }
    return ready
  }

  const lockFile = path.join(repoDir, '.git', 'monorail-write.lock')
  async function locked(fn) {
    await ensureRepo()
    let release
    for (let waited = 0; !(release = await tryLock(lockFile, { staleMs: 60_000 })); waited += 50) {
      if (waited > 15_000) throw new Error('The flows repository is busy. Try again in a moment.')
      await sleep(50)
    }
    try {
      return await fn()
    } finally {
      await release()
    }
  }

  function serial(fn) {
    const run = () => locked(fn)
    const next = queue.then(run, run)
    queue = next.catch(() => {})
    return next
  }

  async function read(id) {
    const file = abs(checkId(id))
    let raw, st
    try {
      ;[raw, st] = await Promise.all([fsp.readFile(file, 'utf8'), fsp.stat(file)])
    } catch {
      throw new Error('That flow no longer exists.')
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('This flow file is damaged (not valid JSON). Restore an earlier version, or fix the file in the flows repo.')
    }
    return { flow: cleanFlow(parsed, { id }), updated: st.mtimeMs }
  }

  async function write(id, flow) {
    const text = `${JSON.stringify({ ...flow, id }, null, 2)}\n`
    if (Buffer.byteLength(text) > MAX_FILE_BYTES) throw new Error('This flow is too large to save (4 MB at most).')
    const tmp = `${abs(id)}.${process.pid}.tmp`
    await fsp.writeFile(tmp, text)
    await fsp.rename(tmp, abs(id))
  }

  function scheduleCommit() {
    clearTimeout(timer)
    timer = setTimeout(() => void commitPending().catch((e) => log('commit failed', e?.message)), commitAfterMs)
    timer.unref?.()
  }

  function newId(name) {
    for (let i = 0; i < 20; i++) {
      const id = `${slugOf(name)}-${crypto.randomBytes(3).toString('hex')}`
      if (!fs.existsSync(abs(id))) return id
    }
    throw new Error('Could not pick a file name for the flow.')
  }

  async function commitAll() {
    const rows = await git.statusMatrix({ fs, dir: repoDir, filepaths: [FLOWS] })
    const changed = rows.filter(([file, head, work, stage]) => file.endsWith('.json') && !(head === 1 && work === 1 && stage === 1))
    pending.clear()
    if (changed.length === 0) return false
    const names = []
    for (const [file, head, work] of changed) {
      if (work === 0) {
        await git.remove({ fs, dir: repoDir, filepath: file })
        names.push(`delete ${path.basename(file, '.json')}`)
        continue
      }
      await git.add({ fs, dir: repoDir, filepath: file })
      let name = path.basename(file, '.json')
      try {
        name = JSON.parse(await fsp.readFile(path.join(repoDir, file), 'utf8')).name || name
      } catch {
        // a damaged file is still committed, under its file name
      }
      names.push(head === 0 ? `new "${name}"` : `"${name}"`)
    }
    const message = changed.length === 1 ? `Flows: ${names[0]}` : `Flows: ${changed.length} flows (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', ...' : ''})`
    await git.commit({ fs, dir: repoDir, message, author: AUTHOR })
    return true
  }

  function commitPending() {
    clearTimeout(timer)
    timer = undefined
    return serial(commitAll)
  }

  return {
    repoDir,

    /** Every flow, newest first. A damaged file is listed with `error`. */
    async list() {
      await ensureRepo()
      const files = (await fsp.readdir(flowsDir).catch(() => [])).filter((f) => f.endsWith('.json') && ID_RE.test(f.slice(0, -5)))
      const flows = await Promise.all(
        files.map(async (f) => {
          const id = f.slice(0, -5)
          try {
            const { flow, updated } = await read(id)
            return summaryOf(flow, updated)
          } catch (e) {
            return { id, name: id, description: '', folder: '', kinds: [], steps: 0, agentName: id, updated: 0, error: e.message }
          }
        }),
      )
      return { flows: flows.sort((a, b) => b.updated - a.updated), pending: pending.size }
    },

    async get(id) {
      await ensureRepo()
      const { flow, updated } = await read(id)
      return { flow, updated, committed: !pending.has(id) }
    },

    /** A new flow from a draft (a template or a duplicate). Committed at once. */
    async create(draft) {
      const clean = cleanFlow(draft ?? {})
      return serial(async () => {
        const id = newId(clean.name)
        const flow = { ...clean, id }
        await write(id, flow)
        await commitAll()
        return { flow, updated: Date.now(), committed: true }
      })
    },

    async save(id, draft) {
      checkId(id)
      const flow = cleanFlow(draft, { id })
      return serial(async () => {
        if (!fs.existsSync(abs(id))) throw new Error('That flow no longer exists.')
        await write(id, flow)
        pending.add(id)
        scheduleCommit()
        return { flow, updated: Date.now(), committed: false }
      })
    },

    async flush() {
      await ensureRepo()
      return { committed: await commitPending() }
    },

    /** Delete the file and commit at once; earlier versions stay in the history. */
    async remove(id) {
      checkId(id)
      return serial(async () => {
        await fsp.rm(abs(id), { force: true })
        pending.delete(id)
        await commitAll()
        return { removed: true }
      })
    },

    /** Versions of one flow, newest first. */
    async history(id) {
      checkId(id)
      await ensureRepo()
      try {
        const commits = await git.log({ fs, dir: repoDir, filepath: rel(id), force: true })
        return commits.map((c) => ({ oid: c.oid, message: c.commit.message.trim(), time: c.commit.author.timestamp * 1000 }))
      } catch {
        return []
      }
    },

    /** The flow as it was at one commit (not saved; the page may restore it). */
    async version(id, oid) {
      checkId(id)
      if (typeof oid !== 'string' || !/^[0-9a-f]{40}$/.test(oid)) throw new Error('Unknown version')
      await ensureRepo()
      const { blob } = await git.readBlob({ fs, dir: repoDir, oid, filepath: rel(id) })
      return { flow: cleanFlow(JSON.parse(Buffer.from(blob).toString('utf8')), { id }) }
    },

    close() {
      clearTimeout(timer)
      timer = undefined
    },
  }
}

module.exports = { createFlowsStore, repoDirOf, slugOf, COMMIT_AFTER_MS }
