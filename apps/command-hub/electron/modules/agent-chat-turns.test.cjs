// Tests for Agent Chat turns and options, with stand-in workers (no SDK, no network).
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const test = require('node:test')

const turns = require('./agent-chat-turns.cjs')
const opts = require('./agent-chat-options.cjs')

const job = { prompt: 'Hello', mode: 'ask', model: 'default', effort: 'default' }

function fakeWorker(script) {
  return () =>
    spawn(process.execPath, ['-e', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
}

async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = fn()
    if (v) return v
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('timed out waiting')
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test('the job reaches the worker on stdin, not argv, and events stream back', async () => {
  const script = `
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      const j=JSON.parse(d);
      const out=(e)=>process.stdout.write(JSON.stringify(e)+'\\n');
      out({t:'init',sessionId:'s1',model:'m'});
      out({t:'argv',argv:process.argv.slice(1)});
      out({t:'delta',text:j.job.prompt});
      out({t:'result',isError:false,costUsd:0.01});
    })`
  const { turnId } = turns.startTurn({ chatKey: 'new:a', worker: { job }, meta: { sdk: 'claude', model: 'default', mode: 'ask' }, spawnWorker: fakeWorker(script) })
  const r = await waitFor(() => {
    const p = turns.pollTurn(turnId)
    return p.status !== 'running' && p
  })
  assert.equal(r.status, 'done')
  assert.equal(r.sessionId, 's1')
  assert.equal(r.events.find((e) => e.t === 'delta').text, 'Hello')
  assert.ok(!JSON.stringify(r.events.find((e) => e.t === 'argv').argv).includes('Hello'))
  // Polling from an offset returns only newer events.
  assert.equal(turns.pollTurn(turnId, r.next).events.length, 0)
})

test('a second message while a turn runs is refused with the reason', async () => {
  const script = `process.stdin.resume(); process.stdout.write(JSON.stringify({t:'init',sessionId:'busy1'})+'\\n'); setTimeout(()=>{}, 60000)`
  const { turnId } = turns.startTurn({ chatKey: 'claude:busy1', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) })
  assert.throws(
    () => turns.startTurn({ chatKey: 'claude:busy1', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) }),
    /still running/,
  )
  turns.stopTurn(turnId)
  assert.equal(turns.pollTurn(turnId).status, 'stopped')
  // Free again once stopped.
  const again = turns.startTurn({ chatKey: 'claude:busy1', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) })
  turns.stopTurn(again.turnId)
})

test('a new chat is also busy under its session id once it has one', async () => {
  const script = `process.stdin.resume(); process.stdout.write(JSON.stringify({t:'init',sessionId:'fresh'})+'\\n'); setTimeout(()=>{}, 60000)`
  const { turnId } = turns.startTurn({ chatKey: 'new:b', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) })
  await waitFor(() => turns.pollTurn(turnId).sessionId)
  assert.throws(() => turns.startTurn({ chatKey: 'claude:fresh', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) }), /still running/)
  turns.stopTurn(turnId)
})

test('Stop ends the whole process tree', { skip: process.platform === 'win32' }, async () => {
  // The worker starts a grandchild (like the SDK starting Claude Code) and reports its pid.
  const script = `
    process.stdin.resume();
    const c=require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});
    process.stdout.write(JSON.stringify({t:'child',pid:c.pid})+'\\n');
    setTimeout(()=>{},60000)`
  const { turnId } = turns.startTurn({ chatKey: 'new:tree', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) })
  const pid = await waitFor(() => turns.pollTurn(turnId).events.find((e) => e.t === 'child')?.pid)
  assert.ok(alive(pid))
  turns.stopTurn(turnId)
  await waitFor(() => !alive(pid))
})

test('a turn past its time limit is stopped and marked timed out', async () => {
  const script = `process.stdin.resume(); setTimeout(()=>{}, 60000)`
  const { turnId } = turns.startTurn({ chatKey: 'new:slow', worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script), timeoutMs: 200 })
  const r = await waitFor(() => {
    const p = turns.pollTurn(turnId)
    return p.status !== 'running' && p
  })
  assert.equal(r.status, 'timed_out')
  assert.match(r.events.at(-1).message, /timed out/)
})

