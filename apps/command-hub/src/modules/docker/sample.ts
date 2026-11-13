// Fictional Docker data for the browser dev server (no backend there).

import type { ContainerInfo, ContainerLogs, DockerOverview, StatsSample } from './types'

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const GB = 1024 ** 3
const MB = 1024 ** 2

export const sampleOverview: DockerOverview = {
  engine: { client: '27.4.0', server: '27.4.0', platform: 'Docker Desktop 4.37.1', context: 'desktop-linux', os: 'Docker Desktop (WSL 2)', cpus: 8, memory: 7.6 * GB },
  containers: [
    { id: 'a1f3c9d2e4b5', name: 'bakery-api', image: 'bakery/api:dev', state: 'running', status: 'Up 3 hours (healthy)', health: 'healthy', project: 'bakery', service: 'api', ports: ['8080->8080/tcp'], createdAt: ago(190) },
    { id: 'b2e4d6f8a0c1', name: 'bakery-db', image: 'postgres:17', state: 'running', status: 'Up 3 hours', project: 'bakery', service: 'db', ports: ['5432->5432/tcp'], createdAt: ago(190) },
    { id: 'c3d5e7f9b1a2', name: 'bakery-cache', image: 'redis:7-alpine', state: 'running', status: 'Up 3 hours', project: 'bakery', service: 'cache', ports: [], createdAt: ago(190) },
    { id: 'd4c6b8a0e2f3', name: 'bakery-worker', image: 'bakery/api:dev', state: 'restarting', status: 'Restarting (1) 12 seconds ago', project: 'bakery', service: 'worker', ports: [], createdAt: ago(190) },
    { id: 'e5b7a9c1d3f4', name: 'bakery-migrate', image: 'bakery/api:dev', state: 'exited', status: 'Exited (0) 3 hours ago', project: 'bakery', service: 'migrate', ports: [], createdAt: ago(191) },
    { id: 'f6a8b0d2c4e5', name: 'minio', image: 'minio/minio:latest', state: 'running', status: 'Up 2 days', ports: ['9000->9000/tcp', '9001->9001/tcp'], createdAt: ago(3000) },
    { id: 'a7b9c1e3d5f6', name: 'docs-preview', image: 'nginx:1.27-alpine', state: 'exited', status: 'Exited (137) 5 days ago', ports: [], createdAt: ago(8000) },
  ],
  images: [
    { id: 'sha256:1a2b3c4d5e6f', repository: 'bakery/api', tag: 'dev', size: 1.21 * GB, createdAt: ago(200), containers: 3, dangling: false },
    { id: 'sha256:2b3c4d5e6f7a', repository: 'postgres', tag: '17', size: 438 * MB, createdAt: ago(20000), containers: 1, dangling: false },
    { id: 'sha256:3c4d5e6f7a8b', repository: 'minio/minio', tag: 'latest', size: 175 * MB, createdAt: ago(30000), containers: 1, dangling: false },
    { id: 'sha256:4d5e6f7a8b9c', repository: 'redis', tag: '7-alpine', size: 41 * MB, createdAt: ago(40000), containers: 1, dangling: false },
    { id: 'sha256:5e6f7a8b9c0d', repository: 'nginx', tag: '1.27-alpine', size: 48 * MB, createdAt: ago(50000), containers: 1, dangling: false },
    { id: 'sha256:6f7a8b9c0d1e', repository: '<none>', tag: '<none>', size: 1.19 * GB, createdAt: ago(1500), containers: 0, dangling: true },
    { id: 'sha256:7a8b9c0d1e2f', repository: 'node', tag: '22-slim', size: 236 * MB, createdAt: ago(60000), containers: 0, dangling: false },
  ],
  volumes: [
    { name: 'bakery_pgdata', driver: 'local', size: 612 * MB, containers: 1 },
    { name: 'bakery_redis', driver: 'local', size: 3 * MB, containers: 1 },
    { name: 'minio-data', driver: 'local', size: 2.4 * GB, containers: 1 },
    { name: '4f1e0c9b7a…', driver: 'local', size: 88 * MB, containers: 0 },
  ],
  networks: [
    { id: 'n1', name: 'bakery_default', driver: 'bridge', scope: 'local', containers: 4 },
    { id: 'n2', name: 'bridge', driver: 'bridge', scope: 'local', containers: 1 },
    { id: 'n3', name: 'host', driver: 'host', scope: 'local', containers: 0 },
  ],
  disk: { images: 3.33 * GB, containers: 64 * MB, volumes: 3.1 * GB, buildCache: 1.8 * GB, reclaimable: 3.2 * GB },
  lazydocker: { version: '0.24.1' },
  readAt: ago(0),
}

