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
