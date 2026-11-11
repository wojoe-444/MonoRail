// Agent Catalog backend: the subagents on this computer, and create / edit /
// delete for them.
//
//   Claude Code subagents  <claude config>/agents/*.md   <repo>/.claude/agents/*.md
//   pi subagents           <pi agent dir>/agents/*.md    <repo>/.pi/agents/*.md
//
// pi has no subagents of its own: these are the files pi's subagent extension
// reads (its example extension, or a package built on it). Repos are the Chat
// page's allowed repos, re-resolved on every call. MonoRail's built-in
// coordinator is listed read-only.
//
// Safety rules:
//   - the page names a subagent only by the id handed out here, and a place to
//     save to only as 'user' or an allowed repo's name; paths are built here
//     from those folders and a validated name, never taken from the page
//   - the agents folder must resolve (real path) inside the user's config
//     folder or the repo, so a link cannot point a write elsewhere
//   - an edit refuses when the file changed on disk since it was opened
//   - before a file is changed or deleted, a copy goes to backups/ in this
//     module's data folder (newest MAX_BACKUPS kept); nothing else is stored

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const { allowedRepos } = require('./agent-chat-folders.cjs')
const { BUILTIN_COORDINATOR } = require('./agent-chat-options.cjs')
const { parseFrontmatter } = require('./agents-definitions.cjs')
const { writeAtomic } = require('../cache/files.cjs')

const BACKUPS_DIR = 'backups'
const MAX_BACKUPS = 200
const MAX_FILES = 300
const MAX_FILE_BYTES = 512 * 1024
const MAX_PROMPT = 200_000
const MAX_DESCRIPTION = 2000
const NAME_RE = /^[a-z][a-z0-9-]{0,63}$/
const MODEL_RE = /^[A-Za-z0-9][\w.:/@-]{0,127}$/
const TOOL_RE = /^[A-Za-z][\w:.-]{0,127}$/
const KNOWN_KEYS = ['name', 'description', 'tools', 'model']

const TOOLS = ['claude', 'pi']

function claudeHome(env, home) {
  const first = env.CLAUDE_CONFIG_DIR?.split(',').map((s) => s.trim()).find(Boolean)
  return first || path.join(home, '.claude')
}

function piHome(env, home) {
  return env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent')
}

/** The user-level base folder and agents folder for a tool. */
function userPlace(tool, env, home) {
  const base = tool === 'pi' ? piHome(env, home) : claudeHome(env, home)
  return { base, dir: path.join(base, 'agents'), display: tool === 'pi' ? '~/.pi/agent/agents' : '~/.claude/agents' }
}

function projectPlace(tool, repoPath) {
  const rel = tool === 'pi' ? ['.pi', 'agents'] : ['.claude', 'agents']
  return { base: repoPath, dir: path.join(repoPath, ...rel), display: rel.join('/') }
}

async function real(p) {
  try {
    return await fs.promises.realpath(p)
  } catch {
    return undefined
  }
}

function inside(child, parent) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * The agents folder, checked: it (or, when it does not exist yet, its nearest
 * existing parent) must resolve inside the base folder.
 */
async function checkedDir(place) {
  const base = await real(place.base)
  if (!base) return undefined
  let probe = place.dir
  while (!(await real(probe))) {
    const up = path.dirname(probe)
    if (up === probe) return undefined
    probe = up
  }
  const r = await real(probe)
  if (!r || !inside(r, base)) return undefined
  return probe === place.dir ? r : place.dir
}

// Handles handed to the page, valid for the life of the process.
const known = new Map()

function handleFor(entry) {
  const id = `sub_${crypto.createHash('sha256').update(`${entry.tool}\0${entry.file}`).digest('hex').slice(0, 16)}`
  known.set(id, entry)
  return id
}

function list(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean)
  return undefined
}

function oneLine(s, max) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Every place subagents may live, for both tools. */
async function places({ chatDir, env, home }) {
  const folders = await allowedRepos(chatDir, { home })
  const out = []
  for (const tool of TOOLS) {
    out.push({ tool, scope: 'user', ...userPlace(tool, env, home) })
    for (const r of folders.repos) out.push({ tool, scope: 'project', repo: r.name, repoPath: r.path, ...projectPlace(tool, r.path) })
  }
  return { places: out, repos: folders.repos }
}

