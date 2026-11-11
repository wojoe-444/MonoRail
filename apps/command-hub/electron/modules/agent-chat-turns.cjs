// Agent Chat turns: one worker process per turn (K2, L1).
//
// - The job, prompt included, goes to the worker on stdin, never on a command line.
// - One turn per chat at a time; a second send is refused with the reason.
// - Stop ends the turn and its whole process tree, including the processes the
//   SDK started (taskkill /T on Windows, the process group elsewhere).
// - A turn that runs longer than 30 minutes is stopped and marked timed out.
// - The page polls for events, so the renderer bridge stays as it is.
// - The log records only session ids, the SDK, the model, the mode and how a
//   turn ended: never a prompt, a reply, tool output or a token.

const { execFile, spawn } = require('node:child_process')
const crypto = require('node:crypto')
const path = require('node:path')

const TURN_TIMEOUT_MS = 30 * 60 * 1000
const KEEP_FINISHED_MS = 60 * 60 * 1000
const MAX_EVENTS = 20_000
const WORKER = path.join(__dirname, 'agent-chat-worker.mjs')

/** turnId -> turn */
const turns = new Map()
/** chat key -> turnId of its running turn */
const running = new Map()

let log = () => {}
function setLogger(fn) {
  log = fn
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.killed) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {})
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL') // the worker leads its own process group
    } catch {
      try {
        child.kill('SIGKILL')
      } catch {
        // already gone
      }
    }
  }
}

function prune() {
  const now = Date.now()
  for (const [id, t] of turns) if (t.endedAt && now - t.endedAt > KEEP_FINISHED_MS) turns.delete(id)
}

/**
 * Start a turn. `chatKey` identifies the chat ("claude:<session>" or a fresh
 * key for a new chat). `worker` is the job for the worker; its folder was
 * resolved and checked by the caller.
 */
function startTurn({ chatKey, worker, meta, onFinish, spawnWorker = defaultSpawn, timeoutMs = TURN_TIMEOUT_MS }) {
  prune()
  if (running.has(chatKey)) throw new Error('A reply is still running in this chat. Wait for it to finish, or press Stop.')
  const id = crypto.randomUUID()
  const turn = { id, chatKey, keys: [chatKey], status: 'running', events: [], startedAt: Date.now(), endedAt: undefined, child: undefined, meta }
  turns.set(id, turn)
  running.set(chatKey, id)

  const finish = (status, extra) => {
    if (turn.endedAt) return
    if (extra) push(turn, extra)
    // Bookkeeping (e.g. the turn's cost) lands before the status flips, so a
    // poll that sees the end also sees it.
    try {
      for (const e of onFinish?.(turn, status) ?? []) push(turn, e)
    } catch {
      // never let a bookkeeping error break the turn
    }
    turn.status = status
    turn.endedAt = Date.now()
    clearTimeout(turn.timer)
    for (const k of turn.keys) if (running.get(k) === id) running.delete(k)
    log('turn ended', { session: turn.sessionId ?? null, sdk: meta.sdk, model: meta.model, mode: meta.mode, end: status })
  }

  log('turn started', { session: meta.resume ?? null, sdk: meta.sdk, model: meta.model, mode: meta.mode })
  const child = spawnWorker()
  turn.child = child
  let buf = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (!line.trim()) continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      if (event.t === 'init' && event.sessionId) {
        turn.sessionId = event.sessionId
        const key = `${meta.sdk}:${event.sessionId}`
        if (!turn.keys.includes(key)) {
          turn.keys.push(key)
          if (!turn.endedAt) running.set(key, id)
        }
      }
      if (event.t === 'result') turn.result = event
      push(turn, event)
    }
  })
  child.stderr?.resume() // drained, never logged
  child.on('error', (err) => finish('failed', { t: 'error', message: `Could not start the worker: ${err.message}` }))
  child.on('exit', (code) => {
    if (turn.endedAt) return
    const ok = code === 0 && turn.result && !turn.result.isError
    finish(ok ? 'done' : 'failed', ok || turn.events.some((e) => e.t === 'error') ? undefined : { t: 'error', message: 'The turn ended without a reply.' })
  })

  child.stdin.on('error', () => {})
  child.stdin.end(JSON.stringify(worker))

  turn.timer = setTimeout(() => {
    killTree(child)
    finish('timed_out', { t: 'error', message: `Stopped after ${Math.round(timeoutMs / 60000)} minutes: the turn timed out.` })
  }, timeoutMs)
  turn.timer.unref?.()
  return { turnId: id }
}

function push(turn, event) {
  if (turn.events.length < MAX_EVENTS) turn.events.push(event)
}

function pollTurn(turnId, after = 0) {
  const turn = turns.get(turnId)
  if (!turn) throw new Error('That turn is no longer available.')
  const from = Number.isInteger(after) && after >= 0 ? after : 0
  return {
    status: turn.status,
    sessionId: turn.sessionId,
    startedAt: turn.startedAt,
    endedAt: turn.endedAt,
    events: turn.events.slice(from),
    next: turn.events.length,
  }
}

function stopTurn(turnId) {
  const turn = turns.get(turnId)
  if (!turn || turn.endedAt) return
  killTree(turn.child)
  // Mark it now; the exit event that follows is ignored.
  turn.status = 'stopped'
  turn.endedAt = Date.now()
  clearTimeout(turn.timer)
  push(turn, { t: 'stopped' })
  for (const k of turn.keys) if (running.get(k) === turn.id) running.delete(k)
  log('turn ended', { session: turn.sessionId ?? null, sdk: turn.meta.sdk, model: turn.meta.model, mode: turn.meta.mode, end: 'stopped' })
}

/** Running turn for a chat, so a reopened page can pick it up again. */
function runningTurnFor(chatKey) {
  return running.get(chatKey)
}

function stopAll() {
  for (const t of turns.values()) if (!t.endedAt) killTree(t.child)
}

function defaultSpawn() {
  return spawn(process.execPath, [WORKER], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32', // own process group, so Stop can end the whole tree
  })
}

module.exports = { startTurn, pollTurn, stopTurn, stopAll, runningTurnFor, setLogger, killTree, WORKER, _turns: turns, TURN_TIMEOUT_MS }
