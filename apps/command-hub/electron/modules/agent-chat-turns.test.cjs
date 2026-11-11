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
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-guard-')))
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
})
