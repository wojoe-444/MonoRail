// Tests for the Flashcards scheduler and store, on fictional cards in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { schedule, retrievability, intervalDays, MINUTE, DAY } = require('./flashcards-fsrs.cjs')
const S = require('./flashcards-store.cjs')
const backend = require('./flashcards.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'flashcards-'))
const newCard = { state: 'new', step: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReview: null, due: 0 }
const call = (ctx, method, args) => backend.methods[method](ctx, args)

test('FSRS: recall is 90% after S days and the interval at 0.9 retention is S', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9)
  assert.equal(retrievability(0, 5), 1)
  assert.equal(intervalDays(12, 0.9), 12)
  assert.ok(intervalDays(12, 0.8) > intervalDays(12, 0.9))
  assert.ok(intervalDays(12, 0.95) < intervalDays(12, 0.9))
  assert.equal(intervalDays(0.1, 0.9), 1)
})

test('FSRS: a new card goes through learning steps; Easy graduates at once', () => {
  const now = Date.UTC(2026, 0, 1)
  const o = schedule(newCard, now)
  assert.equal(o[1].state, 'learning')
  assert.equal(o[1].due - now, 1 * MINUTE)
  assert.equal(o[2].due - now, 5.5 * MINUTE)
  assert.equal(o[3].due - now, 10 * MINUTE)
  assert.equal(o[3].step, 1)
  assert.equal(o[4].state, 'review')
  assert.ok(o[4].intervalDays >= 2)
  // Initial stability follows the rating: w0 < w1 < w2 < w3.
  assert.ok(o[1].stability < o[2].stability && o[2].stability < o[3].stability && o[3].stability < o[4].stability)
  // Initial difficulty falls as the rating rises.
  assert.ok(o[1].difficulty > o[2].difficulty && o[3].difficulty > o[4].difficulty)

  // Good on the last step graduates to review.
  const graduated = schedule(o[3], now + 10 * MINUTE)[3]
  assert.equal(graduated.state, 'review')
  assert.ok(graduated.intervalDays >= 1)
})

test('FSRS: review intervals keep Hard <= Good < Easy, and Again is a lapse', () => {
  const now = Date.UTC(2026, 0, 10)
  const card = { state: 'review', step: 0, stability: 8, difficulty: 5, reps: 4, lapses: 0, lastReview: now - 8 * DAY, due: now }
  const o = schedule(card, now)
  assert.ok(o[2].intervalDays <= o[3].intervalDays)
  assert.ok(o[3].intervalDays < o[4].intervalDays)
  assert.ok(o[3].stability > card.stability, 'a successful review on time grows stability')
  assert.equal(o[1].state, 'relearning')
  assert.equal(o[1].lapses, 1)
  assert.ok(o[1].stability <= card.stability, 'forgetting never raises stability')
  assert.equal(o[1].due - now, 10 * MINUTE)
  // A later review (lower recall) that succeeds grows stability more.
  const late = schedule({ ...card, lastReview: now - 20 * DAY }, now)
  assert.ok(late[3].stability > o[3].stability)
  for (const g of [1, 2, 3, 4]) assert.equal(o[g].reps, 5)
})

