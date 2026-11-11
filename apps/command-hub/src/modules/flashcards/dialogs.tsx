import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'

import { call, errorText } from './api'
import { CardText } from './CardText'
import type { Card, Deck } from './types'

const RETENTION = [0.8, 0.85, 0.9, 0.95]

/** Create a deck (deck undefined) or edit one. */
export function DeckDialog({ open, deck, onClose, onSaved }: { open: boolean; deck?: Deck; onClose: () => void; onSaved: (d: Deck) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [newPerDay, setNewPerDay] = useState('20')
  const [retention, setRetention] = useState(0.9)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setName(deck?.name ?? '')
    setDescription(deck?.description ?? '')
    setNewPerDay(String(deck?.newPerDay ?? 20))
    setRetention(deck?.retention ?? 0.9)
    setError(undefined)
  }, [open, deck])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const args = { name, description, newPerDay: Number(newPerDay), retention }
      const saved = await call<Deck>(deck ? 'updateDeck' : 'createDeck', deck ? { id: deck.id, ...args } : args)
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const retentionOptions = RETENTION.includes(retention) ? RETENTION : [...RETENTION, retention].sort()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{deck ? 'Edit deck' : 'New deck'}</DialogTitle>
            <DialogDescription>Decks and cards are kept on this computer only.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fc-deck-name">Name</Label>
              <Input id="fc-deck-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fc-deck-desc">Description</Label>
              <Input id="fc-deck-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fc-deck-new">New cards per day</Label>
                <Input id="fc-deck-new" type="number" min={0} max={9999} value={newPerDay} onChange={(e) => setNewPerDay(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fc-deck-ret">Target recall</Label>
                <NativeSelect id="fc-deck-ret" value={String(retention)} onChange={(e) => setRetention(Number(e.target.value))}>
                  {retentionOptions.map((r) => (
                    <option key={r} value={String(r)}>
                      {Math.round(r * 100)}%{r === 0.9 ? ' (recommended)' : ''}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Target recall is how likely you should be to remember a card when it comes back. Higher means shorter intervals and more reviews.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} {deck ? 'Save' : 'Create deck'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Add cards to a deck (card undefined: stays open after each add, Ctrl+Enter
 * adds) or edit one card, including moving it to another deck.
 */
export function CardDialog({
  open,
  deckId,
  card,
  decks,
  onClose,
  onSaved,
}: {
  open: boolean
  deckId: string
  card?: Card
  decks: Deck[]
  onClose: () => void
  onSaved: (c: Card) => void
}) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [target, setTarget] = useState(deckId)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [added, setAdded] = useState(0)
  const frontRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setFront(card?.front ?? '')
    setBack(card?.back ?? '')
    setTarget(card?.deckId ?? deckId)
    setMode('edit')
    setError(undefined)
    setAdded(0)
  }, [open, card, deckId])

  async function save() {
    if (!front.trim() || busy) return
    setBusy(true)
    setError(undefined)
    try {
      if (card) {
        const saved = await call<Card>('updateCard', { id: card.id, front, back, deckId: target })
        onSaved(saved)
        onClose()
      } else {
        const saved = await call<Card>('addCard', { deckId: target, front, back })
        onSaved(saved)
        setAdded((n) => n + 1)
        setFront('')
        setBack('')
        setMode('edit')
        requestAnimationFrame(() => frontRef.current?.focus())
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle>{card ? 'Edit card' : 'Add cards'}</DialogTitle>
          <DialogDescription>Markdown works on both sides: **bold**, `code`, lists and tables.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-48 flex-col gap-2">
              <Label htmlFor="fc-card-deck">Deck</Label>
              <NativeSelect id="fc-card-deck" value={target} onChange={(e) => setTarget(e.target.value)}>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Segmented
              value={mode}
              aria-label="Write or preview"
              onChange={setMode}
              options={[
                { value: 'edit', label: 'Write' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
          </div>
          {mode === 'edit' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fc-card-front">Front</Label>
                <Textarea id="fc-card-front" ref={frontRef} value={front} onChange={(e) => setFront(e.target.value)} rows={4} autoFocus maxLength={20000} placeholder="The question or prompt" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fc-card-back">Back</Label>
                <Textarea id="fc-card-back" value={back} onChange={(e) => setBack(e.target.value)} rows={5} maxLength={20000} placeholder="The answer" />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 rounded-lg bg-muted/40 px-6 py-6 ring-1 ring-foreground/10">
              <CardText text={front || '*Front is empty*'} />
              <div className="border-t" />
              <CardText text={back || '*Back is empty*'} />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="items-center">
          {!card && added > 0 && <span className="mr-auto text-sm text-muted-foreground">{added === 1 ? '1 card added' : `${added} cards added`}</span>}
          <Button type="button" variant="outline" onClick={onClose}>
            {card || added === 0 ? 'Cancel' : 'Done'}
          </Button>
          <Button type="button" disabled={busy || !front.trim()} onClick={() => void save()} title="Ctrl+Enter">
            {busy && <Loader2 className="animate-spin" />} {card ? 'Save' : 'Add card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Paste many cards at once: one per line, front and back split by a tab or a semicolon. */
export function ImportDialog({ open, deck, onClose, onDone }: { open: boolean; deck: Deck; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [separator, setSeparator] = useState<'\t' | ';'>('\t')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<{ added: number; skipped: number }>()

  useEffect(() => {
    if (!open) return
    setText('')
    setError(undefined)
    setResult(undefined)
  }, [open])

  async function run() {
    setBusy(true)
    setError(undefined)
    try {
      const r = await call<{ added: number; skipped: number }>('importCards', { deckId: deck.id, text, separator })
      setResult(r)
      setText('')
      onDone()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cards into {deck.name}</DialogTitle>
          <DialogDescription>
            One card per line: the front, a separator, then the back. Copying two columns from a spreadsheet gives tab-separated lines. Write \n for a line break inside a card.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="fc-import-sep">Separator</Label>
            <NativeSelect id="fc-import-sep" className="w-40" value={separator === '\t' ? 'tab' : 'semicolon'} onChange={(e) => setSeparator(e.target.value === 'tab' ? '\t' : ';')}>
              <option value="tab">Tab</option>
              <option value="semicolon">Semicolon (;)</option>
            </NativeSelect>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder={separator === '\t' ? 'hola\thello\nadiós\tgoodbye' : 'hola;hello\nadiós;goodbye'}
            aria-label="Cards to import"
          />
          {result && (
            <p className="text-sm text-success">
              Added {result.added} {result.added === 1 ? 'card' : 'cards'}
              {result.skipped > 0 && <span className="text-muted-foreground">; skipped {result.skipped} {result.skipped === 1 ? 'line' : 'lines'} without a separator</span>}.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button disabled={busy || !text.trim()} onClick={() => void run()}>
            {busy && <Loader2 className="animate-spin" />} Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Confirm a destructive step. */
export function ConfirmDialog({
  open,
  title,
  body,
  action,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  action: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (open) setError(undefined)
  }, [open])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } catch (e) {
                setError(errorText(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
