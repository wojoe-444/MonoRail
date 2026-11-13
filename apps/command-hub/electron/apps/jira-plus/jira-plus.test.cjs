// Tests for the Jira+ backend pieces that run without Electron: the local
// git-backed store and the ADF <-> plain text conversion. Run with `npm test`.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const git = require('isomorphic-git')

const { createLocalStore, formatSeconds } = require('./local.cjs')
const { adfToText, textToAdf, normalizeSite, jiraTime } = require('./cloud.cjs')

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

describe('trigger templates', () => {
  it('persists, edits and deletes project-scoped templates without creating issues', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo')
    const store = createLocalStore(dir)
    await store.createProject({ key: 'ME', name: 'Personal' })
    await assert.rejects(store.saveTriggerTemplate({ source: 'local', projectKey: '../X', summary: 'Bad' }), /Invalid project/)
    await assert.rejects(store.saveTriggerTemplate({ source: 'local', projectKey: 'ME', summary: ' ' }), /summary/)
    const template = await store.saveTriggerTemplate({ source: 'local', projectKey: 'ME', summary: ' Check logs ', condition: 'When error rate rises', priority: 'High', description: 'Inspect service' })
    await store.saveTriggerTemplate({ source: 'jira', projectKey: 'ME', summary: 'Team task' })
    const reopened = createLocalStore(dir)
    assert.equal((await reopened.listTriggerTemplates({ source: 'local', projectKey: 'ME' }))[0].summary, 'Check logs')
    assert.equal((await reopened.listTriggerTemplates({ source: 'jira', projectKey: 'ME' })).length, 1)
    const updated = await reopened.saveTriggerTemplate({ ...template, summary: 'Check alerts' })
    assert.equal(updated.created, template.created)
    assert.equal((await reopened.listIssues('ME')).length, 0)
    await reopened.deleteTriggerTemplate({ source: 'local', projectKey: 'ME', id: template.id })
    assert.deepEqual(await reopened.listTriggerTemplates({ source: 'local', projectKey: 'ME' }), [])
    await assert.rejects(reopened.saveTriggerTemplate({ ...template }), /no longer exists/)
  })
})

describe('recurring maintenance', () => {
  it('creates exactly one scheduled next occurrence and retains the completed item', async () => {
    const s = createLocalStore(join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo'))
    await s.createProject({ key: 'ME', name: 'Personal' })
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: 'Maintenance', type: 'Recurring', recurrence: 'weekly' }), /expected end date/)
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: 'Bad date', dueDate: '2026-02-30' }), /valid expected end date/)
    const issue = await s.createIssue({ projectKey: 'ME', summary: 'Maintenance', type: 'Recurring', recurrence: 'monthly', dueDate: '2028-01-31' })
    await s.transitionIssue({ key: issue.key, transitionId: 'Done' })
    const done = await s.getIssue(issue.key)
    const next = await s.getIssue(done.nextOccurrence)
    assert.equal(next.dueDate, '2028-02-29')
    assert.equal(next.type, 'Recurring')
    assert.equal(next.status, 'To Do')
    await s.transitionIssue({ key: issue.key, transitionId: 'To Do' })
    await s.transitionIssue({ key: issue.key, transitionId: 'Done' })
    assert.equal((await s.listIssues('ME')).length, 2)
    await assert.rejects(s.updateIssue({ key: next.key, fields: { dueDate: '' } }), /need an expected end date/)
  })
})

