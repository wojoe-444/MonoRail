// GitHub+ search: code, files, commits, history and issues of local repos.
//
// What a hosted search can't do, because it only sees pushed code on one
// branch: search the working folder (uncommitted and new files included),
// any branch, tag or commit, several refs at once, the whole history (git's
// pickaxe: the commits that added or removed a text), and every repo the
// user opened, offline.
//
// Read-only like the rest of GitHub+: only the local git binary runs, with
// the same per-call config that keeps repo settings from running programs
// (no textconv, external diff or fsmonitor). The search text always goes to
// git as one argument after `-e` (or glued to its option, `--grep=...`,
// `-S...`), so it can never be read as an option; refs are checked with
// assertRef and resolved first; paths are filtered here, in JS, and passed to
// git only as pathspecs after `--`. Results are capped and a running search
// is killed when a newer one on the same channel starts. Nothing is written
// to disk: results are repo content.

const { spawn } = require('node:child_process')

const git = require('./git.cjs')
const issues = require('./issues.cjs')

const LIMITS = {
  code: 300, // matching lines per repo
  files: 100,
  commits: 50,
  history: 30,
  issues: 50,
}
/** Cross-repo searches keep each repo's share smaller. */
const ALL_LIMITS = { code: 60, files: 20, commits: 15, history: 8, issues: 15 }
const TIME_LIMIT_MS = { code: 30_000, files: 20_000, commits: 20_000, history: 45_000, issues: 20_000 }
const MAX_LINE_CHARS = 400
const MAX_TEXT = 500
const KINDS = ['code', 'files', 'commits', 'history', 'issues']

// --- Query ---------------------------------------------------------------

/** File extensions per `lang:` name. Unknown names are used as an extension. */
const LANGS = {
  ts: ['ts', 'tsx', 'mts', 'cts'],
  typescript: ['ts', 'tsx', 'mts', 'cts'],
  js: ['js', 'jsx', 'mjs', 'cjs'],
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  py: ['py', 'pyi'],
  python: ['py', 'pyi'],
  cs: ['cs'],
  csharp: ['cs'],
  go: ['go'],
  rs: ['rs'],
  rust: ['rs'],
  java: ['java'],
  kt: ['kt', 'kts'],
  kotlin: ['kt', 'kts'],
  rb: ['rb'],
  ruby: ['rb'],
  php: ['php'],
  c: ['c', 'h'],
  cpp: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'h'],
  swift: ['swift'],
  md: ['md', 'markdown'],
  markdown: ['md', 'markdown'],
  json: ['json', 'jsonc'],
  yaml: ['yml', 'yaml'],
  yml: ['yml', 'yaml'],
  css: ['css', 'scss', 'less'],
  html: ['html', 'htm'],
  sql: ['sql'],
  sqlx: ['sqlx'],
  sh: ['sh', 'bash', 'zsh'],
  shell: ['sh', 'bash', 'zsh'],
  ps: ['ps1', 'psm1', 'psd1'],
  powershell: ['ps1', 'psm1', 'psd1'],
  toml: ['toml'],
  xml: ['xml'],
}

const QUALIFIERS = new Set(['repo', 'path', '-path', 'lang', 'language', 'ref', 'author', 'before', 'after', 'def', 'is', 'case', 'word', 'regex'])
const MAX_QUERY = 1000

