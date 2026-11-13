const test = require('node:test')
const assert = require('node:assert/strict')
const { MARKER, sanitize, whatsNewSection, formatNotes, parseNotes, changesSince, compareVersions } = require('./release-notes.cjs')

test('whatsNewSection reads the bullets of the What\'s new section only', () => {
  const body = [
    '<!-- claude-projects-attribution: {"github_login":"someone"} -->',
    '## What',
    '- `electron/x.cjs`: internals',
    '',
    "## What's new",
    '- **Update notes**: the update pop-up lists what changed',
    '  since your version.',
    '- **Faster lists**: chats open quicker.',
    '',
    '## Tests',
    '- npm test',
  ].join('\n')
  assert.deepEqual(whatsNewSection(body), [
    '**Update notes**: the update pop-up lists what changed since your version.',
    '**Faster lists**: chats open quicker.',
  ])
  assert.deepEqual(whatsNewSection('## What\n- x'), [])
})

test('sanitize removes personal paths, emails and comments', () => {
  const out = sanitize('Saved in C:\\Users\\someone\\AppData\\x and /home/someone/x or /Users/a/b, mail a.b@example.com <!-- hi -->')
  assert.ok(!/someone|example\.com|hi -->|\/Users\/a/.test(out), out)
  assert.equal(sanitize('pi 1.0 needs @earendil-works/pi-coding-agent@1.0.0'), 'pi 1.0 needs @earendil-works/pi-coding-agent@1.0.0')
})

test('formatNotes falls back to the PR title and round-trips through parseNotes', () => {
  const md = formatNotes([
    { number: 7, title: 'Wiki: linked guides', body: '## What\n- internals' },
    { number: 8, title: 'x', body: "## What's new\n- **Update notes**: lists what changed.\n- Plain line with `code`" },
  ])
  assert.ok(md.startsWith(MARKER))
  assert.deepEqual(parseNotes(md), [
    { title: 'Wiki: linked guides', text: '', pr: 7 },
    { title: 'Update notes', text: 'lists what changed.', pr: 8 },
    { title: 'Plain line with code', text: '', pr: 8 },
  ])
  assert.match(formatNotes([]), /Maintenance/)
})

test('parseNotes ignores bodies written before the notes existed', () => {
  assert.deepEqual(parseNotes('Built from abc123.'), [])
  assert.deepEqual(parseNotes(null), [])
})

test('changesSince keeps releases after the installed version up to the latest, newest first', () => {
  const rel = (v, body = `${MARKER}\n- **v${v}**`) => ({ tag_name: `v${v}`, body, published_at: '2026-01-01T00:00:00Z' })
  const list = [rel('0.1.9'), rel('0.1.12'), rel('0.1.10', 'Built from abc.'), rel('0.1.13'), { ...rel('0.1.11'), draft: true }]
  const out = changesSince(list, '0.1.9', '0.1.12')
  assert.deepEqual(out.map((r) => r.version), ['0.1.12', '0.1.10'])
  assert.deepEqual(out[0].items, [{ title: 'v0.1.12', text: '' }])
  assert.deepEqual(out[1].items, [])
  assert.equal(compareVersions('0.1.100', '0.1.99'), 1)
})