async function readEntry(place, file) {
  const stat = await fs.promises.stat(file)
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return undefined
  const text = await fs.promises.readFile(file, 'utf8')
  const { data, body } = parseFrontmatter(text)
  const slug = path.basename(file).replace(/\.md$/i, '')
  const entry = { tool: place.tool, scope: place.scope, repo: place.repo, file, updatedAt: stat.mtimeMs }
  return {
    entry,
    summary: {
      id: handleFor(entry),
      tool: place.tool,
      scope: place.scope,
      repo: place.repo,
      name: oneLine(data.name || slug, 80),
      description: oneLine(data.description, MAX_DESCRIPTION),
      model: typeof data.model === 'string' && data.model ? data.model : undefined,
      tools: list(data.tools),
      location: `${place.display}/${path.basename(file)}`,
      updatedAt: stat.mtimeMs,
      extraFields: Object.keys(data).filter((k) => !KNOWN_KEYS.includes(k)),
      // pi's subagent extension skips files without a name and a description.
      ...(place.tool === 'pi' && (!data.name || !data.description) ? { problem: 'pi skips this file: it needs a name and a description.' } : {}),
    },
    body,
  }
}

function builtinCoordinator() {
  return {
    id: 'builtin:coordinator',
    tool: 'claude',
    scope: 'builtin',
    name: 'coordinator',
    description: `${BUILTIN_COORDINATOR.description} Used when you have no coordinator subagent of your own.`,
    tools: [...BUILTIN_COORDINATOR.tools],
    location: 'Built in to MonoRail',
    updatedAt: 0,
    extraFields: [],
  }
}

/** Is pi's subagent extension (or a package with "subagent" in its name) installed? Names only. */
async function piSubagentExtension(env, home) {
  const base = piHome(env, home)
  try {
    const entries = await fs.promises.readdir(path.join(base, 'extensions'))
    if (entries.some((e) => /subagent/i.test(e))) return true
  } catch {
    // No extensions folder.
  }
  try {
    const settings = JSON.parse(await fs.promises.readFile(path.join(base, 'settings.json'), 'utf8'))
    const pkgs = Array.isArray(settings?.packages) ? settings.packages : []
    return pkgs.some((p) => /subagent/i.test(typeof p === 'string' ? p : String(p?.source ?? p?.name ?? '')))
  } catch {
    return false
  }
}

async function listSubagents({ chatDir, env = process.env, home = os.homedir() }) {
  const { places: all, repos } = await places({ chatDir, env, home })
  const subagents = []
  for (const p of all) {
    const dir = await checkedDir(p)
    if (!dir) continue
    let entries
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (subagents.length >= MAX_FILES) break
      if (e.name.startsWith('.') || !e.name.toLowerCase().endsWith('.md')) continue
      if (!e.isFile() && !e.isSymbolicLink()) continue
      try {
        const r = await readEntry(p, path.join(dir, e.name))
        if (r) subagents.push(r.summary)
      } catch {
        // Unreadable file: left out.
      }
    }
  }
  subagents.sort((a, b) => a.name.localeCompare(b.name) || a.tool.localeCompare(b.tool))
  // The built-in coordinator is shown only while the user has none of their own.
  const ownCoordinator = subagents.some((s) => s.tool === 'claude' && s.scope === 'user' && s.name === 'coordinator')
  if (!ownCoordinator) subagents.push(builtinCoordinator())
  return {
    generatedAt: Date.now(),
    subagents,
    truncated: subagents.length >= MAX_FILES,
    repos: repos.map((r) => ({ name: r.name, path: r.path })),
    piExtension: await piSubagentExtension(env, home),
  }
}

async function getSubagent(id) {
  if (id === 'builtin:coordinator') return { ...builtinCoordinator(), prompt: BUILTIN_COORDINATOR.prompt }
  const entry = typeof id === 'string' ? known.get(id) : undefined
  if (!entry) throw new Error('Subagent not found. Refresh the page and try again.')
  const r = await readEntry({ tool: entry.tool, scope: entry.scope, repo: entry.repo, display: displayFor(entry) }, entry.file).catch(() => undefined)
  if (!r) throw new Error('This subagent file can no longer be read.')
  known.set(id, r.entry)
  return { ...r.summary, id, prompt: r.body }
}

function displayFor(entry) {
  if (entry.scope === 'user') return entry.tool === 'pi' ? '~/.pi/agent/agents' : '~/.claude/agents'
  return entry.tool === 'pi' ? '.pi/agents' : '.claude/agents'
}

// ---------------------------------------------------------------------------
// Writing

