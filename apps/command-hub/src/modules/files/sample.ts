// Fictional folders for the browser dev server (no backend). Nothing here is
// anyone's real data, and nothing can be changed.

import type { FileEntry, Listing, Places, Preview, SearchResult } from './types'

const HOME = 'C:\\Users\\alex'
const DAY = 86_400_000
const now = Date.UTC(2026, 10, 18, 9, 30)

type Node = { size?: number; age?: number; text?: string; children?: Record<string, Node> }

const file = (size: number, age: number, text?: string): Node => ({ size, age, text })
const dir = (children: Record<string, Node>, age = 3): Node => ({ children, age })

const TREE: Node = dir({
  Desktop: dir({ 'Launch checklist.md': file(1820, 1, '# Launch checklist\n\n- [x] Freeze the copy\n- [ ] Final screenshots\n- [ ] Tell the team\n'), 'screenshot-0412.png': file(482_113, 2) }),
  Documents: dir({
    Receipts: dir({ '2026-09 bike service.pdf': file(88_201, 40), '2026-10 desk lamp.pdf': file(64_990, 22) }, 22),
    'Garden plan.xlsx': file(28_400, 12),
    'Reading list.txt': file(640, 5, 'Reading list\n\n1. The Overstory\n2. A Psalm for the Wild-Built\n3. Piranesi\n'),
    'Trip to the coast.docx': file(51_220, 30),
  }),
  Downloads: dir({ 'sourdough-starter-guide.pdf': file(1_204_000, 0), 'fonts.zip': file(5_890_221, 6), 'tide-tables.csv': file(12_044, 3, 'date,high,low\n2026-11-18,06:12,12:40\n2026-11-19,06:58,13:21\n') }, 0),
  Pictures: dir({ Hikes: dir({ 'ridge.jpg': file(3_420_000, 60), 'lake.jpg': file(2_980_000, 60) }, 60), 'cat-on-keyboard.png': file(912_000, 9) }, 9),
  Music: dir({}, 120),
  Videos: dir({ 'timelapse-clouds.mp4': file(84_000_000, 45) }, 45),
  Repos: dir({
    'trail-mapper': dir({
      src: dir({ 'main.ts': file(2048, 1, "import { loadTrails } from './trails'\n\nconst trails = await loadTrails()\nconsole.log(`${trails.length} trails`)\n"), 'trails.ts': file(4096, 2) }, 1),
      'README.md': file(1400, 4, '# Trail mapper\n\nA tiny tool that draws hiking trails from GPX files.\n\n## Run it\n\n```sh\nnpm start\n```\n'),
      'package.json': file(612, 4, '{\n  "name": "trail-mapper",\n  "version": "0.4.0",\n  "type": "module"\n}\n'),
      '.gitignore': file(24, 30, 'node_modules\ndist\n'),
    }, 1),
  }, 1),
  '.config': dir({}, 90),
  'notes.md': file(310, 0, '# Scratch\n\nRemember to water the basil.\n'),
})

function nodeAt(p: string): Node | undefined {
  if (!p.toLowerCase().startsWith(HOME.toLowerCase())) return undefined
  const rest = p.slice(HOME.length).split('\\').filter(Boolean)
  let n: Node | undefined = TREE
  for (const part of rest) n = n?.children?.[part]
  return n
}

const extOf = (name: string) => {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : name.startsWith('.') ? name.slice(1) : ''
}

function entry(parent: string, name: string, n: Node): FileEntry {
  const isDir = !!n.children
  const t = now - (n.age ?? 0) * DAY - name.length * 60_000
  return { name, path: `${parent}\\${name}`, ext: isDir ? '' : extOf(name), kind: isDir ? 'dir' : 'file', size: isDir ? 0 : (n.size ?? 0), modified: t, created: t - 30 * DAY, hidden: name.startsWith('.') }
}

function parentOf(p: string) {
  const i = p.lastIndexOf('\\')
  return i > 2 ? p.slice(0, i) : null
}

