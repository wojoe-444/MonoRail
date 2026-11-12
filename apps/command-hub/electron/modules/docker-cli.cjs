// The docker CLI, read-only, for the Docker connector and the Docker page.
//
// Only the user's own `docker` (and `lazydocker`) programs, found on PATH by
// looking at files. Programs are started directly, never through a shell, with
// fixed arguments written here; the one value from the page, a container id,
// must be a hex id (CONTAINER_ID) the CLI handed out. No command here creates,
// starts, stops or removes anything, and nothing is written to disk: output is
// parsed in memory and returned. Environment variable values from `docker
// inspect` are dropped here, so they never reach the page.
//
// Nothing in this file runs unless the user has added the Docker connection:
// the connector calls it from status() and actions, the page backend checks
// hasConnection('docker') first.

const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')


const CONTAINER_ID = /^[a-f0-9]{12,64}$/
const OUTPUT_LIMIT = 4 * 1024 * 1024
const LOG_TAIL = 500

/** The first file named `name` on PATH. Looks at files only: nothing is started. */
async function findOnPath(name, { env = process.env, platform = process.platform, stat = fs.stat, exts } = {}) {
  const dirs = String(env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
  const list = exts ?? (platform === 'win32' ? String(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''])
  for (const dir of dirs) {
    for (const ext of list) {
      const file = path.join(dir, name + ext.toLowerCase())
      try {
        if ((await stat(file)).isFile()) return file
      } catch {
        // not here
      }
    }
  }
  return undefined
}

// Windows gives every program the PATH from when Explorer started. Docker
// Desktop (or winget's lazydocker) installed after that is on the PATH in the
// registry but not in MonoRail's own copy until the user signs out, so the
// lookups below also read the current PATH from the registry (reg.exe query,
// fixed arguments, values only) and check the usual install folders by file.

const REG_KEYS = ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'HKCU\\Environment']
const FRESH_PATH_MS = 60_000
let freshCache

/** "%SystemRoot%\\x" -> "C:\\Windows\\x", from the given environment. */
function expandVars(text, env) {
  return String(text).replace(/%([^%]+)%/g, (m, name) => {
    const key = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase())
    return key ? env[key] : m
  })
}

/** The Path value out of `reg query <key> /v Path` output. */
function parseRegPath(stdout) {
  const m = /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im.exec(String(stdout ?? ''))
  return m ? m[1].trim() : ''
}

/** PATH as Windows has it now: machine, then user (as Explorer builds it), then MonoRail's own. */
async function freshPath(deps = {}) {
  const env = deps.env ?? process.env
  const current = String(env.PATH ?? env.Path ?? '')
  if ((deps.platform ?? process.platform) !== 'win32') return current
  if (!deps.runFile && freshCache && Date.now() - freshCache.at < FRESH_PATH_MS) return freshCache.value
  const reg = path.join(env.SystemRoot || env.windir || 'C:\\Windows', 'System32', 'reg.exe')
  const run = deps.runFile ?? runFile
  const parts = []
  for (const key of REG_KEYS) {
    const res = await run(reg, ['query', key, '/v', 'Path'], { timeoutMs: 5_000 })
    if (res.code === 0) parts.push(...expandVars(parseRegPath(res.stdout), env).split(';'))
  }
  parts.push(...current.split(';'))
  const seen = new Set()
  const value = parts
    .map((p) => p.trim())
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
    .join(';')
  if (!deps.runFile) freshCache = { at: Date.now(), value }
  return value
}

/** Usual install folders, for when even the registry PATH has no entry. */
function knownLocations(name, env = process.env) {
  // Only used on Windows, so always Windows paths.
  const home = env.USERPROFILE || ''
  const local = env.LOCALAPPDATA || (home && path.win32.join(home, 'AppData', 'Local'))
  const dirs =
    name === 'docker'
      ? [env.ProgramFiles, env.ProgramW6432, local && path.win32.join(local, 'Programs')]
          .filter(Boolean)
          .map((b) => path.win32.join(b, 'Docker', 'Docker', 'resources', 'bin'))
          .concat(env.ProgramData ? [path.win32.join(env.ProgramData, 'DockerDesktop', 'version-bin')] : [])
      : [
          local && path.win32.join(local, 'Microsoft', 'WinGet', 'Links'),
          home && path.win32.join(home, 'scoop', 'shims'),
          env.ChocolateyInstall ? path.win32.join(env.ChocolateyInstall, 'bin') : env.ProgramData && path.win32.join(env.ProgramData, 'chocolatey', 'bin'),
          home && path.win32.join(home, 'go', 'bin'),
        ].filter(Boolean)
  return dirs.map((d) => path.win32.join(d, `${name}.exe`))
}

