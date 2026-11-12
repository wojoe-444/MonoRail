// What the Docker backend (electron/modules/docker.cjs) hands the page.
// Everything is read on demand from the docker CLI; nothing is stored.

/** Why the page cannot show Docker yet. Nothing was run to find out 'not-set-up'. */
export type DockerBlock = 'not-set-up' | 'not-installed' | 'not-running'

export interface DockerEngine {
  client: string
  server?: string
  /** "Docker Desktop 4.37.1" when the engine says so. */
  platform?: string
  context?: string
  os?: string
  cpus?: number
  memory?: number
}

export type ContainerState = 'running' | 'paused' | 'restarting' | 'exited' | 'created' | 'dead' | 'removing'

export interface DockerContainer {
  id: string
  name: string
  image: string
  state: ContainerState
  /** Docker's own words, e.g. "Up 3 hours (healthy)". */
  status: string
  health?: 'healthy' | 'unhealthy' | 'starting'
  /** The compose project, when it was started by docker compose. */
  project?: string
  service?: string
  ports: string[]
  createdAt?: string
}

export interface DockerImage {
  id: string
  repository: string
  tag: string
  size: number
  createdAt?: string
  /** Containers (any state) made from it. */
  containers: number
  dangling: boolean
}

export interface DockerVolume {
  name: string
  driver: string
  size?: number
  containers: number
}

export interface DockerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  containers: number
}

export interface DockerDiskUsage {
  images: number
  containers: number
  volumes: number
  buildCache: number
  reclaimable: number
}

export interface DockerOverview {
  block?: DockerBlock
  /** One line under the block, e.g. the CLI's error. */
  blockDetail?: string
  engine?: DockerEngine
  containers: DockerContainer[]
  images: DockerImage[]
  volumes: DockerVolume[]
  networks: DockerNetwork[]
  disk?: DockerDiskUsage
  /** lazydocker's version when it was found on PATH. */
  lazydocker?: { version?: string }
  readAt: string
}

export interface ContainerStats {
  id: string
  cpu: number
  memory: number
  memoryLimit: number
  netIn: number
  netOut: number
  blockIn: number
  blockOut: number
  pids: number
}

export interface StatsSample {
  at: string
  stats: ContainerStats[]
}

export interface LogLine {
  at?: string
  stream: 'stdout' | 'stderr'
  text: string
}

export interface ContainerLogs {
  id: string
  lines: LogLine[]
  /** More lines exist than were read. */
  truncated: boolean
}

export interface ContainerInfo {
  id: string
  command: string
  createdAt?: string
  startedAt?: string
  restartPolicy?: string
  restarts: number
  ports: string[]
  mounts: { type: string; source: string; target: string; readOnly: boolean }[]
  networks: string[]
  /** Variable names only: values can be secrets and never leave the backend. */
  envNames: string[]
  labels: { key: string; value: string }[]
}
