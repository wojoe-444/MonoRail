// Custom system prompts per agent (Claude, pi, the coordinator).
//
// Kept in system-prompts.json in the module's data folder, never in the repo:
// the text is the user's own. The main process reads it when a turn starts
// and puts the matching prompt on the job, so every turn picks it up the same
// way: turns from the page, child turns the coordinator starts and coordinator
// turns from the MCP server.
//
// Modes:
//   - append (default): Claude Code's / pi's own prompt, then this text.
//   - replace: this text instead of their own prompt. For Claude that drops
//     Claude Code's built-in guidance on tools, safety and style; pi keeps its
//     tool list and context files and only swaps its opening instructions.
// The coordinator can only append: its own instructions are its subagent file.
// A prompt never changes permissions; the tool lists and checks stay as they are.

const fs = require('node:fs')
const path = require('node:path')

const PROMPTS_FILE = 'system-prompts.json'

const AGENTS = ['claude', 'pi', 'coordinator']
const PROMPT_MODES = ['append', 'replace']
const MAX_PROMPT = 20_000

const empty = () => ({ mode: 'append', text: '' })

/** One agent's entry, cleaned. Throws on anything the page should not send. */
function cleanEntry(agent, entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Missing system prompt')
  const mode = entry.mode ?? 'append'
  if (!PROMPT_MODES.includes(mode)) throw new Error('Unknown system prompt mode')
  if (agent === 'coordinator' && mode !== 'append') throw new Error("The coordinator's prompt can only be added to. Edit coordinator.md to change its instructions.")
  if (typeof entry.text !== 'string') throw new Error('Missing system prompt text')
  if (entry.text.length > MAX_PROMPT) throw new Error(`A system prompt can be at most ${MAX_PROMPT.toLocaleString('en-US')} characters.`)
  return { mode, text: entry.text }
}

/** Every agent's prompt; missing or unreadable entries read as empty. */
function readPrompts(dataDir) {
  const out = Object.fromEntries(AGENTS.map((a) => [a, empty()]))
  if (!dataDir) return out
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dataDir, PROMPTS_FILE), 'utf8'))
  } catch {
    return out
  }
  for (const a of AGENTS) {
    try {
      if (raw?.[a]) out[a] = cleanEntry(a, raw[a])
    } catch {
      // a broken entry reads as none
    }
  }
  return out
}

/** Save the agents named in `value` (others are kept). Written atomically. */
function writePrompts(dataDir, value) {
  if (!dataDir) throw new Error('No data folder')
  if (!value || typeof value !== 'object') throw new Error('Missing system prompts')
  const next = readPrompts(dataDir)
  for (const [a, entry] of Object.entries(value)) {
    if (!AGENTS.includes(a)) throw new Error('Unknown agent')
    next[a] = cleanEntry(a, entry)
  }
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, PROMPTS_FILE)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, file)
  return next
}

/** The prompt for one turn, or undefined when the agent has none. */
function promptForTurn(prompts, { sdk, coordinator }) {
  const entry = prompts?.[coordinator ? 'coordinator' : sdk]
  if (!entry || !entry.text.trim()) return undefined
  return { mode: coordinator ? 'append' : entry.mode, text: entry.text }
}

/** Validates the prompt on a job (the worker checks the job again). */
function validateJobPrompt(p, { coordinator }) {
  if (p === undefined || p === null) return undefined
  if (typeof p !== 'object' || !PROMPT_MODES.includes(p.mode)) throw new Error('Unknown system prompt mode')
  if (typeof p.text !== 'string' || !p.text.trim()) throw new Error('Empty system prompt')
  if (p.text.length > MAX_PROMPT) throw new Error('That system prompt is too long.')
  if (coordinator && p.mode !== 'append') throw new Error("The coordinator's prompt can only be added to.")
  return { mode: p.mode, text: p.text }
}

module.exports = { PROMPTS_FILE, AGENTS, PROMPT_MODES, MAX_PROMPT, readPrompts, writePrompts, promptForTurn, validateJobPrompt }
