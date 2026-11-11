# Flashcards

**Workspace > Flashcards** keeps spaced repetition decks: each card comes back
just before you would forget it, so a few minutes a day is enough to remember
it for years.

## Decks and cards

- **New deck** asks for a name, how many new cards to introduce per day
  (default 20) and a target recall (default 90%). A higher target brings cards
  back sooner, so you review more often.
- Open a deck to see its cards. **Add cards** keeps the dialog open after each
  card (Ctrl+Enter adds); **Preview** shows how the card will look. Both sides
  are Markdown: bold, `code`, lists, tables and code blocks. Links and remote
  images are shown but never opened or fetched.
- **Import** takes pasted lines, one card per line: the front, a tab (or a
  semicolon) and the back. Copying two columns from a spreadsheet gives tab
  separated lines. Write `\n` for a line break inside a card.
- Each card's menu can edit it, move it to another deck, **Suspend** it (left
  out of studying until turned back on), **Forget progress** (it becomes new
  again) or delete it.

## Studying

**Study** shows the front of a card. Recall the answer, press **Show answer**
(Space), then say how well you knew it. Each button shows when the card will
come back:

| Button | Key | Meaning |
| --- | --- | --- |
| Again | 1 | Forgotten: the card is shown again in a few minutes |
| Hard | 2 | Recalled with real effort: a shorter interval |
| Good | 3 or Space | Recalled: the normal interval |
| Easy | 4 | Instantly: a longer interval |

**U** (or Ctrl+Z) undoes the last answer and **E** edits the card. The order is:
learning cards that are due, then reviews due today (most overdue first), then
new cards up to the daily limit. When nothing else is left, a learning card due
in the next 20 minutes is shown early.

The deck list shows three counts per deck: **New** (still allowed today),
**Learning** (due now) and **Due** (reviews due today).

## How the schedule works

MonoRail schedules cards with **FSRS** (Free Spaced Repetition Scheduler), an
open algorithm, using its published default weights. Every card has a
*stability* (how many days until your chance of recalling it falls to 90%) and
a *difficulty*. Each answer updates both, and the next review is set for when
your chance of recall reaches the deck's target. New cards first go through
two short learning steps (1 and 10 minutes); a forgotten card goes through one
10 minute relearning step before it gets an interval again.

## Where the data lives

Everything is in one file on this computer, `decks.json` in
`%APPDATA%\MonoRail\modules\flashcards` (older installs keep their original
data folder). It holds the decks, the cards and per-day study counts for the
last 90 days. Nothing is sent anywhere. If the file is ever damaged MonoRail
refuses to change it, so a backup copy of it can be put back.

## Agents

Agents connected to [MonoRail's MCP server](mcp.md) can read your decks
(`list_flashcard_decks`, `list_flashcards`) and, once you allow it for that
agent on **Configure > Agent access**, add cards with `add_flashcards`, for
example "make flashcards from this chapter". Every call is in the Activity log.
