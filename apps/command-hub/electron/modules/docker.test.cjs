const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const cli = require('./docker-cli.cjs')
const docker = require('./docker.cjs')
const connector = require('../connections/connectors/docker.cjs')

const { parseSize, parseVersion, parseContainers, parseDiskVerbose, parseDisk, parseStats, mergeLogs, parseInspect, assertId } = cli._internal

describe('docker-cli parsing', () => {
  test('sizes: decimal and binary units', () => {
    assert.equal(parseSize('1.21GB'), 1_210_000_000)
    assert.equal(parseSize('312MiB'), 312 * 1024 ** 2)
    assert.equal(parseSize('0B'), 0)
    assert.equal(parseSize('nope'), undefined)
  })

  test('version: running engine and stopped engine', () => {
    const ok = parseVersion({ stdout: JSON.stringify({ Client: { Version: '27.4.0', Context: 'desktop-linux' }, Server: { Version: '27.4.0', Platform: { Name: 'Docker Desktop 4.37.1 (178610)' } } }), stderr: '' })
    assert.deepEqual(ok, { client: '27.4.0', server: '27.4.0', platform: 'Docker Desktop 4.37.1', context: 'desktop-linux', running: true, error: undefined })
    const down = parseVersion({ stdout: JSON.stringify({ Client: { Version: '27.4.0' }, Server: null }), stderr: 'error during connect: pipe not found\nmore' })
    assert.equal(down.running, false)
    assert.equal(down.error, 'error during connect: pipe not found')
  })

  test('containers: compose labels, health, ports', () => {
    const line = JSON.stringify({ ID: 'a'.repeat(64), Names: 'bakery-api', Image: 'bakery/api:dev', State: 'running', Status: 'Up 3 hours (healthy)', Labels: 'com.docker.compose.project=bakery,com.docker.compose.service=api', Ports: '0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp', Networks: 'bakery_default', CreatedAt: '2026-11-12 01:02:03 +0000 UTC' })
    const [c] = parseContainers(`${line}\nWARNING: not json\n`)
    assert.equal(c.project, 'bakery')
    assert.equal(c.service, 'api')
    assert.equal(c.health, 'healthy')
    assert.deepEqual(c.ports, ['8080->8080/tcp'])
    assert.equal(c.createdAt, '2026-11-12T01:02:03.000Z')
  })

  test('disk use and images', () => {
    const v = parseDiskVerbose(JSON.stringify({ Images: [{ ID: 'sha256:1', Repository: '<none>', Tag: '<none>', Size: '1.19GB', Containers: '0' }], Volumes: [{ Name: 'pg', Driver: 'local', Size: '612MB', Links: '1' }] }))
    assert.equal(v.images[0].dangling, true)
    assert.equal(v.volumes[0].containers, 1)
    const d = parseDisk([{ Type: 'Images', Size: '3.3GB', Reclaimable: '1.2GB (36%)' }, { Type: 'Local Volumes', Size: '3.1GB', Reclaimable: '0B (0%)' }].map((r) => JSON.stringify(r)).join('\n'))
    assert.equal(d.images, 3_300_000_000)
    assert.equal(d.reclaimable, 1_200_000_000)
  })

  test('stats', () => {
    const [s] = parseStats(JSON.stringify({ ID: 'b'.repeat(64), CPUPerc: '14.25%', MemUsage: '312MiB / 7.6GiB', NetIO: '48MB / 21MB', BlockIO: '90MB / 4MB', PIDs: '23' }))
    assert.equal(s.cpu, 14.25)
    assert.equal(s.memory, 312 * 1024 ** 2)
    assert.equal(s.pids, 23)
  })

  test('logs: stdout and stderr merged by time', () => {
    const lines = mergeLogs('2026-11-12T01:00:01.000000000Z one\n2026-11-12T01:00:03.000000000Z three\n', '2026-11-12T01:00:02.000000000Z two\n')
    assert.deepEqual(lines.map((l) => [l.stream, l.text]), [['stdout', 'one'], ['stderr', 'two'], ['stdout', 'three']])
  })

  test('inspect drops environment values', () => {
    const info = parseInspect(JSON.stringify([{ Id: 'c'.repeat(64), Path: 'node', Args: ['server.js'], Config: { Env: ['SMTP_PASSWORD=hunter2', 'NODE_ENV=production'], Labels: {} }, State: { Running: true, StartedAt: 'x' }, NetworkSettings: { Ports: { '8080/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }] }, Networks: { bakery_default: {} } }, Mounts: [] }]))
    assert.deepEqual(info.envNames, ['SMTP_PASSWORD', 'NODE_ENV'])
    assert.ok(!JSON.stringify(info).includes('hunter2'))
    assert.deepEqual(info.ports, ['0.0.0.0:8080 -> 8080/tcp'])
  })

  test('container ids from the page must be hex', () => {
    assert.equal(assertId('abcdef012345'), 'abcdef012345')
    for (const bad of ['--help', 'abc', 'a1f3c9d2e4b5; rm', undefined, 'ABCDEF012345']) assert.throws(() => assertId(bad))
  })

  test('lazydocker version', () => {
    assert.equal(cli.parseLazydockerVersion('Version: 0.24.1\nDate: 2024-11-23'), '0.24.1')
  })
})

describe('Docker page backend is opt-in', () => {
  test('runs nothing until the connection is added', async () => {
    let looked = false
    const deps = {
      hasConnection: async () => false,
      findOnPath: async () => {
        looked = true
        return '/usr/bin/docker'
      },
      runFile: async () => {
        looked = true
        return { code: 0, stdout: '', stderr: '' }
      },
    }
    const r = await docker._internal.getOverview(deps)
    assert.equal(r.block, 'not-set-up')
    assert.equal(looked, false)
  })

  test('docker missing and engine stopped', async () => {
    const missing = await docker._internal.getOverview({ hasConnection: async () => true, findOnPath: async () => undefined })
    assert.equal(missing.block, 'not-installed')
    const stopped = await docker._internal.getOverview({
      hasConnection: async () => true,
      findOnPath: async () => '/usr/bin/docker',
      runFile: async () => ({ code: 1, stdout: JSON.stringify({ Client: { Version: '27.4.0' } }), stderr: 'Cannot connect to the Docker daemon' }),
    })
    assert.equal(stopped.block, 'not-running')
    assert.equal(stopped.blockDetail, 'Cannot connect to the Docker daemon')
  })

  test('no write commands in the docker CLI wrapper', () => {
    const src = fs.readFileSync(path.join(__dirname, 'docker-cli.cjs'), 'utf8')
    for (const verb of ["'run'", "'start'", "'stop'", "'restart'", "'rm'", "'rmi'", "'prune'", "'kill'", "'exec'", "'pull'", "'create'"]) assert.ok(!src.includes(verb), `docker-cli.cjs must not use ${verb}`)
    assert.ok(!/writeFile|mkdir|appendFile/.test(fs.readFileSync(path.join(__dirname, 'docker.cjs'), 'utf8')))
  })
})

describe('Docker connector', () => {
  const { summarize } = connector._internal
  test('not installed is "unavailable" and optional', () => {
    const s = summarize({})
    assert.equal(s.state, 'unavailable')
    assert.match(s.hint, /optional/)
  })
  test('stopped engine offers Start Docker Desktop only when installed', () => {
    const v = { client: '27.4.0', running: false, error: 'pipe not found' }
    assert.deepEqual(summarize({ docker: 'd', version: v, desktopInstalled: true }).actions, ['start-desktop'])
    assert.deepEqual(summarize({ docker: 'd', version: v, desktopInstalled: false }).actions, [])
  })
  test('running engine with lazydocker', () => {
    const s = summarize({ docker: 'd', version: { client: '27.4.0', server: '27.4.0', platform: 'Docker Desktop 4.37.1', running: true }, containers: [{ state: 'running' }, { state: 'exited' }], lazydocker: { found: true, version: '0.24.1' } })
    assert.equal(s.state, 'ok')
    assert.deepEqual(s.actions, ['open-lazydocker'])
    assert.match(s.summary, /lazydocker 0\.24\.1 found\./)
  })
  test('lazydocker can be turned off', async () => {
    let lookedFor = []
    const deps = { findOnPath: async (name) => (lookedFor.push(name), undefined) }
    await connector.status({ values: { lazydocker: 'no' } }, deps)
    assert.deepEqual(lookedFor, ['docker'])
  })
})
