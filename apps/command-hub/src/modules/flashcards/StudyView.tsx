import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Ban, Loader2, PartyPopper, Pencil, Undo2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { call, errorText, useFlashcards } from './api'
import { CardText } from './CardText'
import { CardDialog } from './dialogs'
import { formatSpan } from './format'
import type { View } from './FlashcardsPage'
import type { Card as FlashCard, DeckList, Rating, StudyState } from './types'

const RATINGS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: 'Again', className: 'bg-destructive-soft text-destructive-soft-foreground hover:bg-destructive-soft/70' },
  { rating: 2, label: 'Hard', className: 'bg-warning-soft text-warning-soft-foreground hover:bg-warning-soft/70' },
  { rating: 3, label: 'Good', className: 'bg-success-soft text-success-soft-foreground hover:bg-success-soft/70' },
  { rating: 4, label: 'Easy', className: 'bg-info-soft text-info-soft-foreground hover:bg-info-soft/70' },
]

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/**
 * One study session: front, Show answer (Space), then rate it 1-4. Space or
 * Enter on the answer means Good. U or Ctrl+Z undoes the last answer, E edits.
 */
export function StudyView({ deckId, go }: { deckId: string; go: (v: View) => void }) {
  const { data: state, setData: setState, error: loadError } = useFlashcards<StudyState>('study', { deckId })
  const decks = useFlashcards<DeckList>('listDecks')
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState(false)
  const [done, setDone] = useState(0)

  const run = useCallback(
    async (method: string, args: Record<string, unknown>, counts = false) => {
      setBusy(true)
      setError(undefined)
      try {
        const next = await call<StudyState>(method, args)
        setState(next)
        setRevealed(method === 'undo')
        if (counts) setDone((n) => n + 1)
        if (method === 'undo') setDone((n) => Math.max(0, n - 1))
      } catch (e) {
        setError(errorText(e))
      } finally {
        setBusy(false)
      }
    },
    [setState],
  )

  const card = state?.card
  const rate = useCallback((r: Rating) => card && !busy && run('answer', { cardId: card.id, rating: r }, true), [card, busy, run])
  const undo = useCallback(() => state?.canUndo && !busy && run('undo', { deckId }), [state, busy, run, deckId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || typing(e.target) || e.altKey) return
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || (e.key === 'u' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        void undo()
        return
      }
      if (e.ctrlKey || e.metaKey || !card) return
      if (e.key === 'e') {
        e.preventDefault()
        setEditing(true)
      } else if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        void rate(3)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        void rate(Number(e.key) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, card, revealed, rate, undo])

  async function suspend(c: FlashCard) {
    setBusy(true)
    try {
      await call('updateCard', { id: c.id, suspended: true })
      setState(await call<StudyState>('study', { deckId }))
      setRevealed(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const counts = state?.counts
  const deck = state?.deck

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Studying"
        title={deck?.name ?? 'Flashcards'}
        description={done > 0 ? `${done} ${done === 1 ? 'card' : 'cards'} studied this session.` : 'Recall the answer, then say how well you knew it.'}
        actions={
          <>
            <Button variant="outline" disabled={!state?.canUndo || busy} onClick={() => void undo()} title="Undo the last answer (U)">
              <Undo2 /> Undo
            </Button>
            <Button variant="outline" onClick={() => go({ name: 'decks' })}>
              <ArrowLeft /> Decks
            </Button>
          </>
        }
      />

      {(loadError || error) && <p className="text-sm text-destructive">{loadError || error}</p>}

      {counts && (
        <div className="flex items-center justify-center gap-6 font-mono text-sm tabular-nums">
          <Count label="New" n={counts.new} className="text-info" active={card?.state === 'new'} />
          <Count label="Learning" n={counts.learning + counts.learningSoon} className="text-warning-soft-foreground" active={card?.state === 'learning' || card?.state === 'relearning'} />
          <Count label="Due" n={counts.review} className="text-success" active={card?.state === 'review'} />
        </div>
      )}

      {state && !card && (
        <Card className="mx-auto w-full max-w-3xl items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-success-soft text-success-soft-foreground">
            <PartyPopper className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{done > 0 ? 'All done for now' : 'Nothing to study right now'}</span>
            <span className="text-sm text-muted-foreground">
              {counts?.nextDue ? `The next card comes back in ${formatSpan(counts.nextDue - Date.now())}.` : counts?.newTotal ? 'You have reached today\'s limit of new cards.' : 'Add cards to this deck to study them.'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => go({ name: 'cards', deckId })}>
              Cards
            </Button>
            <Button onClick={() => go({ name: 'decks' })}>Back to decks</Button>
          </div>
        </Card>
      )}

      {card && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Card className="min-h-80 gap-0 py-0">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs text-muted-foreground">
              <span className="capitalize">{card.state === 'relearning' ? 'Relearning' : card.state}{card.lapses > 0 && ` · forgotten ${card.lapses}×`}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setEditing(true)} title="Edit card (E)">
                  <Pencil /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" disabled={busy} onClick={() => void suspend(card)} title="Leave this card out of studying until you turn it back on">
                  <Ban /> Suspend
                </Button>
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-6 px-8 py-10">
              <CardText text={card.front} />
              {revealed && (
                <>
                  <div className="border-t" />
                  <CardText text={card.back || '*No back*'} />
                </>
              )}
            </div>
          </Card>

          {!revealed ? (
            <Button size="lg" className="mx-auto w-full max-w-xs" onClick={() => setRevealed(true)}>
              Show answer <kbd className="ml-1 rounded bg-primary-foreground/15 px-1.5 font-mono text-xs">Space</kbd>
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RATINGS.map((r) => (
                <button
                  key={r.rating}
                  type="button"
                  disabled={busy}
                  onClick={() => void rate(r.rating)}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50',
                    r.className,
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {busy && r.rating === 3 ? <Loader2 className="size-3.5 animate-spin" /> : <kbd className="font-mono text-xs opacity-60">{r.rating}</kbd>}
                    {r.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums opacity-80">{state?.previews ? formatSpan(state.previews[r.rating]) : ''}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {revealed ? 'Keys 1 to 4 rate the card; Space means Good.' : 'Space shows the answer.'} U undoes, E edits.
          </p>
        </div>
      )}

      {card && (
        <CardDialog
          open={editing}
          deckId={deckId}
          card={card}
          decks={decks.data?.decks ?? (deck ? [deck] : [])}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            if (saved.deckId !== deckId) void call<StudyState>('study', { deckId }).then(setState)
            else setState((s) => (s ? { ...s, card: saved } : s))
          }}
        />
      )}
    </div>
  )
}

function Count({ label, n, className, active }: { label: string; n: number; className: string; active?: boolean }) {
  return (
    <span className={cn('flex items-baseline gap-1.5', active && 'underline decoration-2 underline-offset-4')}>
      <span className="font-sans text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', n ? className : 'text-muted-foreground/60')}>{n}</span>
    </span>
  )
}
