// Run a command-line tool (gcloud, claude) the way a terminal would.
//
// On Windows these tools are .cmd shims, which need cmd.exe, so the command
// goes through the shell there. Only fixed arguments written in this repo are
// ever passed (checked by SAFE_ARG), never text from the page.

const { spawn } = require('node:child_process')

const SAFE_ARG = /^[\w.:=/@-]+$/
const isWin = process.platform === 'win32'

function spawnTool(cmd, args, options = {}) {
  for (const a of [cmd, ...args]) if (!SAFE_ARG.test(a)) throw new Error(`Refusing unsafe argument: ${a}`)
  const opts = { windowsHide: true, ...options, env: { ...process.env, ...(options.env ?? {}) } }
  return isWin ? spawn([cmd, ...args].join(' '), { ...opts, shell: true }) : spawn(cmd, args, opts)
}

/** True when the shell could not find the program (ENOENT, or cmd.exe's 9009). */
function isNotFound(code, stderr, error) {
  if (error?.code === 'ENOENT') return true
  if (code === 9009 || code === 127) return true
  return /is not recognized as an internal or external command|command not found/i.test(stderr ?? '')
}

/**
 * Run to completion: { code, stdout, stderr, notFound, timedOut }. Never throws.
 * input, when given, is written to the program's stdin (request bodies go
 * there, never on the command line).
 */
function runTool(cmd, args, { timeoutMs = 30_000, env, cwd, input } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawnTool(cmd, args, { env, cwd, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: String(error.message), notFound: false, timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    if (input !== undefined) {
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    }
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr, notFound: isNotFound(-1, stderr, error), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr, notFound: isNotFound(code, stderr), timedOut })
    })
  })
}

/** Stop a child and everything it started (cmd.exe -> python on Windows). */
function killTree(child) {
  if (!child?.pid) return
  if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {})
  else child.kill('SIGTERM')
}

/** Open a visible terminal window running a command (Windows only), for sign-ins that ask questions. */
function openTerminal(title, cmd, args, { env } = {}) {
  for (const a of [cmd, ...args]) if (!SAFE_ARG.test(a)) throw new Error(`Refusing unsafe argument: ${a}`)
  if (!SAFE_ARG.test(title.replace(/ /g, '_'))) throw new Error('Unsafe window title')
  if (!isWin) throw new Error(`Open a terminal and run: ${[cmd, ...args].join(' ')}`)
  const child = spawn(`start "${title}" cmd /k ${[cmd, ...args].join(' ')}`, { shell: true, detached: true, stdio: 'ignore', ...(env ? { env: { ...process.env, ...env } } : {}) })
  child.on('error', () => {})
  child.unref()
}

module.exports = { runTool, spawnTool, killTree, openTerminal, isNotFound, SAFE_ARG }