/** Splits on spaces, keeping "quoted phrases" (and key:"quoted values") together. */
function tokens(raw) {
  const out = []
  const re = /(-?[a-z]+):"([^"]*)"|(-?[a-z]+):(\S+)|"([^"]*)"|(\S+)/gi
  let m
  while ((m = re.exec(raw))) {
    if (m[1] !== undefined) out.push({ key: m[1].toLowerCase(), value: m[2], raw: m[0] })
    else if (m[3] !== undefined) out.push({ key: m[3].toLowerCase(), value: m[4], raw: m[0] })
    else if (m[5] !== undefined) out.push({ text: m[5], quoted: true })
    else out.push({ text: m[6] })
  }
  return out
}

const yes = (v) => /^(yes|true|on|1|sensitive)$/i.test(v)
const clean = (v) => String(v).replace(/[\0\r\n]/g, '').slice(0, 200)

/**
 * The search box's text as a structured query:
 *   free text (one pattern; "quotes" keep spaces), /regex/,
 *   repo:  path:  -path:  lang:  ref:main,feat/x  ref:working
 *   author:  before:  after:  def:Name  is:open|closed  case:yes  word:yes
 * `opts` (the page's toggles) fill regex, caseSensitive and word.
 */
function parseQuery(raw, opts = {}) {
  if (typeof raw !== 'string') raw = ''
  raw = raw.slice(0, MAX_QUERY)
  const q = {
    text: '',
    regex: opts.regex === true,
    caseSensitive: opts.caseSensitive === true,
    word: opts.word === true,
    repos: [],
    paths: [],
    notPaths: [],
    langs: [],
    refs: [],
    author: null,
    before: null,
    after: null,
    def: null,
    state: null,
  }
  const words = []
  for (const t of tokens(raw)) {
    if (t.key && QUALIFIERS.has(t.key)) {
      const v = clean(t.value)
      if (!v) continue
      if (t.key === 'repo') q.repos.push(v)
      else if (t.key === 'path') q.paths.push(v)
      else if (t.key === '-path') q.notPaths.push(v)
      else if (t.key === 'lang' || t.key === 'language') q.langs.push(v.toLowerCase())
      else if (t.key === 'ref') q.refs.push(...v.split(',').map((r) => r.trim()).filter(Boolean))
      else if (t.key === 'author') q.author = v
      else if (t.key === 'before') q.before = v
      else if (t.key === 'after') q.after = v
      else if (t.key === 'def') q.def = v
      else if (t.key === 'is' && /^(open|closed)$/i.test(v)) q.state = v.toLowerCase()
      else if (t.key === 'case') q.caseSensitive = yes(v)
      else if (t.key === 'word') q.word = yes(v)
      else if (t.key === 'regex') q.regex = yes(v)
    } else words.push(t.key ? t.raw : t.text)
  }
  let text = words.join(' ').replace(/[\0\r\n]/g, ' ').trim()
  const rx = /^\/(.+)\/$/.exec(text)
  if (rx) {
    text = rx[1]
    q.regex = true
  }
  q.text = text
  q.refs = [...new Set(q.refs)].slice(0, 4)
  if (q.before && !/^\d{4}-\d{2}-\d{2}$/.test(q.before)) q.before = null
  if (q.after && !/^\d{4}-\d{2}-\d{2}$/.test(q.after)) q.after = null
  if (q.def && !/^[\w$.:-]{1,100}$/.test(q.def)) q.def = null
  return q
}

/** True when a query has something to look for. */
function hasTerms(q) {
  return !!(q.text || q.def || q.paths.length || q.langs.length || q.author)
}

// --- Paths ---------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** path: values. With * or ? it is a glob over the whole path; otherwise "contains". Case-insensitive. */
function pathTest(value) {
  const v = value.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!/[*?]/.test(v)) {
    const low = v.toLowerCase()
    return (p) => p.toLowerCase().includes(low)
  }
  const re = new RegExp(
    '(^|/)' +
      v
        .split(/(\*\*\/?|\*|\?)/)
        .map((part) => (part === '**/' || part === '**' ? '.*' : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : escapeRe(part)))
        .join('') +
      '$',
    'i',
  )
  return (p) => re.test(p)
}

function extsOf(q) {
  return [...new Set(q.langs.flatMap((l) => LANGS[l] ?? [l.replace(/^\./, '')]))].filter((e) => /^[\w+-]{1,16}$/.test(e))
}

/** A filter for paths that applies path:, -path: and lang:. */
function pathFilter(q) {
  const inc = q.paths.map(pathTest)
  const exc = q.notPaths.map(pathTest)
  const exts = extsOf(q).map((e) => e.toLowerCase())
  return (p) => {
    if (inc.length && !inc.some((t) => t(p))) return false
    if (exc.some((t) => t(p))) return false
    if (exts.length) {
      const base = p.slice(p.lastIndexOf('/') + 1).toLowerCase()
      if (!exts.some((e) => base.endsWith('.' + e))) return false
    }
    return true
  }
}

