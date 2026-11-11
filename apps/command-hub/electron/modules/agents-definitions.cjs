// Agent definitions on this machine, for the Agents overview.
//
//   Claude Code subagents  ~/.claude/agents/*.md          <repo>/.claude/agents/*.md
//   Claude Code skills     ~/.claude/skills/*/SKILL.md    <repo>/.claude/skills/*/SKILL.md
//   pi skills              ~/.pi/agent/skills/*/SKILL.md  <repo>/.pi/skills/*/SKILL.md
//
// Repos are the Chat page's allowed repos (agent-chat-folders.cjs). Files are
// read in place on demand and never copied or cached to disk. The page names
// a definition only by the id handed out here, never by a path.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const HEAD_BYTES = 16 * 1024
const MAX_BODY = 20_000
const MAX_PER_DIR = 200
const MAX_TOTAL = 400

/** Where definitions live, relative to the user's home or a repo root. */
const LOCATIONS = [
  { tool: 'claude', kind: 'subagent', user: ['.claude', 'agents'], project: ['.claude', 'agents'], layout: 'files' },
  { tool: 'claude', kind: 'skill', user: ['.claude', 'skills'], project: ['.claude', 'skills'], layout: 'skill-dirs' },
  { tool: 'pi', kind: 'skill', user: ['.pi', 'agent', 'skills'], project: ['.pi', 'skills'], layout: 'skill-dirs' },
]

function claudeHome(env, home) {
  // CLAUDE_CONFIG_DIR may list several folders; the first is the user's main one.
  const first = env.CLAUDE_CONFIG_DIR?.split(',').map((s) => s.trim()).find(Boolean)
  return first || path.join(home, '.claude')
}

function piHome(env, home) {
  return env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent')
}

function userDir(loc, env, home) {
  if (loc.tool === 'pi') return path.join(piHome(env, home), ...loc.user.slice(2))
  return path.join(claudeHome(env, home), ...loc.user.slice(1))
}

/**
 * A small frontmatter reader: `key: value` lines between the first two `---`
 * lines, with `>`/`|` blocks, quoted strings and `- item` lists. Enough for
 * agent and skill headers; anything it does not understand is skipped.
 */
function parseFrontmatter(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { data: {}, body: text }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) return { data: {}, body: text }
  const data = {}
  let key
  let block
  for (const line of lines.slice(1, end)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (m) {
      key = m[1]
      const v = m[2].trim()
      block = v === '>' || v === '|' || v === '>-' || v === '|-' ? v[0] : undefined
      data[key] = block ? '' : unquote(v)
      continue
    }
    if (!key) continue
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item && !block) {
      data[key] = [...(Array.isArray(data[key]) ? data[key] : []), unquote(item[1].trim())]
    } else if (block && /^\s+/.test(line)) {
      const sep = data[key] ? (block === '|' ? '\n' : ' ') : ''
      data[key] += sep + line.trim()
    }
  }
  return { data, body: lines.slice(end + 1).join('\n').trim() }
}

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

function list(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean)
  return undefined
}

function oneLine(s, max = 300) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

async function readHead(file) {
  const fh = await fs.promises.open(file, 'r')
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}

/** Definition files in one folder: `*.md` files, or `<name>/SKILL.md` folders. */
async function filesIn(dir, layout) {
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const e of entries) {
    if (out.length >= MAX_PER_DIR) break
    if (e.name.startsWith('.')) continue
    if (layout === 'files' && e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push({ file: path.join(dir, e.name), slug: e.name.replace(/\.md$/i, '') })
    if (layout === 'skill-dirs' && e.isDirectory()) {
      const file = path.join(dir, e.name, 'SKILL.md')
      if (fs.existsSync(file)) out.push({ file, slug: e.name })
    }
  }
  return out
}

// Handles handed to the page, valid for the life of the process.
const known = new Map()

function handleFor(file) {
  const id = `def_${crypto.createHash('sha256').update(file).digest('hex').slice(0, 16)}`
  known.set(id, file)
  return id
}

/**
 * Every definition in the user folders and in each allowed repo.
 * @param {{ repos: { name: string, path: string }[], env?: NodeJS.ProcessEnv, home?: string }} opts
 */
async function listDefinitions({ repos, env = process.env, home = os.homedir() }) {
  const places = []
  for (const loc of LOCATIONS) {
    places.push({ loc, dir: userDir(loc, env, home), scope: 'user', display: path.join('~', ...loc.user) })
    for (const r of repos) places.push({ loc, dir: path.join(r.path, ...loc.project), scope: 'project', repo: r.name, display: path.join(...loc.project) })
  }
  const definitions = []
  const sources = LOCATIONS.map((l) => ({ tool: l.tool, kind: l.kind, found: false }))
  for (const p of places) {
    const files = await filesIn(p.dir, p.loc.layout)
    if (files.length) sources[LOCATIONS.indexOf(p.loc)].found = true
    for (const f of files) {
      if (definitions.length >= MAX_TOTAL) break
      let head
      let stat
      try {
        ;[head, stat] = await Promise.all([readHead(f.file), fs.promises.stat(f.file)])
      } catch {
        continue
      }
      const { data } = parseFrontmatter(head)
      definitions.push({
        id: handleFor(f.file),
        tool: p.loc.tool,
        kind: p.loc.kind,
        scope: p.scope,
        repo: p.repo,
        name: oneLine(data.name || f.slug, 80),
        description: oneLine(data.description),
        model: typeof data.model === 'string' && data.model ? data.model : undefined,
        tools: list(data.tools ?? data['allowed-tools']),
        location: path.join(p.display, p.loc.layout === 'files' ? path.basename(f.file) : path.join(f.slug, 'SKILL.md')),
        updatedAt: stat.mtimeMs,
      })
    }
  }
  definitions.sort((a, b) => a.name.localeCompare(b.name))
  return { definitions, sources, truncated: definitions.length >= MAX_TOTAL }
}

/** One definition's instructions (the text after the header), by id. */
async function getDefinition(id) {
  const file = typeof id === 'string' ? known.get(id) : undefined
  if (!file) throw new Error('Definition not found. Refresh the page and try again.')
  const stat = await fs.promises.stat(file)
  if (stat.size > 1024 * 1024) throw new Error('This definition is too large to show.')
  const { data, body } = parseFrontmatter(await fs.promises.readFile(file, 'utf8'))
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : oneLine(v, 500)]))
  return { id, fields, body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}\n… (${body.length - MAX_BODY} more characters)` : body }
}

module.exports = { listDefinitions, getDefinition, parseFrontmatter, LOCATIONS }
