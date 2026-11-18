---
audience: human, ai
summary: MonoRail's own entity types for learning: flashcard decks and cards.
---

# Learning

Entity types of MonoRail's own for spaced repetition study
([Flashcards](../flashcards.md)). OpenMetadata has no words for these, so the
[MonoRail standard](README.md) defines them in its style (see the
[rules](README.md#rules)). Both are listed on [Explore](../guide/explore.md)
under **Learning**.

<!-- standard:entities learning -->

| Entity | Type | What it is | In MonoRail |
| --- | --- | --- | --- |
| [Flashcard deck](learning.md#flashcard-deck) | `flashcardDeck` | A deck of spaced repetition cards with its own daily limit and target recall. | Tools > Flashcards |
| [Flashcard](learning.md#flashcard) | `flashcard` | One card: a Markdown front and back, scheduled with FSRS-5. | Tools > Flashcards |

<!-- /standard -->

## Flashcard deck

A deck of cards with its own daily limit for new cards and target recall
([Decks and cards](../flashcards.md#decks-and-cards)).

<!-- standard:fields flashcardDeck -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | The deck's id. |
| `name` | `string` | Yes | Its name. |
| `description` | `string` | Yes | What it covers. |
| `newPerDay` | `number` | Yes | New cards per day (default 20). |
| `retention` | `number` | Yes | Target recall, 0 to 1 (default 0.9). |
| `createdAt` | `timestamp` | Yes | When it was made, ms since epoch. |
| `counts` | `deckCounts` | Yes | Cards by state: new (today's allowance), newTotal, learning, review and so on. |
| `today` | `object` | Yes | Studied today: `new` and `reviews`. |

<!-- /standard -->

## Flashcard

One card in a [deck](#flashcard-deck): a Markdown front and back, scheduled
with FSRS-5 ([How the schedule works](../flashcards.md#how-the-schedule-works)).

<!-- standard:fields flashcard -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | The card's id. |
| `deckId` | `string` | Yes | The deck it belongs to. |
| `front` | `markdown` | Yes | The question side. |
| `back` | `markdown` | Yes | The answer side. |
| `state` | `enum` | Yes | `new`, `learning`, `review` or `relearning`. |
| `due` | `timestamp` | Yes | When it is next due, ms since epoch. |
| `intervalDays` | `number` | Yes | Days between the last review and the next. |
| `reps` | `number` | Yes | Times reviewed. |
| `lapses` | `number` | Yes | Times forgotten after being learned. |
| `suspended` | `boolean` | Yes | Left out of study. |
| `createdAt` | `timestamp` | Yes | When it was made, ms since epoch. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |

<!-- /standard -->