/** Pathspecs that narrow what git reads; the exact rules are applied again by pathFilter. */
function pathspecs(q) {
  const out = []
  const exts = extsOf(q)
  if (q.paths.length) {
    for (const v of q.paths) {
      const s = v.replace(/\\/g, '/').replace(/^\/+/, '')
      out.push(`:(icase)${/[*?]/.test(s) ? (s.startsWith('*') ? s : `*${s}`) : `*${s}*`}`)
    }
  } else for (const e of exts) out.push(`:(icase)*.${e}`)
  for (const v of q.notPaths) {
    const s = v.replace(/\\/g, '/').replace(/^\/+/, '')
    out.push(`:(exclude,icase)${/[*?]/.test(s) ? (s.startsWith('*') ? s : `*${s}`) : `*${s}*`}`)
  }
  return out
}

// --- Patterns ------------------------------------------------------------

/** git grep / log flags and the pattern for the query's text (or def:). */
function pattern(q) {
  if (q.def) {
    const name = escapeRe(q.def)
    const kw = '(function|class|interface|type|enum|struct|trait|impl|module|namespace|record|def|fn|func|const|let|var|val|sub|procedure)'
    // A keyword then the name, or "name = (" / "name: function", at a word boundary.
    const p = `(^|[^A-Za-z0-9_$])(${kw}[[:space:]]+(async[[:space:]]+)?\\*?[[:space:]]*${name}([^A-Za-z0-9_$]|$)|${name}[[:space:]]*[:=][[:space:]]*(async[[:space:]]*)?(function|\\(|[A-Za-z_$]+[[:space:]]*=>))`
    return { text: p, regex: true, caseSensitive: true, word: false }
  }
  return { text: q.text, regex: q.regex, caseSensitive: q.caseSensitive, word: q.word }
}

// --- Process runner --------------------------------------------------------

/**
 * Runs git and hands stdout to `feed(chunk)` as it arrives; `feed` returns
 * true to stop early (the process is killed and what was read is kept).
 * Resolves with { code, stderr, stopped }. Killed on abort or after the time
 * limit (then `stopped: 'time'`). Runs inside git.cjs's process limit.
 */
function stream(cwd, args, { signal, timeoutMs, feed, okCodes = [0] }) {
  return git.slot(
    () =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError())
        const child = spawn('git', [...git.GIT_CONFIG, ...args], { cwd, windowsHide: true, env: git.GIT_ENV(), stdio: ['ignore', 'pipe', 'pipe'] })
        let stderr = ''
        let stopped = null
        let settled = false
        const kill = (why) => {
          if (stopped) return
          stopped = why
          if (child.exitCode === null) child.kill()
        }
        const timer = setTimeout(() => kill('time'), timeoutMs)
        const onAbort = () => kill('abort')
        signal?.addEventListener('abort', onAbort)
        const done = (fn) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          fn()
        }
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', (d) => {
          if (stopped) return
          if (feed(d)) kill('limit')
        })
        child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)))
        child.on('error', (e) =>
          done(() => reject(e.code === 'ENOENT' ? new Error('git was not found. Install Git for Windows and make sure it is on PATH.') : e)),
        )
        child.on('close', (code) =>
          done(() => {
            if (stopped === 'abort') return reject(abortError())
            if (stopped || okCodes.includes(code)) return resolve({ code, stopped })
            reject(new Error(friendlyError(stderr.trim()) || `git exited with ${code}`))
          }),
        )
      }),
  )
}

function abortError() {
  return Object.assign(new Error('Search cancelled'), { name: 'AbortError' })
}

function friendlyError(msg) {
  if (/invalid regular expression|unmatched|regcomp|Invalid preceding regular expression|brace|parentheses/i.test(msg)) {
    return `That regular expression is not valid: ${msg.replace(/^fatal: /, '')}`
  }
  return msg.replace(/^fatal: /, '')
}