describe('parents and time logs', () => {
  it('creates sub-tasks under an issue and preserves them when their parent is deleted', async () => {
    const s = createLocalStore(join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo'))
    await s.createProject({ key: 'ME', name: 'Personal' })
    await s.createIssue({ projectKey: 'ME', summary: 'Parent' })
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: 'Orphan', type: 'Sub-task' }), /needs a parent/)
    const sub = await s.createIssue({ projectKey: 'ME', summary: 'Step', type: 'Sub-task', parent: 'ME-1' })
    assert.equal(sub.type, 'Sub-task')
    assert.deepEqual((await s.getIssue('ME-1')).children.map((i) => i.key), [sub.key])
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: 'Nested', type: 'Sub-task', parent: sub.key }), /cannot be the parent/)
    await assert.rejects(s.setParent({ key: sub.key, parent: null }), /needs a parent/)
    await s.deleteIssue({ key: 'ME-1' })
    const kept = await s.getIssue(sub.key)
    assert.equal(kept.type, 'Task')
    assert.equal(kept.parent, undefined)
  })

  it('sets parents, refuses loops and rolls time up the tree', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo')
    const s = createLocalStore(dir)
    await s.createProject({ key: 'ME', name: 'Personal' })
    await s.createProject({ key: 'XO', name: 'Other' })
    await s.createIssue({ projectKey: 'ME', summary: 'Launch', type: 'Epic' })
    await s.createIssue({ projectKey: 'ME', summary: 'Story', type: 'Story', parent: 'ME-1' })
    await s.createIssue({ projectKey: 'ME', summary: 'Task' })
    await s.createIssue({ projectKey: 'XO', summary: 'Elsewhere' })
    await s.setParent({ key: 'ME-3', parent: 'ME-2' })

    // No loops, no other projects, no unknown keys.
    await assert.rejects(s.setParent({ key: 'ME-1', parent: 'ME-3' }), /below this issue/)
    await assert.rejects(s.setParent({ key: 'ME-1', parent: 'ME-1' }), /this issue/)
    await assert.rejects(s.setParent({ key: 'ME-3', parent: 'XO-1' }), /same project/)
    await assert.rejects(s.createIssue({ projectKey: 'ME', summary: 'x', parent: 'ME-99' }), /same project/)
    assert.deepEqual((await s.parentOptions({ key: 'ME-1' })).map((o) => o.key), [])
    assert.deepEqual((await s.parentOptions({ key: 'ME-3' })).map((o) => o.key), ['ME-2', 'ME-1'])

    await s.logWork({ key: 'ME-1', seconds: 1800, comment: 'Plan' })
    await s.logWork({ key: 'ME-2', seconds: 3600 })
    const beforeLogging = Date.now()
    const log = await s.logWork({ key: 'ME-3', seconds: 2 * 3600, started: '2026-11-10T09:00:00Z' })
    await assert.rejects(s.logWork({ key: 'ME-3', seconds: 10 }), /one minute/)
    await assert.rejects(s.logWork({ key: 'ME-3', seconds: 8 * 24 * 3600 }), /at most a week/)

    const epic = await s.getIssue('ME-1')
    assert.deepEqual(epic.timeTracking, { spentSeconds: 1800, totalSeconds: 1800 + 3600 + 7200 })
    assert.deepEqual(epic.children.map((c) => c.key), ['ME-2'])
    assert.equal(epic.worklogs[0].comment, 'Plan')
    const task = await s.getIssue('ME-3')
    assert.equal(task.parent.key, 'ME-2')
    assert.equal(task.parent.summary, 'Story')
    assert.equal(task.worklogs[0].started, '2026-11-10T09:00:00.000Z')
    assert.equal(task.worklogs[0].created, log.created)
    assert.ok(Date.parse(log.created) >= beforeLogging && Date.parse(log.created) <= Date.now())
    assert.ok(task.history.some((h) => h.text === 'Logged 2h'))
    assert.ok(task.history.some((h) => h.text === 'Parent set to ME-2'))

    // Lists carry the parent and the time logged, never the raw logs.
    const listed = (await s.listIssues('ME')).find((i) => i.key === 'ME-3')
    assert.equal(listed.parent.summary, 'Story')
    assert.equal(listed.timeSpentSeconds, 7200)
    assert.equal(listed.worklogs, undefined)

    await s.deleteWorklog({ key: 'ME-3', id: log.id })
    assert.equal((await s.getIssue('ME-1')).timeTracking.totalSeconds, 1800 + 3600)
    await s.setParent({ key: 'ME-3', parent: null })
    assert.equal((await s.getIssue('ME-3')).parent, undefined)

    // Deleting a parent keeps its children, without a parent.
    await s.deleteIssue({ key: 'ME-1' })
    assert.equal((await s.getIssue('ME-2')).parent, undefined)
  })

  it('edits and deletes local comments, one commit each', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'local-repo')
    const s = createLocalStore(dir)
    await s.createProject({ key: 'me', name: 'Personal' })
    await s.createIssue({ projectKey: 'ME', summary: 'Task' })
    const c = await s.addComment({ key: 'ME-1', body: 'First try' })
    await assert.rejects(s.addComment({ key: 'ME-1', body: '  ' }), /Write something/)
    const edited = await s.updateComment({ key: 'ME-1', id: c.id, body: 'Second try' })
    assert.equal(edited.body, 'Second try')
    assert.ok(edited.updated)
    let issue = await s.getIssue('ME-1')
    assert.equal(issue.comments[0].body, 'Second try')
    assert.equal(issue.comments[0].mine, true)
    assert.equal(issue.commentCount, 1)
    await s.deleteComment({ key: 'ME-1', id: c.id })
    await assert.rejects(s.updateComment({ key: 'ME-1', id: c.id, body: 'x' }), /gone/)
    issue = await s.getIssue('ME-1')
    assert.equal(issue.comments.length, 0)
    assert.ok(issue.history.some((h) => h.text === 'Edited a comment'))
    assert.ok(issue.history.some((h) => h.text === 'Deleted a comment'))
  })

  it('formats time the way Jira does', () => {
    assert.equal(formatSeconds(90 * 60), '1h 30m')
    assert.equal(formatSeconds(9 * 3600), '1d 1h')
    assert.equal(jiraTime('2026-11-12T09:30:00Z'), '2026-11-12T09:30:00.000+0000')
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

describe('team Jira connection', () => {
  const backend = require('./index.cjs')
  const ctxFor = () => {
    const dataDir = join(mkdtempSync(join(tmpdir(), 'jira-plus-')), 'apps', 'jira-plus')
    fs.mkdirSync(dataDir, { recursive: true })
    return { dataDir, log: () => {} }
  }
  const realFetch = global.fetch
  const calls = []
  const stubFetch = () => {
    calls.length = 0
    global.fetch = async (url, opts) => {
      calls.push([url, opts.headers.Authorization])
      const body = url.endsWith('/myself') ? { accountId: 'a1', displayName: 'Casey' } : { isLast: true, issues: [] }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    }
  }

  it('loads calendar dates from private projects and the scoped team query', async () => {
    const ctx = ctxFor()
    backend._setCredentialSource(async () => ({ siteUrl: 'https://team.atlassian.net', email: 'c@example.invalid', token: 't1' }))
    await backend.methods.createLocalProject(ctx, { key: 'ME', name: 'Personal' })
    await backend.methods.createIssue(ctx, { source: 'local', projectKey: 'ME', summary: 'First', dueDate: '2026-11-01' })
    await backend.methods.createIssue(ctx, { source: 'local', projectKey: 'ME', summary: 'Outside', dueDate: '2026-12-01' })
    let jql = ''
    global.fetch = async (_url, opts) => {
      jql = JSON.parse(opts.body).jql
      return { ok: true, status: 200, text: async () => JSON.stringify({ isLast: true, issues: [{ key: 'TEAM-1', fields: { summary: 'Team', duedate: '2026-11-15', project: { key: 'TEAM' } } }] }) }
    }
    try {
      const result = await backend.methods.calendarIssues(ctx, { start: '2026-11-01', end: '2026-12-01' })
      assert.deepEqual(result.issues.map((i) => i.key), ['ME-1', 'TEAM-1'])
      assert.equal(result.issues[1].dueDate, '2026-11-15')
      assert.match(jql, /assignee = currentUser/)
      assert.match(jql, /due >= "2026-11-01" AND due < "2026-12-01"/)
      await assert.rejects(backend.methods.calendarIssues(ctx, { start: '2026-02-30', end: '2026-12-01' }), /valid calendar/)
      global.fetch = async () => { throw new Error('offline') }
      const offline = await backend.methods.calendarIssues(ctx, { start: '2026-11-01', end: '2026-12-01' })
      assert.equal(offline.issues.length, 1)
      assert.match(offline.warning, /offline/)
    } finally { global.fetch = realFetch }
  })

  it('uses the Atlassian connection from the Connections page', async () => {
    stubFetch()
    backend._setCredentialSource(async () => ({ siteUrl: 'https://team.atlassian.net', email: 'c@example.invalid', token: 't1' }))
    const o = await backend.methods.getOverview(ctxFor())
    assert.equal(o.connection.connected, true)
    assert.equal(o.connection.via, 'connections')
    assert.equal(o.connection.displayName, 'Casey')
    assert.ok(calls.every(([url]) => url.startsWith('https://team.atlassian.net/')))
    global.fetch = realFetch
  })

  it('falls back to the token Jira+ saved before Connections existed', async () => {
    stubFetch()
    backend._setCredentialSource(async () => {
      throw new Error('Add an Atlassian connection on the Connections page first.')
    })
    const ctx = ctxFor()
    fs.writeFileSync(join(ctx.dataDir, 'connection.json'), JSON.stringify({ siteUrl: 'https://old.atlassian.net', email: 'o@example.invalid', token: 't0', encrypted: false }))
    const o = await backend.methods.getOverview(ctx)
    assert.equal(o.connection.via, 'legacy')
    assert.equal(o.connection.siteUrl, 'https://old.atlassian.net')
    const after = await backend.methods.forgetLegacyConnection(ctx)
    assert.equal(after.connected, false)
    global.fetch = realFetch
  })

  it('posts, edits and deletes real Jira comments and marks your own', async () => {
    const seen = []
    backend._setCredentialSource(async () => ({ siteUrl: 'https://team.atlassian.net', email: 'comments@example.invalid', token: 't1' }))
    const comment = (id, accountId, text) => ({
      id,
      author: { accountId, displayName: accountId === 'me1' ? 'Casey' : 'Sam' },
      body: textToAdf(text),
      created: '2026-11-12T10:00:00.000+0000',
      updated: '2026-11-12T10:00:00.000+0000',
    })
    global.fetch = async (url, opts) => {
      const path = new URL(url).pathname
      seen.push([opts.method, path, opts.body ? JSON.parse(opts.body) : undefined])
      let body = {}
      if (path.endsWith('/myself')) body = { accountId: 'me1', displayName: 'Casey' }
      else if (path.endsWith('/transitions')) body = { transitions: [] }
      else if (path.endsWith('/worklog')) body = { worklogs: [] }
      else if (path.includes('/search')) body = { isLast: true, issues: [] }
      else if (opts.method === 'DELETE') return { ok: true, status: 204, text: async () => '' }
      else if (path.endsWith('/comment')) body = comment('11', 'me1', 'Hello team')
      else if (path.includes('/comment/')) body = { ...comment('11', 'me1', 'Hello again'), updated: '2026-11-12T11:00:00.000+0000' }
      else
        body = {
          key: 'TEAM-1',
          fields: {
            summary: 'S', status: { name: 'To Do', statusCategory: { key: 'new' } }, issuetype: { name: 'Task' }, project: { key: 'TEAM' },
            comment: { total: 3, comments: [comment('10', 'other', 'Theirs'), comment('11', 'me1', 'Mine')] },
          },
        }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    }
    const ctx = ctxFor()
    const issue = await backend.methods.getIssue(ctx, { source: 'jira', key: 'TEAM-1' })
    assert.deepEqual(issue.comments.map((c) => [c.id, c.mine]), [['10', false], ['11', true]])
    assert.equal(issue.comments[0].authorId, undefined)
    assert.equal(issue.commentsCut, 1)

    const posted = await backend.methods.addComment(ctx, { source: 'jira', key: 'TEAM-1', body: ' Hello team ' })
    assert.equal(posted.mine, true)
    assert.deepEqual(seen.at(-1).slice(0, 2), ['POST', '/rest/api/3/issue/TEAM-1/comment'])
    assert.equal(adfToText(seen.at(-1)[2].body), 'Hello team')

    const edited = await backend.methods.updateComment(ctx, { source: 'jira', key: 'TEAM-1', id: '11', body: 'Hello again' })
    assert.equal(edited.body, 'Hello again')
    assert.ok(edited.updated)
    assert.deepEqual(seen.at(-1).slice(0, 2), ['PUT', '/rest/api/3/issue/TEAM-1/comment/11'])

    await backend.methods.deleteComment(ctx, { source: 'jira', key: 'TEAM-1', id: '11' })
    assert.deepEqual(seen.at(-1).slice(0, 2), ['DELETE', '/rest/api/3/issue/TEAM-1/comment/11'])

    await assert.rejects(backend.methods.deleteComment(ctx, { source: 'jira', key: 'TEAM-1', id: '../x' }), /Unknown comment/)
    await assert.rejects(backend.methods.addComment(ctx, { source: 'jira', key: 'TEAM-1', body: ' ' }), /Write something/)
    global.fetch = realFetch
  })

  it('reports a broken connection without hiding private projects', async () => {
    backend._setCredentialSource(async () => {
      throw new Error('Windows Credential Manager has no entry named "jira".')
    })
    const ctx = ctxFor()
    await backend.methods.createLocalProject(ctx, { key: 'ME', name: 'Personal' })
    const o = await backend.methods.getOverview(ctx)
    assert.equal(o.connection.connected, false)
    assert.match(o.connection.error, /Credential Manager/)
    assert.deepEqual(o.projects.map((p) => p.key), ['ME'])
  })

  it('keeps the JQL as a Jira+ setting', async () => {
    backend._setCredentialSource(async () => {
      throw new Error('Add an Atlassian connection on the Connections page first.')
    })
    const ctx = ctxFor()
    const c = await backend.methods.saveSettings(ctx, { scopeJql: 'reporter = currentUser()' })
    assert.equal(c.scopeJql, 'reporter = currentUser()')
    assert.equal((await backend.methods.getOverview(ctx)).connection.scopeJql, 'reporter = currentUser()')
  })
})

describe('repository links', () => {
  const { createRepoLinks } = require('./repo-links.cjs')
  const fresh = () => {
    const dir = mkdtempSync(join(tmpdir(), 'jira-plus-links-'))
    return { dir, links: createRepoLinks(dir) }
  }

  it('links a task to local and GitHub repos and finds them from either side', async () => {
    const { dir, links } = fresh()
    await links.link({ source: 'local', key: 'me-4' }, { path: 'C:/Repos/app', name: 'app', github: 'acme/app' })
    await links.link({ source: 'jira', key: 'PLAT-12' }, { github: 'acme/app' })
    await links.link({ source: 'jira', key: 'PLAT-12' }, { path: 'C:/Repos/tools', name: 'tools' })

    const me = await links.forIssue({ source: 'local', key: 'ME-4' })
    assert.equal(me.length, 1)
    assert.equal(me[0].repo.kind, 'local')
    assert.equal(me[0].repo.github, 'acme/app')

    // A local clone sees links made to its GitHub copy, and the GitHub copy sees links made to the clone.
    const clone = await links.forRepo({ path: 'C:/Repos/app', github: 'acme/app' })
    assert.deepEqual(clone.map((l) => l.issue.key).sort(), ['ME-4', 'PLAT-12'])
    const onGitHub = await links.forRepo({ github: 'ACME/app' })
    assert.deepEqual(onGitHub.map((l) => l.issue.key).sort(), ['ME-4', 'PLAT-12'])
    const localOnly = await links.forRepo({ path: 'C:/Repos/tools' })
    assert.deepEqual(localOnly.map((l) => l.issue.key), ['PLAT-12'])
    assert.deepEqual(await links.forRepo({}), [])

    // Linking again does not duplicate.
    await links.link({ source: 'local', key: 'ME-4' }, { path: 'C:/Repos/app', name: 'app', github: 'acme/app' })
    assert.equal((await links.forIssue({ source: 'local', key: 'ME-4' })).length, 1)

    const counts = await links.counts()
    assert.equal(counts.github['acme/app'], 2)

    // Only keys, folders and names are stored.
    const stored = JSON.parse(fs.readFileSync(join(dir, 'repo-links.json'), 'utf8'))
    assert.equal(stored.version, 1)
    assert.deepEqual(Object.keys(stored.links[0]).sort(), ['issue', 'linkedAt', 'repo'])

    const plat = await links.forIssue({ source: 'jira', key: 'PLAT-12' })
    assert.equal(await links.unlink({ source: 'jira', key: 'PLAT-12' }, plat[0].id), true)
    assert.equal((await links.forIssue({ source: 'jira', key: 'PLAT-12' })).length, 1)
    await links.removeIssue({ source: 'local', key: 'ME-4' })
    assert.equal((await links.forRepo({ github: 'acme/app' })).length, 0)
  })

  it('keeps concurrent links and rejects bad input', async () => {
    const { links } = fresh()
    await Promise.all(Array.from({ length: 10 }, (_, n) => links.link({ source: 'local', key: `ME-${n + 1}` }, { github: 'acme/app' })))
    assert.equal((await links.forRepo({ github: 'acme/app' })).length, 10)
    await assert.rejects(links.link({ source: 'other', key: 'ME-1' }, { github: 'acme/app' }))
    await assert.rejects(links.link({ source: 'local', key: '../x' }, { github: 'acme/app' }))
    await assert.rejects(links.link({ source: 'local', key: 'ME-1' }, { github: 'not a repo' }))
    await assert.rejects(links.link({ source: 'local', key: 'ME-1' }, {}))
  })
})
