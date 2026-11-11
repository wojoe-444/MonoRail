// Claude Stats log scanner: reads the local session logs of every supported
// agent CLI and turns them into compact aggregates for the page.
//
//   Claude Code  ~/.claude/projects and ~/.config/claude (or CLAUDE_CONFIG_DIR),
//                including subagent transcripts under <session>/subagents/
//   Gemini CLI   ~/.gemini/tmp/<project>/chats/*.json (or GEMINI_CLI_HOME/.gemini)
//   pi           ~/.pi/agent/sessions (or PI_CODING_AGENT_DIR/sessions)
//
// Each source has its own reader that yields sessions of normalized requests.
// Everything after that is shared: requests (day x session x model x role x
// context step), turns (prompt size by turn since session start or compaction),
// compactions, and session phases (session partners).
//
// Private data rule: logs are read in place and only aggregates are returned.
// Nothing leaves this machine.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const readline = require('node:readline')

const { contextStep } = require('./claude-stats-prices.cjs')
const { splitPhases } = require('./claude-stats-phases.cjs')

const MAX_TURN = 200

// ---------------------------------------------------------------- locations

function claudeRoots(env = process.env, home = os.homedir()) {
  const bases = env.CLAUDE_CONFIG_DIR
    ? env.CLAUDE_CONFIG_DIR.split(',').map((s) => s.trim()).filter(Boolean)
    : [path.join(home, '.config', 'claude'), path.join(home, '.claude')]
  return bases.map((b) => path.join(b, 'projects'))
}

function geminiRoots(env = process.env, home = os.homedir()) {
  const base = env.GEMINI_CLI_HOME || home
  return [path.join(base, '.gemini', 'tmp')]
}

function piRoots(env = process.env, home = os.homedir()) {
  const base = env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent')
  return [path.join(base, 'sessions')]
}

async function walk(dir, test) {
  const out = []
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full, test)))
    else if (e.isFile() && test(e.name, full)) out.push(full)
  }
  return out
}

async function* jsonLines(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line) continue
    try {
      yield JSON.parse(line)
    } catch {
      // partial last line or junk
    }
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// ---------------------------------------------------------------- readers
// A reader returns { found, sessions: Map<id, { project, requests[], compactions[] }> }.
// A request is { ts, model, sub, effort?, input, output, cw5m, cw1h, cacheRead, thinking, thinkingEst?, logged? }.
// effort: Claude Code's effort level, or pi's thinking level, when the log records one.
// thinking: reasoning tokens (part of output); thinkingEst marks a count estimated from text.

async function readClaude(roots) {
  const sessions = new Map()
  const seen = new Set()
  let found = false
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    found = true
    for (const file of await walk(root, (n) => n.endsWith('.jsonl'))) {
      const rel = path.relative(root, file).split(path.sep)
      const project = rel[0]
      const inSubagentDir = rel.includes('subagents')
      for await (const d of jsonLines(file)) {
        const sessionId = d.sessionId || (inSubagentDir ? rel[rel.length - 3] : path.basename(file, '.jsonl'))
        const ts = Date.parse(d.timestamp)
        if (!Number.isFinite(ts)) continue
        if (d.type === 'system' && d.subtype === 'compact_boundary' && !d.isSidechain) {
          const meta = d.compactMetadata ?? {}
          session(sessions, sessionId, project).compactions.push({
            ts,
            trigger: meta.trigger === 'manual' ? 'manual' : 'auto',
            preTokens: num(meta.preTokens) || undefined,
          })
          continue
        }
        const msg = d.message
        if (d.type !== 'assistant' || !msg?.usage || !msg.model || msg.model === '<synthetic>') continue
        const key = msg.id && d.requestId ? `${msg.id}:${d.requestId}` : undefined
        if (key) {
          if (seen.has(key)) continue
          seen.add(key)
        }
        const u = msg.usage
        const cw = num(u.cache_creation_input_tokens)
        const cw1h = num(u.cache_creation?.ephemeral_1h_input_tokens)
        session(sessions, sessionId, project).requests.push({
          ts,
          model: msg.model,
          sub: d.isSidechain === true || inSubagentDir,
          effort: typeof d.effort === 'string' ? d.effort : undefined,
          input: num(u.input_tokens),
          output: num(u.output_tokens),
          cw5m: Math.max(cw - cw1h, 0),
          cw1h: Math.min(cw1h, cw),
          cacheRead: num(u.cache_read_input_tokens),
          thinking: num(u.output_tokens_details?.thinking_tokens),
        })
      }
    }
  }
  return { found, sessions }
}