/** Collects a whole (capped) output. */
async function collect(cwd, args, { signal, timeoutMs, maxBytes = 8 * 1024 * 1024, okCodes }) {
  let out = ''
  const r = await stream(cwd, args, {
    signal,
    timeoutMs,
    okCodes,
    feed: (d) => {
      out += d
      return out.length > maxBytes
    },
  })
  return { out, stopped: r.stopped }
}

// --- Refs ------------------------------------------------------------------

/**
 * The refs a query searches: [] means the working folder. `ref:working`
 * mixes the working folder with committed refs. Each ref is checked and
 * must exist.
 */
async function resolveRefs(repo, q, fallback) {
  const names = q.refs.length ? q.refs : fallback ? [fallback] : []
  const out = []
  let working = names.length === 0
  for (const r of names) {
    if (/^(working|worktree|wt)$/i.test(r)) {
      working = true
      continue
    }
    git.assertRef(r)
    await git.resolveCommit(repo, r)
    out.push(r)
  }
  return { refs: out, working }
}

// --- Code ----------------------------------------------------------------

/**
 * Matching lines (with one line of context) from `git grep`, grouped by
 * file. Each ref in q.refs is searched; with none (or ref:working) the
 * working folder is searched: tracked files as they are now, plus new files
 * that .gitignore does not hide.
 */
async function searchCode(repo, q, { limit = LIMITS.code, signal, defaultRef } = {}) {
  const pat = pattern(q)
  if (!pat.text) return { files: [], matches: 0, truncated: false }
  const { refs, working } = await resolveRefs(repo, q, defaultRef)
  const filter = pathFilter(q)
  const runs = []
  if (working) runs.push(null)
  runs.push(...refs)
  const files = []
  let matches = 0
  let truncated = false
  for (const ref of runs) {
    if (matches >= limit) {
      truncated = true
      break
    }
    const args = ['grep', '-n', '-z', '--column', '-I', '--no-color', '-C', '1', '--no-textconv']
    if (!pat.caseSensitive) args.push('-i')
    if (pat.word) args.push('-w')
    args.push(pat.regex ? '-E' : '-F')
    if (ref === null) args.push('--untracked')
    args.push('-e', pat.text)
    if (ref !== null) args.push(ref)
    args.push('--', ...pathspecs(q))
    const prefix = ref === null ? '' : `${ref}:`
    const byFile = new Map()
    let buf = ''
    let found = 0
    // The context line before a file's first match arrives before the file is known.
    let before = null
    let skipped = false
    const take = (line) => {
      if (!line || line === '--') return
      const parts = line.split('\0')
      if (parts.length < 3) return
      let file = parts[0]
      if (prefix && file.startsWith(prefix)) file = file.slice(prefix.length)
      if (!filter(file)) return
      // Match lines carry a column ("file\0line\0col\0text"); context lines do not.
      const isMatch = parts.length >= 4
      // Full: keep the context line right after the last match, drop the rest.
      if (matches + found >= limit) {
        if (isMatch) skipped = true
        else if (!skipped) {
          const f = byFile.get(file)
          const last = f?.lines[f.lines.length - 1]
          if (last?.match && Number(parts[1]) === last.n + 1) f.lines.push({ n: last.n + 1, text: parts.slice(2).join('\0').slice(0, MAX_LINE_CHARS), match: false })
        }
        return
      }
      const n = Number(parts[1])
      const text = (isMatch ? parts.slice(3).join('\0') : parts.slice(2).join('\0')).slice(0, MAX_LINE_CHARS)
      let f = byFile.get(file)
      if (!f) {
        if (!isMatch) {
          before = { file, n, text }
          return
        }
        f = { ref, path: file, matches: 0, lines: [] }
        if (before?.file === file && before.n === n - 1) f.lines.push({ n: before.n, text: before.text, match: false })
        byFile.set(file, f)
        files.push(f)
      }
      before = null
      if (isMatch) {
        f.matches++
        found++
      }
      const last = f.lines[f.lines.length - 1]
      if (last && last.n === n) {
        if (isMatch) last.match = true
        return
      }
      f.lines.push({ n, text, match: isMatch })
    }
    const r = await stream(repo, args, {
      signal,
      timeoutMs: TIME_LIMIT_MS.code,
      okCodes: [0, 1],
      feed: (d) => {
        buf += d
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const l of lines) take(l)
        return skipped
      },
    })
    if (!r.stopped) take(buf)
    if (r.stopped || skipped) truncated = true
    matches += found
  }
  // Drop trailing context after the last match of each file.
  for (const f of files) {
    while (f.lines.length && !f.lines[f.lines.length - 1].match) {
      const i = f.lines.length - 1
      if (i > 0 && f.lines[i - 1].match) break
      f.lines.pop()
    }
  }
  return { files, matches, truncated }
}

