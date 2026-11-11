// Tests for the Jira+ backend pieces that run without Electron: the local
// git-backed store and the ADF <-> plain text conversion. Run with `npm test`.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const git = require('isomorphic-git')

const { createLocalStore } = require('./local.cjs')
const { adfToText, textToAdf, normalizeSite } = require('./cloud.cjs')

describe('local store', () => {
  it('commits every change and reads history from git', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo')
    const s = createLocalStore(dir)
    await s.createProject({ key: 'me', name: 'Personal' })
    const created = await s.createIssue({ projectKey: 'ME', summary: 'First' })
    assert.equal(created.key, 'ME-1')
    // Concurrent writes are serialized, so none are lost.
    await Promise.all([
      s.transitionIssue({ key: 'ME-1', transitionId: 'In Progress' }),
      s.addComment({ key: 'ME-1', body: 'hi' }),
      s.updateIssue({ key: 'ME-1', fields: { priority: 'High', labels: ['a'] } }),
      s.createIssue({ projectKey: 'ME', summary: 'Second' }),
    ])
    const issue = await s.getIssue('ME-1')
    assert.equal(issue.status, 'In Progress')
    assert.equal(issue.projectName, 'Personal')
    assert.equal(issue.statusCategory, 'in_progress')
    assert.equal(issue.priority, 'High')
    assert.equal(issue.comments.length, 1)
    assert.equal(issue.history.length, 4)
    assert.ok(!issue.transitions.some((t) => t.id === 'In Progress'))

    const [project] = await s.listProjects()
    assert.deepEqual([project.key, project.issueCount, project.openCount], ['ME', 2, 2])

    await s.deleteIssue({ key: 'ME-2' })
    assert.equal((await s.listIssues('ME')).length, 1)
    // The repository never gets a remote.
    assert.deepEqual(await git.listRemotes({ fs, dir }), [])
  })

  it('rejects bad keys and duplicate projects', async () => {
    const s = createLocalStore(join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo'))
    await assert.rejects(s.createProject({ key: '1X', name: 'Bad' }))
    await s.createProject({ key: 'ME', name: 'Personal' })
    await assert.rejects(s.createProject({ key: 'ME', name: 'Again' }))
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: '  ' }))
  })
})

describe('Jira Cloud helpers', () => {
  it('round-trips plain text through ADF', () => {
    const text = 'a\nb\n\nc'
    assert.equal(adfToText(textToAdf(text)), text)
  })

  it('flattens lists, mentions and breaks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'mention', attrs: { text: '@Sam' } }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
      ],
    }
    assert.equal(adfToText(doc), 'Hi @Sam\n\n- one')
  })

  it('normalizes the site to an https origin', () => {
    assert.equal(normalizeSite('team.atlassian.net/jira/software'), 'https://team.atlassian.net')
    assert.throws(() => normalizeSite('http://team.atlassian.net'))
    assert.throws(() => normalizeSite(''))
  })
})
