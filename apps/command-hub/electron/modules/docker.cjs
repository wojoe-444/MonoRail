// Docker page backend (Utilities > Docker): a lazydocker-style look at what
// the user's own Docker runs.
//
// Read-only and opt-in. Every method first checks that the user has added the
// Docker connection (hasConnection, which only reads the saved list); until
// then it runs nothing and the page says "not set up". There is no start():
// nothing runs while the page is closed. Nothing is written to disk: no cache,
// no files in the data folder. Logs and stats live in the page's memory only,
// and environment variable values never leave docker-cli.cjs.
//
// The only actions open lazydocker in a terminal (when it is on PATH) and
// lazydocker's project page in the browser. MonoRail never installs either.

const cli = require('./docker-cli.cjs')

function connectionsApi() {
  return require('../connections/index.cjs')
}

async function setUp() {
  return connectionsApi().hasConnection('docker')
}

/** The docker client, or why the page cannot show Docker. */
async function dockerOrBlock(deps = {}) {
  if (!(await (deps.hasConnection ?? setUp)())) return { block: 'not-set-up' }
  const target = await cli.findDockerTarget(deps)
  if (!target) return { block: 'not-installed' }
  return { docker: cli.createDocker(target, deps) }
}

async function requireDocker(deps) {
  const r = await dockerOrBlock(deps)
  if (r.block === 'not-set-up') throw new Error('Set up Docker on the Connections page first.')
  if (r.block === 'not-installed') throw new Error('Docker was not found on this computer.')
  return r.docker
}

async function lazydockerWanted(deps) {
  if (deps.lazydockerWanted) return deps.lazydockerWanted()
  try {
    return (await connectionsApi().getCredentials('docker')).lazydocker
  } catch {
    return false
  }
}

async function getOverview(deps = {}) {
  const readAt = new Date().toISOString()
  const empty = { containers: [], images: [], volumes: [], networks: [], readAt }
  const { docker, block } = await dockerOrBlock(deps)
  if (block) return { ...empty, block }
  const version = await docker.version()
  if (!version.running) return { ...empty, block: 'not-running', blockDetail: version.error, engine: { client: version.client, wsl: docker.wsl } }

  const [info, containers, verbose, disk, lazyBin] = await Promise.all([
    docker.info().catch(() => undefined),
    docker.containers(),
    docker.diskVerbose().catch(() => ({ images: [], volumes: [] })),
    docker.disk().catch(() => undefined),
    (async () => {
      if (!(await lazydockerWanted(deps))) return undefined
      if (docker.wsl) return (await cli.wslLazydockerVersion(docker.target, deps)).found || undefined
      return cli.findLazydocker(deps)
    })(),
  ])
  const networks = await docker.networks(containers).catch(() => [])
  return {
    engine: {
      client: version.client,
      server: version.server,
      platform: version.platform,
      context: version.context,
      wsl: docker.wsl,
      os: info?.OperatingSystem,
      cpus: Number(info?.NCPU) || undefined,
      memory: Number(info?.MemTotal) || undefined,
    },
    // The networks list per container is only used to count network members.
    containers: containers.map(({ networks: _n, ...c }) => c),
    images: verbose.images,
    volumes: verbose.volumes,
    networks,
    disk,
    lazydocker: lazyBin ? {} : undefined,
    readAt,
  }
}

module.exports = {
  id: 'docker',
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['openLazydocker', 'openLazydockerPage'],
  methods: {
    getOverview: () => getOverview(),
    getStats: async () => ({ at: new Date().toISOString(), stats: await (await requireDocker()).stats() }),
    getLogs: async (_ctx, args) => (await requireDocker()).logs(args?.id),
    getContainer: async (_ctx, args) => (await requireDocker()).inspect(args?.id),
    openLazydocker: async () => {
      const { connections } = connectionsApi()
      const conn = await connections().has('docker')
      if (!conn) throw new Error('Set up Docker on the Connections page first.')
      const { lazydocker } = await connectionsApi().getCredentials('docker')
      await require('../connections/connectors/docker.cjs').openLazydocker({ values: { lazydocker: lazydocker ? 'yes' : 'no' } })
    },
    openLazydockerPage: async () => {
      const { shell } = require('electron')
      await shell.openExternal(require('../connections/connectors/docker.cjs').LAZYDOCKER_URL)
    },
  },
  _internal: { getOverview, dockerOrBlock },
}