/** How many lines match (git grep -c), for saved searches. Same refs rules as searchCode. */
async function countCode(repo, q, { signal, defaultRef } = {}) {
  const pat = pattern(q)
  if (!pat.text) return 0
  const { refs, working } = await resolveRefs(repo, q, defaultRef)
  const filter = pathFilter(q)
  let total = 0
  for (const ref of [...(working ? [null] : []), ...refs]) {
    const args = ['grep', '-c', '-z', '-I', '--no-color', '--no-textconv']
    if (!pat.caseSensitive) args.push('-i')
    if (pat.word) args.push('-w')
    args.push(pat.regex ? '-E' : '-F')
    if (ref === null) args.push('--untracked')
    args.push('-e', pat.text)
    if (ref !== null) args.push(ref)
    args.push('--', ...pathspecs(q))
    const { out } = await collect(repo, args, { signal, timeoutMs: TIME_LIMIT_MS.code, okCodes: [0, 1] })
    const prefix = ref === null ? '' : `${ref}:`
    for (const line of out.split('\n')) {
      const [file, n] = line.split('\0')
      if (!file || !n) continue
      if (filter(prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file)) total += Number(n) || 0
    }
  }
  return total
}

// --- Files -----------------------------------------------------------------

const listMemo = git.memo(40)

/** Every file path at a ref (memoized by commit), or in the working folder (tracked plus new, not ignored). */
async function listFiles(repo, ref, signal) {
  if (ref === null) {
    const { out } = await collect(repo, ['ls-files', '-z', '-c', '-o', '--exclude-standard'], { signal, timeoutMs: TIME_LIMIT_MS.files })
    return [...new Set(out.split('\0').filter(Boolean))]
  }
  const sha = await git.resolveCommit(repo, ref)
  return listMemo.get(`${repo}\0${sha}`, async () => {
    const { out } = await collect(repo, ['ls-tree', '-r', '-z', '--name-only', sha], { timeoutMs: TIME_LIMIT_MS.files })
    return out.split('\0').filter(Boolean)
  })
}

/**
 * Scores a path against the text, fuzzy like a code editor's "go to file":
 * the whole text in the file name scores highest, then in the path, then
 * the letters in order (a gap costs a little). 0 means no match.
 */
function fuzzyScore(path, text) {
  if (!text) return 1
  const p = path.toLowerCase()
  const t = text.toLowerCase().replace(/\\/g, '/')
  const base = p.slice(p.lastIndexOf('/') + 1)
  if (base === t) return 1000
  if (base.startsWith(t)) return 900 - base.length
  if (base.includes(t)) return 800 - base.length
  if (p.includes(t)) return 600 - p.length / 10
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((w) => p.includes(w))) return 500 - p.length / 10
  const letters = t.replace(/[\s/]+/g, '')
  // Letters in order inside the file name beat letters spread over the path.
  const inBase = subsequenceGaps(base, letters)
  if (inBase >= 0) return Math.max(301, 450 - inBase * 15 - base.length)
  const inPath = subsequenceGaps(p, letters)
  if (inPath < 0) return 0
  return Math.max(1, 300 - inPath * 20 - p.length / 10)
}

/** How many gaps the letters need to appear in order in s; -1 when they don't. */
function subsequenceGaps(s, letters) {
  let i = 0
  let gaps = 0
  let last = -1
  for (const ch of letters) {
    const at = s.indexOf(ch, i)
    if (at < 0) return -1
    if (last >= 0 && at > last + 1) gaps++
    last = at
    i = at + 1
  }
  return gaps
}

