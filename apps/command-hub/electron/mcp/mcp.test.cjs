// Tests for the MCP server (electron/mcp). Run with `npm test`.
// Builds a fictional MonoRail data folder in the OS temp folder (needs `git`
// on PATH), then talks to the server in process and over real stdio.

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync, spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createMcpServer, checkArgs } = require('./protocol.cjs')
const { createServer } = require('./server.cjs')
const issues = require('../apps/github-plus/issues.cjs')
const { createLocalStore } = require('../apps/jira-plus/local.cjs')
const cache = require('../cache/index.cjs')
const { createConnections } = require('../connections/index.cjs')

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p))

let root
let repo

async function call(server, name, args, id = 1) {
  const res = await server.handle({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
  assert.ok(res.result, JSON.stringify(res))
  const text = res.result.content[0].text
  return { isError: !!res.result.isError, text, value: res.result.isError ? undefined : JSON.parse(text) }
}

before(async () => {
  root = tmp('monorail-mcp-')

  // Claude Stats summary, as written after a report build.
  const statsDir = path.join(root, 'modules', 'claude-stats')
  fs.mkdirSync(statsDir, { recursive: true })
  await cache.writeSummary({ dataDir: statsDir }, 'claude-stats.summary', {
    version: 1,
    days: [
      { date: '2026-11-09', cost: 1.5 },
      { date: '2026-11-10', cost: 2.25 },
    ],
    total: 3.75,
    topModels: [{ source: 'claude-code', model: 'claude-example', cost: 3.75 }],
  })

  // A GitHub+ repo with local issues.
  repo = path.join(tmp('monorail-mcp-repo-'), 'demo-repo')
  fs.mkdirSync(repo)
  const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 'tester@example.invalid')
  g('config', 'user.name', 'Tester')
  g('config', 'commit.gpgsign', 'false')
  fs.writeFileSync(path.join(repo, 'README.md'), '# Demo\n')
  g('add', '.')
  g('commit', '-qm', 'initial')
  await issues.createIssue(repo, { title: 'First bug', body: 'It breaks.' })
  await issues.createIssue(repo, { title: 'Second idea', body: 'Maybe later.' })
  await issues.addComment(repo, 1, { body: 'Seen it too.' })
  await issues.updateIssue(repo, 2, { state: 'closed' })
  const ghDir = path.join(root, 'apps', 'github-plus')
  fs.mkdirSync(ghDir, { recursive: true })
  fs.writeFileSync(path.join(ghDir, 'recents.json'), JSON.stringify([repo, path.join(root, 'gone')]))

  // A Jira+ local project.
  const jira = createLocalStore(path.join(root, 'apps', 'jira-plus', 'local-repo'))
  await jira.createProject({ key: 'ME', name: 'Me' })
  await jira.createIssue({ projectKey: 'ME', summary: 'Write docs', description: 'All of them.' })
  await jira.createIssue({ projectKey: 'ME', summary: 'Ship it', status: 'Done' })
  await jira.addComment({ key: 'ME-1', body: 'Started.' })

  // Connections: a check writes the summary file (no secrets).
  const connDir = path.join(root, 'modules', 'connections')
  fs.mkdirSync(connDir, { recursive: true })
  const enc = (s) => `enc:${s}`
  const conns = createConnections({
    dataDir: connDir,
    cipher: { isAvailable: () => true, encrypt: enc, decrypt: (s) => s.slice(4) },
    deps: { fetch: async () => ({ ok: true, status: 200, json: async () => ({ displayName: 'Test User', emailAddress: 'user@example.invalid' }) }) },
  })
  await conns.save({ kind: 'atlassian', values: { siteUrl: 'demo-team.atlassian.net', tokenSource: 'direct', email: 'user@example.invalid' }, secrets: { token: 'SECRET-TOKEN-123' } })
  // The summary is written in the background; wait for it.
  for (let i = 0; i < 50 && !fs.existsSync(path.join(connDir, 'summary.json')); i++) await new Promise((r) => setTimeout(r, 20))
})

describe('MCP protocol', () => {
  const server = createMcpServer({
    name: 'test',
    version: '1.0.0',
    tools: [
      {
        name: 'echo',
        title: 'Echo',
        description: 'Echo',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
        handler: async ({ text }) => ({ text }),
      },
      { name: 'boom', title: 'Boom', description: 'Fails', inputSchema: { type: 'object' }, handler: async () => { throw new Error('nope') } },
    ],
  })

  it('negotiates the protocol version', async () => {
    const r = await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } } })
    assert.equal(r.result.protocolVersion, '2025-03-26')
    assert.deepEqual(r.result.capabilities, { tools: { listChanged: false } })
    const r2 = await server.handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
    assert.equal(r2.result.protocolVersion, '2025-06-18')
  })

  it('ignores notifications and answers ping', async () => {
    assert.equal(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined)
    assert.deepEqual((await server.handle({ jsonrpc: '2.0', id: 3, method: 'ping' })).result, {})
  })

  it('lists tools without their handlers', async () => {
    const r = await server.handle({ jsonrpc: '2.0', id: 4, method: 'tools/list' })
    assert.deepEqual(r.result.tools.map((t) => t.name), ['echo', 'boom'])
    assert.equal(r.result.tools[0].handler, undefined)
  })

  it('calls a tool and reports tool errors as results', async () => {
    assert.deepEqual((await call(server, 'echo', { text: 'hi' })).value, { text: 'hi' })
    const bad = await call(server, 'echo', { text: 1 })
    assert.equal(bad.isError, true)
    assert.match(bad.text, /must be a string/)
    assert.match((await call(server, 'echo', { text: 'a', more: 1 })).text, /Unknown argument/)
    assert.match((await call(server, 'boom', {})).text, /nope/)
  })

  it('rejects unknown methods and tools with JSON-RPC errors', async () => {
    assert.equal((await server.handle({ jsonrpc: '2.0', id: 5, method: 'nope' })).error.code, -32601)
    assert.equal((await server.handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'missing' } })).error.code, -32602)
    assert.equal((await server.handle({ id: 7, method: 'ping' })).error.code, -32600)
  })

  it('handles batches', async () => {
    const r = await server.handle([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
    ])
    assert.equal(r.length, 1)
  })

  it('checks argument ranges and enums', () => {
    const schema = { type: 'object', properties: { n: { type: 'integer', minimum: 1, maximum: 5 }, s: { type: 'string', enum: ['a'] } } }
    assert.throws(() => checkArgs(schema, { n: 0 }), /at least 1/)
    assert.throws(() => checkArgs(schema, { n: 1.5 }), /integer/)
    assert.throws(() => checkArgs(schema, { s: 'b' }), /one of/)
    assert.throws(() => checkArgs(schema, []), /object/)
    assert.deepEqual(checkArgs(schema, undefined), {})
  })
})

