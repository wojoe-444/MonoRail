// Tests for the Agent Chat backend, on fictional session logs in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { _internal: chat } = require('./agent-chat.cjs')
const folders = require('./agent-chat-folders.cjs')

const opts = (home) => ({ home, env: {}, dataDir: path.join(home, 'data') })
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

function fixture() {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-chat-')))
  const repo = (name) => {
    const dir = path.join(home, 'Repos', name)
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true })
    return dir
  }
  const demo = repo('demo-app')
  const notes = repo('notes')
  const claudeDir = path.join(home, '.claude', 'projects', '-work-demo-app')
  fs.mkdirSync(path.join(claudeDir, 'abc', 'subagents'), { recursive: true })
  const t = (s) => `2026-01-02T10:00:${String(s).padStart(2, '0')}Z`
  fs.writeFileSync(
    path.join(claudeDir, 'abc.jsonl'),
    jsonl([
      { type: 'user', isMeta: true, timestamp: t(0), cwd: demo, message: { role: 'user', content: 'Caveat: meta' } },
      { type: 'user', timestamp: t(1), cwd: demo, gitBranch: 'main', message: { role: 'user', content: 'Add a dark mode toggle' } },
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
      { type: 'session', version: 3, id: 'p1', timestamp: '2026-01-03T09:00:00Z', cwd: notes },
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
  const { sources, sessions } = await chat.listSessions(opts(home))
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
  await chat.listSessions(opts(home))
  const { messages } = await chat.getSession('claude:abc', opts(home))
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant'])
  assert.deepEqual(messages[1].blocks.map((b) => b.type), ['thinking', 'text', 'tool'])
  assert.equal(messages[1].blocks[2].summary, 'ls src')
  assert.equal(messages[1].blocks[2].result, 'App.tsx')
  assert.equal(messages[2].blocks[0].text, '/compact')
  assert.ok(!JSON.stringify(messages).includes('subagent'))
})

test('shows the active branch of a pi session tree', async () => {
  const home = fixture()
  await chat.listSessions(opts(home))
  const { messages } = await chat.getSession('pi:p1', opts(home))
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'assistant'])
  assert.equal(messages[1].blocks[0].name, 'read')
  assert.equal(messages[1].blocks[0].result, '# A')
  assert.ok(!JSON.stringify(messages).includes('Abandoned'))
})

test('refuses ids it did not hand out', async () => {
  await assert.rejects(chat.getSession('claude:../../etc/passwd', opts(os.tmpdir())), /not found/)
})

test('lists only chats whose folder is in an allowed repo', async () => {
  const home = fixture()
  const outside = path.join(home, 'elsewhere')
  fs.mkdirSync(path.join(outside, '.git'), { recursive: true })
  const dir = path.join(home, '.claude', 'projects', '-elsewhere')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'out.jsonl'), jsonl([{ type: 'user', timestamp: '2026-01-04T00:00:00Z', cwd: outside, message: { content: 'Outside' } }]))
  // A link under Repos that points outside it is not "directly under" Repos.
  fs.symlinkSync(outside, path.join(home, 'Repos', 'sneaky'), process.platform === 'win32' ? 'junction' : 'dir')
  const { sessions, limits } = await chat.listSessions(opts(home))
  assert.deepEqual(sessions.map((s) => s.id).sort(), ['claude:abc', 'pi:p1'])
  assert.equal(limits.outsideAllowed, 1)
  assert.equal(sessions.find((s) => s.id === 'claude:abc').repo.name, 'demo-app')
  await assert.rejects(chat.getSession('claude:out', opts(home)), /not found/)

  // Adding the repo in settings allows it.
  await folders.addRepo(opts(home).dataDir, outside)
  const again = await chat.listSessions(opts(home))
  assert.ok(again.sessions.some((s) => s.id === 'claude:out'))
  // Removing it again shuts the chat even though it is still in the cached index.
  await folders.removeRepo(opts(home).dataDir, outside)
  await assert.rejects(chat.getSession('claude:out', opts(home)), /not in an allowed folder/)
})

