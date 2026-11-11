import { useState } from 'react'

import { DecksView } from './DecksView'
import { CardsView } from './CardsView'
import { StudyView } from './StudyView'

export type View = { name: 'decks' } | { name: 'study'; deckId: string } | { name: 'cards'; deckId: string }

/**
 * Flashcards: spaced repetition decks (electron/modules/flashcards.cjs).
 * Three views on one route: the deck list, a deck's cards, and a study session.
 */
export default function FlashcardsPage() {
  const [view, setView] = useState<View>({ name: 'decks' })
  if (view.name === 'study') return <StudyView key={view.deckId} deckId={view.deckId} go={setView} />
  if (view.name === 'cards') return <CardsView key={view.deckId} deckId={view.deckId} go={setView} />
  return <DecksView go={setView} />
}