const gitFor = (p: string) => (p.toLowerCase().startsWith(`${HOME}\\Repos\\trail-mapper`.toLowerCase()) ? { root: `${HOME}\\Repos\\trail-mapper`, branch: 'main', detached: false } : null)

function list(path: string, showHidden: boolean): Listing {
  const n = nodeAt(path)
  if (!n?.children) throw new Error(path.toLowerCase().startsWith(HOME.toLowerCase()) ? 'This folder is no longer there.' : 'The sample only has the home folder.')
  const all = Object.entries(n.children).map(([name, c]) => entry(path, name, c))
  const entries = showHidden ? all : all.filter((e) => !e.hidden)
  return { path, name: path.split('\\').pop() || path, parent: parentOf(path), entries, hiddenCount: all.length - entries.length, truncated: false, git: gitFor(path) }
}

function preview(path: string): Preview {
  const n = nodeAt(path)
  if (!n) throw new Error('This item is no longer there.')
  const name = path.split('\\').pop() || path
  const e = entry(parentOf(path) ?? HOME, name, n)
  const base = { path, name, size: e.size, modified: e.modified, created: e.created, accessed: e.modified }
  if (n.children) return { ...base, kind: 'dir', items: Object.keys(n.children).length, folders: Object.values(n.children).filter((c) => c.children).length, git: gitFor(path) }
  if (n.text != null) return { ...base, kind: 'text', ext: e.ext, text: n.text, truncated: false, lines: n.text.split('\n').length }
  return { ...base, kind: 'binary', ext: e.ext }
}

function search(dir: string, query: string, showHidden: boolean): SearchResult {
  const q = query.trim().toLowerCase()
  const results: FileEntry[] = []
  const walk = (p: string, n: Node) => {
    for (const [name, c] of Object.entries(n.children ?? {})) {
      if (!showHidden && name.startsWith('.')) continue
      if (name.toLowerCase().includes(q)) results.push(entry(p, name, c))
      if (c.children) walk(`${p}\\${name}`, c)
    }
  }
  const n = nodeAt(dir)
  if (n && q) walk(dir, n)
  return { results, truncated: false, visited: 40, ms: 3 }
}

function sizeOf(n: Node): { bytes: number; files: number; dirs: number } {
  if (!n.children) return { bytes: n.size ?? 0, files: 1, dirs: 0 }
  return Object.values(n.children).reduce(
    (acc, c) => {
      const s = sizeOf(c)
      return { bytes: acc.bytes + s.bytes, files: acc.files + s.files, dirs: acc.dirs + s.dirs + (c.children ? 1 : 0) }
    },
    { bytes: 0, files: 0, dirs: 0 },
  )
}

export async function sampleInvoke<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const p = String(args.path ?? args.dir ?? '')
  const out = (() => {
    switch (method) {
      case 'places':
        return {
          home: HOME,
          sep: '\\',
          places: [
            { id: 'home', label: 'Home', path: HOME },
            ...['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Repos'].map((l) => ({ id: l.toLowerCase(), label: l, path: `${HOME}\\${l}` })),
          ],
          drives: [
            { path: 'C:\\', label: 'C:', total: 512e9, free: 141e9 },
            { path: 'D:\\', label: 'D:', total: 2e12, free: 1.42e12 },
          ],
        } satisfies Places
      case 'list':
        return list(p, !!args.showHidden)
      case 'preview':
        return preview(p)
      case 'thumbnail':
        return null
      case 'search':
        return search(p, String(args.query ?? ''), !!args.showHidden)
      case 'folderSize': {
        const n = nodeAt(p)
        return { path: p, ...(n ? sizeOf(n) : { bytes: 0, files: 0, dirs: 0 }), truncated: false, ms: 2 }
      }
      case 'statMany':
        return (Array.isArray(args.paths) ? args.paths : [])
          .map((x) => {
            const n = nodeAt(String(x))
            const parent = parentOf(String(x))
            return n && parent ? entry(parent, String(x).split('\\').pop() ?? '', n) : null
          })
          .filter(Boolean)
      default:
        throw new Error('This is a sample: changes work in the desktop app.')
    }
  })()
  return out as T
}