/** Paths that match the text (fuzzy) and the path filters, best first. */
async function searchFiles(repo, q, { limit = LIMITS.files, signal, defaultRef } = {}) {
  if (!q.text && !q.paths.length && !q.langs.length) return { files: [], total: 0, truncated: false }
  if (q.regex && q.text) {
    let re
    try {
      re = new RegExp(q.text, q.caseSensitive ? '' : 'i')
    } catch {
      re = null
    }
    if (!re) return { files: [], total: 0, truncated: false }
  }
  const { refs, working } = await resolveRefs(repo, q, defaultRef)
  const ref = working ? null : refs[0]
  const filter = pathFilter(q)
  const all = (await listFiles(repo, ref, signal)).filter(filter)
  let scored
  if (q.regex && q.text) {
    const re = new RegExp(q.text, q.caseSensitive ? '' : 'i')
    scored = all.filter((p) => re.test(p)).map((p) => ({ path: p, score: 1 }))
  } else {
    scored = all.map((p) => ({ path: p, score: fuzzyScore(p, q.text) })).filter((x) => x.score > 0)
  }
  scored.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path))
  return { files: scored.slice(0, limit).map((x) => ({ ref, path: x.path })), total: scored.length, truncated: scored.length > limit }
}

// --- Commits ---------------------------------------------------------------

function logRefs(refs, working) {
  const list = [...refs]
  if (working && !list.length) list.push('HEAD')
  return list
}

/** Commit messages that match (git log --grep), plus a commit whose sha starts with the text. */
async function searchCommits(repo, q, { limit = LIMITS.commits, signal, defaultRef } = {}) {
  if (q.def || (!q.text && !q.author && !q.before && !q.after)) return { commits: [], truncated: false }
  const { refs, working } = await resolveRefs(repo, q, defaultRef)
  const revs = logRefs(refs, working)
  const args = ['log', `--format=${git.LOG_FMT}`, '-n', String(limit + 1)]
  if (q.text) {
    if (!q.caseSensitive) args.push('-i')
    args.push(q.regex ? '-E' : '-F', `--grep=${q.text}`)
  }
  if (q.author) args.push(`--author=${q.author}`)
  if (q.after) args.push(`--since=${q.after}`)
  if (q.before) args.push(`--until=${q.before}`)
  args.push(...revs, '--', ...pathspecs(q))
  const { out } = await collect(repo, args, { signal, timeoutMs: TIME_LIMIT_MS.commits, okCodes: [0] })
  let commits = git.parseLog(out)
  if (q.text && /^[0-9a-f]{4,40}$/i.test(q.text)) {
    const sha = await git.resolveCommit(repo, q.text).catch(() => null)
    if (sha && !commits.some((c) => c.sha === sha)) {
      const { out: one } = await collect(repo, ['show', '-s', `--format=${git.LOG_FMT}`, sha, '--'], { signal, timeoutMs: TIME_LIMIT_MS.commits })
      commits = [...git.parseLog(one), ...commits]
    }
  }
  return { commits: commits.slice(0, limit), truncated: commits.length > limit }
}

// --- History (pickaxe) -------------------------------------------------------

const HIST_FMT = '%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1f%b%x1d'

/**
 * Commits whose changes added or removed the text (git log -S), or changed
 * a line matching the regex (-G), with the files involved, newest first.
 * This walks diffs of the whole history, so it runs only when asked for.
 */