async function findProgram(name, exts, deps = {}) {
  const platform = deps.platform ?? process.platform
  const env = deps.env ?? process.env
  const PATH = await freshPath(deps)
  const found = await (deps.findOnPath ?? findOnPath)(name, { env: { ...env, PATH }, platform, exts })
  if (found || platform !== 'win32') return found
  const stat = deps.stat ?? fs.stat
  for (const file of knownLocations(name, env)) {
    try {
      if ((await stat(file)).isFile()) return file
    } catch {
      // not here
    }
  }
  return undefined
}

/** docker.exe is a real program on Windows, so it never needs cmd.exe. */
function findDocker(deps = {}) {
  return findProgram('docker', (deps.platform ?? process.platform) === 'win32' ? ['.exe'] : undefined, deps)
}

function findLazydocker(deps = {}) {
  return findProgram('lazydocker', undefined, deps)
}

/** The environment for docker and lazydocker: the fresh PATH, with docker's own folder first (its credential helpers live there). */
async function programEnv(file, deps = {}) {
  const PATH = await freshPath(deps)
  return { PATH: file ? `${path.dirname(file)}${path.delimiter}${PATH}` : PATH }
}

/**
 * Run a program to completion, no shell: { code, stdout, stderr, timedOut }.
 * Never throws. Output past OUTPUT_LIMIT is dropped (truncated: true).
 */
function runFile(file, args, { timeoutMs = 20_000, env } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(file, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(env ?? {}), DOCKER_CLI_HINTS: 'false' } })
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: String(error.message), timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let truncated = false
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    const take = (cur, d) => {
      if (cur.length >= OUTPUT_LIMIT) {
        truncated = true
        return cur
      }
      return cur + d
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => (stdout = take(stdout, d)))
    child.stderr.on('data', (d) => (stderr = take(stderr, d)))
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: stderr || String(error.message), timedOut, truncated })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr, timedOut, truncated })
    })
  })
}

// ---------------------------------------------------------------- parsing

/** One JSON object per line (docker's --format "{{json .}}"). Bad lines are skipped. */
function jsonLines(text) {
  const out = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t))
    } catch {
      // not JSON (a warning line)
    }
  }
  return out
}

function parseJson(text) {
  try {
    return JSON.parse(String(text ?? '').trim())
  } catch {
    return undefined
  }
}

const UNITS = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }

/** "1.21GB" (decimal, docker's sizes) or "312MiB" (binary, stats) -> bytes. */
function parseSize(text) {
  const m = /^\s*([\d.]+)\s*([a-z]*)/i.exec(String(text ?? ''))
  if (!m) return undefined
  const n = Number(m[1])
  const unit = UNITS[(m[2] || 'b').toLowerCase()]
  return Number.isFinite(n) && unit ? Math.round(n * unit) : undefined
}

/** "48MB / 21MB" -> [bytes, bytes]. */
function parsePair(text) {
  const [a, b] = String(text ?? '').split('/')
  return [parseSize(a) ?? 0, parseSize(b) ?? 0]
}

const firstLine = (t) => String(t ?? '').trim().split(/\r?\n/)[0] ?? ''

/** `docker version` -> engine facts, or why the engine did not answer. */
function parseVersion(res) {
  const v = parseJson(res.stdout) ?? {}
  const client = v.Client?.Version
  const server = v.Server?.Version
  return {
    client,
    server,
    platform: v.Server?.Platform?.Name?.replace(/\s*\(\d+\)\s*$/, '') || undefined,
    context: v.Client?.Context || undefined,
    running: !!server,
    error: server ? undefined : firstLine(res.stderr) || undefined,
  }
}

function parseLabels(text) {
  const out = {}
  for (const part of String(text ?? '').split(',')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1)
  }
  return out
}

const STATES = new Set(['running', 'paused', 'restarting', 'exited', 'created', 'dead', 'removing'])

