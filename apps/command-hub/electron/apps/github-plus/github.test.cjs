// GitHub+ and github.com: remote parsing, the opt-in gate, the repo list and
// issues created on GitHub. GitHub itself is stubbed; nothing goes online.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const { createGitHubService, parseGitHubRemote, pickGitHubRemote } = require('./github.cjs')
const githubApi = require('../../connections/github-api.cjs')
const connector = require('../../connections/connectors/github.cjs')
const { SAFE_ARG } = require('../../connections/run.cjs')
const issues = require('./issues.cjs')
const git = require('./git.cjs')

const repoJson = (full, extra = {}) => ({ full_name: full, owner: { login: full.split('/')[0], type: 'User' }, private: false, permissions: { push: true }, pushed_at: '2026-01-01T00:00:00Z', default_branch: 'main', ...extra })

describe('github remotes', () => {
  it('reads owner/name from https, ssh and scp remotes, and nothing else', () => {
    assert.equal(parseGitHubRemote('https://github.com/acme/web.git'), 'acme/web')
    assert.equal(parseGitHubRemote('https://someone@github.com/acme/web'), 'acme/web')
    assert.equal(parseGitHubRemote('git@github.com:acme/web.git'), 'acme/web')
    assert.equal(parseGitHubRemote('ssh://git@github.com/acme/my.repo.git'), 'acme/my.repo')
    assert.equal(parseGitHubRemote('https://gitlab.com/acme/web.git'), null)
    assert.equal(parseGitHubRemote('https://github.com.evil.example/acme/web'), null)
    assert.equal(parseGitHubRemote('https://github.com/acme/web/tree/main'), null)
  })

  it('prefers origin, then upstream', () => {
    const remotes = [
      { name: 'upstream', url: 'https://github.com/team/app.git' },
      { name: 'origin', url: 'git@github.com:me/app.git' },
    ]
    assert.equal(pickGitHubRemote(remotes), 'me/app')
    assert.equal(pickGitHubRemote(remotes.slice(0, 1)), 'team/app')
    assert.equal(pickGitHubRemote([{ name: 'origin', url: '/some/folder' }]), null)
  })
})

describe('github service', () => {
  it('runs nothing until GitHub is set up', async () => {
    let calls = 0
    const svc = createGitHubService({ hasConnection: async () => false, getCredentials: async () => { calls++; return { via: 'gh' } }, deps: { runTool: async () => { calls++; return {} } } })
    assert.deepEqual(await svc.repos(), { connected: false, repos: [] })
    await assert.rejects(svc.createIssue('acme/web', { title: 't', body: '' }), /Connections/)
    assert.equal(calls, 0)
  })

  it('lists owned, organization and shared repos through gh, with safe arguments only', async () => {
    const seen = []
    const runTool = async (cmd, args, opts) => {
      seen.push({ cmd, args, opts })
      for (const a of [cmd, ...args]) assert.match(a, SAFE_ARG)
      if (args[1] === 'user') return { code: 0, stdout: JSON.stringify({ login: 'me' }), stderr: '' }
      const page = Number(args.find((a) => a.startsWith('page=')).split('=')[1])
      const items = page === 1
        ? [repoJson('me/notes'), repoJson('acme/platform', { owner: { login: 'acme', type: 'Organization' }, private: true }), repoJson('friend/tool')]
        : []
      return { code: 0, stdout: JSON.stringify(items), stderr: '' }
    }
    const svc = createGitHubService({ hasConnection: async () => true, getCredentials: async () => ({ via: 'gh' }), deps: { runTool } })
    const r = await svc.repos()
    assert.equal(r.connected, true)
    assert.equal(r.login, 'me')
    assert.deepEqual(r.repos.map((x) => [x.fullName, x.relation, x.private]), [['me/notes', 'owner', false], ['acme/platform', 'organization', true], ['friend/tool', 'collaborator', false]])
    // Default affiliation of /user/repos: owner, collaborator and organization member.
    assert.ok(seen.some((s) => s.args[1] === 'user/repos' && !s.args.some((a) => a.startsWith('affiliation'))))
    // Cached: a second open asks nobody.
    const before = seen.length
    await svc.repos()
    assert.equal(seen.length, before)
    assert.ok(svc.known('ACME/platform'))
  })

  it('keeps the last good list when a refresh fails', async () => {
    let fail = false
    const fetch = async (url) => {
      if (fail) throw Object.assign(new Error('offline'), { cause: { code: 'ENOTFOUND' } })
      const body = url.includes('/user/repos') ? [repoJson('me/a')] : { login: 'me' }
      return { ok: true, status: 200, json: async () => body, headers: { get: () => 'repo' } }
    }
    const svc = createGitHubService({ hasConnection: async () => true, getCredentials: async () => ({ via: 'token', token: 'x' }), deps: { fetch } })
    assert.equal((await svc.repos()).repos.length, 1)
    fail = true
    const r = await svc.repos({ force: true })
    assert.match(r.error, /Could not reach GitHub/)
    assert.equal(r.repos.length, 1)
  })

  it('creates an issue with the body on stdin, never on the command line', async () => {
    let call
    const runTool = async (cmd, args, opts) => {
      call = { args, opts }
      return { code: 0, stdout: JSON.stringify({ number: 7 }), stderr: '' }
    }
    const svc = createGitHubService({ hasConnection: async () => true, getCredentials: async () => ({ via: 'gh' }), deps: { runTool } })
    const link = await svc.createIssue('acme/web', { title: 'Spaces & "quotes"', body: 'a\nb' })
    assert.deepEqual(link, { repo: 'acme/web', number: 7, url: 'https://github.com/acme/web/issues/7' })
    assert.deepEqual(call.args, ['api', 'repos/acme/web/issues', '-X', 'POST', '--input', '-'])
    assert.deepEqual(JSON.parse(call.opts.input), { title: 'Spaces & "quotes"', body: 'a\nb' })
    await assert.rejects(svc.createIssue('not a repo', { title: 't' }), /github.com remote/)
  })
})

