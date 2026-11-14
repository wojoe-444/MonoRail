// Collect the complete available patch and guidance from the PR's base SHA.
// Refuse partial diffs: a clean result must never imply an incomplete PR was reviewed.
const github = require('../connections/github-api.cjs')

const REPO_RE = /^[A-Za-z0-9_.-]+[/][A-Za-z0-9_.-]+$/
const SHA_RE = /^[a-f0-9]{40}$/i
const PATH_RE = /^[A-Za-z0-9_.\/-]+$/
const MAX_GUIDANCE_FILES = 100

function guidancePaths(files) {
  const dirs = new Set([''])
  for (const file of files) {
    if (typeof file.filename !== 'string' || !PATH_RE.test(file.filename) || file.filename.split('/').some((p) => !p || p === '.' || p === '..')) throw new Error('A changed path cannot be safely read through the GitHub connection.')
    const parts = file.filename.split('/').slice(0, -1)
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  }
  const paths = [...dirs].flatMap((d) => ['AGENTS.md', 'CLAUDE.md'].map((name) => d ? `${d}/${name}` : name))
  if (paths.length > MAX_GUIDANCE_FILES) throw new Error('This PR touches too many directories to collect all repository guidance.')
  return paths
}

async function collect({ credentials, repository, number }, api = github) {
  if (!REPO_RE.test(repository) || !Number.isInteger(number) || number < 1) throw new Error('Invalid repository or pull request number.')
  const prefix = `repos/${repository}`
  const { data: pr } = await api.request(credentials, { path: `${prefix}/pulls/${number}` })
  const base = pr?.base?.sha
  if (!SHA_RE.test(base ?? '')) throw new Error('GitHub did not return the PR base revision.')
  const listed = await api.list(credentials, `${prefix}/pulls/${number}/files`, {}, { maxPages: 3 })
  const incomplete = (f) => {
    if (typeof f.patch !== 'string' || !Number.isInteger(f.additions) || !Number.isInteger(f.deletions)) return true
    const lines = f.patch.split('\n')
    return lines.filter((line) => line.startsWith('+')).length !== f.additions || lines.filter((line) => line.startsWith('-')).length !== f.deletions
  }
  if (listed.truncated || !listed.items.length || listed.items.some(incomplete)) throw new Error('GitHub did not provide a complete textual patch for this PR; no review was run.')
  const guidance = []
  for (const file of guidancePaths(listed.items)) {
    try {
      const { data } = await api.request(credentials, { path: `${prefix}/contents/${file}`, query: { ref: base } })
      if (data?.encoding !== 'base64' || typeof data.content !== 'string') throw new Error(`Could not read repository guidance ${file}.`)
      guidance.push({ path: file, text: Buffer.from(data.content, 'base64').toString('utf8') })
    } catch (e) {
      if (e.status !== 404) throw e
    }
  }
  const diff = listed.items.map((f) => `File: ${f.filename}\n${f.patch}`).join('\n\n')
  return { repository, number, title: pr.title, base, head: pr.head?.sha, guidance, diff }
}

module.exports = { collect, _internal: { guidancePaths } }
