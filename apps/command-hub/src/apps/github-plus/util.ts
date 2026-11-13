const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]
]
export function timeAgo(iso: string): string {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, s] of UNITS) if (Math.abs(secs) >= s) return rtf.format(Math.round(secs / s), unit)
  return 'just now'
}
export const fullDate = (iso: string): string => new Date(iso).toLocaleString()
export const dayKey = (iso: string): string =>
  new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
export const dirname = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
export const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)

/** Resolve a relative link (as found in a README) against the directory of the file containing it. */
export function resolveRelative(baseDir: string, href: string): string {
  const parts = href.startsWith('/') ? [] : baseDir.split('/').filter(Boolean)
  for (const seg of href.replace(/^\//, '').split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', cs: 'csharp', cpp: 'cpp', cc: 'cpp',
  c: 'c', h: 'c', hpp: 'cpp', php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', json: 'json',
  yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', css: 'css',
  scss: 'scss', less: 'less', md: 'markdown', sql: 'sql', swift: 'swift', lua: 'lua', r: 'r', diff: 'diff', patch: 'diff',
  bat: 'dos', cmd: 'dos', gradle: 'groovy', pl: 'perl', vue: 'xml'
}
export function languageFor(path: string): string | undefined {
  const name = basename(path).toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  return EXT_LANG[name.split('.').pop() ?? '']
}

/** What the system file manager is called: "Finder" on a Mac, "File Explorer" elsewhere (MonoRail ships for Windows). */
export const fileManagerName = /Mac/i.test(navigator.userAgent) ? 'Finder' : 'File Explorer'
