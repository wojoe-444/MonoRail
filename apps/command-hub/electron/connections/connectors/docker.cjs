// Docker connector.
//
// Optional, like every connector: nothing here runs until the user adds the
// Docker connection, and MonoRail never downloads or installs Docker or
// lazydocker. Nothing is stored except the one setting (whether to look for
// lazydocker). The check finds `docker` on PATH by file, asks it for its
// version (client and engine) and, when lazydocker is wanted, finds
// `lazydocker` on PATH and asks for its version. The Docker page
// (electron/modules/docker.cjs) reads from the same docker CLI.
//
// Actions: Start Docker Desktop (Windows, only if it is installed in its usual
// folder) and Open lazydocker (a terminal window).

const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')

const cli = require('../../modules/docker-cli.cjs')
const { openTerminal } = require('../run.cjs')

const LAZYDOCKER_URL = 'https://github.com/jesseduffield/lazydocker'

function wantsLazydocker(conn) {
  return conn?.values?.lazydocker !== 'no'
}

/** Docker Desktop's program in its default install folder, if it is there. */
async function dockerDesktopExe(deps = {}) {
  if ((deps.platform ?? process.platform) !== 'win32') return undefined
  const env = deps.env ?? process.env
  const stat = deps.stat ?? fs.stat
  const local = env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs')
  const installed = await cli.dockerDesktopDir(deps)
  const dirs = [installed, ...[env.ProgramFiles, env.ProgramW6432, local].filter(Boolean).map((b) => path.win32.join(b, 'Docker', 'Docker'))]
  for (const dir of dirs.filter(Boolean)) {
    const file = path.win32.join(dir, 'Docker Desktop.exe')
    try {
      if ((await stat(file)).isFile()) return file
    } catch {
      // not here
    }
  }
  return undefined
}

async function lazydockerFacts(deps, target) {
  const bin = await cli.findLazydocker(deps)
  if (!bin && target && typeof target === 'object') return { ...(await cli.wslLazydockerVersion(target, deps)), wsl: target.distro }
  if (!bin) return { found: false }
  // A shim (.cmd/.ps1) cannot run without a shell; it is still found.
  if (!/\.(exe)$/i.test(bin) && process.platform === 'win32') return { found: true }
  const res = await (deps.runFile ?? cli.runFile)(bin, ['--version'], { timeoutMs: 10_000, env: await cli.programEnv(undefined, deps) })
  return { found: true, version: cli.parseLazydockerVersion(res.stdout) }
}

/** Where the check looked, so a "not found" can be acted on. */
function searchDetails(trace = {}) {
  const details = [{ label: 'docker', value: 'Not found on PATH' }]
  if (trace.wsl) details.push({ label: 'WSL', value: trace.wsl })
  if (trace.registryPath !== undefined) details.push({ label: 'Windows PATH', value: trace.registryPath ? 'Read from Windows settings, no docker there' : 'Could not be read' })
  details.push({ label: 'Docker Desktop', value: trace.desktopDir ? `Installed in ${trace.desktopDir}, but docker.exe is missing there` : 'No install recorded by Windows' })
  for (const file of trace.looked ?? []) details.push({ label: 'Looked for', value: file })
  return details
}

/** Fold the checks into one status. Exported for tests. */
function summarize({ docker, version, containers, lazydocker, desktopInstalled, trace, wsl }) {
  const lazyDetail = lazydocker
    ? { label: 'lazydocker', value: lazydocker.found ? `${lazydocker.version ?? 'Found'}${lazydocker.wsl ? ` (in ${lazydocker.wsl})` : ''}` : 'Not found on PATH (optional)', ok: lazydocker.found || undefined }
    : { label: 'lazydocker', value: 'Not looked for (turned off)' }
  if (!docker) {
    return {
      state: 'unavailable',
      summary: 'Docker was not found on this computer.',
      hint: 'Docker is optional. If you want it, install Docker Desktop yourself, then check again. MonoRail never installs it.',
      details: searchDetails(trace),
    }
  }
  const details = [{ label: 'docker CLI', value: version.client ?? 'Did not answer' }]
  if (wsl) details.push({ label: 'Runs in', value: `WSL (${wsl})` })
  if (!version.running) {
    details.push({ label: 'Engine', value: 'Not running', ok: false })
    if (version.error) details.push({ label: 'Error', value: version.error })
    details.push(lazyDetail)
    return {
      state: 'error',
      summary: 'Docker is installed, but its engine is not running.',
      hint: wsl
        ? `Start Docker inside ${wsl} (for example: sudo service docker start), then check again.`
        : desktopInstalled
          ? 'Start Docker Desktop, wait until it says "Engine running", then check again.'
          : 'Start the Docker engine, then check again.',
      details,
      actions: desktopInstalled ? ['start-desktop'] : [],
    }
  }
  details.push({ label: 'Engine', value: `${version.server}, running`, ok: true })
  if (version.platform) details.push({ label: 'Platform', value: version.platform })
  if (version.context) details.push({ label: 'Context', value: version.context })
  if (containers) {
    const running = containers.filter((c) => c.state === 'running').length
    details.push({ label: 'Containers', value: `${running} running, ${containers.length - running} stopped` })
  }
  details.push(lazyDetail)
  const lazy = lazydocker?.found ? ` lazydocker ${lazydocker.version ?? ''} found.`.replace('  ', ' ') : ''
  return {
    state: 'ok',
    summary: `${version.platform ?? 'Docker'} is running${wsl ? ` in WSL (${wsl})` : ''} (Engine ${version.server}).${lazy}`,
    details,
    actions: lazydocker?.found ? ['open-lazydocker'] : [],
  }
}

