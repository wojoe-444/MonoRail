// Flashcards data: decks, cards and per-day study counts in one JSON file in
// the module's data folder (%APPDATA%\MonoRail\modules\flashcards\decks.json).
//
// No Electron here: the MCP server (electron/mcp) uses this file from its own
// process, so every change takes the lock file, reads the file fresh, changes
// it and writes it atomically. A damaged file is never treated as empty: reads
// throw and nothing is written over it.

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const { writeJsonAtomic, tryLock, sleep } = require('../cache/files.cjs')
const { schedule, DAY } = require('./flashcards-fsrs.cjs')

const DECKS_FILE = 'decks.json'
const LOCK_FILE = 'decks.json.lock'
const FORMAT = 1

const LIMITS = Object.freeze({ name: 120, description: 500, text: 20000, cardsPerFile: 50000, importBatch: 5000, keepDays: 90 })
const DEFAULT_DECK = Object.freeze({ newPerDay: 20, retention: 0.9 })
/** With nothing else to study, learning cards due this soon are shown early. */
const LEARN_AHEAD_MS = 20 * 60 * 1000

const STATES = new Set(['new', 'learning', 'review', 'relearning'])

// ---------- days ----------

/** Local calendar day of `ms`, 'YYYY-MM-DD'. */
function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** First moment of the next local day. */
function endOfDay(ms) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}

// ---------- validation ----------

function text(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null) value = ''
  if (typeof value !== 'string') throw new Error(`${field} must be text.`)
  const v = value.replace(/\r\n/g, '\n')
  if (required && !v.trim()) throw new Error(`${field} is empty.`)
  if (v.length > max) throw new Error(`${field} is longer than ${max} characters.`)
  return v
}