test('store: decks, cards, study queue, daily new limit and undo', async () => {
  const ctx = { dataDir: tmp() }
  const deck = await call(ctx, 'createDeck', { name: 'Capitals', newPerDay: 2 })
  assert.equal(deck.counts.total, 0)
  for (const [front, back] of [
    ['France', 'Paris'],
    ['Peru', 'Lima'],
    ['Kenya', 'Nairobi'],
  ])
    await call(ctx, 'addCard', { deckId: deck.id, front, back })

  let list = await call(ctx, 'listDecks')
  assert.equal(list.decks[0].counts.new, 2, 'new cards are capped at the daily limit')
  assert.equal(list.decks[0].counts.newTotal, 3)

  let st = await call(ctx, 'study', { deckId: deck.id })
  assert.equal(st.card.front, 'France', 'new cards come in the order they were added')
  assert.equal(st.previews[3], 10 * MINUTE)

  st = await call(ctx, 'answer', { cardId: st.card.id, rating: 4 }) // France: graduates
  assert.equal(st.card.front, 'Peru')
  st = await call(ctx, 'answer', { cardId: st.card.id, rating: 1 }) // Peru: back in 1 minute
  // Daily limit of 2 reached; Peru is due within 20 minutes, so it is shown early.
  assert.equal(st.card.front, 'Peru')
  assert.equal(st.counts.new, 0)
  assert.equal(st.counts.learningSoon, 1)

  // Undo puts Peru back to new and lowers today's count.
  st = await call(ctx, 'undo', { deckId: deck.id })
  assert.equal(st.card.front, 'Peru')
  assert.equal(st.card.state, 'new')
  assert.equal(st.canUndo, false)
  await assert.rejects(call(ctx, 'undo', { deckId: deck.id }), /nothing to undo/)

  list = await call(ctx, 'listDecks')
  assert.equal(list.reviewedToday, 1)
  assert.equal(list.decks[0].today.new, 1)
  assert.equal(list.history.length, 30)

  // Edit, suspend, search, reset and delete.
  const cards = await call(ctx, 'listCards', { deckId: deck.id, query: 'nairobi' })
  assert.equal(cards.total, 1)
  const kenya = cards.cards[0]
  await call(ctx, 'updateCard', { id: kenya.id, back: 'Nairobi (capital)', suspended: true })
  const after = await call(ctx, 'listCards', { deckId: deck.id })
  assert.equal(after.cards.find((c) => c.id === kenya.id).suspended, true)
  assert.equal((await call(ctx, 'listDecks')).decks[0].counts.suspended, 1)
  const france = after.cards.find((c) => c.front === 'France')
  assert.equal(france.state, 'review')
  assert.equal((await call(ctx, 'resetCard', { id: france.id })).state, 'new')
  await call(ctx, 'deleteCard', { id: kenya.id })
  assert.equal((await call(ctx, 'listCards', { deckId: deck.id })).total, 2)

  const del = await call(ctx, 'deleteDeck', { id: deck.id })
  assert.equal(del.deleted, 2)
  assert.deepEqual((await call(ctx, 'listDecks')).decks, [])
  assert.deepEqual(fs.readdirSync(ctx.dataDir), [S.DECKS_FILE], 'only the declared file stays, no lock or temp files')
})

test('store: paste import splits at the first separator and skips bad lines', async () => {
  assert.deepEqual(S.parseImport('a\tb\tc\nno separator\n\n\tempty front\nx\ty\\nz', '\t'), {
    cards: [
      { front: 'a', back: 'b\tc' },
      { front: 'x', back: 'y\nz' },
    ],
    skipped: 2,
  })
  assert.equal(S.parseImport('q;a', ';').cards[0].back, 'a')
  const ctx = { dataDir: tmp() }
  const deck = await call(ctx, 'createDeck', { name: 'Words' })
  assert.deepEqual(await call(ctx, 'importCards', { deckId: deck.id, text: 'hola\thello\nadios\tgoodbye\noops', separator: '\t' }), { added: 2, skipped: 1 })
  await assert.rejects(call(ctx, 'importCards', { deckId: deck.id, text: 'no tabs here', separator: '\t' }), /tab/)
})

test('store: validation and a damaged file is never overwritten', async () => {
  const ctx = { dataDir: tmp() }
  await assert.rejects(call(ctx, 'createDeck', { name: '  ' }), /empty/)
  await assert.rejects(call(ctx, 'createDeck', { name: 'x', retention: 2 }), /between/)
  const deck = await call(ctx, 'createDeck', { name: 'x' })
  await assert.rejects(call(ctx, 'addCard', { deckId: deck.id, front: '' }), /empty/)
  await assert.rejects(call(ctx, 'addCard', { deckId: '../etc', front: 'a' }), /Unknown deck/)
  await assert.rejects(call(ctx, 'answer', { cardId: 'ffffffffffffffff', rating: 3 }), /no longer exists/)

  const file = path.join(ctx.dataDir, S.DECKS_FILE)
  fs.writeFileSync(file, '{ broken')
  await assert.rejects(call(ctx, 'listDecks'), /damaged/)
  await assert.rejects(call(ctx, 'createDeck', { name: 'y' }), /damaged/)
  assert.equal(fs.readFileSync(file, 'utf8'), '{ broken')
})

test('store: concurrent changes from two stores (app and MCP server) all land', async () => {
  const dir = tmp()
  const a = S.createStore(dir)
  const b = S.createStore(dir)
  const deck = await a.update((data, now) => S.createDeck(data, { name: 'Shared' }, now))
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).update((data, now) => S.addCards(data, deck.id, [{ front: `q${i}`, back: `a${i}` }], now))),
  )
  assert.equal((await a.read()).cards.length, 20)
})
