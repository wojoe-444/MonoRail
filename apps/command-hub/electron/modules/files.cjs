// Files (Tools > Files): a file explorer for this PC (docs/files.md).
//
// The page sends absolute paths; every one is checked here (absolute, no NUL,
// normalized) and names typed by the user are checked against Windows' rules.
// Reads are bounded (listing size, preview bytes, search and folder-size walks
// stop on a count and a time limit; links and junctions are never followed by
// a walk). Writes are only the ones the user asks for on the page: new folder,
// new file, rename, copy, move and Move to Recycle Bin (never a permanent
// delete). Nothing is cached or written to the module's data folder; pins,
// tags and tabs are the person's preferences in the page (prefs).
// Remote access refuses the whole backend (electron/remote/policy.cjs): the
// PC's files are not served to a phone.

const fs = require('node:fs')
const fsp = fs.promises
const os = require('node:os')
const path = require('node:path')

const LIST_LIMIT = 20000
const PREVIEW_TEXT_BYTES = 256 * 1024
const PREVIEW_IMAGE_BYTES = 12 * 1024 * 1024
const SEARCH_MAX_VISITED = 60000
const SEARCH_MAX_RESULTS = 500
const SEARCH_MS = 8000
const SIZE_MAX_ENTRIES = 400000
const SIZE_MS = 20000
const PASTE_MAX = 1000
const STAT_MANY_MAX = 500

const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

const TEXT_EXT = new Set(
  (
    'txt md markdown mdx log csv tsv json jsonc json5 yml yaml toml ini cfg conf env xml html htm css scss less js mjs cjs jsx ts tsx mts cts ' +
    'py rb go rs java kt kts c h cpp hpp cc cs fs swift php pl lua r sql sh bash zsh ps1 psm1 bat cmd vue svelte astro graphql gql proto ' +
    'gitignore gitattributes editorconfig dockerfile makefile lock properties gradle tf hcl nix dart ex exs erl clj scala vb'
  ).split(' '),
)

// Names Windows (or the shell) keeps out of sight. The Windows hidden
// attribute needs a native call, so the common ones are listed by name.
const HIDDEN_NAMES = new Set([
  'desktop.ini',
  'thumbs.db',
  '$recycle.bin',
  'system volume information',
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  'dumpstack.log',
  'dumpstack.log.tmp',
  'config.msi',
  'recovery',
  '$windows.~bt',
  '$windows.~ws',
  '$winreagent',
  '$sysreset',
  '$getcurrent',
  'documents and settings',
  'msocache',
])
// Old junctions in the home folder that Windows itself hides (and refuses to open).
const HOME_LEGACY = new Set(['appdata', 'application data', 'cookies', 'local settings', 'my documents', 'nethood', 'printhood', 'recent', 'sendto', 'start menu', 'templates'])
// Folders a search skips unless hidden items are shown: huge and rarely what anyone looks for.
const SEARCH_SKIP = new Set(['node_modules', '.git', '$recycle.bin', 'system volume information'])

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

class FilesError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

/** An absolute, normalized path from the page, or a thrown error. */
function absPath(p) {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0')) throw new FilesError('That is not a valid location.', 'bad-path')
  if (!path.isAbsolute(p)) throw new FilesError('Use a full path, such as C:\\Users.', 'bad-path')
  // "C:" alone means the drive's current folder to Windows; treat it as the drive root.
  if (/^[a-z]:$/i.test(p)) p += path.sep
  return path.resolve(p)
}