describe('MonoRail read tools', () => {
  let server
  before(() => {
    server = createServer({ rootDir: root })
  })

  it('marks every read tool read-only', async () => {
    const r = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.ok(r.result.tools.length >= 9)
    for (const t of r.result.tools) {
      assert.equal(t.annotations.readOnlyHint, !/^(create|comment)_/.test(t.name), t.name)
      assert.equal(t.inputSchema.type, 'object', t.name)
      assert.match(t.name, /^[a-z_]+$/)
    }
  })

  it('usage_summary reads the Claude Stats summary', async () => {
    const { value } = await call(server, 'usage_summary', { days: 1 })
    assert.equal(value.available, true)
    assert.deepEqual(value.days, [{ date: '2026-11-10', cost: 2.25 }])
    assert.equal(value.totalForDays, 2.25)
    assert.equal(value.topModels30Days[0].model, 'claude-example')
  })

  it('usage_summary says when there is no report', async () => {
    const empty = createServer({ rootDir: tmp('monorail-mcp-empty-') })
    const { value } = await call(empty, 'usage_summary', {})
    assert.equal(value.available, false)
  })

  it('lists GitHub+ repos and their issues', async () => {
    const repos = (await call(server, 'list_github_plus_repos', {})).value.repos
    assert.equal(repos[0].name, 'demo-repo')
    assert.deepEqual(repos[0].issues, { open: 1, closed: 1 })
    assert.equal(repos[1].error, 'Folder not found')

    const open = (await call(server, 'list_github_plus_issues', { repo: 'demo-repo' })).value
    assert.deepEqual(open.issues.map((i) => i.title), ['First bug'])
    const all = (await call(server, 'list_github_plus_issues', { repo: repo, state: 'all' })).value
    assert.equal(all.total, 2)

    const one = (await call(server, 'get_github_plus_issue', { repo: 'demo-repo', number: 1 })).value
    assert.equal(one.body, 'It breaks.')
    assert.ok(one.timeline.some((t) => t.body === 'Seen it too.'))
  })

  it('refuses repos that were not opened in GitHub+', async () => {
    const other = tmp('monorail-mcp-other-')
    const r = await call(server, 'list_github_plus_issues', { repo: other })
    assert.equal(r.isError, true)
    assert.match(r.text, /not one of the repos opened in GitHub\+/)
  })

  it('reads Jira+ local projects and issues', async () => {
    const projects = (await call(server, 'list_jira_plus_projects', {})).value.projects
    assert.equal(projects[0].key, 'ME')
    assert.equal(projects[0].openCount, 1)

    const todo = (await call(server, 'list_jira_plus_issues', { project: 'me', statusCategory: 'todo' })).value
    assert.deepEqual(todo.issues.map((i) => i.key), ['ME-1'])
    assert.equal(todo.issues[0].description, undefined)

    const issue = (await call(server, 'get_jira_plus_issue', { key: 'ME-1' })).value
    assert.equal(issue.description, 'All of them.')
    assert.equal(issue.comments[0].body, 'Started.')
    assert.ok(issue.history.length >= 2)
    assert.equal(issue.transitions, undefined)
  })

  it('validates Jira+ keys and never creates the local repo', async () => {
    assert.match((await call(server, 'get_jira_plus_issue', { key: '../../x' })).text, /look like/)
    assert.match((await call(server, 'get_jira_plus_issue', { key: 'ME-99' })).text, /no local Jira\+ issue/)
    const emptyRoot = tmp('monorail-mcp-empty-')
    const empty = createServer({ rootDir: emptyRoot })
    assert.deepEqual((await call(empty, 'list_jira_plus_projects', {})).value.projects, [])
    assert.equal(fs.existsSync(path.join(emptyRoot, 'apps', 'jira-plus', 'local-repo')), false)
  })

  it('reports connection status without secrets', async () => {
    const r = await call(server, 'connection_status', {})
    assert.equal(r.value.connections[0].kind, 'atlassian')
    assert.equal(r.value.connections[0].state, 'ok')
    assert.doesNotMatch(r.text, /SECRET-TOKEN-123/)
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'modules', 'connections', 'summary.json'), 'utf8'), /SECRET-TOKEN-123/)
  })

  it('lists chat sessions in allowed folders only', async () => {
    const r = await call(server, 'list_chat_sessions', {})
    assert.equal(r.isError, false, r.text)
    assert.ok(Array.isArray(r.value.sessions))
  })
})