async function searchHistory(repo, q, { limit = LIMITS.history, signal, defaultRef } = {}) {
  const pat = pattern(q)
  if (!pat.text) return { commits: [], truncated: false }
  const { refs, working } = await resolveRefs(repo, q, defaultRef)
  const revs = logRefs(refs, working)
  const args = ['log', `--format=${HIST_FMT}`, '--name-only', '--no-textconv', '--no-ext-diff', '-n', String(limit + 1)]
  if (!pat.caseSensitive) args.push('-i')
  args.push(pat.regex ? `-G${pat.text}` : `-S${pat.text}`)
  if (q.author) args.push(`--author=${q.author}`)
  if (q.after) args.push(`--since=${q.after}`)
  if (q.before) args.push(`--until=${q.before}`)
  args.push(...revs, '--', ...pathspecs(q))
  const { out, stopped } = await collect(repo, args, { signal, timeoutMs: TIME_LIMIT_MS.history, okCodes: [0] })
  const filter = pathFilter(q)
  const commits = []
  for (const rec of out.split('\x1e')) {
    const end = rec.indexOf('\x1d')
    if (end < 0) continue
    const [c] = git.parseLog(rec.slice(0, end) + '\x1e')
    if (!c) continue
    const files = rec
      .slice(end + 1)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(filter)
    commits.push({ ...c, files: files.slice(0, 20), moreFiles: Math.max(0, files.length - 20) })
  }
  return { commits: commits.slice(0, limit), truncated: commits.length > limit || stopped === 'time' }
}

// --- Issues ----------------------------------------------------------------

function textTest(q) {
  const pat = pattern(q)
  if (!pat.text) return () => true
  if (pat.regex) {
    let re
    try {
      re = new RegExp(pat.text, pat.caseSensitive ? '' : 'i')
    } catch {
      return () => false
    }
    return (s) => re.test(s)
  }
  if (pat.caseSensitive) return (s) => s.includes(pat.text)
  const low = pat.text.toLowerCase()
  return (s) => s.toLowerCase().includes(low)
}

/** A short piece of `s` around the first match. */
function snippet(s, test, q) {
  const lines = s.split(/\r?\n/)
  const hit = lines.find((l) => test(l)) ?? lines[0] ?? ''
  const t = hit.trim()
  if (t.length <= MAX_TEXT) return t
  const low = t.toLowerCase()
  const at = q.text && !q.regex ? Math.max(0, low.indexOf(q.text.toLowerCase()) - 80) : 0
  return (at ? '…' : '') + t.slice(at, at + MAX_TEXT) + '…'
}

/** Local issues whose number, title, description or comments match. */
async function searchIssues(repo, q, { limit = LIMITS.issues } = {}) {
  if (q.def || (!q.text && !q.author && !q.state)) return { issues: [], truncated: false }
  const test = textTest(q)
  const { issues: all } = await issues.readAll(repo)
  const num = /^#?(\d+)$/.exec(q.text)
  const out = []
  for (const i of [...all].sort((a, b) => b.number - a.number)) {
    if (q.state && i.state !== q.state) continue
    if (q.author && !i.author.toLowerCase().includes(q.author.toLowerCase())) continue
    let where = null
    let text = ''
    if (!q.text || (num && Number(num[1]) === i.number)) where = 'number'
    else if (test(i.title)) where = 'title'
    else if (test(i.body)) {
      where = 'description'
      text = snippet(i.body, test, q)
    } else {
      const c = i.timeline.find((t) => t.kind === 'comment' && typeof t.body === 'string' && test(t.body))
      if (c) {
        where = 'comment'
        text = snippet(c.body, test, q)
      }
    }
    if (!where) continue
    out.push({
      number: i.number,
      title: i.title,
      state: i.state,
      author: i.author,
      updatedAt: i.updatedAt,
      comments: i.timeline.filter((t) => t.kind === 'comment').length,
      where,
      snippet: text,
    })
  }
  return { issues: out.slice(0, limit), truncated: out.length > limit }
}

// --- One repo, every kind ------------------------------------------------------

/**
 * Runs the asked-for kinds for one repo. A kind that fails reports its own
 * error and does not stop the others. `defaultRef` is used when the query
 * names no ref: null means the working folder.
 */
async function searchRepo(repo, q, { kinds, limits = LIMITS, signal, defaultRef = null } = {}) {
  const want = (Array.isArray(kinds) ? kinds : ['code', 'files', 'commits', 'issues']).filter((k) => KINDS.includes(k))
  const fns = { code: searchCode, files: searchFiles, commits: searchCommits, history: searchHistory, issues: searchIssues }
  const out = {}
  await Promise.all(
    want.map(async (k) => {
      try {
        out[k] = await fns[k](repo, q, { limit: limits[k], signal, defaultRef })
      } catch (e) {
        if (e.name === 'AbortError') throw e
        out[k] = { error: e.message }
      }
    }),
  )
  return out
}

