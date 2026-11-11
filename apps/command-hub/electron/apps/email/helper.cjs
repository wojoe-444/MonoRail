// Hidden helper processes for connectors that talk to a program on this PC
// (the Outlook connector drives the running Outlook over COM through Windows
// PowerShell).
//
// - No window: windowsHide plus -WindowStyle Hidden, so no console flashes.
// - Script and arguments never go on the command line. The script arrives on
//   stdin; the arguments are base64 JSON in an environment variable, read by
//   the script as data (never pasted into code).
// - A hard timeout kills the process; the caller gets code 'timeout'.
// - The script answers with exactly one JSON object on stdout:
//   { ok: true, result } or { ok: false, code, message }.
// - At most MAX_RUNNING at a time, so a slow mailbox cannot pile up processes.
// - Logs metadata only (op, ms, outcome), never arguments or results.

const { spawn } = require('node:child_process')

const MAX_RUNNING = 3
let running = 0
const waiting = []

async function slot() {
  if (running < MAX_RUNNING) {
    running++
    return
  }
  await new Promise((resolve) => waiting.push(resolve))
  running++
}
function release() {
  running--
  waiting.shift()?.()
}

class HelperError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/**
 * Run `command args` hidden, write `stdin`, pass `args` as base64 JSON in
 * MONORAIL_ARGS, and parse the JSON answer.
 */
async function runJsonHelper({ command, commandArgs, stdin, args, timeoutMs, label = 'helper', log = () => {}, spawnImpl = spawn }) {
  await slot()
  const started = Date.now()
  try {
    return await new Promise((resolve, reject) => {
      let child
      try {
        child = spawnImpl(command, commandArgs, {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...minimalEnv(), MONORAIL_ARGS: Buffer.from(JSON.stringify(args ?? {}), 'utf8').toString('base64') },
        })
      } catch (e) {
        reject(new HelperError('unavailable', `Could not start ${command}: ${e.message}`))
        return
      }
      let out = ''
      let err = ''
      let done = false
      const finish = (fn) => {
        if (done) return
        done = true
        clearTimeout(timer)
        fn()
      }
      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          /* already gone */
        }
        finish(() => reject(new HelperError('timeout', `No answer after ${Math.round(timeoutMs / 1000)} s.`)))
      }, timeoutMs)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (d) => {
        out += d
        if (out.length > 64 * 1024 * 1024) child.kill()
      })
      child.stderr.on('data', (d) => {
        if (err.length < 8192) err += d
      })
      child.on('error', (e) =>
        finish(() => reject(new HelperError(e.code === 'ENOENT' ? 'unavailable' : 'helper', e.code === 'ENOENT' ? `${command} was not found on this PC.` : e.message))),
      )
      child.on('close', (code) =>
        finish(() => {
          let answer
          try {
            answer = JSON.parse(out.trim())
          } catch {
            const firstLine = err.split(/\r?\n/).find((l) => l.trim()) ?? ''
            reject(new HelperError('helper', `The helper stopped without an answer (exit ${code}). ${firstLine.slice(0, 300)}`.trim()))
            return
          }
          if (answer?.ok) resolve(answer.result)
          else reject(new HelperError(String(answer?.code || 'helper'), String(answer?.message || 'The helper failed.')))
        }),
      )
      child.stdin.on('error', () => {})
      child.stdin.end(stdin ?? '')
    })
  } catch (e) {
    log(`${label} failed after ${Date.now() - started} ms (${e.code ?? 'error'})`)
    throw e
  } finally {
    release()
  }
}

/** Only what Windows needs to run PowerShell and reach COM; no tokens from MonoRail's own environment. */
function minimalEnv() {
  const keep = ['SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR', 'SystemDrive', 'TEMP', 'TMP', 'USERPROFILE', 'USERNAME', 'USERDOMAIN', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'PATH', 'Path', 'PATHEXT', 'COMPUTERNAME', 'PROCESSOR_ARCHITECTURE', 'PSModulePath', 'HOME', 'LANG']
  const env = {}
  for (const k of keep) if (process.env[k] != null) env[k] = process.env[k]
  return env
}

/**
 * Run a Windows PowerShell 5.1 script (powershell.exe: COM's
 * Marshal.GetActiveObject is not in PowerShell 7). The command line only
 * carries a fixed bootstrap that reads the script from stdin.
 */
function runPowerShell(script, args, { timeoutMs = 30_000, label, log } = {}) {
  if (process.platform !== 'win32') return Promise.reject(new HelperError('unavailable', 'This needs Windows.'))
  const bootstrap = '$s = [Console]::In.ReadToEnd(); Invoke-Expression $s'
  const encoded = Buffer.from(bootstrap, 'utf16le').toString('base64')
  return runJsonHelper({
    command: 'powershell.exe',
    commandArgs: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
    stdin: script,
    args,
    timeoutMs,
    label,
    log,
  })
}

module.exports = { runJsonHelper, runPowerShell, HelperError, _internal: { minimalEnv } }