/** A YAML scalar for a header value: plain when safe, else a JSON string (valid YAML). */
function scalar(v) {
  return /^[A-Za-z0-9][\w ,./@()+-]*$/.test(v) && !/ $/.test(v) && !/:\s|#/.test(v) ? v : JSON.stringify(v)
}

/**
 * The file text for a draft. Header fields MonoRail does not edit (color,
 * permissionMode, ...) are kept from `previous`, as written, in their order.
 */
function render(draft, previous) {
  const ours = { name: draft.name, description: draft.description, tools: draft.tools?.join(', '), model: draft.model }
  const lines = []
  const written = new Set()
  const prevHeader = previous ? headerBlocks(previous) : []
  for (const b of prevHeader) {
    if (KNOWN_KEYS.includes(b.key)) {
      written.add(b.key)
      if (ours[b.key]) lines.push(`${b.key}: ${scalar(ours[b.key])}`)
    } else lines.push(...b.lines)
  }
  for (const k of KNOWN_KEYS) if (!written.has(k) && ours[k]) lines.push(`${k}: ${scalar(ours[k])}`)
  return `---\n${lines.join('\n')}\n---\n\n${draft.prompt.replace(/\r\n/g, '\n').trim()}\n`
}

/** The header as top-level key blocks (a key line plus its indented lines). */
function headerBlocks(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return []
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) return []
  const blocks = []
  for (const line of lines.slice(1, end)) {
    const m = /^([A-Za-z_][\w-]*):/.exec(line)
    if (m) blocks.push({ key: m[1], lines: [line] })
    else if (blocks.length) blocks.at(-1).lines.push(line)
  }
  return blocks
}

function validateDraft(d, tool) {
  if (!d || typeof d !== 'object') throw new Error('Nothing to save.')
  if (!TOOLS.includes(tool)) throw new Error('Pick Claude Code or pi.')
  const name = String(d.name ?? '').trim()
  if (!NAME_RE.test(name)) throw new Error('Use lowercase letters, numbers and hyphens for the name, starting with a letter.')
  const description = oneLine(d.description, MAX_DESCRIPTION + 1)
  if (!description) throw new Error('Say when it should be used.')
  if (description.length > MAX_DESCRIPTION) throw new Error('The description is too long.')
  const prompt = String(d.prompt ?? '')
  if (!prompt.trim()) throw new Error('Write its instructions.')
  if (prompt.length > MAX_PROMPT) throw new Error('The instructions are too long.')
  if (/^---\s*$/m.test(prompt.split('\n')[0] ?? '')) throw new Error('The instructions cannot start with a --- line.')
  const model = d.model ? String(d.model).trim() : ''
  if (model && !MODEL_RE.test(model)) throw new Error('That model name has characters a model id never has.')
  let tools = null
  if (Array.isArray(d.tools)) {
    tools = [...new Set(d.tools.map((t) => String(t).trim()).filter(Boolean))]
    if (tools.some((t) => !TOOL_RE.test(t))) throw new Error('A tool name has characters a tool never has.')
    if (tools.length === 0) throw new Error('Pick at least one tool, or let it use every tool.')
  } else if (d.tools !== null && d.tools !== undefined) throw new Error('Unknown tool list.')
  // `inherit` is the default for Claude; pi has no such value, so leave it out.
  const keepModel = model && !(model === 'inherit' && tool === 'pi')
  return { name, description, prompt, model: keepModel ? model : undefined, tools: tools ?? undefined }
}

async function backup(dataDir, entry, label) {
  const dir = path.join(dataDir, BACKUPS_DIR)
  await fs.promises.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const where = entry.scope === 'user' ? 'user' : `repo-${String(entry.repo ?? 'repo').replace(/[^\w.-]/g, '_')}`
  const name = path.basename(entry.file).replace(/[^\w.-]/g, '_')
  const target = path.join(dir, `${stamp}__${label}__${entry.tool}__${where}__${name}`)
  await fs.promises.copyFile(entry.file, target, fs.constants.COPYFILE_EXCL)
  // Keep the newest MAX_BACKUPS; only MonoRail's own backup files are pruned.
  const files = (await fs.promises.readdir(dir)).filter((f) => /^\d{4}-\d\d-\d\dT[\w-]+__(edit|delete)__(claude|pi)__.+\.md$/.test(f)).sort()
  for (const f of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) await fs.promises.unlink(path.join(dir, f)).catch(() => {})
  return target
}