// --- Line history ------------------------------------------------------------

const MAX_LINE_COMMITS = 25
const MAX_HUNK_LINES = 40

/**
 * "Since when?" for one line: who last changed it (git blame) and every
 * commit that changed it, with the lines it changed (git log -L).
 */
async function lineHistory(repo, ref, filePath, line, { signal } = {}) {
  git.assertRef(ref)
  const p = git.assertPath(filePath)
  const n = Math.trunc(Number(line))
  if (!p || !Number.isFinite(n) || n < 1 || n > 10_000_000) throw new Error('Invalid line')
  const sha = await git.resolveCommit(repo, ref)
  const blameRun = collect(repo, ['blame', '--porcelain', '-L', `${n},${n}`, sha, '--', p], { signal, timeoutMs: 30_000 })
  const logRun = collect(
    repo,
    ['log', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--no-textconv', '--no-ext-diff', '-n', String(MAX_LINE_COMMITS), `-L${n},${n}:${p}`, sha],
    { signal, timeoutMs: 45_000, maxBytes: 4 * 1024 * 1024 },
  )
  const [blame, log] = await Promise.all([blameRun, logRun])
  let last = null
  const b = blame.out.split('\n')
  const head = /^([0-9a-f]{40,64}) \d+ \d+/.exec(b[0] ?? '')
  if (head) {
    const field = (k) => b.find((l) => l.startsWith(k + ' '))?.slice(k.length + 1) ?? ''
    const time = Number(field('author-time'))
    last = {
      sha: head[1],
      authorName: field('author'),
      date: Number.isFinite(time) && time > 0 ? new Date(time * 1000).toISOString() : '',
      subject: field('summary'),
      text: (b.find((l) => l.startsWith('\t')) ?? '').slice(1),
    }
  }
  const commits = []
  for (const rec of log.out.split('\x1e')) {
    if (!rec.trim()) continue
    const nl = rec.indexOf('\n')
    const [csha, authorName, date, subject] = (nl < 0 ? rec : rec.slice(0, nl)).split('\x1f')
    if (!/^[0-9a-f]{40,64}$/.test(csha ?? '')) continue
    const body = nl < 0 ? '' : rec.slice(nl + 1)
    const at = body.indexOf('\n@@')
    const hunk = (at < 0 ? '' : body.slice(at + 1))
      .split('\n')
      .filter((l) => /^[ +-]/.test(l) && !/^(\+\+\+|---) /.test(l))
      .slice(0, MAX_HUNK_LINES)
      .map((l) => ({ kind: l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx', text: l.slice(1, MAX_LINE_CHARS + 1) }))
    commits.push({ sha: csha, shortSha: csha.slice(0, 7), authorName, date, subject, lines: hunk })
  }
  return { ref, path: p, line: n, last, commits, truncated: commits.length >= MAX_LINE_COMMITS }
}

// --- Channels ------------------------------------------------------------------

/** One running search per channel (a page's box): a newer search cancels the older one. */
const channels = new Map()

function channel(name) {
  const key = typeof name === 'string' && /^[a-z0-9-]{1,32}$/.test(name) ? name : 'default'
  channels.get(key)?.abort()
  const ctl = new AbortController()
  channels.set(key, ctl)
  return {
    signal: ctl.signal,
    done: () => channels.get(key) === ctl && channels.delete(key),
  }
}

/** Public view of a query, for the page's chips. */
function describe(q) {
  const { text, regex, caseSensitive, word, repos, paths, notPaths, langs, refs, author, before, after, def, state } = q
  return { text, regex, caseSensitive, word, repos, paths, notPaths, langs, refs, author, before, after, def, state }
}

module.exports = {
  LIMITS,
  ALL_LIMITS,
  KINDS,
  parseQuery,
  hasTerms,
  describe,
  pathFilter,
  pathspecs,
  fuzzyScore,
  searchCode,
  countCode,
  searchFiles,
  searchCommits,
  searchHistory,
  searchIssues,
  searchRepo,
  lineHistory,
  channel,
}
