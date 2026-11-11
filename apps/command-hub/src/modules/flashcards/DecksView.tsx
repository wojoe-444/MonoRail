import { useState } from 'react'
import { GraduationCap, Layers, ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { StatTile } from '@/components/charts/StatTile'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCount } from '@/lib/format'
import { isDesktop } from '@/modules/client'

import { call, useFlashcards } from './api'
import { ConfirmDialog, DeckDialog } from './dialogs'
import { DueCounts } from './DueCounts'
import { formatSpan } from './format'
import type { View } from './FlashcardsPage'
import type { Deck, DeckList } from './types'

export function DecksView({ go }: { go: (v: View) => void }) {
  const { data, error, reload } = useFlashcards<DeckList>('listDecks')
  const [editing, setEditing] = useState<{ deck?: Deck } | undefined>()
  const [deleting, setDeleting] = useState<Deck>()

  const decks = data?.decks ?? []
  const totals = decks.reduce(
    (t, d) => ({ due: t.due + d.counts.review + d.counts.learning, fresh: t.fresh + d.counts.new, cards: t.cards + d.counts.total }),
    { due: 0, fresh: 0, cards: 0 },
  )
  const week = data?.history.slice(-7).reduce((s, h) => s + h.reviews, 0) ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Workspace"
        title="Flashcards"
        description={`Spaced repetition decks: each card comes back just before you would forget it.${isDesktop() ? ' Kept on this computer only.' : ' Sample decks: nothing is saved in the browser preview.'}`}
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus /> New deck
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Due today" value={data ? formatCount(totals.due) : '–'} hint="reviews and learning cards" />
        <StatTile label="New today" value={data ? formatCount(totals.fresh) : '–'} hint="within each deck's daily limit" />
        <StatTile
          label="Reviewed today"
          value={data ? formatCount(data.reviewedToday) : '–'}
          hint={data ? `${formatCount(week)} in the last 7 days` : undefined}
          trend={data && <Sparkline data={data.history.map((h) => h.reviews)} className="text-primary" />}
        />
        <StatTile label="Cards" value={data ? formatCount(totals.cards) : '–'} hint={data ? `in ${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}` : undefined} />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="py-6">
          <CardTitle>Decks</CardTitle>
          <CardDescription>Study what is due, or open a deck to add and edit its cards.</CardDescription>
          <CardAction className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
            <DueCounts legend />
          </CardAction>
        </CardHeader>
        {data && decks.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Layers className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">No decks yet</span>
              <span className="max-w-md text-sm text-muted-foreground">
                Make a deck, then add cards one by one or paste a whole list from a spreadsheet.
              </span>
            </div>
            <Button onClick={() => setEditing({})}>
              <Plus /> New deck
            </Button>
          </div>
        ) : (
          <ul className="divide-y border-t">
            {decks.map((d) => {
              const ready = d.counts.new + d.counts.learning + d.counts.review + d.counts.learningSoon
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/40">
                  <button type="button" className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left" onClick={() => go({ name: 'cards', deckId: d.id })}>
                    <span className="truncate font-medium">{d.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {d.description || `${formatCount(d.counts.total)} ${d.counts.total === 1 ? 'card' : 'cards'}`}
                      {d.description && ` · ${formatCount(d.counts.total)} ${d.counts.total === 1 ? 'card' : 'cards'}`}
                    </span>
                  </button>
                  <DueCounts counts={d.counts} />
                  <div className="flex w-40 items-center justify-end gap-2">
                    {ready > 0 ? (
                      <Button size="sm" onClick={() => go({ name: 'study', deckId: d.id })}>
                        <GraduationCap /> Study
                      </Button>
                    ) : (
                      <span className="text-right text-xs text-muted-foreground">
                        {d.counts.total === 0 ? 'No cards yet' : d.counts.nextDue ? `Done · next in ${formatSpan(d.counts.nextDue - Date.now())}` : 'Done for today'}
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8" aria-label={`More for ${d.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => go({ name: 'cards', deckId: d.id })}>
                          <ListChecks /> Cards
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing({ deck: d })}>
                          <Pencil /> Edit deck
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(d)}>
                          <Trash2 /> Delete deck
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <DeckDialog open={!!editing} deck={editing?.deck} onClose={() => setEditing(undefined)} onSaved={() => void reload()} />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? 'deck'}?`}
        body={`This deletes the deck, its ${formatCount(deleting?.counts.total ?? 0)} cards and their study progress. It cannot be undone.`}
        action="Delete deck"
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          await call('deleteDeck', { id: deleting!.id })
          await reload()
        }}
      />
    </div>
  )
}