/** A file or folder name the user typed, or a thrown error saying what is wrong. */
function checkName(name) {
  if (typeof name !== 'string') throw new FilesError('Type a name.', 'bad-name')
  const n = name.trim()
  if (!n) throw new FilesError('Type a name.', 'bad-name')
  if (n.length > 255) throw new FilesError('That name is too long (255 characters at most).', 'bad-name')
  if (n === '.' || n === '..') throw new FilesError('That name is not allowed.', 'bad-name')
  // eslint-disable-next-line no-control-regex
  if (/[<>:"/\\|?*\x00-\x1f]/.test(n)) throw new FilesError('A name cannot contain any of these: \\ / : * ? " < > |', 'bad-name')
  if (/[. ]$/.test(n)) throw new FilesError('A name cannot end with a dot or a space.', 'bad-name')
  if (RESERVED.test(n)) throw new FilesError(`Windows reserves the name "${n}".`, 'bad-name')
  return n
}

/** A plain-language message for a file system error. */
function friendly(err, what = 'it') {
  const code = err && err.code
  if (err instanceof FilesError) return err
  const msg =
    code === 'ENOENT'
      ? `${cap(what)} is no longer there.`
      : code === 'EPERM' || code === 'EACCES'
        ? `Windows refused access to ${what}.`
        : code === 'EEXIST' || code === 'ENOTEMPTY'
          ? 'Something with that name is already there.'
          : code === 'EBUSY'
            ? `${cap(what)} is in use by another program.`
            : code === 'ENOTDIR'
              ? `${cap(what)} is not a folder.`
              : code === 'ENOSPC'
                ? 'The drive is full.'
                : (err && err.message) || 'Something went wrong.'
  return new FilesError(msg, code || 'error')
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function extOf(name) {
  const base = name.toLowerCase()
  if (base.startsWith('.') && base.indexOf('.', 1) === -1) return base.slice(1)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1) : base === 'dockerfile' || base === 'makefile' ? base : ''
}

function isHidden(name, dir, home = os.homedir()) {
  const lower = name.toLowerCase()
  if (name.startsWith('.') || HIDDEN_NAMES.has(lower) || lower.startsWith('ntuser.')) return true
  return !!dir && samePath(dir, home) && HOME_LEGACY.has(lower)
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** One entry for the page: name, full path, kind, size, times. */
async function entryOf(dir, name, home) {
  const full = path.join(dir, name)
  const base = { name, path: full, ext: extOf(name), hidden: isHidden(name, dir, home) }
  let st
  try {
    st = await fsp.lstat(full)
  } catch {
    return { ...base, kind: 'other', size: 0, modified: 0, created: 0, locked: true }
  }
  let link = false
  if (st.isSymbolicLink()) {
    link = true
    try {
      st = await fsp.stat(full)
    } catch {
      return { ...base, kind: 'other', size: 0, modified: 0, created: 0, link, locked: true }
    }
  }
  const kind = st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other'
  return {
    ...base,
    ext: kind === 'dir' ? '' : base.ext,
    kind,
    size: kind === 'file' ? st.size : 0,
    modified: st.mtimeMs,
    created: st.birthtimeMs || st.ctimeMs,
    ...(link ? { link } : {}),
  }
}

/** The git repository a folder is in (root and branch), read from .git/HEAD; no git process. */
async function gitInfo(dir) {
  let cur = dir
  for (let i = 0; i < 64; i++) {
    const dotGit = path.join(cur, '.git')
    try {
      const st = await fsp.stat(dotGit)
      let gitDir = dotGit
      if (st.isFile()) {
        const m = /^gitdir:\s*(.+)$/m.exec(await fsp.readFile(dotGit, 'utf8'))
        if (!m) return null
        gitDir = path.resolve(cur, m[1].trim())
      }
      const head = (await fsp.readFile(path.join(gitDir, 'HEAD'), 'utf8')).trim()
      const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)
      return { root: cur, branch: ref ? ref[1] : head.slice(0, 7), detached: !ref }
    } catch {
      /* not here */
    }
    const up = path.dirname(cur)
    if (up === cur) return null
    cur = up
  }
  return null
}

async function list(dirArg, { showHidden = false, home = os.homedir() } = {}) {
  const dir = absPath(dirArg)
  let names
  try {
    const st = await fsp.stat(dir)
    if (!st.isDirectory()) throw Object.assign(new Error('not a dir'), { code: 'ENOTDIR' })
    names = await fsp.readdir(dir)
  } catch (e) {
    throw friendly(e, 'this folder')
  }
  const truncated = names.length > LIST_LIMIT
  if (truncated) names = names.slice(0, LIST_LIMIT)
  const all = await Promise.all(names.map((n) => entryOf(dir, n, home)))
  const entries = showHidden ? all : all.filter((e) => !e.hidden)
  const up = path.dirname(dir)
  return {
    path: dir,
    name: path.basename(dir) || dir,
    parent: up === dir ? null : up,
    entries,
    hiddenCount: all.length - entries.length,
    truncated,
    git: await gitInfo(dir),
  }
}

async function preview(fileArg) {
  const file = absPath(fileArg)
  let st
  try {
    st = await fsp.stat(file)
  } catch (e) {
    throw friendly(e, 'this item')
  }
  const base = { path: file, name: path.basename(file) || file, size: st.size, modified: st.mtimeMs, created: st.birthtimeMs || st.ctimeMs, accessed: st.atimeMs }
  if (st.isDirectory()) {
    let items = null
    let folders = 0
    try {
      const ents = await fsp.readdir(file, { withFileTypes: true })
      items = ents.length
      folders = ents.filter((d) => d.isDirectory()).length
    } catch {
      /* not readable */
    }
    return { ...base, kind: 'dir', size: 0, items, folders, git: await gitInfo(file) }
  }
  const ext = extOf(base.name)
  if (IMAGE_MIME[ext]) {
    if (st.size > PREVIEW_IMAGE_BYTES) return { ...base, kind: 'image', ext, tooBig: true }
    const buf = await fsp.readFile(file).catch((e) => {
      throw friendly(e, 'this file')
    })
    return { ...base, kind: 'image', ext, dataUrl: `data:${IMAGE_MIME[ext]};base64,${buf.toString('base64')}` }
  }
  // Read the head once: text if the extension says so, or if it has no NUL bytes.
  const handle = await fsp.open(file, 'r').catch((e) => {
    throw friendly(e, 'this file')
  })
  try {
    const len = Math.min(st.size, PREVIEW_TEXT_BYTES)
    const buf = Buffer.alloc(len)
    const { bytesRead } = len ? await handle.read(buf, 0, len, 0) : { bytesRead: 0 }
    const head = buf.subarray(0, bytesRead)
    const looksText = !head.subarray(0, 8192).includes(0)
    if ((TEXT_EXT.has(ext) || (looksText && st.size < 4 * 1024 * 1024)) && looksText) {
      let text = head.toString('utf8')
      if (bytesRead < st.size) text = text.replace(/[\uFFFD]$/, '') // a character cut at the limit
      return { ...base, kind: 'text', ext, text, truncated: bytesRead < st.size, lines: text.split('\n').length }
    }
  } finally {
    await handle.close()
  }
  return { ...base, kind: 'binary', ext }
}

/** "name (2).ext", "name (3).ext", ... the first one not taken in dir. */
async function uniqueTarget(dir, name) {
  const first = path.join(dir, name)
  if (!(await exists(first))) return first
  const i = name.lastIndexOf('.')
  const [stem, ext] = i > 0 ? [name.slice(0, i), name.slice(i)] : [name, '']
  for (let n = 2; n < 10000; n++) {
    const p = path.join(dir, `${stem} (${n})${ext}`)
    if (!(await exists(p))) return p
  }
  throw new FilesError('Too many copies with that name.', 'EEXIST')
}

async function exists(p) {
  try {
    await fsp.lstat(p)
    return true
  } catch {
    return false
  }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child)
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
}

async function paste({ sources, dir: dirArg, mode }) {
  if (mode !== 'copy' && mode !== 'move') throw new FilesError('Unknown paste mode.', 'bad-args')
  if (!Array.isArray(sources) || !sources.length) return { done: [], failed: [], pairs: [] }
  if (sources.length > PASTE_MAX) throw new FilesError(`Paste at most ${PASTE_MAX} items at once.`, 'too-many')
  const dir = absPath(dirArg)
  const dst = await fsp.stat(dir).catch((e) => {
    throw friendly(e, 'the target folder')
  })
  if (!dst.isDirectory()) throw new FilesError('Paste into a folder.', 'ENOTDIR')
  const done = []
  const failed = []
  // from -> to for every item that landed, so the page can carry its pins and tags along.
  const pairs = []
  for (const s of sources) {
    let src
    try {
      src = absPath(s)
      const name = path.basename(src)
      if (!name) throw new FilesError('A whole drive cannot be copied or moved here.', 'bad-path')
      if (isInside(dir, src)) throw new FilesError('A folder cannot go inside itself.', 'into-self')
      if (mode === 'move' && samePath(path.dirname(src), dir)) {
        done.push(src) // already here
        continue
      }
      const target = await uniqueTarget(dir, name)
      if (mode === 'copy') {
        await fsp.cp(src, target, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, preserveTimestamps: true })
      } else {
        try {
          await fsp.rename(src, target)
        } catch (e) {
          if (e.code !== 'EXDEV') throw e
          // Another drive: copy, then remove the original only after the copy finished.
          await fsp.cp(src, target, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, preserveTimestamps: true })
          await fsp.rm(src, { recursive: true })
        }
      }
      done.push(target)
      pairs.push({ from: src, to: target })
    } catch (e) {
      failed.push({ name: typeof s === 'string' ? path.basename(s) : '?', error: friendly(e, 'it').message })
    }
  }
  return { done, failed, pairs }
}

