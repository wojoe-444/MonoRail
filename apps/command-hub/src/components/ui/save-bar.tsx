import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './button'

/** How long "Saved" stays on screen after a save the backend confirmed. */
const SAVED_MS = 6000

export interface SaveBarProps {
  /** How many fields differ from what is saved (`countChanges` in lib/changes.ts); 0 means nothing is unsaved. */
  changes: number
  /** A save is running. */
  saving: boolean
  /** The last save failed; the draft is kept and the bar offers Try again. */
  error?: string
  /** `savedNow()` (lib/changes.ts) at the last save the backend confirmed. Shows "Saved" for a few seconds. */
  savedAt?: number
  /** Why Save cannot run yet, e.g. "Choose a folder first". Disables Save and is shown beside the count. */
  blocked?: string
  /** One plain line under "Saved", e.g. what happens next. */
  savedNote?: string
  /** What is being saved ("Backups"), for screen readers and pages with more than one bar. */
  label: string
  onSave: () => void
  onDiscard: () => void
  className?: string
}

/**
 * The sticky Save bar for forms that save as a unit (docs/guide/setup/saving.md).
 * Put it last inside the form's container: it rises to the bottom of the
 * scrolling area while there are unsaved changes, and after the save the
 * backend confirmed it says "Saved. Safe to leave." for a few seconds.
 * Its container must not clip (`overflow: hidden` stops sticky).
 */
export function SaveBar({ changes, saving, error, savedAt, blocked, savedNote, label, onSave, onDiscard, className }: SaveBarProps) {
  const justSaved = useRecent(savedAt, SAVED_MS)
  const state = saving ? 'saving' : error ? 'error' : changes > 0 ? 'dirty' : justSaved ? 'saved' : 'idle'
  if (state === 'idle') return <div role="status" aria-live="polite" className="sr-only" />

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${state === 'saved' ? 'saved' : state === 'saving' ? 'saving' : state === 'error' ? 'could not save' : 'unsaved changes'}`}
      data-state={state}
      className={cn(
        'sticky bottom-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-elevation-2 ring-1 ring-foreground/10',
        'animate-in fade-in-0 slide-in-from-bottom-2',
        className,
      )}
    >
      {state === 'saved' ? (
        <>
          <Check className="size-4 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <span className="font-medium">Saved.</span> Safe to leave.
            {savedNote && <div className="text-xs text-muted-foreground">{savedNote}</div>}
          </div>
        </>
      ) : (
        <>
          {state === 'error' ? (
            <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          ) : state === 'saving' ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          )}
          <div className="min-w-0 flex-1">
            {state === 'error' ? (
              <span className="text-destructive-soft-foreground">
                <span className="font-medium">Couldn't save.</span> {error}
              </span>
            ) : state === 'saving' ? (
              'Saving…'
            ) : (
              <>
                <span className="font-medium">
                  {changes} unsaved {changes === 1 ? 'change' : 'changes'}
                </span>
                {blocked && <span className="text-muted-foreground"> · {blocked}</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={saving} onClick={onDiscard}>
              Discard
            </Button>
            <Button size="sm" disabled={saving || !!blocked} title={blocked} onClick={onSave}>
              {saving && <Loader2 className="animate-spin" />}
              {state === 'error' ? 'Try again' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** True while `at` is less than `ms` old; re-renders when it runs out. */
function useRecent(at: number | undefined, ms: number): boolean {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!at) return
    const left = at + ms - Date.now()
    if (left <= 0) return
    const t = setTimeout(() => setNow(Date.now()), left)
    return () => clearTimeout(t)
  }, [at, ms])
  return !!at && now - at < ms
}