describe('write tools and consent', () => {
  const access = require('./access.cjs')
  let server
  const init = (srv, name) => srv.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1.2.3' } } })

  before(async () => {
    server = createServer({ rootDir: root })
    await init(server, 'test-agent')
  })

  it('lists write tools as not read-only', async () => {
    const r = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    const create = r.result.tools.find((t) => t.name === 'create_github_plus_issue')
    assert.equal(create.annotations.readOnlyHint, false)
  })

  it('records a new agent with nothing allowed and refuses its writes', async () => {
    const a = await access.readAccess(root)
    assert.deepEqual(a.agents['test-agent'].allow, {})
    assert.equal(a.agents['test-agent'].version, '1.2.3')
    const r = await call(server, 'create_github_plus_issue', { repo: 'demo-repo', title: 'From an agent' })
    assert.equal(r.isError, true)
    assert.match(r.text, /has not allowed "test-agent"/)
    assert.equal((await issues.listIssues(repo, 'all')).length, 2)
  })

  it('runs a write the user allowed, for that agent and tool only', async () => {
    await access.setAllowed(root, 'test-agent', 'create_github_plus_issue', true)
    const r = await call(server, 'create_github_plus_issue', { repo: 'demo-repo', title: 'From an agent', body: 'Hello' })
    assert.equal(r.isError, false, r.text)
    assert.equal(r.value.number, 3)
    // Another tool, and another agent, are still refused.
    assert.equal((await call(server, 'comment_github_plus_issue', { repo: 'demo-repo', number: 3, body: 'x' })).isError, true)
    const other = createServer({ rootDir: root })
    await init(other, 'other-agent')
    assert.equal((await call(other, 'create_github_plus_issue', { repo: 'demo-repo', title: 'Nope' })).isError, true)
    // Turning it off applies at once.
    await access.setAllowed(root, 'test-agent', 'create_github_plus_issue', false)
    assert.equal((await call(server, 'create_github_plus_issue', { repo: 'demo-repo', title: 'Again' })).isError, true)
  })

  it('writes Jira+ local issues and comments when allowed', async () => {
    await access.setAllowed(root, 'test-agent', 'create_jira_plus_issue', true)
    await access.setAllowed(root, 'test-agent', 'comment_jira_plus_issue', true)
    const created = await call(server, 'create_jira_plus_issue', { project: 'ME', summary: 'Agent task', type: 'Bug' })
    assert.equal(created.value.key, 'ME-3')
    assert.equal((await call(server, 'comment_jira_plus_issue', { key: 'ME-3', body: 'Done soon.' })).isError, false)
    assert.match((await call(server, 'create_jira_plus_issue', { project: 'NOPE', summary: 'x' })).text, /no local Jira\+ project/)
    assert.match((await call(server, 'comment_jira_plus_issue', { key: 'ME-99', body: 'x' })).text, /no local Jira\+ issue/)
  })

  it('logs every call with what a write did, and no arguments', async () => {
    const log = await access.readAudit(root)
    const ok = log.find((e) => e.tool === 'create_github_plus_issue' && e.ok)
    assert.equal(ok.agent, 'test-agent')
    assert.equal(ok.write, true)
    assert.match(ok.did, /Created issue #3 "From an agent" in demo-repo/)
    assert.ok(log.some((e) => e.tool === 'create_github_plus_issue' && !e.ok && /not allowed/.test(e.error)))
    assert.ok(log.some((e) => e.tool === 'usage_summary' && e.write === false))
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'modules', 'mcp', 'audit.jsonl'), 'utf8'), /Hello/)
  })

  it('keeps agent names tidy', () => {
    assert.equal(access.cleanName(''), 'unknown agent')
    assert.equal(access.cleanName('a\u0000b'), 'ab')
    assert.equal(access.cleanName('x'.repeat(500)).length, 100)
  })
})

describe('stdio server', () => {
  it('answers initialize, tools/list and tools/call over a real process', async () => {
    const child = spawn(process.execPath, [path.join(__dirname, 'server.cjs'), '--data-dir', root], { stdio: ['pipe', 'pipe', 'pipe'] })
    const lines = []
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        lines.push(JSON.parse(buf.slice(0, i)))
        buf = buf.slice(i + 1)
      }
    })
    const send = (m) => child.stdin.write(`${JSON.stringify(m)}\n`)
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'usage_summary', arguments: {} } })
    child.stdin.write('not json\n')
    child.stdin.end()
    const code = await new Promise((r) => child.on('exit', r))
    assert.equal(code, 0)
    const byId = new Map(lines.map((l) => [l.id, l]))
    assert.equal(byId.get(1).result.serverInfo.name, 'monorail')
    assert.ok(byId.get(2).result.tools.some((t) => t.name === 'list_github_plus_issues'))
    assert.equal(JSON.parse(byId.get(3).result.content[0].text).totalForDays, 3.75)
    assert.equal(byId.get(null).error.code, -32700)
  })
})
