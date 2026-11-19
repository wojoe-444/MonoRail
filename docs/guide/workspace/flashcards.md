---
audience: human, ai
summary: Spaced-repetition decks scheduled with FSRS, supporting Markdown cards, bulk import and agent card creation.
---

# Flashcards

**Tools > Flashcards** schedules spaced-repetition decks with **FSRS** so every
card returns right before you would forget it. Part of
[your workspace](README.md); agents can also add cards through
[agent access](../agents/agent-access.md).

## Decks and cards

- **New deck**: set name, daily new-card limit (default 20) and target recall
  (default 90%; higher brings cards back sooner).
- **Add cards**: Markdown on both sides (`Ctrl+Enter` adds and keeps the dialog
  open; links and remote images never load automatically).
- **Import**: paste one card per line (`front<tab>back` or `front;back`; use
  `\n` for line breaks).
- Each card's menu lets you edit, move, **Suspend**, **Forget progress** or
  delete.

## Studying

Press **Space** to flip, then rate recall (each button previews the next
interval):

| Rating | Key | Effect |
| --- | --- | --- |
| **Again** | `1` | Forgotten — back in minutes |
| **Hard** | `2` | Shorter interval |
| **Good** | `3` / `Space` | Standard interval |
| **Easy** | `4` | Longer interval |

`U` (`Ctrl+Z`) undoes the last answer; `E` edits the card. Queue order: due
learning cards → due reviews (most overdue first) → new cards up to the daily
limit. Deck rows display **New**, **Learning** and **Due** counts.

## How the schedule works

Uses **FSRS** (Free Spaced Repetition Scheduler) with published default weights,
tracking each card's *stability* and *difficulty* (1 min and 10 min learning
steps; 10 min relearning step).

## Where the data lives

Stored locally in `%APPDATA%\MonoRail\modules\flashcards\decks.json` (decks,
cards and 90-day study counts) and included in
[backups](../setup/backups-and-updates.md). Damaged files are never overwritten
so you can restore safely ([private data stays local](../private-data.md)).

## Agents

Connected agents ([MCP reference](../../mcp.md)) can read decks
(`list_flashcard_decks`, `list_flashcards`) and, once approved per agent in
**Settings > Agent access**, create cards (`add_flashcards`). Standard types:
[Flashcard deck](../../standard/monorail/learning.md#flashcard-deck) and
[Flashcard](../../standard/monorail/learning.md#flashcard)
([MonoRail standard](../../standard/README.md)).
