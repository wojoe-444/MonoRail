import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, CirclePlay, FileUp, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formatCount } from '@/lib/format'

import { call, errorText, useFlashcards } from './api'
import { CardDialog, ConfirmDialog, DeckDialog, ImportDialog } from './dialogs'
import { DueCounts } from './DueCounts'
import { formatDue, formatSpan, plainLine } from './format'
import type { View } from './FlashcardsPage'
import type { Card as FlashCard, CardList, CardState, DeckList } from './types'

const STATE: Record<CardState, { label: string; variant: 'info' | 'warning' | 'success' | 'destructive' }> = {
  new: { label: 'New', variant: 'info' },
  learning: { label: 'Learning', variant: 'warning' },
  relearning: { label: 'Relearning', variant: 'warning' },
  review: { label: 'Review', variant: 'success' },
}

/** A deck's cards: search, add, paste import, edit, suspend, reset, delete. */
export function CardsView({ deckId, go }: { deckId: string; go: (v: View) => void }) {
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(query), 200)
    return () => clearTimeout(t)
  }, [query])
  const { data, error: loadError, reload } = useFlashcards<CardList>('listCards', { deckId, query: q })
  const decks = useFlashcards<DeckList>('listDecks')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingDeck, setEditingDeck] = useState(false)
  const [editing, setEditing] = useState<FlashCard>()
  const [deleting, setDeleting] = useState<FlashCard>()
  const [error, setError] = useState<string>()

  const deck = data?.deck
  const ready = deck ? deck.counts.new + deck.counts.learning + deck.counts.review + deck.counts.learningSoon : 0
  const allDecks = decks.data?.decks ?? (deck ? [deck] : [])

  async function act(fn: () => Promise<unknown>) {
    setError(undefined)
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const now = Date.now()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Flashcards"
        title={deck?.name ?? 'Deck'}
        description={deck?.description || (deck ? `${formatCount(deck.counts.total)} ${deck.counts.total === 1 ? 'card' : 'cards'}, ${deck.newPerDay} new a day, ${Math.round(deck.retention * 100)}% target recall.` : undefined)}
        actions={
          <>
            <Button variant="outline" onClick={() => go({ name: 'decks' })}>
              <ArrowLeft /> Decks
            </Button>
            <Button variant="outline" disabled={!deck} onClick={() => setEditingDeck(true)}>
              <Pencil /> Edit deck
            </Button>
            <Button disabled={!ready} onClick={() => go({ name: 'study', deckId })}>
              <CirclePlay /> Study
            </Button>
          </>
        }
      />

      {(loadError || error) && <p className="text-sm text-destructive">{loadError || error}</p>}

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-4 px-6 py-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search front and back" className="pl-9" aria-label="Search cards" />
          </div>
          {deck && <DueCounts counts={deck.counts} className="ml-auto" />}
          <div className="flex gap-2">
            <Button variant="outline" disabled={!deck} onClick={() => setImporting(true)}>
              <FileUp /> Import
            </Button>
            <Button disabled={!deck} onClick={() => setAdding(true)}>
              <Plus /> Add cards
            </Button>
          </div>
        </div>
        {data && data.cards.length === 0 ? (
          <div className="border-t px-6 py-16 text-center text-sm text-muted-foreground">
            {q ? 'No card matches that search.' : 'This deck has no cards yet. Add some, or import a list.'}
          </div>
        ) : (
          <ul className="divide-y border-t">
            {data?.cards.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/40">
                <button type="button" className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-0.5 text-left md:grid-cols-2" onClick={() => setEditing(c)}>
                  <span className={c.suspended ? 'truncate text-sm text-muted-foreground line-through' : 'truncate text-sm'}>{plainLine(c.front)}</span>
                  <span className="truncate text-sm text-muted-foreground">{plainLine(c.back) || '—'}</span>
                </button>
                <span className="hidden w-24 justify-end sm:flex">
                  {c.suspended ? <Badge variant="secondary">Suspended</Badge> : <Badge variant={STATE[c.state].variant}>{STATE[c.state].label}</Badge>}
                </span>
                <span className="hidden w-28 text-right font-mono text-xs text-muted-foreground tabular-nums lg:block" title={c.state === 'new' ? undefined : new Date(c.due).toLocaleString()}>
                  {c.state === 'new' ? '—' : formatDue(c.due, now)}
                  {c.intervalDays > 0 && <span className="opacity-60"> · {formatSpan(c.intervalDays * 86_400_000)}</span>}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8" aria-label="More for this card">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void act(() => call('updateCard', { id: c.id, suspended: !c.suspended }))}>
                      <Ban /> {c.suspended ? 'Turn back on' : 'Suspend'}
                    </DropdownMenuItem>
                    {c.state !== 'new' && (
                      <DropdownMenuItem onSelect={() => void act(() => call('resetCard', { id: c.id }))}>
                        <RotateCcw /> Forget progress
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(c)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        {data?.truncated && <p className="border-t px-6 py-3 text-xs text-muted-foreground">Showing the first {formatCount(data.cards.length)} of {formatCount(data.total)} cards. Search to narrow it down.</p>}
      </Card>

      <CardDialog open={adding} deckId={deckId} decks={allDecks} onClose={() => setAdding(false)} onSaved={() => void reload()} />
      <CardDialog open={!!editing} deckId={deckId} card={editing} decks={allDecks} onClose={() => setEditing(undefined)} onSaved={() => void reload()} />
      {deck && <ImportDialog open={importing} deck={deck} onClose={() => setImporting(false)} onDone={() => void reload()} />}
      <DeckDialog
        open={editingDeck}
        deck={deck}
        onClose={() => setEditingDeck(false)}
        onSaved={() => {
          void reload()
          void decks.reload()
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete this card?"
        body={deleting ? `“${plainLine(deleting.front, 80)}” and its study progress will be deleted. It cannot be undone.` : ''}
        action="Delete card"
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          await call('deleteCard', { id: deleting!.id })
          await reload()
        }}
      />
    </div>
  )
}