async function readGemini(roots) {
  const sessions = new Map()
  let found = false
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    found = true
    const files = await walk(root, (n, full) => n.endsWith('.json') && full.split(path.sep).includes('chats'))
    for (const file of files) {
      let doc
      try {
        doc = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      } catch {
        continue
      }
      const project = path.relative(root, file).split(path.sep)[0]
      const sessionId = `gemini:${doc.sessionId || path.basename(file, '.json')}`
      for (const m of Array.isArray(doc.messages) ? doc.messages : []) {
        const t = m?.tokens
        if (!t || !m.model) continue
        const ts = Date.parse(m.timestamp ?? doc.lastUpdated)
        if (!Number.isFinite(ts)) continue
        const cached = num(t.cached)
        // Gemini reports prompt tokens including the cached part; thoughts bill as output.
        session(sessions, sessionId, `gemini:${project.slice(0, 12)}`).requests.push({
          ts,
          model: m.model,
          sub: false,
          input: Math.max(num(t.input) - cached, 0),
          output: num(t.output) + num(t.thoughts),
          cw5m: 0,
          cw1h: 0,
          cacheRead: cached,
          thinking: num(t.thoughts),
        })
      }
    }
  }
  return { found, sessions }
}

async function readPi(roots) {
  const sessions = new Map()
  let found = false
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    found = true
    for (const file of await walk(root, (n) => n.endsWith('.jsonl'))) {
      const project = path.relative(root, file).split(path.sep)[0]
      let sessionId = `pi:${path.basename(file, '.jsonl')}`
      let cwd
      // pi sessions are trees: an entry's thinking level is the last
      // thinking_level_change on its branch (pi writes one at session start).
      const levels = new Map()
      for await (const d of jsonLines(file)) {
        if (d.type === 'session') {
          if (d.id) sessionId = `pi:${d.id}`
          cwd = d.cwd
          continue
        }
        const level = d.type === 'thinking_level_change' && typeof d.thinkingLevel === 'string' ? d.thinkingLevel : levels.get(d.parentId)
        if (d.id) levels.set(d.id, level)
        const ts = Date.parse(d.timestamp)
        if (!Number.isFinite(ts)) continue
        if (d.type === 'compaction') {
          session(sessions, sessionId, projectName(cwd, project)).compactions.push({
            ts,
            trigger: 'auto',
            preTokens: num(d.tokensBefore) || undefined,
          })
          continue
        }
        const m = d.type === 'message' ? d.message : undefined
        if (m?.role !== 'assistant' || !m.usage || !m.model) continue
        const u = m.usage
        const c = u.cost
        session(sessions, sessionId, projectName(cwd, project)).requests.push({
          ts,
          model: m.model,
          sub: false,
          input: num(u.input),
          output: num(u.output),
          cw5m: num(u.cacheWrite),
          cw1h: 0,
          cacheRead: num(u.cacheRead),
          effort: level,
          // pi logs no reasoning token count: estimate it from the thinking text (~4 characters a token).
          ...piThinking(m.content),
          // pi logs its own cost per token type; use it as logged when present.
          logged:
            c && num(c.total) > 0
              ? { input: num(c.input), output: num(c.output), cacheWrite: num(c.cacheWrite), cacheRead: num(c.cacheRead) }
              : undefined,
        })
      }
    }
  }
  return { found, sessions }
}

function piThinking(content) {
  let chars = 0
  for (const b of Array.isArray(content) ? content : []) if (b?.type === 'thinking' && typeof b.thinking === 'string') chars += b.thinking.length
  return chars ? { thinking: Math.round(chars / 4), thinkingEst: true } : { thinking: 0 }
}

function projectName(cwd, dirName) {
  if (cwd) return path.basename(String(cwd).replace(/[\\/]+$/, '')) || dirName
  return dirName
}

function session(map, id, project) {
  let s = map.get(id)
  if (!s) map.set(id, (s = { project, requests: [], compactions: [] }))
  return s
}

// ---------------------------------------------------------------- aggregates

function localDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const promptOf = (r) => r.input + r.cw5m + r.cw1h + r.cacheRead

/**
 * Shared aggregation over normalized sessions. Exported for tests.
 * Returns { requests, turns, compactions, sessions, phases }.
 */
