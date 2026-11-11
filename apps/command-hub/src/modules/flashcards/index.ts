import { lazy } from 'react'
import { Layers } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Flashcards: spaced repetition decks kept in the module's data folder, scheduled
 * with FSRS (electron/modules/flashcards.cjs).
 */
export const flashcardsModule: ModuleDefinition = {
  id: 'flashcards',
  title: 'Flashcards',
  description: 'Spaced repetition decks: study what is due, add and edit cards.',
  icon: Layers,
  path: '/flashcards',
  nav: { section: 'Workspace' },
  component: lazy(() => import('./FlashcardsPage')),
  dataMethods: ['listDecks', 'createDeck', 'updateDeck', 'deleteDeck', 'listCards', 'addCard', 'importCards', 'updateCard', 'resetCard', 'deleteCard', 'study', 'answer', 'undo'],
}