test('onFinish events (the turn cost) arrive before the status flips', async () => {
  const script = `process.stdin.on('data',()=>{}).on('end',()=>{process.stdout.write(JSON.stringify({t:'init',sessionId:'c1'})+'\\n'+JSON.stringify({t:'result',isError:false,costUsd:0.5})+'\\n')})`
  const { turnId } = turns.startTurn({
    chatKey: 'new:cost',
    worker: { job },
    meta: { sdk: 'claude' },
    spawnWorker: fakeWorker(script),
    onFinish: (t) => [{ t: 'cost', turnUsd: t.result.costUsd }],
  })
  const r = await waitFor(() => {
    const p = turns.pollTurn(turnId)
    return p.status !== 'running' && p
  })
  assert.equal(r.events.find((e) => e.t === 'cost').turnUsd, 0.5)
})

// ---------------------------------------------------------------------------
// Options

test('Ask allows read tools only, no MCP servers, and is explicit about its mode', () => {
  const o = opts.buildClaudeOptions({ job, cwd: '/r', executable: '/bin/claude' })
  assert.deepEqual(o.tools, ['Read', 'Grep', 'Glob'])
  assert.deepEqual(o.mcpServers, {})
  assert.equal(o.strictMcpConfig, true)
  assert.equal(o.permissionMode, 'dontAsk')
  assert.equal(o.settings.permissions.disableBypassPermissionsMode, 'disable')
  assert.equal(o.model, undefined)
  assert.equal(o.effort, undefined) // Default sends no effort
})

test('Agent uses the normal rules, denies prompts through canUseTool, and passes model and effort', () => {
  const canUseTool = async () => ({ behavior: 'deny', message: 'no' })
  const o = opts.buildClaudeOptions({ job: { ...job, mode: 'agent', model: 'claude-sonnet-5-5', effort: 'high' }, cwd: '/r', resume: 's', executable: '/c', canUseTool })
  assert.equal(o.permissionMode, 'default')
  assert.equal(o.canUseTool, canUseTool)
  assert.equal(o.tools, undefined)
  assert.equal(o.model, 'claude-sonnet-5-5')
  assert.equal(o.effort, 'high')
  assert.equal(o.resume, 's')
})

test('options that bypass permissions are refused', () => {
  assert.throws(() => opts.assertNoBypass({ permissionMode: 'bypassPermissions' }), /bypass/)
  assert.throws(() => opts.assertNoBypass({ allowDangerouslySkipPermissions: true }), /dangerously/i)
  assert.throws(() => opts.assertNoBypass({ extraArgs: { 'dangerously-skip-permissions': null, x: 'y' } }), /bypass|dangerously/i)
  assert.throws(() => opts.assertNoBypass({ settings: { permissions: { defaultMode: 'bypassPermissions' } } }), /bypass/)
  // A folder may be named anything.
  assert.doesNotThrow(() => opts.assertNoBypass({ cwd: '/home/me/bypass-tool', permissionMode: 'default' }))
})

test('jobs are validated', () => {
  assert.throws(() => opts.validateJob({ ...job, prompt: '  ' }), /Type a message/)
  assert.throws(() => opts.validateJob({ ...job, mode: 'yolo' }), /mode/)
  assert.throws(() => opts.validateJob({ ...job, model: 'gpt' }), /model/)
  assert.throws(() => opts.validateJob({ ...job, effort: 'ultra' }), /effort/)
})

// ---------------------------------------------------------------------------
// pi

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

test('pi tools: Ask reads only, Agent adds edit and write, never a shell', () => {
  assert.deepEqual(opts.piTools('ask'), ['read', 'grep', 'find', 'ls'])
  assert.deepEqual(opts.piTools('agent'), ['read', 'grep', 'find', 'ls', 'edit', 'write'])
  for (const m of ['ask', 'agent']) assert.ok(!opts.piTools(m).some((t) => /bash/.test(t)))
})

