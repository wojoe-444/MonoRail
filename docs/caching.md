---
audience: ai
---

# Caching in MonoRail

Every cache in MonoRail goes through one shared primitive in
`apps/command-hub/electron/cache/`, and every cache is declared in one place:
`electron/cache/declared.cjs`. This page lists the rules and how to use the
primitive. The rules are numbered so code and tests can point at them.

## Rules for caches

**A1. Every cache is rebuildable and declared.** Deleting a cache file loses
nothing: the next build makes it again. Each cache is listed in `CACHES` in
`declared.cjs` with its tier, file, version and time limits, and every other
file a backend keeps in its data folder (settings, encrypted tokens) is listed
in `DATA_FILES`. Opening an undeclared cache throws. A test fails on any
`*_FILE` constant that is not declared, and at startup MonoRail logs any
undeclared file it finds in a declared data folder (it never deletes one).
Snapshots (`history` tier, D2) are the one exception to "rebuildable": they
keep history, so deleting them loses it.

**A2. Each source states whether message content may be cached.** Every cache
has a `content` policy (`derived`, or `messages`) and a one-line `policy`.
A cache of message content must also say what it does not cover (`coverage`),
because a message missing from the cache may still exist, and its page must
say so. Sources that are deliberately not cached are in `NOT_CACHED`:

| Source | Policy |
| --- | --- |
| Email | Mail is fetched on demand and never written to disk, by design. |
| Chat | Logs are read in place and never copied or cached to disk. Nothing from a transcript (titles and previews included) is persisted; only running cost numbers per session (costs.json) and list flags per chat id (chat-state.json: last seen, unread, archived, started here). |
| Jira Cloud | Tickets are fetched on demand and not cached. |
| Claude Stats | Derived only: token counts, costs, models, projects and session ids. Never prompt or reply text. |

**A3. Cache files are written atomically.** `writeAtomic` writes a temporary
sibling (`<file>.<pid>.<random>.tmp`), flushes it and renames it over the old
file. A reader sees the old file or the new one, never half of one.

**A4. One refresh at a time.** A build takes `<file>.lock` (created
exclusively, holding the pid and start time). A second request, from the same
process or another one, waits for the running build and reuses its result; it
never starts another read. A waiting request gives up after the cache's
`waitMs` and reports `building: true`, and the page keeps polling. A lock left
by a dead process, or older than the build time limit, is broken.

## Freshness

**B1. Each cache has its own time limit,** set in `declared.cjs` and nowhere
else, with a test that checks the values:

| Cache | Limit |
| --- | --- |
| `claude-stats.usage` | fresh 15 min, rebuilt every 15 min, retried 1 h after a failure |
| `connections.connector-check` | 15 min |
| `connections.sign-in` | 15 min after a success, 2 min after a failure |
| `agent-chat.recent` | 10 s, cleared when the chat list changes |
| `connections.summary` | rewritten after every connection check; reads as stale after 1 h |

**B2. A cached check is keyed to its definition.** `keyed(id).get(key, fn, {
definition })` stores a SHA-256 hash of the definition (a connector's config,
for example) with the result. An edited definition no longer matches and the
old result is discarded at once. Only the hash is stored, never the definition.

**B3. A cache is cleared on change, not only on expiry.** Call
`invalidate(key)` when the user sends, saves or archives something the cached
result depends on, or pass `force: true` for that one call.

**B4. Growing files are read from where the last read stopped.**
`incremental(ctx, id, { init, reduce }).read(key, file)` stores the byte offset
it reached and a hash of the file's first bytes, and parses only the complete
lines added since. A file that shrank, or whose start changed, was rewritten
and is read from the start. The state is saved to disk, so it survives a
restart, with the declared version: an older format is rebuilt, never misread.
What `reduce` returns is what is stored, so the `content` policy applies to it.

## Refresh and failure

**C1. A failed refresh backs off.** After a failure, a build that was not
forced does not run again until `failureTtlMs` has passed, and that interval
is kept apart from the success interval. The backoff is stored in
`<file>.status.json`, so a restart does not reset it. The page shows when the
next automatic try is.

**C2. The last good result is shown with its age.** A failed build never
replaces the last good result. Every page that shows cached data shows when it
was built (`CacheStatusBadge`) and marks it stale once it is older than its
limit.

**C3. Pages never start a slow read on open.** Opening a page calls `read()`,
which only reads the saved result. A slow build starts only from a button the
user presses (Refresh) or from the background schedule.

**C4. Expensive caches are rebuilt on a schedule** while the app runs
(`schedule(report)` from a backend's `start(ctx)`; checked every minute and
shortly after startup). The current result stays readable until the new one
replaces it.

**C5. Refresh bypasses the cache** (`refresh({ force: true })`): it skips the
freshness check and the failure backoff, but still shares a running build.

## Summaries and saved results

**D1. Home reads small summary files only.** After each good build, a module
writes a small summary (`writeSummary(ctx, '<module>.summary', data)`), and
the `home` backend's `getSummaries` reads only those files. Loading Home never
starts a read or a scan.

**D2. Snapshots answer "what changed".** A periodic scan (for example disk
usage every 3 days) adds a snapshot with `history(ctx, id).add(data, { csvRow
})`. `lastTwo()` gives the current and previous snapshot; the newest `keep`
are kept, and an optional CSV history is appended next to the file.

**D3. Expensive on-demand checks keep their last reading.** Declare a
`reading` cache with `failureTtlMs: Infinity` and no schedule: the page shows
the saved reading and its time, and takes a new one only when the user asks
(`refresh({ force: true })`).

**D4. Failed scans retry at most hourly.** Every scheduled cache has
`failureTtlMs` of at least an hour (a test checks this), and the page says the
last attempt failed and why.

## Kept as it is

- The Refresh button that bypasses the cache (C5).
- A time limit on every external read: ccusage keeps its 5-minute limit, and
  every report build has a `timeoutMs` that fails the build and frees the lock.
- The version number on the Claude Stats cache (now the declared `version`).
- Mail is not cached on disk (A2).

## Adding a cache

1. Add an entry to `CACHES` in `electron/cache/declared.cjs`. Pick the tier,
   the limits and the content policy; write the one-line policy.
2. Open it from the backend:

   ```js
   const cache = require('../cache/index.cjs')

   // An expensive report, rebuilt on a schedule
   const report = cache.report(ctx, 'my-module.report', { build: () => readEverything() })
   module.exports = {
     id: 'my-module',
     start: (ctx) => cache.schedule(report),
     methods: {
       get: async (ctx, args) => (args?.refresh ? report.refresh({ force: true }) : report.read()),
     },
   }

   // A keyed check
   const checks = cache.keyed('my-module.check')
   const result = await checks.get(kind, () => runCheck(conn), { definition: conn, failed: (r) => r.state !== 'ok' })
   ```

3. On the page, show `<CacheStatusBadge status={data.cache} />` and poll with
   `useCachePolling(status, reload)` (`src/lib/cache.ts`), which re-reads every
   few seconds while a build runs and every minute otherwise.
4. Add a test next to the backend, and run `npm test`: the declaration tests
   check the new entry.