/** Where a new subagent goes: 'user' or an allowed repo's name. */
async function targetPlace(o, tool, saveTo) {
  const { places: all } = await places(o)
  const p = all.find((x) => x.tool === tool && (saveTo === 'user' ? x.scope === 'user' : x.scope === 'project' && x.repo === saveTo))
  if (!p) throw new Error('That repo is not in your allowed folders any more.')
  const dir = await checkedDir(p)
  if (!dir) throw new Error('That agents folder points outside its home or repo, so MonoRail will not write there.')
  return { ...p, dir }
}

async function createSubagent(opts, args) {
  const tool = args?.tool
  const d = validateDraft(args?.draft, tool)
  const p = await targetPlace(opts, tool, String(args?.draft?.saveTo ?? 'user'))
  await fs.promises.mkdir(p.dir, { recursive: true })
  const file = path.join(p.dir, `${d.name}.md`)
  // 'wx' refuses to replace a file that is already there.
  try {
    await fs.promises.writeFile(file, render(d), { flag: 'wx' })
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error(`There is already a subagent called ${d.name} there.`)
    throw err
  }
  const entry = { tool, scope: p.scope, repo: p.repo, file }
  return { id: handleFor(entry) }
}

async function updateSubagent(opts, args) {
  const entry = known.get(args?.id)
  if (!entry) throw new Error('Subagent not found. Refresh the page and try again.')
  const d = validateDraft(args?.draft, entry.tool)
  await assertStillThere(opts, entry)
  const stat = await fs.promises.stat(entry.file)
  if (typeof args?.updatedAt === 'number' && Math.abs(stat.mtimeMs - args.updatedAt) > 1) throw new Error('This file changed on disk after you opened it. Reopen it to see the change, then edit again.')
  const previous = await fs.promises.readFile(entry.file, 'utf8')
  const slug = path.basename(entry.file).replace(/\.md$/i, '')
  const current = parseFrontmatter(previous).data.name
  if (d.name !== slug && d.name !== current) throw new Error('To rename a subagent, duplicate it under the new name.')
  await backup(opts.backupDir, entry, 'edit')
  await writeAtomic(entry.file, render(d, previous))
  return { id: args.id }
}

async function removeSubagent(opts, args) {
  const entry = known.get(args?.id)
  if (!entry) throw new Error('Subagent not found. Refresh the page and try again.')
  await assertStillThere(opts, entry)
  const saved = await backup(opts.backupDir, entry, 'delete')
  await fs.promises.unlink(entry.file)
  known.delete(args.id)
  return { backup: path.basename(saved) }
}

/** The file's folder is still an allowed, checked agents folder. */
async function assertStillThere(opts, entry) {
  const { places: all } = await places(opts)
  const p = all.find((x) => x.tool === entry.tool && x.scope === entry.scope && x.repo === entry.repo)
  const dir = p && (await checkedDir(p))
  const fileDir = await real(path.dirname(entry.file))
  if (!dir || !fileDir || !(await real(dir)) || fileDir !== (await real(dir))) throw new Error('This subagent is no longer in an allowed folder.')
  const st = await fs.promises.lstat(entry.file).catch(() => undefined)
  if (!st) throw new Error('This subagent file is gone. Refresh the page.')
  if (st.isSymbolicLink()) throw new Error('This subagent file is a link to another file, so MonoRail leaves it alone. Edit the file it points to.')
}

/** Allowed repos come from Chat's folder settings; backups go to this module's own folder. */
function opts(ctx) {
  return { chatDir: path.join(ctx.rootDir, 'modules', 'agent-chat'), backupDir: ctx.dataDir, env: process.env, home: os.homedir() }
}

module.exports = {
  id: 'agent-catalog',
  methods: {
    list: async (ctx) => listSubagents(opts(ctx)),
    get: async (_ctx, args) => getSubagent(args?.id),
    create: async (ctx, args) => createSubagent(opts(ctx), args),
    update: async (ctx, args) => updateSubagent(opts(ctx), args),
    remove: async (ctx, args) => removeSubagent(opts(ctx), args),
    openBackups: async (ctx) => {
      const dir = path.join(ctx.dataDir, BACKUPS_DIR)
      await fs.promises.mkdir(dir, { recursive: true })
      const { shell } = require('electron')
      const err = await shell.openPath(dir)
      if (err) throw new Error(err)
      return { ok: true }
    },
  },
  _internal: { listSubagents, getSubagent, createSubagent, updateSubagent, removeSubagent, render, validateDraft, headerBlocks, checkedDir, NAME_RE, BACKUPS_DIR },
}