test('a history keeps the last 300 messages and says it was cut', async () => {
  const home = fixture()
  const dir = path.join(home, '.claude', 'projects', '-long')
  fs.mkdirSync(dir, { recursive: true })
  const cwd = fs.readdirSync(path.join(home, 'Repos')).map((n) => path.join(home, 'Repos', n))[0]
  const rows = []
  for (let i = 0; i < 320; i++) rows.push({ type: 'user', timestamp: '2026-01-05T00:00:00Z', cwd, message: { content: `Message ${i}` } })
  fs.writeFileSync(path.join(dir, 'long.jsonl'), jsonl(rows))
  await chat.listSessions(opts(home))
  const { messages, truncated } = await chat.getSession('claude:long', opts(home))
  assert.equal(messages.length, 300)
  assert.equal(messages[0].blocks[0].text, 'Message 20')
  assert.deepEqual(truncated, { bytes: false, messages: 20 })
})

// ---------------------------------------------------------------------------
// Detailed view and totals

test('Claude replies carry one usage per model call, and subagent calls are read apart', () => {
  const usage = { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens: 7 }
  const msgs = chat.claudeTranscript([
    { type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Hi' } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:01Z', message: { id: 'm1', model: 'demo', content: [{ type: 'thinking', thinking: 'hmm' }], usage } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:01Z', message: { id: 'm1', model: 'demo', content: [{ type: 'text', text: 'Hello' }], usage } },
  ])
  const a = msgs.filter((m) => m.role === 'assistant')
  assert.equal(a.length, 1)
  assert.deepEqual(a[0].usage, { model: 'demo', input: 10, cacheRead: 100, cacheWrite: 5, output: 7 })
  const sub = chat.claudeSubagentCalls([
    { type: 'assistant', timestamp: '2026-01-01T00:00:02Z', message: { id: 's1', model: 'small', content: [], usage } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:02Z', message: { id: 's1', model: 'small', content: [], usage } },
  ])
  assert.equal(sub.length, 1)
  assert.equal(sub[0].subagent, true)
})

test("pi's total counts every paid entry, abandoned branches included", () => {
  const paid = (id, parentId, usd) => ({ type: 'message', id, parentId, message: { role: 'assistant', content: [], usage: { input: 1, output: 1, cost: { total: usd } } } })
  const entries = [
    { type: 'session', id: 's', cwd: '/r' },
    { type: 'message', id: 'u1', parentId: null, message: { role: 'user', content: 'Hi' } },
    paid('a1', 'u1', 0.25), // abandoned branch
    paid('a2', 'u1', 0.5),
  ]
  assert.equal(chat.piSpend(entries), 0.75)
  // The transcript follows one branch, but carries each call's logged cost.
  const shown = chat.piTranscript(entries).filter((m) => m.role === 'assistant')
  assert.equal(shown.length, 1)
  assert.equal(shown[0].usage.costUsd, 0.5)
})

test('a Claude total is complete only while nothing ran after its record', () => {
  const costs = { s1: { usd: 1.5, at: 1_000_000 } }
  assert.deepEqual(chat.chatTotal({ source: 'claude', sessionId: 's1', updatedAt: 1_000_500 }, costs), { usd: 1.5, complete: true })
  assert.equal(chat.chatTotal({ source: 'claude', sessionId: 's1', updatedAt: 2_000_000 }, costs).complete, false)
  assert.equal(chat.chatTotal({ source: 'claude', sessionId: 'nope' }, costs).reason, 'no-record')
  assert.equal(chat.chatTotal({ source: 'pi' }, costs).reason, 'too-big')
})

// ---------------------------------------------------------------------------
// List flags (unread, archived, scheduled)

const chatState = require('./agent-chat-state.cjs')

test('unread, archived and started-here flags live in a record file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-state-'))
  const s0 = chatState.read(dir)
  const id = 'claude:abc-1'
  // Changed before the record file existed: not unread. Changed after: unread.
  assert.equal(chatState.flags(s0, id, s0.since - 5000).unread, false)
  assert.equal(chatState.flags(s0, id, s0.since + 5000).unread, true)
  chatState.markSeen(dir, id)
  const seen = chatState.read(dir).chats[id].seen
  assert.equal(chatState.flags(chatState.read(dir), id, seen - 10).unread, false)
  chatState.setUnread(dir, id, true)
  assert.equal(chatState.flags(chatState.read(dir), id, 0).unread, true)
  chatState.setUnread(dir, id, false)
  assert.equal(chatState.flags(chatState.read(dir), id, 0).unread, false)
  chatState.setArchived(dir, id, true)
  assert.equal(chatState.flags(chatState.read(dir), id, 0).archived, true)
  chatState.markStartedHere(dir, id)
  assert.equal(chatState.flags(chatState.read(dir), id, 0).startedHere, true)
  assert.throws(() => chatState.setArchived(dir, '../../etc', true), /Unknown chat/)
  // Only flags and numbers are stored.
  assert.deepEqual(Object.keys(chatState.read(dir).chats[id]).sort(), ['archived', 'here', 'seen'])
})

