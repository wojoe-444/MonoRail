import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderGit2,
  Presentation,
  Settings2,
  type LucideIcon,
} from 'lucide-react'

import type { FileEntry, Sort, TagColor } from './types'

export type Category = 'folder' | 'image' | 'video' | 'audio' | 'code' | 'document' | 'sheet' | 'slides' | 'pdf' | 'archive' | 'app' | 'text' | 'other'

const BY_EXT: Record<string, Category> = {}
const add = (cat: Category, exts: string) => exts.split(' ').forEach((e) => (BY_EXT[e] = cat))
add('image', 'png jpg jpeg gif webp bmp svg ico avif heic heif tif tiff raw psd')
add('video', 'mp4 mov mkv avi webm wmv m4v flv')
add('audio', 'mp3 wav flac aac ogg m4a wma opus')
add('code', 'js mjs cjs jsx ts tsx mts cts py rb go rs java kt c h cpp hpp cc cs swift php lua r sql sh bash ps1 psm1 bat cmd vue svelte astro html htm css scss less json jsonc yml yaml toml xml graphql proto dart ex exs scala')
add('document', 'doc docx odt rtf pages md markdown mdx')
add('sheet', 'xls xlsx ods csv tsv numbers')
add('slides', 'ppt pptx odp key')
add('pdf', 'pdf')
add('archive', 'zip rar 7z tar gz tgz bz2 xz iso cab')
add('app', 'exe msi appx msix lnk dll sys')
add('text', 'txt log ini cfg conf env gitignore gitattributes editorconfig lock')

export function categoryOf(e: Pick<FileEntry, 'kind' | 'ext'>): Category {
  if (e.kind === 'dir') return 'folder'
  return BY_EXT[e.ext] ?? 'other'
}

const LOOK: Record<Category, { icon: LucideIcon; tile: string; label: string }> = {
  folder: { icon: Folder, tile: 'bg-primary-soft text-primary', label: 'Folder' },
  image: { icon: FileImage, tile: 'bg-success-soft text-success-soft-foreground', label: 'Image' },
  video: { icon: FileVideo, tile: 'bg-destructive-soft text-destructive-soft-foreground', label: 'Video' },
  audio: { icon: FileAudio, tile: 'bg-highlight-soft text-highlight-soft-foreground', label: 'Audio' },
  code: { icon: FileCode2, tile: 'bg-info-soft text-info-soft-foreground', label: 'Code' },
  document: { icon: FileText, tile: 'bg-info-soft text-info-soft-foreground', label: 'Document' },
  sheet: { icon: FileSpreadsheet, tile: 'bg-success-soft text-success-soft-foreground', label: 'Spreadsheet' },
  slides: { icon: Presentation, tile: 'bg-warning-soft text-warning-soft-foreground', label: 'Slides' },
  pdf: { icon: FileText, tile: 'bg-destructive-soft text-destructive-soft-foreground', label: 'PDF' },
  archive: { icon: FileArchive, tile: 'bg-warning-soft text-warning-soft-foreground', label: 'Archive' },
  app: { icon: Settings2, tile: 'bg-muted text-muted-foreground', label: 'Program' },
  text: { icon: FileText, tile: 'bg-muted text-muted-foreground', label: 'Text' },
  other: { icon: File, tile: 'bg-muted text-muted-foreground', label: 'File' },
}

export function lookOf(e: Pick<FileEntry, 'kind' | 'ext' | 'name'>, isRepo = false) {
  const cat = categoryOf(e)
  const look = LOOK[cat]
  return { ...look, icon: cat === 'folder' && isRepo ? FolderGit2 : look.icon, category: cat }
}

/** Kinds Windows can make a shell thumbnail for (worth asking the backend). */
export function hasThumbnail(e: Pick<FileEntry, 'kind' | 'ext'>) {
  const c = categoryOf(e)
  return e.kind === 'file' && (c === 'image' || c === 'video' || c === 'pdf') && e.ext !== 'svg'
}

export function typeLabel(e: Pick<FileEntry, 'kind' | 'ext'>) {
  if (e.kind === 'dir') return 'Folder'
  if (!e.ext) return 'File'
  return `${e.ext.toUpperCase()} ${LOOK[categoryOf(e)].label === 'File' ? 'file' : LOOK[categoryOf(e)].label.toLowerCase()}`
}

/** Tag colors: the fixed chart series hues (they do not follow the palette), red from destructive. */
export const TAGS: { color: TagColor; label: string; css: string }[] = [
  { color: 'red', label: 'Red', css: 'var(--destructive)' },
  { color: 'orange', label: 'Orange', css: 'var(--series-2)' },
  { color: 'yellow', label: 'Yellow', css: 'var(--series-4)' },
  { color: 'green', label: 'Green', css: 'var(--series-3)' },
  { color: 'blue', label: 'Blue', css: 'var(--series-1)' },
  { color: 'purple', label: 'Purple', css: 'var(--series-6)' },
]
export const tagCss = (c: TagColor) => TAGS.find((t) => t.color === c)?.css ?? 'currentColor'

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

export function formatDate(ms: number) {
  if (!ms) return ''
  const d = new Date(ms)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return `Today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  const yest = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === yest.toDateString()) return `Yesterday ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleDateString(undefined, { year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric', month: 'short', day: 'numeric' })
}

/** Split a path into breadcrumb parts: [{ label, path }]. Works for C:\a\b and /a/b. */
export function crumbs(p: string, sep: string): { label: string; path: string }[] {
  if (sep === '\\') {
    const m = /^([a-zA-Z]:)\\?(.*)$/.exec(p)
    if (m) {
      const out = [{ label: m[1].toUpperCase(), path: `${m[1].toUpperCase()}\\` }]
      let acc = `${m[1].toUpperCase()}\\`
      for (const part of m[2].split('\\').filter(Boolean)) {
        acc = acc.endsWith('\\') ? acc + part : `${acc}\\${part}`
        out.push({ label: part, path: acc })
      }
      return out
    }
    const unc = /^(\\\\[^\\]+\\[^\\]+)(.*)$/.exec(p)
    if (unc) {
      const out = [{ label: unc[1], path: unc[1] }]
      let acc = unc[1]
      for (const part of unc[2].split('\\').filter(Boolean)) out.push({ label: part, path: (acc = `${acc}\\${part}`) })
      return out
    }
  }
  const out = [{ label: '/', path: '/' }]
  let acc = ''
  for (const part of p.split('/').filter(Boolean)) out.push({ label: part, path: (acc = `${acc}/${part}`) })
  return out
}

export function baseName(p: string) {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function parentPath(p: string, sep: string) {
  const c = crumbs(p, sep)
  return c.length > 1 ? c[c.length - 2].path : null
}

export const samePath = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Sort entries: folders first (optional), then by key, names compared like Explorer (numbers in order). */
export function sortEntries(entries: FileEntry[], sort: Sort, foldersFirst: boolean) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    if (foldersFirst && (a.kind === 'dir') !== (b.kind === 'dir')) return a.kind === 'dir' ? -1 : 1
    let c = 0
    if (sort.key === 'modified') c = a.modified - b.modified
    else if (sort.key === 'size') c = a.size - b.size
    else if (sort.key === 'type') c = collator.compare(a.ext, b.ext)
    return (c || collator.compare(a.name, b.name)) * (c ? dir : sort.key === 'name' ? dir : 1)
  })
}