function wildcard(query) {
  const q = query.trim().toLowerCase()
  if (!/[*?]/.test(q)) return (name) => name.toLowerCase().includes(q)
  const re = new RegExp(`^${q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i')
  return (name) => re.test(name)
}

/** Names matching query anywhere under dir. Breadth first, links never followed, bounded. */
async function search({ dir: dirArg, query, showHidden = false, home = os.homedir() }) {
  const dir = absPath(dirArg)
  if (typeof query !== 'string' || !query.trim()) return { results: [], truncated: false, visited: 0, ms: 0 }
  const match = wildcard(query)
  const started = Date.now()
  const results = []
  const queue = [dir]
  let visited = 0
  let truncated = false
  while (queue.length) {
    if (visited >= SEARCH_MAX_VISITED || Date.now() - started > SEARCH_MS || results.length >= SEARCH_MAX_RESULTS) {
      truncated = true
      break
    }
    const cur = queue.shift()
    let ents
    try {
      ents = await fsp.readdir(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const d of ents) {
      visited++
      const hidden = isHidden(d.name, cur, home)
      if (hidden && !showHidden) continue
      if (match(d.name) && results.length < SEARCH_MAX_RESULTS) results.push(await entryOf(cur, d.name, home))
      if (d.isDirectory() && !d.isSymbolicLink() && (showHidden || !SEARCH_SKIP.has(d.name.toLowerCase()))) queue.push(path.join(cur, d.name))
    }
  }
  return { results, truncated, visited, ms: Date.now() - started }
}

/** Total size of a folder: files counted once, links never followed, bounded. */
async function folderSize(dirArg) {
  const dir = absPath(dirArg)
  const started = Date.now()
  let bytes = 0
  let files = 0
  let dirs = 0
  let seen = 0
  let truncated = false
  const stack = [dir]
  while (stack.length) {
    if (seen >= SIZE_MAX_ENTRIES || Date.now() - started > SIZE_MS) {
      truncated = true
      break
    }
    const cur = stack.pop()
    let ents
    try {
      ents = await fsp.readdir(cur, { withFileTypes: true })
    } catch {
      continue
    }
    const fileStats = []
    for (const d of ents) {
      seen++
      const p = path.join(cur, d.name)
      if (d.isSymbolicLink()) continue
      if (d.isDirectory()) {
        dirs++
        stack.push(p)
      } else if (d.isFile()) fileStats.push(p)
    }
    const sizes = await Promise.all(fileStats.map((p) => fsp.lstat(p).then((s) => s.size, () => 0)))
    for (const s of sizes) bytes += s
    files += fileStats.length
  }
  return { path: dir, bytes, files, dirs, truncated, ms: Date.now() - started }
}

async function statMany(paths, home = os.homedir()) {
  if (!Array.isArray(paths)) return []
  const out = await Promise.all(
    paths.slice(0, STAT_MANY_MAX).map(async (p) => {
      try {
        const full = absPath(p)
        if (!path.basename(full) || !(await exists(full))) return null
        return entryOf(path.dirname(full), path.basename(full), home)
      } catch {
        return null
      }
    }),
  )
  return out.filter(Boolean)
}

async function withTimeout(promise, ms) {
  let t
  return Promise.race([promise, new Promise((resolve) => (t = setTimeout(() => resolve(null), ms)))]).finally(() => clearTimeout(t))
}

async function drives({ platform = process.platform, home = os.homedir() } = {}) {
  const roots = platform === 'win32' ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`) : ['/', ...(home.startsWith('/Volumes/') ? [home] : [])]
  const found = await Promise.all(
    roots.map(async (root) => {
      const s = await withTimeout(
        fsp.statfs(root).then(
          (v) => ({ total: v.blocks * v.bsize, free: v.bavail * v.bsize }),
          () => null,
        ),
        1500,
      )
      return s ? { path: root, label: platform === 'win32' ? root.slice(0, 2) : root, ...s } : null
    }),
  )
  return found.filter(Boolean)
}