async function status(conn, deps = {}) {
  const trace = {}
  const docker = await cli.findDockerTarget({ ...deps, trace })
  const lazydocker = wantsLazydocker(conn) ? await lazydockerFacts(deps, docker) : undefined
  if (!docker) return summarize({ lazydocker, trace })
  const d = cli.createDocker(docker, deps)
  const version = await d.version()
  const containers = version.running ? await d.containers() : undefined
  const desktopInstalled = !d.wsl && !version.running && !!(await (deps.dockerDesktopExe ?? dockerDesktopExe)(deps))
  return summarize({ docker, version, containers, lazydocker, desktopInstalled, wsl: d.wsl })
}

async function startDesktop(_conn, job, deps = {}) {
  const exe = await (deps.dockerDesktopExe ?? dockerDesktopExe)(deps)
  if (!exe) throw new Error('Docker Desktop was not found in its usual folder. Start it from the Start menu.')
  const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false, shell: false })
  child.on('error', () => {})
  child.unref()
  if (job) job.note = 'Docker Desktop is starting. Check again once it says "Engine running".'
}

/** Open lazydocker in a terminal window. Shared with the Docker page. */
async function openLazydocker(conn, deps = {}) {
  if (!wantsLazydocker(conn)) throw new Error('Looking for lazydocker is turned off for the Docker connection.')
  const bin = await cli.findLazydocker(deps)
  if (!bin) {
    // Docker inside WSL: run the distro's own lazydocker there (login shell, fixed command).
    const target = await cli.findDockerInWsl(deps)
    if (target && (await cli.wslLazydockerVersion(target, deps)).found) {
      ;(deps.openTerminal ?? openTerminal)('lazydocker', 'wsl', ['-d', target.distro, '-e', 'bash', '-lc', 'lazydocker'])
      return
    }
  }
  if (!bin) throw new Error(`lazydocker was not found on PATH. It is optional; see ${LAZYDOCKER_URL} if you want it.`)
  // The terminal gets the current PATH plus lazydocker's own folder (found in
  // an install folder that is not on PATH) and docker's, so both start there.
  const docker = await cli.findDocker(deps)
  const extra = [path.dirname(bin), docker && path.dirname(docker)].filter(Boolean).join(path.delimiter)
  const { PATH } = await cli.programEnv(undefined, deps)
  ;(deps.openTerminal ?? openTerminal)('lazydocker', 'lazydocker', [], { env: { PATH: `${extra}${path.delimiter}${PATH}` } })
}

module.exports = {
  kind: 'docker',
  title: 'Docker',
  description: 'Your own Docker (Docker Desktop or Docker Engine), and lazydocker if you have it. The Docker page under Utilities reads from it. Optional: MonoRail never installs either.',
  icon: 'container',
  fields: [
    {
      key: 'lazydocker',
      label: 'lazydocker',
      type: 'select',
      options: [
        { value: 'yes', label: 'Use it when it is installed' },
        { value: 'no', label: 'Do not look for it' },
      ],
      defaultValue: 'yes',
      help: 'lazydocker is a terminal dashboard for Docker. When it is on your PATH, the Docker page can open it in a terminal.',
    },
  ],
  actions: [
    { id: 'start-desktop', label: 'Start Docker Desktop', description: 'Opens Docker Desktop, if it is installed.', showWhen: ['error'], run: (conn, job, deps) => startDesktop(conn, job, deps) },
    { id: 'open-lazydocker', label: 'Open lazydocker', description: 'Opens lazydocker in a terminal window.', showWhen: ['ok'], run: (conn, _job, deps) => openLazydocker(conn, deps) },
  ],
  status,
  /** For the Docker page backend: the saved setting only. */
  credentials: (conn) => ({ lazydocker: wantsLazydocker(conn) }),
  LAZYDOCKER_URL,
  openLazydocker,
  _internal: { summarize, dockerDesktopExe, wantsLazydocker },
}