/** `docker ps -a` rows -> containers. */
function parseContainers(text) {
  return jsonLines(text).map((r) => {
    const labels = parseLabels(r.Labels)
    const health = /\((healthy|unhealthy|health: starting)\)/.exec(r.Status ?? '')?.[1]
    return {
      id: String(r.ID ?? '').slice(0, 64),
      name: String(r.Names ?? '').split(',')[0],
      image: String(r.Image ?? ''),
      state: STATES.has(r.State) ? r.State : 'created',
      status: String(r.Status ?? ''),
      health: health === 'health: starting' ? 'starting' : health,
      project: labels['com.docker.compose.project'] || undefined,
      service: labels['com.docker.compose.service'] || undefined,
      ports: String(r.Ports ?? '')
        .split(',')
        .map((p) => p.trim().replace(/^(0\.0\.0\.0|\[::\]|::):/, ''))
        .filter((p, i, all) => p && all.indexOf(p) === i),
      networks: String(r.Networks ?? '').split(',').filter(Boolean),
      createdAt: toIso(r.CreatedAt),
    }
  })
}

/** "2026-11-12 01:02:03 +0000 UTC" -> ISO. */
function toIso(text) {
  if (!text) return undefined
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})/.exec(text)
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`) : new Date(text)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** `docker system df -v` -> images, volumes and disk use. */
function parseDiskVerbose(text) {
  const v = parseJson(text) ?? {}
  const images = (v.Images ?? []).map((i) => ({
    id: String(i.ID ?? ''),
    repository: String(i.Repository ?? '<none>'),
    tag: String(i.Tag ?? '<none>'),
    size: parseSize(i.Size) ?? 0,
    createdAt: toIso(i.CreatedAt),
    containers: Number(i.Containers) || 0,
    dangling: i.Repository === '<none>' && i.Tag === '<none>',
  }))
  const volumes = (v.Volumes ?? []).map((x) => ({
    name: String(x.Name ?? ''),
    driver: String(x.Driver ?? 'local'),
    size: parseSize(x.Size),
    containers: Number(x.Links) || 0,
  }))
  return { images, volumes }
}

/** `docker system df` (one row per type) -> totals. */
function parseDisk(text) {
  const rows = jsonLines(text)
  const size = (type) => parseSize(rows.find((r) => r.Type === type)?.Size) ?? 0
  const reclaimable = rows.reduce((n, r) => n + (parseSize(r.Reclaimable) ?? 0), 0)
  if (!rows.length) return undefined
  return { images: size('Images'), containers: size('Containers'), volumes: size('Local Volumes'), buildCache: size('Build Cache'), reclaimable }
}

function parseNetworks(text, containers) {
  return jsonLines(text).map((n) => ({
    id: String(n.ID ?? ''),
    name: String(n.Name ?? ''),
    driver: String(n.Driver ?? ''),
    scope: String(n.Scope ?? ''),
    containers: containers.filter((c) => c.state === 'running' && c.networks.includes(n.Name)).length,
  }))
}

/** `docker stats --no-stream` -> per-container numbers. */
function parseStats(text) {
  return jsonLines(text).map((s) => {
    const [memory, memoryLimit] = parsePair(s.MemUsage)
    const [netIn, netOut] = parsePair(s.NetIO)
    const [blockIn, blockOut] = parsePair(s.BlockIO)
    return {
      id: String(s.ID ?? '').slice(0, 64),
      cpu: Number.parseFloat(s.CPUPerc) || 0,
      memory,
      memoryLimit,
      netIn,
      netOut,
      blockIn,
      blockOut,
      pids: Number(s.PIDs) || 0,
    }
  })
}

/** `docker logs --timestamps` output of one stream -> lines. */
function parseLogLines(text, stream) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => l.length)
    .map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2}T\S+Z) (.*)$/.exec(l)
      return m ? { at: m[1], stream, text: m[2] } : { stream, text: l }
    })
}

/** stdout and stderr merged in time order (stable for equal times), newest LOG_TAIL kept. */
function mergeLogs(out, err) {
  const all = [...parseLogLines(out, 'stdout'), ...parseLogLines(err, 'stderr')]
  all.sort((a, b) => (a.at && b.at ? (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) : 0))
  return all.slice(-LOG_TAIL)
}

/** `docker inspect` -> what the Info tab shows. Environment values are dropped here. */
function parseInspect(text) {
  const c = (parseJson(text) ?? [])[0]
  if (!c) return undefined
  const ports = []
  for (const [inner, binds] of Object.entries(c.NetworkSettings?.Ports ?? {})) {
    for (const b of binds ?? []) ports.push(`${b.HostIp || '0.0.0.0'}:${b.HostPort} -> ${inner}`)
  }
  const started = c.State?.Running ? c.State?.StartedAt : undefined
  return {
    id: String(c.Id ?? ''),
    command: [c.Path, ...(c.Args ?? [])].filter(Boolean).join(' '),
    createdAt: c.Created,
    startedAt: started,
    restartPolicy: c.HostConfig?.RestartPolicy?.Name || undefined,
    restarts: Number(c.RestartCount) || 0,
    ports,
    mounts: (c.Mounts ?? []).map((m) => ({ type: String(m.Type ?? ''), source: String(m.Name || m.Source || ''), target: String(m.Destination ?? ''), readOnly: m.RW === false })),
    networks: Object.keys(c.NetworkSettings?.Networks ?? {}),
    envNames: (c.Config?.Env ?? []).map((e) => String(e).split('=')[0]).filter(Boolean),
    labels: Object.entries(c.Config?.Labels ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  }
}

function assertId(id) {
  if (typeof id !== 'string' || !CONTAINER_ID.test(id)) throw new Error('Not a container id.')
  return id
}

// ---------------------------------------------------------------- reads

/** A docker client bound to one docker program. deps.runFile is for tests. */
function createDocker(file, deps = {}) {
  let envP
  const run = async (args, opts) => {
    envP ??= programEnv(file, deps)
    return (deps.runFile ?? runFile)(file, args, { ...opts, env: await envP })
  }
  return {
    version: async () => parseVersion(await run(['version', '--format', '{{json .}}'], { timeoutMs: 15_000 })),
    info: async () => parseJson((await run(['info', '--format', '{{json .}}'], { timeoutMs: 20_000 })).stdout),
    containers: async () => parseContainers((await run(['ps', '--all', '--no-trunc', '--format', '{{json .}}'])).stdout),
    diskVerbose: async () => parseDiskVerbose((await run(['system', 'df', '--verbose', '--format', '{{json .}}'], { timeoutMs: 30_000 })).stdout),
    disk: async () => parseDisk((await run(['system', 'df', '--format', '{{json .}}'], { timeoutMs: 30_000 })).stdout),
    networks: async (containers) => parseNetworks((await run(['network', 'ls', '--no-trunc', '--format', '{{json .}}'])).stdout, containers),
    stats: async () => parseStats((await run(['stats', '--no-stream', '--no-trunc', '--format', '{{json .}}'], { timeoutMs: 20_000 })).stdout),
    async logs(id) {
      const res = await run(['logs', '--tail', String(LOG_TAIL), '--timestamps', assertId(id)], { timeoutMs: 15_000 })
      if (res.code !== 0 && !res.stdout && !res.stderr) throw new Error('docker logs did not answer.')
      if (res.code !== 0 && /No such container/i.test(res.stderr)) throw new Error('That container no longer exists.')
      const lines = mergeLogs(res.stdout, res.stderr)
      return { id, lines, truncated: lines.length >= LOG_TAIL || !!res.truncated }
    },
    async inspect(id) {
      const res = await run(['inspect', '--type', 'container', assertId(id)], { timeoutMs: 15_000 })
      const info = parseInspect(res.stdout)
      if (!info) throw new Error(firstLine(res.stderr) || 'That container no longer exists.')
      return info
    },
  }
}

/** "lazydocker version 0.24.1 ..." / "Version: 0.24.1" -> "0.24.1". */
function parseLazydockerVersion(text) {
  return /(?:version[:=\s]+)v?(\d+\.\d+(?:\.\d+)?)/i.exec(String(text ?? ''))?.[1]
}

module.exports = {
  CONTAINER_ID,
  LOG_TAIL,
  findOnPath,
  findDocker,
  findLazydocker,
  freshPath,
  programEnv,
  knownLocations,
  runFile,
  createDocker,
  parseLazydockerVersion,
  _internal: { expandVars, parseRegPath, jsonLines, parseSize, parsePair, parseVersion, parseContainers, parseDiskVerbose, parseDisk, parseNetworks, parseStats, mergeLogs, parseInspect, toIso, assertId },
}