/** Well-known folders that exist on this PC, plus the drives. */
async function places({ home = os.homedir(), env = process.env, getPath } = {}) {
  const special = (name, fallback) => {
    try {
      if (getPath) return getPath(name)
    } catch {
      /* not known */
    }
    return path.join(home, fallback)
  }
  const candidates = [
    { id: 'home', label: 'Home', path: home },
    { id: 'desktop', label: 'Desktop', path: special('desktop', 'Desktop') },
    { id: 'documents', label: 'Documents', path: special('documents', 'Documents') },
    { id: 'downloads', label: 'Downloads', path: special('downloads', 'Downloads') },
    { id: 'pictures', label: 'Pictures', path: special('pictures', 'Pictures') },
    { id: 'music', label: 'Music', path: special('music', 'Music') },
    { id: 'videos', label: 'Videos', path: special('videos', 'Videos') },
    { id: 'repos', label: 'Repos', path: path.join(home, 'Repos') },
    ...(env.OneDrive ? [{ id: 'onedrive', label: 'OneDrive', path: env.OneDrive }] : []),
  ]
  const seen = new Set()
  const out = []
  for (const c of candidates) {
    const key = c.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    try {
      if ((await fsp.stat(c.path)).isDirectory()) out.push(c)
    } catch {
      /* not on this PC */
    }
  }
  return { home, sep: path.sep, places: out, drives: await drives({ home }) }
}