function wave(i: number, base: number, amp: number, period: number) {
  return Math.max(0, base + amp * Math.sin(i / period) + amp * 0.4 * Math.sin(i / 2.3))
}

/** Two minutes of samples, one every 5 seconds. */
export const sampleStats: StatsSample[] = Array.from({ length: 24 }, (_, i) => ({
  at: new Date(now - (23 - i) * 5000).toISOString(),
  stats: [
    { id: 'a1f3c9d2e4b5', cpu: wave(i, 14, 9, 3), memory: 312 * MB + wave(i, 0, 18, 4) * MB, memoryLimit: 7.6 * GB, netIn: 48 * MB, netOut: 21 * MB, blockIn: 90 * MB, blockOut: 4 * MB, pids: 23 },
    { id: 'b2e4d6f8a0c1', cpu: wave(i, 4, 3, 5), memory: 186 * MB, memoryLimit: 7.6 * GB, netIn: 12 * MB, netOut: 30 * MB, blockIn: 210 * MB, blockOut: 380 * MB, pids: 11 },
    { id: 'c3d5e7f9b1a2', cpu: wave(i, 0.8, 0.5, 2), memory: 9 * MB, memoryLimit: 7.6 * GB, netIn: 2 * MB, netOut: 3 * MB, blockIn: 1 * MB, blockOut: 0, pids: 6 },
    { id: 'f6a8b0d2c4e5', cpu: wave(i, 1.5, 1, 6), memory: 141 * MB, memoryLimit: 7.6 * GB, netIn: 640 * MB, netOut: 92 * MB, blockIn: 1.1 * GB, blockOut: 2.2 * GB, pids: 17 },
  ],
}))

const LOG_LINES = [
  ['stdout', 'Starting bakery-api 0.9.2 (node 22.11.0)'],
  ['stdout', 'Connected to postgres at db:5432 (pool 10)'],
  ['stdout', 'Connected to redis at cache:6379'],
  ['stdout', 'Listening on http://0.0.0.0:8080'],
  ['stdout', 'GET /health 200 2ms'],
  ['stdout', 'GET /api/loaves?page=1 200 41ms'],
  ['stdout', 'POST /api/orders 201 88ms'],
  ['stderr', 'WARN slow query (412ms): SELECT * FROM orders WHERE status = $1'],
  ['stdout', 'GET /api/orders/1042 200 12ms'],
  ['stdout', 'GET /health 200 1ms'],
  ['stdout', 'PATCH /api/orders/1042 200 35ms'],
  ['stdout', 'GET /api/loaves?page=2 200 29ms'],
  ['stderr', 'ERROR job sendReceipt failed: SMTP connection refused (attempt 1 of 5)'],
  ['stdout', 'GET /health 200 1ms'],
  ['stdout', 'GET /api/bakers 200 17ms'],
  ['stdout', 'POST /api/orders 201 74ms'],
  ['stdout', 'GET /health 200 2ms'],
] as const

export const sampleLogs: ContainerLogs = {
  id: 'a1f3c9d2e4b5',
  truncated: true,
  lines: LOG_LINES.map(([stream, text], i) => ({ stream, text, at: new Date(now - (LOG_LINES.length - i) * 37_000).toISOString() })),
}

export const sampleInfo: ContainerInfo = {
  id: 'a1f3c9d2e4b5',
  command: 'node dist/server.js',
  createdAt: ago(190),
  startedAt: ago(188),
  restartPolicy: 'unless-stopped',
  restarts: 0,
  ports: ['0.0.0.0:8080 -> 8080/tcp'],
  mounts: [
    { type: 'bind', source: '~/Repos/bakery/src', target: '/app/src', readOnly: false },
    { type: 'volume', source: 'bakery_uploads', target: '/app/uploads', readOnly: false },
  ],
  networks: ['bakery_default'],
  envNames: ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'SMTP_PASSWORD'],
  labels: [
    { key: 'com.docker.compose.project', value: 'bakery' },
    { key: 'com.docker.compose.service', value: 'api' },
  ],
}