describe('github api client', () => {
  it('refuses paths and parameters that could leave the API', async () => {
    const creds = { via: 'token', token: 'x' }
    await assert.rejects(githubApi.request(creds, { path: '../evil' }), /Invalid/)
    await assert.rejects(githubApi.request(creds, { path: 'user?x=1' }), /Invalid/)
    await assert.rejects(githubApi.request(creds, { path: 'user', query: { 'a b': 1 } }), /Invalid/)
    await assert.rejects(githubApi.request(creds, { path: 'user', method: 'DELETE' }), /Unsupported/)
    await assert.rejects(githubApi.request(undefined, { path: 'user' }), /Connections/)
  })

  it('turns gh failures into readable errors', async () => {
    const run = (r) => async () => ({ code: 1, stdout: '', stderr: '', ...r })
    await assert.rejects(githubApi.request({ via: 'gh' }, { path: 'user' }, { runTool: run({ notFound: true }) }), /cli.github.com/)
    await assert.rejects(githubApi.request({ via: 'gh' }, { path: 'user' }, { runTool: run({ stderr: 'To get started with GitHub CLI, please run:  gh auth login' }) }), (e) => e.status === 401)
    await assert.rejects(githubApi.request({ via: 'gh' }, { path: 'repos/a/b/issues' }, { runTool: run({ stderr: 'gh: Issues are disabled (HTTP 410)', stdout: '{"message":"Issues are disabled for this repo"}' }) }), /turned off/)
  })
})

describe('github connector', () => {
  it('hands out gh or a token, and reports the account', async () => {
    assert.deepEqual(await connector.credentials({ values: { source: 'gh' }, secrets: {} }), { via: 'gh' })
    assert.deepEqual(await connector.credentials({ values: { source: 'direct' }, secrets: { token: 't' } }), { via: 'token', token: 't' })
    assert.deepEqual(await connector.credentials({ values: { source: 'wincred', credentialTarget: 'gh-token' }, secrets: {} }, { readCredential: async () => ({ secret: 'w' }) }), { via: 'token', token: 'w' })
    assert.throws(() => connector.validate({ values: { source: 'direct' }, secretsSet: {} }), /token/)
    const s = await connector.status({ values: { source: 'gh' }, secrets: {} }, { runTool: async () => ({ code: 0, stdout: '{"login":"me"}', stderr: '' }) })
    assert.equal(s.state, 'ok')
    assert.match(s.summary, /me/)
    const expired = await connector.status({ values: { source: 'gh' }, secrets: {} }, { runTool: async () => ({ code: 1, stdout: '', stderr: 'please run: gh auth login' }) })
    assert.equal(expired.state, 'expired')
  })

  it('flags a classic token without the repo scope', () => {
    assert.equal(connector._internal.scopeDetail('read:org, gist').ok, false)
    assert.equal(connector._internal.scopeDetail('repo, read:org').ok, true)
    assert.equal(connector._internal.scopeDetail(undefined), undefined)
  })
})

describe('local issues linked to GitHub', () => {
  it('records the GitHub link and keeps it through edits', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghp-gh-'))
    execFileSync('git', ['init', '-q', dir])
    execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', 'https://github.com/acme/web.git'])
    assert.deepEqual(await git.remotes(dir), [{ name: 'origin', url: 'https://github.com/acme/web.git' }])
    const local = await issues.createIssue(dir, { title: 'Only here' })
    assert.equal(local.github, null)
    const linked = await issues.createIssue(dir, { title: 'Published', github: { repo: 'acme/web', number: 12 } })
    assert.deepEqual(linked.github, { repo: 'acme/web', number: 12, url: 'https://github.com/acme/web/issues/12' })
    const edited = await issues.updateIssue(dir, linked.number, { state: 'closed' })
    assert.equal(edited.github.number, 12)
    const list = await issues.listIssues(dir, 'all')
    assert.equal(list.find((i) => i.number === linked.number).github.repo, 'acme/web')
    await assert.rejects(issues.createIssue(dir, { title: 'x', github: { repo: 'bad repo', number: 1 } }), /Invalid GitHub link/)
  })
})