function electronGetPath() {
  try {
    const { app } = require('electron')
    return app && typeof app.getPath === 'function' ? (n) => app.getPath(n) : undefined
  } catch {
    return undefined
  }
}

module.exports = {
  id: 'files',
  desktopOnly: ['open', 'reveal', 'trash'],
  methods: {
    async places() {
      return places({ getPath: electronGetPath() })
    },
    async list(_ctx, args) {
      return list(args && args.path, { showHidden: !!(args && args.showHidden) })
    },
    async preview(_ctx, args) {
      return preview(args && args.path)
    },
    /** A Windows shell thumbnail (images, video, PDF, Office), or null. */
    async thumbnail(_ctx, args) {
      const file = absPath(args && args.path)
      const size = Math.max(32, Math.min(512, Number(args && args.size) || 160))
      try {
        const { nativeImage } = require('electron')
        if (!nativeImage || typeof nativeImage.createThumbnailFromPath !== 'function') return null
        const img = await nativeImage.createThumbnailFromPath(file, { width: size, height: size })
        return img.isEmpty() ? null : img.toDataURL()
      } catch {
        return null
      }
    },
    async search(_ctx, args) {
      return search({ dir: args && args.dir, query: args && args.query, showHidden: !!(args && args.showHidden) })
    },
    async folderSize(_ctx, args) {
      return folderSize(args && args.path)
    },
    async statMany(_ctx, args) {
      return statMany(args && args.paths)
    },
    async createFolder(_ctx, args) {
      const dir = absPath(args && args.dir)
      const target = path.join(dir, checkName(args && args.name))
      try {
        await fsp.mkdir(target)
      } catch (e) {
        throw friendly(e, 'the folder')
      }
      return { path: target }
    },
    async createFile(_ctx, args) {
      const dir = absPath(args && args.dir)
      const target = path.join(dir, checkName(args && args.name))
      try {
        await fsp.writeFile(target, '', { flag: 'wx' })
      } catch (e) {
        throw friendly(e, 'the file')
      }
      return { path: target }
    },
    async rename(_ctx, args) {
      const from = absPath(args && args.path)
      const name = checkName(args && args.name)
      const dir = path.dirname(from)
      if (dir === from) throw new FilesError('A drive cannot be renamed here.', 'bad-path')
      const to = path.join(dir, name)
      if (to === from) return { path: to }
      // A change of letter case only is the same file on Windows: allowed.
      if (!samePath(to, from) && (await exists(to))) throw new FilesError('Something with that name is already there.', 'EEXIST')
      try {
        await fsp.rename(from, to)
      } catch (e) {
        throw friendly(e, 'it')
      }
      return { path: to }
    },
    async paste(_ctx, args) {
      return paste({ sources: args && args.sources, dir: args && args.dir, mode: args && args.mode })
    },
    /** Move to the Recycle Bin (never a permanent delete). */
    async trash(_ctx, args) {
      const paths = Array.isArray(args && args.paths) ? args.paths.slice(0, PASTE_MAX) : []
      const { shell } = require('electron')
      const done = []
      const failed = []
      for (const p of paths) {
        try {
          const full = absPath(p)
          if (path.dirname(full) === full) throw new FilesError('A whole drive cannot go to the Recycle Bin.', 'bad-path')
          await shell.trashItem(full)
          done.push(full)
        } catch (e) {
          failed.push({ name: typeof p === 'string' ? path.basename(p) : '?', error: friendly(e, 'it').message })
        }
      }
      return { done, failed }
    },
    /** Open with the program Windows uses for it (a folder opens in Explorer). */
    async open(_ctx, args) {
      const full = absPath(args && args.path)
      const { shell } = require('electron')
      const err = await shell.openPath(full)
      if (err) throw new FilesError(err, 'open-failed')
      return { ok: true }
    },
    async reveal(_ctx, args) {
      const full = absPath(args && args.path)
      const { shell } = require('electron')
      shell.showItemInFolder(full)
      return { ok: true }
    },
  },
  // For tests.
  _internal: { absPath, checkName, extOf, isHidden, list, preview, paste, search, folderSize, statMany, uniqueTarget, gitInfo, places, wildcard, LIMITS: { LIST_LIMIT, PREVIEW_TEXT_BYTES, SEARCH_MAX_RESULTS } },
}
