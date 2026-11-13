// Release notes: the "What's new" text of each GitHub release.
//
// Written by CI (scripts/release-notes.cjs) from the pull requests merged since
// the previous release, and read back by the settings backend so the update
// pop-up and Settings can list what changed since the installed version.
// No Electron dependency: CI and the tests load this file under plain Node.
//
// A release body looks like this (Markdown, so it also reads well on GitHub):
//
//   <!-- monorail-notes v1 -->
//   - **Wiki pages link to each other**: guides open from links, with previews. (#84)
//   - **Update pop-up**: MonoRail checks for updates by itself. (#83)
//
// Where the text comes from: a "## What's new" section in the PR description
// (plain language for people using the app, one bullet per change, written
// "**Short title**: one sentence"); without one, the PR title. Anything that
// looks like a personal path or an email address is removed, because release
// notes are public.

const MARKER = '<!-- monorail-notes v1 -->'

/** Remove things that must never be in public notes: home-folder paths, emails, HTML comments. */
function sanitize(text) {
  return String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[A-Za-z]:\\Users\\[^\s`)'"]*/gi, '')
    .replace(/(?:^|(?<=[\s`(]))(?:\/home|\/Users)\/[^\s`)'"]*/g, '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** The bullets of a PR description's "## What's new" section (also "Release notes"), or []. */
function whatsNewSection(body) {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((l) => /^#{1,4}\s*(what['’]s new|release notes)\s*$/i.test(l.trim()))
  if (start < 0) return []
  const out = []
  let current = null
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,4}\s/.test(line.trim()) || /^---+\s*$/.test(line.trim())) break
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (current) out.push(current)
      current = bullet[1].trim()
    } else if (line.trim()) {
      current = current ? `${current} ${line.trim()}` : line.trim()
    } else if (current) {
      out.push(current)
      current = null
    }
  }
  if (current) out.push(current)
  return out.map(sanitize).filter(Boolean)
}

/** "Area: thing" PR titles read fine as a title on their own. */
function titleItem(title) {
  return `**${sanitize(title).replace(/\*\*/g, '')}**`
}

/**
 * Markdown release body for a list of merged PRs ({ number, title, body }),
 * oldest first.
 */
function formatNotes(prs) {
  const lines = [MARKER]
  for (const pr of prs) {
    const items = whatsNewSection(pr.body)
    const list = items.length ? items : [titleItem(pr.title)]
    for (const item of list) lines.push(`- ${item} (#${pr.number})`)
  }
  if (lines.length === 1) lines.push('- Maintenance and small fixes.')
  return lines.join('\n') + '\n'
}

/** Turn Markdown inline marks into plain text for the app. */
function plain(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .trim()
}

/**
 * Parse a release body into items { title, text, pr }. Bodies CI wrote before
 * these notes existed ("Built from <sha>.") give [].
 */
function parseNotes(body) {
  const src = String(body ?? '').replace(/\r\n/g, '\n')
  if (!src.includes(MARKER)) return []
  const items = []
  for (const line of src.split('\n')) {
    const m = /^\s*[-*]\s+(.*)$/.exec(line)
    if (!m) continue
    let rest = m[1].trim()
    let pr
    const prMatch = /\s*\(#(\d+)\)\s*$/.exec(rest)
    if (prMatch) {
      pr = Number(prMatch[1])
      rest = rest.slice(0, prMatch.index)
    }
    let title = ''
    let text = rest
    const lead = /^\*\*(.+?)\*\*\s*[:.–—-]?\s*(.*)$/.exec(rest)
    if (lead) {
      title = plain(lead[1])
      text = lead[2]
    }
    text = plain(sanitize(text))
    title = sanitize(title)
    if (!title && !text) continue
    if (!title) {
      title = text
      text = ''
    }
    items.push({ title, text, ...(pr ? { pr } : {}) })
  }
  return items
}

/** Compare dotted versions numerically: -1, 0 or 1. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.+-]/).map((n) => Number(n) || 0)
  const pb = String(b).replace(/^v/, '').split(/[.+-]/).map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

/**
 * From GitHub's release list, the notes of every release newer than `current`
 * and no newer than `latest`, newest first: [{ version, date, items }].
 * Releases with no notes are kept with items [] so the caller can count them.
 */
function changesSince(releases, current, latest) {
  return releases
    .filter((r) => r && !r.draft && !r.prerelease && typeof r.tag_name === 'string')
    .map((r) => ({ version: r.tag_name.replace(/^v/, ''), date: r.published_at ?? undefined, items: parseNotes(r.body) }))
    .filter((r) => compareVersions(r.version, current) > 0 && (!latest || compareVersions(r.version, latest) <= 0))
    .sort((a, b) => compareVersions(b.version, a.version))
}

module.exports = { MARKER, sanitize, whatsNewSection, formatNotes, parseNotes, compareVersions, changesSince }