test('effort maps to the pi thinking level; Default sends none', () => {
  assert.equal(opts.piThinkingLevel('default'), undefined)
  assert.equal(opts.piThinkingLevel('high'), 'high')
  assert.equal(opts.piThinkingLevel('max'), 'xhigh')
})

test('pi jobs are checked against the pi model list', () => {
  assert.doesNotThrow(() => opts.validateJob({ ...job, sdk: 'pi', model: 'anthropic/claude-sonnet-4-6' }))
  assert.throws(() => opts.validateJob({ ...job, sdk: 'pi', model: 'claude-sonnet-5-5' }), /model/)
  assert.throws(() => opts.validateJob({ ...job, sdk: 'other' }), /SDK/)
})

test('pi paths must resolve inside the repo, links included', async () => {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-guard-')))
  const repo = path.join(base, 'repo')
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true })
  fs.writeFileSync(path.join(base, 'secret.txt'), 'x')
  fs.symlinkSync(base, path.join(repo, 'escape'), 'junction')
  const ok = (p) => opts.piPathAllowed(repo, repo, p)
  assert.equal(await ok(undefined), true) // default: the repo itself
  assert.equal(await ok('src'), true)
  assert.equal(await ok('src/new/file.ts'), true) // a new file inside
  assert.equal(await ok('../secret.txt'), false)
  assert.equal(await ok(path.join(base, 'secret.txt')), false)
  assert.equal(await ok('escape/secret.txt'), false) // through a link
  assert.equal(await ok('escape/new.txt'), false)
  assert.equal(await ok('~/x'), false)
})

test('the pi SDK is found behind the pi command', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-find-'))
  const pkg = path.join(base, 'lib', 'node_modules', '@mariozechner', 'pi-coding-agent')
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@mariozechner/pi-coding-agent', version: '9.9.9' }))
  fs.writeFileSync(path.join(pkg, 'dist', 'cli.js'), '')
  fs.mkdirSync(path.join(base, 'bin'))
  const bin = path.join(base, 'bin', process.platform === 'win32' ? 'pi.cmd' : 'pi')
  if (process.platform === 'win32') {
    fs.mkdirSync(path.join(base, 'bin', 'node_modules', '@mariozechner'), { recursive: true })
    fs.cpSync(pkg, path.join(base, 'bin', 'node_modules', '@mariozechner', 'pi-coding-agent'), { recursive: true })
    fs.writeFileSync(bin, '')
  } else fs.symlinkSync(path.join(pkg, 'dist', 'cli.js'), bin)
  const found = opts.findPiSdk({ PATH: path.join(base, 'bin') }, base)
  assert.equal(found?.version, '9.9.9')
  assert.equal(opts.findPiSdk({ PATH: path.join(base, 'nowhere') }, base), undefined)
  fs.rmSync(base, { recursive: true, force: true })
})

