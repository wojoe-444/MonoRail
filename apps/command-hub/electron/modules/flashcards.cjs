// Flashcards backend: spaced repetition decks kept in the module's data folder
// (decks.json, see flashcards-store.cjs; scheduler in flashcards-fsrs.cjs).
// Nothing leaves the computer and nothing is cached: every call reads the
// file, every change writes it.

const S = require('./flashcards-store.cjs')
const { schedule } = require('./flashcards-fsrs.cjs')

const stores = new Map()
function store(ctx) {
  let s = stores.get(ctx.dataDir)
  if (!s) stores.set(ctx.dataDir, (s = S.createStore(ctx.dataDir)))
  return s
}

/** The last answer per deck, so the review screen can undo it. Memory only. */
const undos = new Map()

module.exports = {
  id: 'flashcards',
  methods: {
    async listDecks(ctx) {
      return S.listDecks(await store(ctx).read(), Date.now())
    },

    async createDeck(ctx, args) {
      return store(ctx).update((data, now) => S.deckView(data, S.createDeck(data, args, now), now))
    },

    async updateDeck(ctx, args) {
      return store(ctx).update((data, now) => S.deckView(data, S.updateDeck(data, args), now))
    },

    async deleteDeck(ctx, args) {
      undos.delete(args?.id)
      return store(ctx).update((data) => S.deleteDeck(data, args))
    },

    async listCards(ctx, args) {
      const data = await store(ctx).read()
      return { deck: S.deckView(data, S.findDeck(data, args?.deckId), Date.now()), ...S.listCards(data, args) }
    },

    async addCard(ctx, args) {
      return store(ctx).update((data, now) => S.cardView(S.addCards(data, args?.deckId, [args], now)[0]))
    },

    /** Paste import: { deckId, text, separator: '\t' | ';' } -> { added, skipped }. */
    async importCards(ctx, args) {
      const { cards, skipped } = S.parseImport(args?.text, args?.separator)
      if (cards.length === 0) throw new Error(skipped ? `No line had a ${args?.separator === ';' ? 'semicolon' : 'tab'} between front and back.` : 'Nothing to import.')
      return store(ctx).update((data, now) => ({ added: S.addCards(data, args?.deckId, cards, now).length, skipped }))
    },

    async updateCard(ctx, args) {
      return store(ctx).update((data, now) => S.cardView(S.updateCard(data, args, now)))
    },

    async resetCard(ctx, args) {
      return store(ctx).update((data, now) => S.cardView(S.resetCard(data, args, now)))
    },

    async deleteCard(ctx, args) {
      return store(ctx).update((data) => S.deleteCard(data, args))
    },

    /** The next card of a deck with each rating's next due time (ms from now), or card: null. */
    async study(ctx, args) {
      const state = S.studyState(await store(ctx).read(), args?.deckId, Date.now())
      return { ...state, canUndo: undos.has(args?.deckId) }
    },

    /** Rate a card, then return the next study state. */
    async answer(ctx, args) {
      return store(ctx).update((data, now) => {
        const done = S.answer(data, args, now)
        undos.set(done.after.deckId, done)
        return { ...S.studyState(data, done.after.deckId, now), canUndo: true }
      })
    },

    async undo(ctx, args) {
      const u = undos.get(args?.deckId)
      if (!u) throw new Error('There is nothing to undo.')
      undos.delete(args.deckId)
      return store(ctx).update((data, now) => {
        S.undoAnswer(data, u)
        // Show the card that was undone again, whatever the queue would pick.
        const state = S.studyState(data, args.deckId, now)
        const card = data.cards.find((c) => c.id === u.before.id)
        if (card && !card.suspended && state.card?.id !== card.id) {
          const deck = S.findDeck(data, args.deckId)
          const outcomes = schedule(card, now, { retention: deck.retention })
          state.card = S.cardView(card)
          state.previews = Object.fromEntries([1, 2, 3, 4].map((g) => [g, outcomes[g].due - now]))
        }
        return { ...state, canUndo: false }
      })
    },
  },
}
