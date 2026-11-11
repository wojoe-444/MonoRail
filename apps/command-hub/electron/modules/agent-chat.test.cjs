// Tests for the Agent Chat backend, on fictional session logs in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { _internal: chat } = require('./agent-chat.cjs')

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-chat-'))
  const claudeDir = path.join(home, '.claude', 'projects', '-work-demo-app')
  fs.mkdirSync(path.join(claudeDir, 'abc', 'subagents'), { recursive: true })
  const t = (s) => `2026-01-02T10:00:${String(s).padStart(2, '0')}Z`
  fs.writeFileSync(
    path.join(claudeDir, 'abc.jsonl'),
    jsonl([
      { type: 'user', isMeta: true, timestamp: t(0), cwd: '/work/demo-app', message: { role: 'user', content: 'Caveat: meta' } },
      { type: 'user', timestamp: t(1), cwd: '/work/demo-app', gitBranch: 'main', message: { role: 'user', content: 'Add a dark mode toggle' } },
      { type: 'assistant', timestamp: t(2), message: { id: 'm1', model: 'claude-sonnet-demo', content: [{ type: 'thinking', thinking: 'Plan it' }] } },
      { type: 'assistant', timestamp: t(3), message: { id: 'm1', model: 'claude-sonnet-demo', content: [{ type: 'text', text: 'Let me look.' }] } },
      { type: 'assistant', timestamp: t(4), message: { id: 'm1', model: 'claude-sonnet-demo', content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'ls src' } }] } },
      { type: 'user', timestamp: t(5), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'App.tsx' }] } },
      { type: 'assistant', timestamp: t(6), isSidechain: true, message: { id: 'side', model: 'x', content: [{ type: 'text', text: 'subagent' }] } },
      { type: 'user', timestamp: t(7), message: { role: 'user', content: '<command-name>/compact</command-name><command-args></command-args>' } },
      { type: 'assistant', timestamp: t(8), message: { id: 'm2', model: 'claude-sonnet-demo', content: [{ type: 'text', text: 'Done.' }] } },
    ]),
  )
  fs.writeFileSync(path.join(claudeDir, 'abc', 'subagents', 'agent-1.jsonl'), jsonl([{ type: 'user', message: { content: 'sub' } }]))

  const piDir = path.join(home, '.pi', 'agent', 'sessions', '--work-notes--')
  fs.mkdirSync(piDir, { recursive: true })
  fs.writeFileSync(
    path.join(piDir, '2026-01-03T09-00-00-000Z_p1.jsonl'),
    jsonl([
      { type: 'session', version: 3, id: 'p1', timestamp: '2026-01-03T09:00:00Z', cwd: '/work/notes' },
      { type: 'message', id: 'a', parentId: null, timestamp: '2026-01-03T09:00:01Z', message: { role: 'user', content: 'First try' } },
      { type: 'message', id: 'b', parentId: 'a', timestamp: '2026-01-03T09:00:02Z', message: { role: 'assistant', model: 'demo-model', content: [{ type: 'text', text: 'Abandoned branch' }] } },
      { type: 'message', id: 'c', parentId: 'a', timestamp: '2026-01-03T09:00:03Z', message: { role: 'assistant', model: 'demo-model', content: [{ type: 'toolCall', id: 'tc1', name: 'read', arguments: { path: 'a.md' } }] } },
      { type: 'message', id: 'd', parentId: 'c', timestamp: '2026-01-03T09:00:04Z', message: { role: 'toolResult', toolCallId: 'tc1', content: [{ type: 'text', text: '# A' }], isError: false } },
      { type: 'message', id: 'e', parentId: 'd', timestamp: '2026-01-03T09:00:05Z', message: { role: 'assistant', model: 'demo-model', content: [{ type: 'text', text: 'It is a heading.' }] } },
    ]),
  )
  return home
}

test('lists Claude Code and pi sessions, skipping subagent logs', async () => {
  const home = fixture()
  const { sources, sessions } = await chat.listSessions({ home, env: {} })
  assert.deepEqual(sources.map((s) => [s.id, s.found]), [['claude', true], ['pi', true]])
  assert.equal(sessions.length, 2)
  const claude = sessions.find((s) => s.source === 'claude')
  assert.equal(claude.id, 'claude:abc')
  assert.equal(claude.title, 'Add a dark mode toggle')
  assert.equal(claude.project, 'demo-app')
  assert.equal(claude.branch, 'main')
  assert.equal(claude.model, 'claude-sonnet-demo')
  const pi = sessions.find((s) => s.source === 'pi')
  assert.equal(pi.id, 'pi:p1')
  assert.equal(pi.project, 'notes')
  assert.equal(pi.title, 'First try')
})

test('turns a Claude Code log into a transcript', async () => {
  const home = fixture()
  await chat.listSessions({ home, env: {} })
  const { messages } = await chat.getSession('claude:abc', { home, env: {} })
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant'])
  assert.deepEqual(messages[1].blocks.map((b) => b.type), ['thinking', 'text', 'tool'])
  assert.equal(messages[1].blocks[2].summary, 'ls src')
  assert.equal(messages[1].blocks[2].result, 'App.tsx')
  assert.equal(messages[2].blocks[0].text, '/compact')
  assert.ok(!JSON.stringify(messages).includes('subagent'))
})

test('shows the active branch of a pi session tree', async () => {
  const home = fixture()
  await chat.listSessions({ home, env: {} })
  const { messages } = await chat.getSession('pi:p1', { home, env: {} })
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'assistant'])
  assert.equal(messages[1].blocks[0].name, 'read')
  assert.equal(messages[1].blocks[0].result, '# A')
  assert.ok(!JSON.stringify(messages).includes('Abandoned'))
})

test('refuses ids it did not hand out', async () => {
  await assert.rejects(chat.getSession('claude:../../etc/passwd', { home: os.tmpdir(), env: {} }), /not found/)
})
