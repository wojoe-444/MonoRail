const { execFile, spawn } = require('node:child_process')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const exec = promisify(execFile)

async function call(args) {
  if (process.platform !== 'win32') throw new Error('Windows Task Scheduler is available on Windows only.')
  const script = await readFile(path.join(__dirname, 'scheduled.ps1'), 'utf8')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const env = { ...process.env, MONORAIL_SCHEDULED_ARGS: Buffer.from(JSON.stringify(args)).toString('base64') }
  try {
    const { stdout } = await exec(path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env, windowsHide: true, timeout: 60000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' })
    return JSON.parse(stdout.trim())
  } catch (e) { throw new Error(e.stderr?.trim() || e.message) }
}
module.exports = {
  id: 'scheduled',
  desktopOnly: ['openScheduler'],
  methods: {
    list: () => call({ action: 'list' }),
    change: (_ctx, args) => call({ action: args?.action, name: args?.name, path: args?.path }),
    openScheduler: async () => {
      if (process.platform !== 'win32') throw new Error('Windows Task Scheduler is available on Windows only.')
      const child = spawn(path.join(process.env.SystemRoot, 'System32', 'mmc.exe'), [path.join(process.env.SystemRoot, 'System32', 'taskschd.msc')], { detached: true, stdio: 'ignore' })
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
      child.unref()
    },
  },
}
