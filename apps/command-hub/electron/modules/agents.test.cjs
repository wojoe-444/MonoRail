// Tests for the Agents overview backend, on fictional definitions in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const defs = require('./agents-definitions.cjs')
const { _internal: agents } = require('./agents.cjs')

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function fixture() {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agents-')))
  const repo = path.join(home, 'Repos', 'demo-app')
  write(
    path.join(home, '.claude', 'agents', 'code-reviewer.md'),
    '---\nname: code-reviewer\ndescription: Reviews diffs for bugs\nmodel: sonnet\ntools: Read, Grep, Glob\n---\n\nYou review code.\n',
  )
  write(path.join(home, '.claude', 'agents', 'notes.txt'), 'not a definition')
  write(
    path.join(home, '.claude', 'skills', 'release-notes', 'SKILL.md'),
    '---\nname: release-notes\ndescription: >\n  Drafts release notes\n  from merged PRs\nallowed-tools:\n  - Bash\n  - Read\n---\nSteps go here.\n',
  )
  write(path.join(repo, '.claude', 'agents', 'test-writer.md'), 'No header at all.\n')
  write(path.join(home, '.pi', 'agent', 'skills', 'triage', 'SKILL.md'), '---\nname: "triage"\ndescription: \'Labels issues\'\n---\n')
  write(path.join(repo, '.pi', 'skills', 'empty-dir', 'README.md'), 'no SKILL.md here')
  return { home, repos: [{ name: 'demo-app', path: repo }] }
}

test('frontmatter: plain, folded and list values', () => {
  const { data, body } = defs.parseFrontmatter('---\nname: a\ndescription: >\n  one\n  two\ntools:\n  - X\n  - Y\nmodel: "opus"\n---\nBody\n')
  assert.deepEqual(data, { name: 'a', description: 'one two', tools: ['X', 'Y'], model: 'opus' })
  assert.equal(body, 'Body')
  assert.deepEqual(defs.parseFrontmatter('no header').data, {})
})

test('lists user and project definitions, never handing out a path', async () => {
  const { home, repos } = fixture()
  const { definitions, sources } = await defs.listDefinitions({ repos, env: {}, home })
  assert.deepEqual(
    definitions.map((d) => [d.name, d.tool, d.kind, d.scope, d.repo ?? null]),
    [
      ['code-reviewer', 'claude', 'subagent', 'user', null],
      ['release-notes', 'claude', 'skill', 'user', null],
      ['test-writer', 'claude', 'subagent', 'project', 'demo-app'],
      ['triage', 'pi', 'skill', 'user', null],
    ],
  )
  const reviewer = definitions[0]
  assert.equal(reviewer.model, 'sonnet')
  assert.deepEqual(reviewer.tools, ['Read', 'Grep', 'Glob'])
  assert.deepEqual(definitions[1].tools, ['Bash', 'Read'])
  assert.equal(definitions[1].description, 'Drafts release notes from merged PRs')
  assert.ok(sources.every((s) => s.found))
  for (const d of definitions) {
    assert.match(d.id, /^def_[0-9a-f]{16}$/)
    assert.ok(!JSON.stringify(d).includes(home), 'no absolute paths reach the page')
  }

  const one = await defs.getDefinition(reviewer.id)
  assert.equal(one.body, 'You review code.')
  assert.equal(one.fields.model, 'sonnet')
  await assert.rejects(defs.getDefinition('../../etc/passwd'), /not found/)
})

test('CLAUDE_CONFIG_DIR and PI_CODING_AGENT_DIR move the user folders', async () => {
  const { home } = fixture()
  const alt = path.join(home, 'alt-claude')
  write(path.join(alt, 'agents', 'other.md'), '---\nname: other\n---\n')
  const { definitions } = await defs.listDefinitions({ repos: [], env: { CLAUDE_CONFIG_DIR: alt, PI_CODING_AGENT_DIR: path.join(home, 'nowhere') }, home })
  assert.deepEqual(definitions.map((d) => d.name), ['other'])
})

test('overview: states, weekly counts, repos and spend', () => {
  const now = new Date(2026, 0, 10, 12, 0).getTime()
  const H = 60 * 60 * 1000
  const session = (id, source, repo, ago) => ({ id: `${source}:${id}`, source, sessionId: id, title: id, repo: { name: repo, path: `/r/${repo}` }, startedAt: now - ago - H, updatedAt: now - ago })
  const list = {
    sessions: [session('a', 'claude', 'one', 60 * 1000), session('b', 'pi', 'two', 2 * H), session('c', 'claude', 'one', 30 * H), session('d', 'claude', 'one', 20 * 24 * H)],
    sources: [],
    limits: { dropped: 0 },
    folders: {},
  }
  const o = agents.buildOverview({
    list,
    definitions: { definitions: [], sources: [], truncated: false },
    composer: { repos: [{ name: 'one', path: '/r/one' }, { name: 'idle', path: '/r/idle' }], sdks: [] },
    running: [{ chatKey: 'draft:x', sdk: 'pi', sessionId: 'b' }],
    summary: { 'claude-stats.summary': { builtAt: 'x', stale: false, summary: { days: Array.from({ length: 30 }, (_, i) => ({ date: String(i), cost: i < 23 ? 100 : 1 })) } } },
    now,
  })
  assert.deepEqual(o.recent.map((r) => r.state), ['active', 'running', 'idle', 'idle'])
  assert.equal(o.activity.today, 2)
  assert.equal(o.activity.week, 3)
  assert.equal(o.activity.activeNow, 2)
  assert.equal(o.activity.weekCapped, false)
  assert.deepEqual(o.repos.map((r) => [r.name, r.sessions]), [['one', 3], ['two', 1], ['idle', 0]])
  assert.equal(o.cost.total, 7)
})