test('the renamed pi package is found through a command shim', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-shim-'))
  const name = process.platform === 'win32' ? 'pi.cmd' : 'pi'
  const makePkg = (dir, pkgName, version) => {
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: pkgName, version }))
  }
  // npm's .cmd shim: the package beside the shim, named relative to %dp0%.
  const npmDir = path.join(base, 'npm')
  makePkg(path.join(npmDir, 'node_modules', '@earendil-works', 'pi-coding-agent'), '@earendil-works/pi-coding-agent', '1.5.2')
  fs.writeFileSync(
    path.join(npmDir, name),
    '@ECHO off\r\nSETLOCAL\r\n"%_prog%"  "%dp0%\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\bundle\\cli.js" %*\r\n',
  )
  const found = opts.findPiSdk({ PATH: npmDir }, base)
  assert.equal(found?.name, '@earendil-works/pi-coding-agent')
  assert.equal(found?.version, '1.5.2')

  // A shim (pnpm style) that names the package by an absolute path somewhere else.
  const store = path.join(base, 'store', 'node_modules', '@earendil-works', 'pi-coding-agent')
  makePkg(store, '@earendil-works/pi-coding-agent', '2.0.0')
  const shimDir = path.join(base, 'shims')
  fs.mkdirSync(shimDir)
  fs.writeFileSync(path.join(shimDir, name), `#!/bin/sh\nexec node "${path.join(store, 'dist', 'bundle', 'cli.js')}" "$@"\n`)
  assert.equal(opts.findPiSdk({ PATH: shimDir }, base)?.version, '2.0.0')

  // Something else called pi is not taken for it.
  const other = path.join(base, 'other')
  makePkg(path.join(other, 'node_modules', '@someone', 'pi-coding-agent'), '@someone/pi-coding-agent', '0.0.1')
  fs.writeFileSync(path.join(other, name), '"%dp0%\\node_modules\\@someone\\pi-coding-agent\\cli.js"')
  assert.equal(opts.findPiSdk({ PATH: other }, base), undefined)
  fs.rmSync(base, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Changes panel

test('the changes panel reads git status and the diff against HEAD', async () => {
  const { execFileSync } = require('node:child_process')
  const changes = require('./agent-chat-changes.cjs')
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-changes-'))
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' })
  g('init', '-q', '-b', 'main')
  g('-c', 'user.email=demo@example.com', '-c', 'user.name=Demo', 'commit', '-q', '--allow-empty', '-m', 'init')
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n')
  g('add', 'a.txt')
  g('-c', 'user.email=demo@example.com', '-c', 'user.name=Demo', 'commit', '-q', '-m', 'a')
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n')
  fs.writeFileSync(path.join(repo, 'new file.txt'), 'x\n')
  const r = await changes.changes(repo)
  assert.match(r.branch, /^main/)
  assert.deepEqual(r.files.map((f) => [f.code, f.path]).sort(), [[' M', 'a.txt'], ['??', 'new file.txt']])
  assert.match(r.diff, /-one\n\+two/)
  assert.equal(r.diffCut, false)
})

// ---------------------------------------------------------------------------
// Coordinator

test('the coordinator may only delegate and run workflows, with no MCP servers', () => {
  const o = opts.buildClaudeOptions({ job: opts.validateJob({ ...job, mode: 'agent', coordinator: true }), cwd: '/c', executable: '/c' })
  assert.equal(o.agent, 'coordinator')
  assert.deepEqual(o.tools, ['Agent', 'Workflow'])
  assert.deepEqual(o.allowedTools, ['Agent', 'Workflow'])
  assert.deepEqual(o.mcpServers, {})
  assert.equal(o.strictMcpConfig, true)
  assert.equal(o.permissionMode, 'dontAsk')
  assert.throws(() => opts.validateJob({ ...job, sdk: 'pi', coordinator: true }), /Claude/)
})

test('the coordinator subagent is found in the Claude config folder', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-'))
  assert.equal(opts.findCoordinator({}, home), undefined)
  fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'agents', 'coordinator.md'), '---\nname: coordinator\n---\n')
  assert.ok(opts.findCoordinator({}, home))
})

test('reasoning is requested only when asked for', () => {
  assert.equal(opts.buildClaudeOptions({ job: opts.validateJob({ ...job }), cwd: '/r', executable: '/c' }).thinking, undefined)
  assert.deepEqual(opts.buildClaudeOptions({ job: opts.validateJob({ ...job, reasoning: true }), cwd: '/r', executable: '/c' }).thinking, { type: 'adaptive', display: 'summarized' })
})

test('the coordinator gets MonoRail chat tools only when its worker has them', () => {
  const server = { type: 'sdk', name: 'monorail', instance: { note: 'bypass words inside the server object are not options' } }
  const o = opts.buildClaudeOptions({ job: opts.validateJob({ ...job, coordinator: true }), cwd: '/c', executable: '/c', coordinatorServer: server })
  assert.deepEqual(o.tools, ['Agent', 'Workflow'])
  assert.deepEqual(o.allowedTools, ['Agent', 'Workflow', ...opts.COORDINATOR_MCP_TOOLS])
  assert.equal(o.mcpServers.monorail, server)
  assert.equal(o.strictMcpConfig, true)
  assert.equal(o.permissionMode, 'dontAsk')
  // Only the coordinator: a normal chat never gets them.
  const plain = opts.buildClaudeOptions({ job: opts.validateJob({ ...job }), cwd: '/c', executable: '/c', coordinatorServer: server })
  assert.deepEqual(plain.mcpServers, {})
  // Bypass is still refused anywhere else in the options.
  assert.throws(() => opts.assertNoBypass({ mcpServers: { monorail: { type: 'sdk', instance: {}, mode: 'bypassPermissions' } } }), /bypass/)
  // The names match the tools the coordinator module serves.
  const { CHAT_TOOL_SPECS } = require('./agent-chat-coordinator.cjs')
  assert.deepEqual(opts.COORDINATOR_MCP_TOOLS, Object.keys(CHAT_TOOL_SPECS).map((n) => `mcp__monorail__${n}`))
})

