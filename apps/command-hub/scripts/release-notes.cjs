// CI only: write the "What's new" notes of a GitHub release from the pull
// requests merged since the previous release (format and rules in
// electron/release-notes.cjs). Needs the GitHub CLI with GH_TOKEN and
// GITHUB_REPOSITORY set.
//
//   node scripts/release-notes.cjs --to <sha> --out notes.md
//       Notes for a new release at <sha>: PRs merged since the latest release.
//   node scripts/release-notes.cjs --backfill <n> [--force]
//       Rewrite the notes of the newest <n> releases (only those without
//       notes, unless --force).
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { MARKER, formatNotes, compareVersions } = require('../electron/release-notes.cjs')

const repo = process.env.GITHUB_REPOSITORY
if (!repo) throw new Error('GITHUB_REPOSITORY is not set (this script is for CI).')

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 })
}

function api(route) {
  return JSON.parse(gh(['api', '-H', 'Accept: application/vnd.github+json', route]))
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Published releases, newest version first. */
function releases() {
  const out = []
  for (let page = 1; page <= 5; page++) {
    const batch = api(`repos/${repo}/releases?per_page=100&page=${page}`)
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out
    .filter((r) => !r.draft && !r.prerelease)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))
}

let prCache
/** Recently merged PRs into main (the newest 500 closed ones is plenty). */
function mergedPrs() {
  if (prCache) return prCache
  prCache = []
  for (let page = 1; page <= 5; page++) {
    const batch = api(`repos/${repo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100&page=${page}`)
    prCache.push(...batch.filter((p) => p.merged_at))
    if (batch.length < 100) break
  }
  return prCache
}

/** Commit shas reachable from `to` but not from `from`. */
function commitsBetween(from, to) {
  const shas = new Set()
  for (let page = 1; page <= 10; page++) {
    const cmp = api(`repos/${repo}/compare/${from}...${to}?per_page=100&page=${page}`)
    for (const c of cmp.commits ?? []) shas.add(c.sha)
    if ((cmp.commits ?? []).length < 100) break
  }
  return shas
}

/** PRs whose merge (or squash) commit lands between the two refs, oldest first. */
function prsBetween(from, to) {
  const shas = from ? commitsBetween(from, to) : null
  return mergedPrs()
    .filter((p) => (shas ? shas.has(p.merge_commit_sha) : p.merge_commit_sha === to))
    .sort((a, b) => a.merged_at.localeCompare(b.merged_at))
    .map((p) => ({ number: p.number, title: p.title, body: p.body ?? '' }))
}

function newRelease() {
  const to = arg('--to')
  const out = arg('--out')
  if (!to || !out) throw new Error('Usage: --to <sha> --out <file>')
  const prev = releases()[0]
  const prs = prsBetween(prev?.tag_name, to)
  fs.writeFileSync(out, formatNotes(prs))
  console.log(`notes for ${prs.length} pull request(s) since ${prev?.tag_name ?? 'the start'}`)
}

function backfill() {
  const n = Number(arg('--backfill'))
  const force = process.argv.includes('--force')
  if (!(n > 0)) throw new Error('Usage: --backfill <count> [--force]')
  const list = releases()
  for (let i = 0; i < Math.min(n, list.length); i++) {
    const r = list[i]
    if (!force && (r.body ?? '').includes(MARKER)) continue
    const prev = list[i + 1]
    const prs = prsBetween(prev?.tag_name, r.tag_name)
    const file = path.join(os.tmpdir(), `notes-${r.tag_name}.md`)
    fs.writeFileSync(file, formatNotes(prs))
    gh(['release', 'edit', r.tag_name, '--notes-file', file, '--repo', repo])
    console.log(`${r.tag_name}: ${prs.length} pull request(s)`)
  }
}

if (process.argv.includes('--backfill')) backfill()
else newRelease()
