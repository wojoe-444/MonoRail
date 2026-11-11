// Session partners: splits each Claude Code session into phases and records
// which models worked together in each one.
//
// A phase is a stretch of a session with one *driver* model (the model on the
// main conversation thread) plus whatever models its subagents ran on. A new
// phase starts when the driver model changes, or when the session sits idle for
// longer than IDLE_GAP_MS (you came back to it later). Subagent messages are
// attached to the phase running when they happened, so a Sonnet morning and an
// Opus + Haiku afternoon in the same session come out as two separate pairings.
//
// Reads the same JSONL logs ccusage reads. Nothing leaves this machine.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const readline = require('node:readline')

const IDLE_GAP_MS = 2 * 60 * 60 * 1000

function projectRoots() {
  const env = process.env.CLAUDE_CONFIG_DIR
  const bases = env
    ? env.split(',').map((s) => s.trim()).filter(Boolean)
    : [path.join(os.homedir(), '.config', 'claude'), path.join(os.homedir(), '.claude')]
  return bases.map((b) => path.join(b, 'projects')).filter((p) => fs.existsSync(p))
}

async function* walkJsonl(dir) {
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walkJsonl(full)
    else if (e.isFile() && e.name.endsWith('.jsonl')) yield full
  }
}

function localDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Collect assistant messages from every log file, de-duplicated like ccusage (message id + request id). */
async function readMessages(roots) {
  const seen = new Set()
  const bySession = new Map()
  for (const root of roots) {
    for await (const file of walkJsonl(root)) {
      const rel = path.relative(root, file).split(path.sep)
      const project = rel[0]
      const inSubagentDir = rel.includes('subagents')
      const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
      for await (const line of rl) {
        if (!line.includes('"assistant"') || !line.includes('"usage"')) continue
        let d
        try {
          d = JSON.parse(line)
        } catch {
          continue
        }
        const msg = d.message
        if (d.type !== 'assistant' || !msg?.usage || !msg.model || msg.model === '<synthetic>') continue
        const key = msg.id && d.requestId ? `${msg.id}:${d.requestId}` : undefined
        if (key) {
          if (seen.has(key)) continue
          seen.add(key)
        }
        const ts = Date.parse(d.timestamp)
        if (!Number.isFinite(ts)) continue
        const sessionId = d.sessionId || (inSubagentDir ? rel[rel.length - 3] : path.basename(file, '.jsonl'))
        let s = bySession.get(sessionId)
        if (!s) bySession.set(sessionId, (s = { project, messages: [] }))
        const u = msg.usage
        s.messages.push({
          ts,
          model: msg.model,
          sub: d.isSidechain === true || inSubagentDir,
          effort: typeof d.effort === 'string' ? d.effort : undefined,
          input: u.input_tokens || 0,
          output: u.output_tokens || 0,
          cacheCreate: u.cache_creation_input_tokens || 0,
          cacheRead: u.cache_read_input_tokens || 0,
        })
      }
    }
  }
  return bySession
}

function splitPhases(sessionId, project, messages) {
  messages.sort((a, b) => a.ts - b.ts)
  const main = messages.filter((m) => !m.sub)
  const phases = []
  let cur
  let lastTs = -Infinity
  for (const m of main) {
    if (!cur || m.model !== cur.driver || m.ts - lastTs > IDLE_GAP_MS) {
      cur = { sessionId, project, driver: m.model, start: m.ts, end: m.ts, efforts: {}, msgs: [] }
      phases.push(cur)
    }
    cur.end = m.ts
    if (m.effort) cur.efforts[m.effort] = (cur.efforts[m.effort] || 0) + 1
    cur.msgs.push(m)
    lastTs = m.ts
  }
  // Attach subagent messages to the phase running at that time.
  for (const m of messages.filter((x) => x.sub)) {
    // Phases are in start order, so the latest one that started by m.ts was the one running.
    let target = phases.findLast((p) => p.start <= m.ts) || phases[0]
    if (!target) {
      // A session with only subagent traffic: give it its own phase.
      target = { sessionId, project, driver: undefined, start: m.ts, end: m.ts, efforts: {}, msgs: [] }
      phases.push(target)
    }
    target.msgs.push(m)
  }

  return phases.map((p) => {
    const facts = new Map()
    for (const m of p.msgs) {
      const role = m.sub ? 'subagent' : 'driver'
      const k = `${localDate(m.ts)}|${m.model}|${role}`
      let f = facts.get(k)
      if (!f) {
        facts.set(k, (f = { date: localDate(m.ts), model: m.model, role, input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }))
      }
      f.input += m.input
      f.output += m.output
      f.cacheCreate += m.cacheCreate
      f.cacheRead += m.cacheRead
    }
    const effort = Object.entries(p.efforts).sort((a, b) => b[1] - a[1])[0]?.[0]
    return {
      sessionId: p.sessionId,
      project: p.project,
      driver: p.driver,
      effort,
      start: new Date(p.start).toISOString(),
      end: new Date(Math.max(p.end, ...p.msgs.map((m) => m.ts))).toISOString(),
      facts: [...facts.values()],
    }
  })
}

async function collectPhases(roots = projectRoots()) {
  const sessions = await readMessages(roots)
  const phases = []
  for (const [id, s] of sessions) phases.push(...splitPhases(id, s.project, s.messages))
  return { idleGapMinutes: IDLE_GAP_MS / 60000, phases }
}

module.exports = { collectPhases, splitPhases, IDLE_GAP_MS }
