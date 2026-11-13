// Fictional notes for the browser dev server (no backend). Nothing is saved.

import type { Note, NoteList, NoteVersion } from './types'

const MIN = 60_000
const now = Date.now()

const seed: { id: string; body: string; ago: number }[] = [
  {
    id: '2026-11-11-standup-scratch',
    ago: 4 * MIN,
    body: `# Standup scratch

- Build cache misses on the Windows runner again, check the lockfile hash
- Ask Priya about the staging certs before Friday
- Demo flow: open Home, then Notes, then GitHub+

Links
- https://example.com/runbook/cache
`,
  },
  {
    id: '2026-11-10-ideas-for-the-dashboard',
    ago: 26 * 60 * MIN,
    body: `# Ideas for the dashboard

A heat strip of agent runs per hour. Maybe a weekly digest.
Nothing decided, just parking it here.
`,
  },
  {
    id: '2026-11-08-reading-list',
    ago: 3 * 24 * 60 * MIN,
    body: `# Reading list

1. Designing Data-Intensive Applications, ch. 5
2. The FSRS paper
3. That blog post about local-first software
`,
  },
  {
    id: '2026-11-03-wifi-and-printer',
    ago: 8 * 24 * 60 * MIN,
    body: `# Office wifi and printer

Printer is the one by the window, queue name \`floor2-mono\`.
Guest wifi rotates on Mondays, ask the front desk.
`,
  },
]

const notes = new Map<string, Note>()
for (const s of seed) notes.set(s.id, toNote(s.id, s.body, now - s.ago, now - s.ago - 60 * MIN, true))

function titleOf(body: string) {
  const line = body.split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/^#+\s*/, '').trim().slice(0, 120) || 'Untitled'
}

function excerptOf(body: string) {
  const lines = body.split('\n').filter((l) => l.trim())
  return lines.slice(1).map((l) => l.replace(/^\s*([#>]+|[-*+]|\d+\.)\s+/, '').replace(/`/g, '')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 140)
}

function toNote(id: string, body: string, updated: number, created: number, committed: boolean): Note {
  return { id, body, title: titleOf(body), excerpt: excerptOf(body), updated, created, committed, words: body.split(/\s+/).filter(Boolean).length }
}

function summary(n: Note) {
  const { body: _body, created: _created, committed: _committed, ...s } = n
  return s
}

function list(query?: string): NoteList {
  const q = query?.trim().toLowerCase()
  const all = [...notes.values()].filter((n) => !q || n.body.toLowerCase().includes(q))
  all.sort((a, b) => b.updated - a.updated)
  return { notes: all.map(summary), repoPath: 'C:/Users/sample/AppData/Roaming/MonoRail/modules/notes/repo', pending: [...notes.values()].filter((n) => !n.committed).length }
}

export async function sampleInvoke<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  const id = String(args?.id ?? '')
  const r = ((): unknown => {
    switch (method) {
      case 'list':
        return list(args?.query as string | undefined)
      case 'get': {
        const n = notes.get(id)
        if (!n) throw new Error('That note no longer exists.')
        return n
      }
      case 'create': {
        const t = Date.now()
        const body = String(args?.body ?? '')
        const nid = `${new Date(t).toISOString().slice(0, 10)}-note-${Math.floor(t / 1000) % 100000}`
        const n = toNote(nid, body, t, t, false)
        notes.set(nid, n)
        return n
      }
      case 'save': {
        const old = notes.get(id)
        if (!old) throw new Error('That note no longer exists.')
        const n = toNote(id, String(args?.body ?? ''), Date.now(), old.created, false)
        notes.set(id, n)
        return n
      }
      case 'flush':
        for (const [k, n] of notes) notes.set(k, { ...n, committed: true })
        return { committed: true }
      case 'remove':
        notes.delete(id)
        return { removed: true }
      case 'history': {
        const n = notes.get(id)
        const v: NoteVersion[] = n ? [{ oid: 'a1b2c3d', message: `Edit ${n.title}`, time: n.updated }, { oid: 'e4f5a6b', message: `New note ${n.title}`, time: n.created }] : []
        return v
      }
      case 'version':
        return { body: notes.get(id)?.body ?? '' }
      default:
        throw new Error(`Unknown method ${method}`)
    }
  })()
  return r as T
}