// ---------------------------------------------------------------------------
// Coordinator tools (agent-chat-coordinator.cjs)

const coord = require('./agent-chat-coordinator.cjs')

function coordinatorFixture() {
  const home = fixture()
  const dataDir = path.join(home, 'data')
  const cdir = path.join(dataDir, 'coordinator')
  fs.mkdirSync(cdir, { recursive: true })
  const proj = path.join(home, '.claude', 'projects', '-coordinator')
  fs.mkdirSync(proj, { recursive: true })
  fs.writeFileSync(
    path.join(proj, 'coord1.jsonl'),
    jsonl([{ type: 'user', timestamp: '2026-01-04T10:00:00Z', cwd: cdir, message: { role: 'user', content: 'Plan the week' } }]),
  )
  return { home, dataDir, tools: coord.chatTools({ dataDir, home, env: {}, now: () => Date.parse('2026-02-01T00:00:00Z') }) }
}

test('coordinator tools list and read allowed chats, never coordinator chats', async () => {
  const { tools } = coordinatorFixture()
  const { chats, repos } = await tools.list_chats({})
  assert.deepEqual(chats.map((c) => c.chatId).sort(), ['claude:abc', 'pi:p1'])
  assert.deepEqual(repos.sort(), ['demo-app', 'notes'])
  assert.deepEqual((await tools.list_chats({ repo: 'notes' })).chats.map((c) => c.chatId), ['pi:p1'])

  const read = await tools.read_chat({ chatId: 'claude:abc', messages: 2 })
  assert.equal(read.repo, 'demo-app')
  assert.equal(read.messages.at(-1).text, 'Done.')
  assert.ok(read.olderMessages > 0)
  await assert.rejects(tools.read_chat({ chatId: 'claude:coord1' }), /Coordinator chats/)
  await assert.rejects(tools.read_chat({ chatId: 'claude:nope' }), /No such chat/)
})

test('coordinator tools refuse coordinator chats, unknown repos and chats that look busy', async () => {
  const { tools, dataDir, home } = coordinatorFixture()
  await assert.rejects(tools.send_to_chat({ chatId: 'claude:coord1', message: 'hi' }), /coordinator chat/)
  await assert.rejects(tools.send_to_chat({ chatId: 'claude:elsewhere', message: 'hi' }), /No such chat/)
  await assert.rejects(tools.start_chat({ repo: 'not-allowed', message: 'hi' }), /not one of the allowed repos/)
  // A chat whose log changed a moment ago may be open in a terminal.
  const { sessions } = await chat.listSessions({ home, env: {}, dataDir })
  const abc = sessions.find((s) => s.id === 'claude:abc')
  const busy = coord.chatTools({ dataDir, home, env: {}, now: () => abc.updatedAt + 5000 })
  await assert.rejects(busy.send_to_chat({ chatId: 'claude:abc', message: 'hi' }), /last minute/)
  await assert.rejects(tools.wait_for_reply({ turnId: 'made-up' }), /Unknown turnId/)
})

test('a reply is the assistant text after the last tool result', () => {
  assert.equal(
    coord.replyText([
      { t: 'assistant', blocks: [{ type: 'text', text: 'Looking.' }, { type: 'tool', name: 'Read' }] },
      { t: 'tool_result', result: 'file' },
      { t: 'assistant', blocks: [{ type: 'text', text: 'It is fine.' }] },
      { t: 'assistant', blocks: [{ type: 'text', text: 'Anything else?' }] },
    ]),
    'It is fine.\n\nAnything else?',
  )
})
