import { useEffect, useMemo, useState } from 'react'
import { Popover as P } from 'radix-ui'
import { Check, Loader2, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'

import { errorText, jiraApi } from '../api'
import { Lozenge, TypeIcon } from '../bits'
import type { ParentRef, Source } from '../types'

const KEY = /^[A-Z][A-Z0-9]+-\d+$/

/** Type icon + key (+ summary): how a parent shows on cards, rows and the issue view. */
export function ParentChip({ parent, withSummary = true, className }: { parent: ParentRef; withSummary?: boolean; className?: string }) {
  return (
    <span
      title={parent.summary ? `Parent: ${parent.key} ${parent.summary}` : `Parent: ${parent.key}`}
      className={cn('inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] leading-4 font-medium text-primary-soft-foreground', className)}
    >
      <TypeIcon type={parent.type ?? 'Epic'} className="size-3.5" />
      <span className="font-semibold whitespace-nowrap">{parent.key}</span>
      {withSummary && parent.summary && <span className="truncate">{parent.summary}</span>}
    </span>
  )
}

/** Parent issues to choose from, loaded when asked for. */
function useParentOptions(args: { source: Source; key?: string; projectKey?: string } | undefined) {
  const [options, setOptions] = useState<ParentRef[]>()
  const [error, setError] = useState<string>()
  const id = args ? `${args.source}:${args.key ?? ''}:${args.projectKey ?? ''}` : ''
  useEffect(() => {
    if (!args) return
    let live = true
    setOptions(undefined)
    setError(undefined)
    jiraApi()
      .parentOptions(args)
      .then((o) => live && setOptions(o), (e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  return { options, error }
}

/**
 * The Parent row in Details: shows the parent and opens a searchable list of
 * issues in the same project. Team Jira lists open issues and also takes a
 * typed key, since Jira decides which hierarchies it allows.
 */
export function ParentPicker({
  source,
  issueKey,
  value,
  disabled,
  onChange,
}: {
  source: Source
  issueKey: string
  value?: ParentRef
  disabled: boolean
  onChange: (parent: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { options, error } = useParentOptions(open ? { source, key: issueKey } : undefined)

  const q = query.trim()
  const shown = useMemo(() => {
    const words = q.toLowerCase()
    return (options ?? []).filter((o) => !words || `${o.key} ${o.summary ?? ''}`.toLowerCase().includes(words)).slice(0, 50)
  }, [options, q])
  const typedKey = q.toUpperCase()
  const offerTyped = source === 'jira' && KEY.test(typedKey) && typedKey !== issueKey && !shown.some((o) => o.key === typedKey)

  const pick = (key: string | null) => {
    setOpen(false)
    setQuery('')
    if (key !== (value?.key ?? null)) onChange(key)
  }

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <div className="flex min-h-8 items-center gap-1">
        <P.Trigger asChild disabled={disabled}>
          <button type="button" className="jp-focusable -ml-1 flex min-h-8 min-w-0 flex-1 items-center rounded-md px-1 text-left outline-none hover:bg-(--jp-hover)">
            {value ? <ParentChip parent={value} /> : <span className="text-(--jp-subtle)">None</span>}
          </button>
        </P.Trigger>
        {value && !disabled && (
          <button type="button" className="jp-btn jp-btn-subtle size-6 px-0" aria-label="Remove parent" title="Remove parent" onClick={() => pick(null)}>
            <X />
          </button>
        )}
      </div>
      <P.Portal>
        <P.Content align="start" sideOffset={4} className="jp z-50 w-[360px] rounded-md bg-(--jp-raised) shadow-(--jp-shadow-overlay) outline-none">
          <div className="relative p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-(--jp-subtlest)" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={source === 'jira' ? 'Search or type a key, like PLAT-100' : 'Search this project'}
              aria-label="Find a parent issue"
              className="jp-field h-8 min-h-0 py-0 pl-8"
            />
          </div>
          <div className="max-h-72 overflow-y-auto pb-1.5">
            {!options && !error && (
              <div className="flex items-center gap-2 px-4 py-2 text-(--jp-subtle)">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {error && <div className="px-4 py-2 text-(--jp-danger)">{error}</div>}
            {offerTyped && (
              <OptionRow onPick={() => pick(typedKey)}>
                <span className="font-semibold">Use {typedKey}</span>
              </OptionRow>
            )}
            {shown.map((o) => (
              <OptionRow key={o.key} onPick={() => pick(o.key)}>
                <TypeIcon type={o.type ?? 'Task'} />
                <span className="text-xs font-semibold whitespace-nowrap text-(--jp-subtle)">{o.key}</span>
                <span className="min-w-0 flex-1 truncate">{o.summary}</span>
                {o.key === value?.key ? (
                  <Check className="size-4 text-(--jp-selected-fg)" />
                ) : (
                  o.status && <Lozenge status={o.status} category={o.statusCategory ?? 'todo'} />
                )}
              </OptionRow>
            ))}
            {options && !shown.length && !offerTyped && (
              <div className="px-4 py-2 text-(--jp-subtle)">{q ? 'No issues match.' : 'No other issues in this project yet.'}</div>
            )}
          </div>
          <p className="border-t border-(--jp-border) px-4 py-2 text-xs text-(--jp-subtlest)">
            {source === 'jira'
              ? 'Open issues in this project. Your Jira decides which types can be parents.'
              : 'Any issue in this project can be a parent, except this one and those under it.'}
          </p>
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}

function OptionRow({ onPick, children }: { onPick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onPick} className="flex w-full items-center gap-2 px-4 py-1.5 text-left outline-none hover:bg-(--jp-hover) focus-visible:bg-(--jp-hover)">
      {children}
    </button>
  )
}

/** Parent field in Create issue: a plain select of issues in the chosen project. */
export function ParentSelect({ id, source, projectKey, value, onChange, disabled }: { id: string; source: Source; projectKey: string; value: string; onChange: (key: string) => void; disabled?: boolean }) {
  const { options, error } = useParentOptions({ source, projectKey })
  // A preset parent (from "Add child issue") stays listed even before the options arrive.
  const list = options ?? []
  const missing = value && !list.some((o) => o.key === value)
  return (
    <>
      <select id={id} className="jp-field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || (!options && !value)}>
        <option value="">None</option>
        {missing && <option value={value}>{value}</option>}
        {list.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key} {o.summary}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-(--jp-danger)">{error}</p>}
    </>
  )
}
