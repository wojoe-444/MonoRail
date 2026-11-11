/** Shapes returned by electron/modules/flashcards.cjs. */

export type CardState = 'new' | 'learning' | 'review' | 'relearning'
export type Rating = 1 | 2 | 3 | 4

export interface DeckCounts {
  /** New cards still allowed today (daily limit applied). */
  new: number
  /** Every new card in the deck. */
  newTotal: number
  /** Learning and relearning cards due now. */
  learning: number
  /** Learning cards due within 20 minutes. */
  learningSoon: number
  /** Review cards due today. */
  review: number
  total: number
  suspended: number
  /** Next time something comes due (ms), when nothing is due now. */
  nextDue: number | null
}

export interface Deck {
  id: string
  name: string
  description: string
  newPerDay: number
  retention: number
  createdAt: number
  counts: DeckCounts
  today: { new: number; reviews: number }
}

export interface DeckList {
  decks: Deck[]
  history: { day: string; reviews: number }[]
  reviewedToday: number
}

export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  state: CardState
  due: number
  intervalDays: number
  reps: number
  lapses: number
  suspended: boolean
  createdAt: number
  updatedAt: number
}

export interface CardList {
  deck: Deck
  cards: Card[]
  total: number
  truncated: boolean
}

export interface StudyState {
  deck: Deck
  counts: DeckCounts
  card: Card | null
  /** Milliseconds from now until the card is due again, per rating. */
  previews: Record<Rating, number> | null
  canUndo: boolean
}