function num(value, field, lo, hi, fallback) {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${field} must be between ${lo} and ${hi}.`)
  return n
}

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16)
const ID_RE = /^[a-f0-9]{16}$/

function idArg(value, field) {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new Error(`Unknown ${field}.`)
  return value
}

// ---------- file ----------

function emptyData() {
  return { format: FORMAT, decks: [], cards: [], days: {} }
}

function createStore(dataDir) {
  const file = path.join(dataDir, DECKS_FILE)
  const lockFile = path.join(dataDir, LOCK_FILE)
  let queue = Promise.resolve()

  async function read() {
    let raw
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch (e) {
      if (e.code === 'ENOENT') return emptyData()
      throw e
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`The flashcards file is damaged (${file}). MonoRail will not change it; restore it from a backup or move it away to start over.`)
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
      throw new Error(`The flashcards file has an unknown layout (${file}). MonoRail will not change it.`)
    }
    if (data.format > FORMAT) throw new Error('The flashcards file was written by a newer MonoRail. Update MonoRail to open it.')
    if (!data.days || typeof data.days !== 'object') data.days = {}
    return data
  }

  async function lock() {
    const deadline = Date.now() + 10_000
    for (;;) {
      const release = await tryLock(lockFile, { staleMs: 30_000 })
      if (release) return release
      if (Date.now() > deadline) throw new Error('The flashcards file is busy. Try again in a moment.')
      await sleep(25)
    }
  }

  /** Run fn(data, now) under the lock; its changes to data are saved. */
  function update(fn) {
    const run = queue.then(async () => {
      const release = await lock()
      try {
        const data = await read()
        const result = await fn(data, Date.now())
        pruneDays(data, Date.now())
        await writeJsonAtomic(file, data)
        return result
      } finally {
        await release()
      }
    })
    queue = run.catch(() => {})
    return run
  }

  return { read, update, file }
}

function pruneDays(data, now) {
  const oldest = dayKey(now - LIMITS.keepDays * DAY)
  for (const k of Object.keys(data.days)) if (k < oldest) delete data.days[k]
}

// ---------- queries ----------

function findDeck(data, id) {
  const deck = data.decks.find((d) => d.id === idArg(id, 'deck'))
  if (!deck) throw new Error('That deck no longer exists.')
  return deck
}

function findCard(data, id) {
  const card = data.cards.find((c) => c.id === idArg(id, 'card'))
  if (!card) throw new Error('That card no longer exists.')
  return card
}

function dayCount(data, deckId, now) {
  return data.days[dayKey(now)]?.[deckId] ?? { new: 0, reviews: 0 }
}

/** What a deck has to study right now. */
function deckCounts(data, deck, now) {
  const eod = endOfDay(now)
  let fresh = 0
  let learning = 0
  let learningSoon = 0
  let review = 0
  let total = 0
  let suspended = 0
  let nextDue
  for (const c of data.cards) {
    if (c.deckId !== deck.id) continue
    total++
    if (c.suspended) {
      suspended++
      continue
    }
    if (c.state === 'new') fresh++
    else if (c.state === 'review') {
      if (c.due < eod) review++
      else if (nextDue === undefined || c.due < nextDue) nextDue = c.due
    } else if (c.due <= now) learning++
    else {
      if (c.due <= now + LEARN_AHEAD_MS) learningSoon++
      if (nextDue === undefined || c.due < nextDue) nextDue = c.due
    }
  }
  const studiedNew = dayCount(data, deck.id, now).new
  const newToday = Math.max(0, Math.min(fresh, deck.newPerDay - studiedNew))
  return { new: newToday, newTotal: fresh, learning, learningSoon, review, total, suspended, nextDue: nextDue ?? null }
}

function deckView(data, deck, now) {
  const today = dayCount(data, deck.id, now)
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    newPerDay: deck.newPerDay,
    retention: deck.retention,
    createdAt: deck.createdAt,
    counts: deckCounts(data, deck, now),
    today: { new: today.new, reviews: today.reviews },
  }
}

/** Reviews per day for the last `days` days (oldest first), all decks. */
function history(data, now, days = 30) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY)
    const day = data.days[key] ?? {}
    let reviews = 0
    for (const v of Object.values(day)) reviews += v.reviews ?? 0
    out.push({ day: key, reviews })
  }
  return out
}

function listDecks(data, now) {
  const decks = data.decks.map((d) => deckView(data, d, now)).sort((a, b) => a.name.localeCompare(b.name))
  const h = history(data, now)
  return { decks, history: h, reviewedToday: h[h.length - 1].reviews }
}

/**
 * The next card to study in a deck: learning cards that are due, then review
 * cards due today (most overdue first), then new cards up to the daily limit,
 * then learning cards due within 20 minutes.
 */
function pickNext(data, deck, now) {
  const eod = endOfDay(now)
  const live = data.cards.filter((c) => c.deckId === deck.id && !c.suspended)
  const byDue = (a, b) => a.due - b.due
  const learning = live.filter((c) => (c.state === 'learning' || c.state === 'relearning') && c.due <= now).sort(byDue)
  if (learning.length) return learning[0]
  const review = live.filter((c) => c.state === 'review' && c.due < eod).sort(byDue)
  if (review.length) return review[0]
  if (deck.newPerDay - dayCount(data, deck.id, now).new > 0) {
    const fresh = live.filter((c) => c.state === 'new').sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt - b.createdAt)
    if (fresh.length) return fresh[0]
  }
  const soon = live.filter((c) => (c.state === 'learning' || c.state === 'relearning') && c.due <= now + LEARN_AHEAD_MS).sort(byDue)
  return soon[0]
}

function cardView(c) {
  return {
    id: c.id,
    deckId: c.deckId,
    front: c.front,
    back: c.back,
    state: c.state,
    due: c.due,
    intervalDays: c.intervalDays ?? 0,
    reps: c.reps ?? 0,
    lapses: c.lapses ?? 0,
    suspended: !!c.suspended,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

/** The study view of a deck: next card with every rating's outcome, and the counts. */
function studyState(data, deckId, now) {
  const deck = findDeck(data, deckId)
  const card = pickNext(data, deck, now)
  const counts = deckCounts(data, deck, now)
  if (!card) return { deck: deckView(data, deck, now), counts, card: null, previews: null }
  const outcomes = schedule(card, now, { retention: deck.retention })
  const previews = {}
  for (const g of [1, 2, 3, 4]) previews[g] = outcomes[g].due - now
  return { deck: deckView(data, deck, now), counts, card: cardView(card), previews }
}

// ---------- changes ----------

function createDeck(data, args, now) {
  if (data.decks.length >= 1000) throw new Error('That is a lot of decks. Delete some first.')
  const deck = {
    id: newId(),
    name: text(args?.name, 'Deck name', LIMITS.name, { required: true }).trim(),
    description: text(args?.description, 'Description', LIMITS.description).trim(),
    newPerDay: Math.round(num(args?.newPerDay, 'New cards per day', 0, 9999, DEFAULT_DECK.newPerDay)),
    retention: num(args?.retention, 'Desired retention', 0.7, 0.99, DEFAULT_DECK.retention),
    createdAt: now,
  }
  data.decks.push(deck)
  return deck
}

function updateDeck(data, args) {
  const deck = findDeck(data, args?.id)
  if (args.name !== undefined) deck.name = text(args.name, 'Deck name', LIMITS.name, { required: true }).trim()
  if (args.description !== undefined) deck.description = text(args.description, 'Description', LIMITS.description).trim()
  if (args.newPerDay !== undefined) deck.newPerDay = Math.round(num(args.newPerDay, 'New cards per day', 0, 9999))
  if (args.retention !== undefined) deck.retention = num(args.retention, 'Desired retention', 0.7, 0.99)
  return deck
}

function deleteDeck(data, args) {
  const deck = findDeck(data, args?.id)
  data.decks = data.decks.filter((d) => d !== deck)
  const before = data.cards.length
  data.cards = data.cards.filter((c) => c.deckId !== deck.id)
  for (const day of Object.values(data.days)) delete day[deck.id]
  return { deleted: before - data.cards.length }
}

function addCards(data, deckId, list, now) {
  const deck = findDeck(data, deckId)
  if (!Array.isArray(list) || list.length === 0) throw new Error('No cards to add.')
  if (list.length > LIMITS.importBatch) throw new Error(`At most ${LIMITS.importBatch} cards at a time.`)
  if (data.cards.length + list.length > LIMITS.cardsPerFile) throw new Error(`MonoRail keeps at most ${LIMITS.cardsPerFile} cards.`)
  const cards = list.map((c, i) => ({
    front: text(c?.front, list.length > 1 ? `Card ${i + 1}: front` : 'Front', LIMITS.text, { required: true }),
    back: text(c?.back, list.length > 1 ? `Card ${i + 1}: back` : 'Back', LIMITS.text),
  }))
  let position = data.cards.reduce((m, c) => Math.max(m, c.position ?? 0), 0)
  const added = cards.map(({ front, back }) => ({
    id: newId(),
    deckId: deck.id,
    front,
    back,
    state: 'new',
    step: 0,
    due: now,
    stability: 0,
    difficulty: 0,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    suspended: false,
    position: ++position,
    createdAt: now,
    updatedAt: now,
  }))
  data.cards.push(...added)
  return added
}

function updateCard(data, args, now) {
  const card = findCard(data, args?.id)
  if (args.front !== undefined) card.front = text(args.front, 'Front', LIMITS.text, { required: true })
  if (args.back !== undefined) card.back = text(args.back, 'Back', LIMITS.text)
  if (args.deckId !== undefined && args.deckId !== card.deckId) card.deckId = findDeck(data, args.deckId).id
  if (args.suspended !== undefined) card.suspended = !!args.suspended
  card.updatedAt = now
  return card
}

/** Forget a card's progress: it becomes new again. */
function resetCard(data, args, now) {
  const card = findCard(data, args?.id)
  Object.assign(card, { state: 'new', step: 0, due: now, stability: 0, difficulty: 0, intervalDays: 0, reps: 0, lapses: 0, lastReview: null, updatedAt: now })
  return card
}

function deleteCard(data, args) {
  const card = findCard(data, args?.id)
  data.cards = data.cards.filter((c) => c !== card)
  return { ok: true }
}

/**
 * Apply a rating (1 again, 2 hard, 3 good, 4 easy). Returns the card as it
 * was before, for undo.
 */
function answer(data, args, now) {
  const card = findCard(data, args?.cardId)
  const rating = Number(args?.rating)
  if (![1, 2, 3, 4].includes(rating)) throw new Error('Rating must be 1 (again), 2 (hard), 3 (good) or 4 (easy).')
  if (!STATES.has(card.state)) card.state = 'new'
  const deck = findDeck(data, card.deckId)
  const before = { ...card }
  const next = schedule(card, now, { retention: deck.retention })[rating]
  Object.assign(card, next, { updatedAt: now })
  const key = dayKey(now)
  const day = (data.days[key] ??= {})
  const count = (day[deck.id] ??= { new: 0, reviews: 0 })
  count.reviews++
  if (before.state === 'new') count.new++
  return { before, after: { ...card }, dayKey: key }
}

/** Put a card back as it was before an answer, if nothing changed it since. */
function undoAnswer(data, undo) {
  const card = data.cards.find((c) => c.id === undo.before.id)
  if (!card || card.updatedAt !== undo.after.updatedAt || card.reps !== undo.after.reps) throw new Error('That answer can no longer be undone.')
  Object.assign(card, undo.before)
  const count = data.days[undo.dayKey]?.[card.deckId]
  if (count) {
    count.reviews = Math.max(0, count.reviews - 1)
    if (undo.before.state === 'new') count.new = Math.max(0, count.new - 1)
  }
  return card
}

/** Cards of a deck, filtered by a search over front and back. */
function listCards(data, args) {
  const deck = findDeck(data, args?.deckId)
  const q = typeof args?.query === 'string' ? args.query.trim().toLowerCase() : ''
  const cards = data.cards
    .filter((c) => c.deckId === deck.id && (!q || c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt - b.createdAt)
  const limit = 2000
  return { cards: cards.slice(0, limit).map(cardView), total: cards.length, truncated: cards.length > limit }
}

/**
 * Parse pasted lines into cards: one card per line, front and back split at
 * the first separator ('\t' or ';'). Lines without one are skipped.
 */
function parseImport(textValue, separator) {
  const sep = separator === ';' ? ';' : '\t'
  const cards = []
  let skipped = 0
  for (const line of String(textValue ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const i = line.indexOf(sep)
    if (i <= 0) {
      skipped++
      continue
    }
    const front = line.slice(0, i).trim()
    const back = line.slice(i + sep.length).trim()
    if (!front) {
      skipped++
      continue
    }
    cards.push({ front: front.replace(/\\n/g, '\n'), back: back.replace(/\\n/g, '\n') })
  }
  return { cards, skipped }
}

module.exports = {
  createStore,
  listDecks,
  studyState,
  createDeck,
  updateDeck,
  deleteDeck,
  addCards,
  updateCard,
  resetCard,
  deleteCard,
  answer,
  undoAnswer,
  listCards,
  parseImport,
  findDeck,
  deckView,
  cardView,
  dayKey,
  endOfDay,
  DECKS_FILE,
  LOCK_FILE,
  LIMITS,
}
