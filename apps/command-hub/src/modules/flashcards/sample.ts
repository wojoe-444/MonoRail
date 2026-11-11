// Fictional decks for the browser dev server, where there is no backend. A
// tiny in-memory stand-in for electron/modules/flashcards.cjs: same methods,
// same shapes, nothing saved, and fixed intervals instead of the real scheduler.

import type { Card, CardList, Deck, DeckCounts, DeckList, Rating, StudyState } from './types'

const MIN = 60_000
const DAY = 24 * 60 * MIN

interface SampleDeck {
  id: string
  name: string
  description: string
  newPerDay: number
  retention: number
  createdAt: number
}

const now0 = Date.now()
let seq = 100
const id = () => (++seq).toString(16).padStart(16, '0')

const decks: SampleDeck[] = [
  { id: id(), name: 'Spanish basics', description: 'Everyday words and phrases.', newPerDay: 10, retention: 0.9, createdAt: now0 - 30 * DAY },
  { id: id(), name: 'World capitals', description: '', newPerDay: 5, retention: 0.9, createdAt: now0 - 12 * DAY },
  { id: id(), name: 'TypeScript', description: 'Language details worth remembering.', newPerDay: 20, retention: 0.85, createdAt: now0 - 3 * DAY },
]

function make(deck: SampleDeck, front: string, back: string, state: Card['state'], dueIn: number, intervalDays = 0, reps = 0): Card {
  return { id: id(), deckId: deck.id, front, back, state, due: now0 + dueIn, intervalDays, reps, lapses: 0, suspended: false, createdAt: now0 - 5 * DAY, updatedAt: now0 - DAY }
}

const [es, caps, ts] = decks
let cards: Card[] = [
  make(es, 'el perro', 'the dog', 'review', -DAY, 4, 3),
  make(es, 'la manzana', 'the apple', 'review', -2 * 60 * MIN, 9, 4),
  make(es, '¿Dónde está la estación?', 'Where is the station?', 'learning', -MIN, 0, 1),
  make(es, 'gracias', 'thank you', 'review', 6 * DAY, 21, 6),
  make(es, 'mañana', 'tomorrow; morning', 'new', 0),
  make(es, 'el libro', 'the book', 'new', 0),
  make(caps, 'Peru', 'Lima', 'review', -3 * DAY, 12, 5),
  make(caps, 'Kenya', 'Nairobi', 'review', 2 * DAY, 8, 3),
  make(caps, 'Mongolia', 'Ulaanbaatar', 'new', 0),
  make(ts, 'What does `satisfies` do?', 'Checks that an expression matches a type **without** changing its inferred type.', 'new', 0),
  make(ts, 'Type of `[] as const`?', '`readonly []`', 'review', 4 * DAY, 4, 2),
]

const history = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(now0 - (29 - i) * DAY).toISOString().slice(0, 10),
  reviews: [12, 18, 0, 25, 31, 22, 9, 0, 14, 28, 35, 19, 24, 0, 16, 21, 27, 33, 11, 8, 29, 36, 22, 18, 0, 26, 30, 24, 19, 7][i],
}))
const today = new Map<string, { new: number; reviews: number }>()

function counts(deck: SampleDeck): DeckCounts {
  const now = Date.now()
  const mine = cards.filter((c) => c.deckId === deck.id)
  const live = mine.filter((c) => !c.suspended)
  const fresh = live.filter((c) => c.state === 'new').length
  const later = live.filter((c) => c.due > now && c.state !== 'new').map((c) => c.due)
  const studied = today.get(deck.id)?.new ?? 0
  return {
    new: Math.max(0, Math.min(fresh, deck.newPerDay - studied)),
    newTotal: fresh,
    learning: live.filter((c) => (c.state === 'learning' || c.state === 'relearning') && c.due <= now).length,
    learningSoon: live.filter((c) => (c.state === 'learning' || c.state === 'relearning') && c.due > now && c.due <= now + 20 * MIN).length,
    review: live.filter((c) => c.state === 'review' && c.due <= now + 6 * 60 * MIN).length,
    total: mine.length,
    suspended: mine.length - live.length,
    nextDue: later.length ? Math.min(...later) : null,
  }
}

function view(deck: SampleDeck): Deck {
  return { ...deck, counts: counts(deck), today: today.get(deck.id) ?? { new: 0, reviews: 0 } }
}

function deckOf(deckId: unknown): SampleDeck {
  const d = decks.find((x) => x.id === deckId)
  if (!d) throw new Error('That deck no longer exists.')
  return d
}

const PREVIEWS = { new: { 1: MIN, 2: 6 * MIN, 3: 10 * MIN, 4: 4 * DAY }, review: { 1: 10 * MIN, 2: 3 * DAY, 3: 7 * DAY, 4: 15 * DAY } } as const

function study(deckId: unknown, canUndo = false): StudyState {
  const deck = deckOf(deckId)
  const now = Date.now()
  const c = counts(deck)
  const live = cards.filter((x) => x.deckId === deck.id && !x.suspended)
  const card =
    live.find((x) => x.state !== 'new' && x.state !== 'review' && x.due <= now) ??
    live.find((x) => x.state === 'review' && x.due <= now + 6 * 60 * MIN) ??
    (c.new > 0 ? live.find((x) => x.state === 'new') : undefined) ??
    null
  const previews = card ? { ...(card.state === 'review' ? PREVIEWS.review : PREVIEWS.new) } : null
  return { deck: view(deck), counts: c, card, previews, canUndo }
}