test('a coordinator.md tools list without the chat tools is flagged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-tools-'))
  const f = path.join(dir, 'coordinator.md')
  fs.writeFileSync(f, '---\nname: coordinator\n---\nbody tools: x\n')
  assert.equal(opts.coordinatorToolsNote(f), undefined)
  fs.writeFileSync(f, '---\nname: coordinator\ntools: Agent, Workflow\n---\n')
  assert.match(opts.coordinatorToolsNote(f), /cannot reach your chats/)
  fs.writeFileSync(f, '---\nname: coordinator\ntools:\n  - Agent\n  - mcp__monorail__send_to_chat\n---\n')
  assert.equal(opts.coordinatorToolsNote(f), undefined)
  assert.equal(opts.coordinatorToolsNote(path.join(dir, 'missing.md')), undefined)
})

// ---------------------------------------------------------------------------
// One turn per chat across processes

const locks = require('./agent-chat-locks.cjs')

test('a chat lock is exclusive, released once, and a dead holder is taken over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locks-'))
  const release = locks.acquire(dir, 'claude:s1')
  assert.equal(locks.isLocked(dir, 'claude:s1'), true)
  assert.throws(() => locks.acquire(dir, 'claude:s1'), (e) => e.code === 'CHAT_BUSY')
  // Another chat is free.
  locks.acquire(dir, 'claude:s2')()
  release()
  release()
  assert.equal(locks.isLocked(dir, 'claude:s1'), false)
  // A lock left by a process that is gone does not block.
  fs.writeFileSync(locks._lockFile(dir, 'claude:s3'), JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() }))
  assert.equal(locks.isLocked(dir, 'claude:s3'), false)
  locks.acquire(dir, 'claude:s3')()
  // So does one older than a turn may run.
  fs.writeFileSync(locks._lockFile(dir, 'claude:s4'), JSON.stringify({ pid: process.pid, at: Date.now() - locks.MAX_AGE_MS - 1 }))
  locks.acquire(dir, 'claude:s4')()
  // The file holds numbers only.
  const r = locks.acquire(dir, 'claude:secret-session')
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(locks._lockFile(dir, 'claude:secret-session'), 'utf8'))).sort(), ['at', 'pid'])
  r()
})

test('a turn holds the chat lock (and its new session id) until it ends', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locks-turn-'))
  const lock = (key) => locks.acquire(dir, key)
  // Another process already runs a turn in this chat.
  const other = locks.acquire(dir, 'claude:held')
  assert.throws(() => turns.startTurn({ chatKey: 'claude:held', lock, worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker('') }), /still running/)
  other()

  const script = `process.stdin.resume(); process.stdout.write(JSON.stringify({t:'init',sessionId:'locked-new'})+'\\n'); setTimeout(()=>{}, 60000)`
  const { turnId } = turns.startTurn({ chatKey: 'new:locked', lock, worker: { job }, meta: { sdk: 'claude' }, spawnWorker: fakeWorker(script) })
  await waitFor(() => turns.pollTurn(turnId).sessionId)
  assert.equal(locks.isLocked(dir, 'new:locked'), true)
  assert.equal(locks.isLocked(dir, 'claude:locked-new'), true)
  turns.stopTurn(turnId)
  assert.equal(locks.isLocked(dir, 'new:locked'), false)
  assert.equal(locks.isLocked(dir, 'claude:locked-new'), false)
})
