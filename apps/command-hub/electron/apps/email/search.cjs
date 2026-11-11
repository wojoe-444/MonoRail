// Merging one search over several accounts (the Email app's searchAccounts).
// Pure, so it is tested without Electron.

/**
 * results: [{ accountId, page?: { threads, timedOut?, partial? }, error? }]
 * in the order the user picked the accounts.
 * Threads come back newest first, each tagged with its accountId. A mail
 * that turns up in several accounts (same internet message ID, e.g. a
 * shared mailbox you were also sent a copy in) is listed once, under the
 * first account, with the others in alsoIn.
 */
function mergeSearch(results, { limit = 100 } = {}) {
  const threads = []
  const byKey = new Map()
  const errors = []
  const partial = []
  for (const r of results) {
    if (r.error) {
      errors.push({ accountId: r.accountId, error: r.error })
      continue
    }
    if (r.page?.partial || r.page?.timedOut) partial.push({ accountId: r.accountId, message: r.page.partial ?? 'Stopped early.' })
    for (const t of r.page?.threads ?? []) {
      const key = t.dedupeKey ? String(t.dedupeKey).toLowerCase() : null
      const seen = key ? byKey.get(key) : null
      if (seen) {
        if (seen.accountId !== r.accountId && !seen.alsoIn.includes(r.accountId)) seen.alsoIn.push(r.accountId)
        continue
      }
      const row = { ...t, accountId: r.accountId, alsoIn: [] }
      if (key) byKey.set(key, row)
      threads.push(row)
    }
  }
  threads.sort((a, b) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0))
  return { threads: threads.slice(0, limit), truncated: threads.length > limit, errors, partial }
}

module.exports = { mergeSearch }