let last: { card: Card; deckId: string } | undefined

/** Same contract as invokeModule('flashcards', method, args). */
export async function sampleInvoke<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  const a = args ?? {}
  const now = Date.now()
  const result = ((): unknown => {
    switch (method) {
      case 'listDecks':
        return { decks: decks.map(view).sort((x, y) => x.name.localeCompare(y.name)), history: history.map((h, i) => (i === 29 ? { ...h, reviews: h.reviews + [...today.values()].reduce((s, t) => s + t.reviews, 0) } : h)), reviewedToday: history[29].reviews + [...today.values()].reduce((s, t) => s + t.reviews, 0) } satisfies DeckList
      case 'createDeck': {
        const name = String(a.name ?? '').trim()
        if (!name) throw new Error('Deck name is empty.')
        const d = { id: id(), name, description: String(a.description ?? ''), newPerDay: Number(a.newPerDay ?? 20), retention: Number(a.retention ?? 0.9), createdAt: now }
        decks.push(d)
        return view(d)
      }
      case 'updateDeck': {
        const d = deckOf(a.id)
        Object.assign(d, Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== 'id' && v !== undefined)))
        return view(d)
      }
      case 'deleteDeck': {
        const d = deckOf(a.id)
        decks.splice(decks.indexOf(d), 1)
        const n = cards.filter((c) => c.deckId === d.id).length
        cards = cards.filter((c) => c.deckId !== d.id)
        return { deleted: n }
      }
      case 'listCards': {
        const d = deckOf(a.deckId)
        const q = String(a.query ?? '').toLowerCase()
        const list = cards.filter((c) => c.deckId === d.id && (!q || `${c.front}\n${c.back}`.toLowerCase().includes(q)))
        return { deck: view(d), cards: list, total: list.length, truncated: false } satisfies CardList
      }
      case 'addCard': {
        const d = deckOf(a.deckId)
        if (!String(a.front ?? '').trim()) throw new Error('Front is empty.')
        const c = make(d, String(a.front), String(a.back ?? ''), 'new', 0)
        c.due = now
        cards.push(c)
        return c
      }
      case 'importCards': {
        const d = deckOf(a.deckId)
        const sep = a.separator === ';' ? ';' : '\t'
        let added = 0
        let skipped = 0
        for (const line of String(a.text ?? '').split(/\r?\n/)) {
          if (!line.trim()) continue
          const i = line.indexOf(sep)
          if (i <= 0) {
            skipped++
            continue
          }
          cards.push(make(d, line.slice(0, i).trim(), line.slice(i + 1).trim(), 'new', 0))
          added++
        }
        if (!added) throw new Error('Nothing to import.')
        return { added, skipped }
      }
      case 'updateCard': {
        const c = cards.find((x) => x.id === a.id)
        if (!c) throw new Error('That card no longer exists.')
        if (a.front !== undefined) c.front = String(a.front)
        if (a.back !== undefined) c.back = String(a.back)
        if (a.deckId !== undefined) c.deckId = deckOf(a.deckId).id
        if (a.suspended !== undefined) c.suspended = !!a.suspended
        c.updatedAt = now
        return c
      }
      case 'resetCard': {
        const c = cards.find((x) => x.id === a.id)
        if (!c) throw new Error('That card no longer exists.')
        Object.assign(c, { state: 'new', due: now, intervalDays: 0, reps: 0, lapses: 0 })
        return c
      }
      case 'deleteCard':
        cards = cards.filter((x) => x.id !== a.id)
        return { ok: true }
      case 'study':
        return study(a.deckId, last?.deckId === a.deckId)
      case 'answer': {
        const c = cards.find((x) => x.id === a.cardId)
        if (!c) throw new Error('That card no longer exists.')
        const rating = Number(a.rating) as Rating
        last = { card: { ...c }, deckId: c.deckId }
        const t = today.get(c.deckId) ?? { new: 0, reviews: 0 }
        t.reviews++
        if (c.state === 'new') t.new++
        today.set(c.deckId, t)
        const ms = (c.state === 'review' ? PREVIEWS.review : PREVIEWS.new)[rating]
        c.state = ms < DAY ? (c.state === 'review' ? 'relearning' : 'learning') : 'review'
        c.due = now + ms
        c.intervalDays = ms >= DAY ? Math.round(ms / DAY) : 0
        c.reps++
        return study(c.deckId, true)
      }
      case 'undo': {
        if (!last || last.deckId !== a.deckId) throw new Error('There is nothing to undo.')
        const i = cards.findIndex((x) => x.id === last!.card.id)
        if (i >= 0) cards[i] = last.card
        const t = today.get(last.deckId)
        if (t) {
          t.reviews = Math.max(0, t.reviews - 1)
          if (last.card.state === 'new') t.new = Math.max(0, t.new - 1)
        }
        const deckId = last.deckId
        const card = last.card
        last = undefined
        const s = study(deckId)
        return { ...s, card, previews: { ...(card.state === 'review' ? PREVIEWS.review : PREVIEWS.new) } }
      }
      default:
        throw new Error(`Unknown method flashcards.${method}`)
    }
  })()
  return structuredClone(result) as T
}