function aggregate(source, sessions) {
  const reqRows = new Map()
  const turnRows = new Map()
  const compactions = []
  const sessionRows = []
  const phases = []

  for (const [sessionId, s] of sessions) {
    if (!s.requests.length && !s.compactions.length) continue
    s.requests.sort((a, b) => a.ts - b.ts)
    s.compactions.sort((a, b) => a.ts - b.ts)

    for (const r of s.requests) {
      const date = localDate(r.ts)
      const step = contextStep(promptOf(r))
      const effort = r.effort ?? null
      const key = `${date}|${sessionId}|${r.model}|${r.sub ? 1 : 0}|${step}|${effort}`
      let row = reqRows.get(key)
      if (!row) {
        reqRows.set(
          key,
          (row = {
            date, source, project: s.project, sessionId, model: r.model, role: r.sub ? 'subagent' : 'driver', step, effort,
            n: 0, input: 0, output: 0, cw5m: 0, cw1h: 0, cacheRead: 0, thinking: 0, thinkingEst: 0, logged: null,
          }),
        )
      }
      row.n++
      row.input += r.input
      row.output += r.output
      row.cw5m += r.cw5m
      row.cw1h += r.cw1h
      row.cacheRead += r.cacheRead
      row.thinking += r.thinking ?? 0
      if (r.thinkingEst) row.thinkingEst += r.thinking ?? 0
      if (r.logged) {
        row.logged ??= { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, n: 0 }
        row.logged.input += r.logged.input
        row.logged.output += r.logged.output
        row.logged.cacheWrite += r.logged.cacheWrite
        row.logged.cacheRead += r.logged.cacheRead
        row.logged.n++
      }
    }

    // Turns: main-thread requests numbered from the session start or from the last compaction.
    const main = s.requests.filter((r) => !r.sub)
    let ci = 0
    let turn = 0
    let kind = 'start'
    let segDate = main[0] ? localDate(main[0].ts) : undefined
    for (const r of main) {
      while (ci < s.compactions.length && s.compactions[ci].ts <= r.ts) {
        ci++
        turn = 0
        kind = 'compaction'
        segDate = localDate(r.ts)
      }
      turn++
      if (turn > MAX_TURN) continue
      const key = `${segDate}|${r.model}|${kind}|${turn}`
      let row = turnRows.get(key)
      if (!row) turnRows.set(key, (row = { date: segDate, source, model: r.model, kind, turn, n: 0, promptSum: 0 }))
      row.n++
      row.promptSum += promptOf(r)
    }

    // Compactions: the model is the main-thread model running just before it.
    for (const c of s.compactions) {
      let prev
      for (const r of main) {
        if (r.ts > c.ts) break
        prev = r
      }
      compactions.push({
        date: localDate(c.ts),
        source,
        model: prev?.model ?? null,
        trigger: c.trigger,
        preTokens: c.preTokens ?? (prev ? promptOf(prev) : null),
      })
    }

    if (s.requests.length) {
      sessionRows.push({
        source,
        sessionId,
        project: s.project,
        first: new Date(s.requests[0].ts).toISOString(),
        last: new Date(s.requests[s.requests.length - 1].ts).toISOString(),
      })
      const msgs = s.requests.map((r) => ({
        ts: r.ts, model: r.model, sub: r.sub, effort: r.effort,
        input: r.input, output: r.output, cacheCreate: r.cw5m + r.cw1h, cacheRead: r.cacheRead,
      }))
      for (const p of splitPhases(sessionId, s.project, msgs)) phases.push({ ...p, source })
    }
  }

  return { requests: [...reqRows.values()], turns: [...turnRows.values()], compactions, sessions: sessionRows, phases }
}

const SOURCES = [
  { id: 'claude-code', label: 'Claude Code', roots: claudeRoots, read: readClaude },
  { id: 'gemini-cli', label: 'Gemini CLI', roots: geminiRoots, read: readGemini },
  { id: 'pi', label: 'pi', roots: piRoots, read: readPi },
]

/** Scan every source. A source whose log folder does not exist is reported as found: false. */
async function scanAll({ env = process.env, home = os.homedir() } = {}) {
  const out = { sources: [], requests: [], turns: [], compactions: [], sessions: [], phases: [] }
  for (const src of SOURCES) {
    try {
      const { found, sessions } = await src.read(src.roots(env, home))
      const agg = aggregate(src.id, sessions)
      out.sources.push({ id: src.id, label: src.label, found, sessions: agg.sessions.length })
      for (const k of ['requests', 'turns', 'compactions', 'sessions', 'phases']) out[k].push(...agg[k])
    } catch (e) {
      out.sources.push({ id: src.id, label: src.label, found: false, error: e.message })
    }
  }
  return out
}

module.exports = { scanAll, aggregate, readClaude, readGemini, readPi, SOURCES, MAX_TURN }
