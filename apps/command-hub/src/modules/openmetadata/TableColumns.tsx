import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Key, Loader2, Pencil, Tag, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useCall } from './api'
import { Description } from './EntityView'
import { FillBar, KeyBadge, TestBadge, TestMark, TypeChip } from './table-parts'
import { columnLineage, filledShare, percentText, shortColumn, type TableColumn, type TableTest } from './table'
import { ago, displayName, type View } from './util'
import type { OmEntity } from './types'

type Filter = 'all' | 'keys' | 'terms' | 'tags' | 'tested' | 'undocumented'

const FILTERS: { value: Filter; label: string; icon?: ReactNode; test: (c: TableColumn, tested: Set<string>) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'keys', label: 'Keys', icon: <Key aria-hidden />, test: (c) => !!c.key },
  { value: 'terms', label: 'Glossary', icon: <BookOpen aria-hidden />, test: (c) => c.terms.length > 0 },
  { value: 'tags', label: 'Tagged', icon: <Tag aria-hidden />, test: (c) => c.tags.length > 0 },
  { value: 'tested', label: 'Tested', test: (c, tested) => tested.has(c.col.name) },
  { value: 'undocumented', label: 'Undocumented', icon: <Pencil aria-hidden />, test: (c) => !c.col.description?.trim() },
]

/**
 * Every column of the table, searchable and filterable, with how full each
 * is. Clicking one opens the inspector beside the list: its profile, value
 * spread, tests, terms and column lineage.
 */
export function ColumnsTab({ entity, columns, tests, rowCount, profiledAt, profileLoading, selected, onSelect, onOpen }: {
  entity: OmEntity
  columns: TableColumn[]
  tests: TableTest[]
  rowCount?: number
  profiledAt?: number
  profileLoading: boolean
  selected?: string
  onSelect: (path: string | undefined) => void
  onOpen: (v: View) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const tested = useMemo(() => new Set(tests.flatMap((t) => (t.column ? [t.column] : []))), [tests])
  const q = query.trim().toLowerCase()
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, columns.filter((c) => f.test(c, tested)).length])) as Record<Filter, number>
  const test = FILTERS.find((f) => f.value === filter)!.test
  const shown = columns.filter((c) => test(c, tested) && (!q || [c.path, c.col.displayName, c.col.description].some((s) => s?.toLowerCase().includes(q))))
  const current = columns.find((c) => c.path === selected)
  const open = !!current
  const profiled = columns.some((c) => c.profile)

  return (
    <div className="@container">
      <Card className={cn('grid gap-0 overflow-hidden py-0', open && '@4xl:grid-cols-[minmax(0,1fr)_26rem]')}>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Columns</h3>
              <p className="text-xs text-muted-foreground">
                {columns.length} {columns.length === 1 ? 'column' : 'columns'} · {counts.undocumented} without a description · {counts.keys} {counts.keys === 1 ? 'key' : 'keys'}
                {profiled ? ` · profiled ${ago(profiledAt)}` : profileLoading ? '' : ' · not profiled yet'}. Click a column for its profile.
              </p>
            </div>
            <SearchField size="sm" className="w-full sm:w-56" aria-label="Find a column" placeholder="Find a column" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 px-6 pb-3" role="group" aria-label="Show columns">
            {FILTERS.filter((f) => f.value === 'all' || counts[f.value] > 0 || f.value === filter).map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors [&>svg]:size-3',
                  filter === f.value ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted',
                )}
              >
                {f.icon}
                {f.label} <span className="tabular-nums">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 pl-6 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  {!open && <th className="px-3 py-2 font-medium">Description</th>}
                  {!open && <th className="hidden px-3 py-2 font-medium xl:table-cell">Tags and terms</th>}
                  <th className="px-3 py-2 text-right font-medium">Distinct</th>
                  <th className="py-2 pr-6 pl-3 text-right font-medium">Filled</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const isSel = c.path === selected
                  return (
                    <tr
                      key={c.path}
                      tabIndex={0}
                      aria-selected={isSel}
                      onClick={() => onSelect(isSel ? undefined : c.path)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(isSel ? undefined : c.path)
                        }
                      }}
                      className={cn(
                        'cursor-pointer border-b align-top outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/60',
                        isSel && 'bg-primary-soft hover:bg-primary-soft [&>td:first-child]:shadow-[inset_2px_0_0_var(--primary)]',
                      )}
                    >
                      <td className="py-2.5 pr-3 pl-6" style={{ paddingLeft: `${1.5 + c.depth * 1.25}rem` }}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-mono text-[13px] font-medium">{c.col.displayName || c.col.name}</span>
                          <KeyBadge label={c.key} />
                        </span>
                      </td>
                      <td className="max-w-40 px-3 py-2.5">
                        <TypeChip dataType={c.col.dataType} display={c.col.dataTypeDisplay} />
                      </td>
                      {!open && (
                        <td className="min-w-48 px-3 py-2.5">
                          {c.col.description?.trim() ? <span className="line-clamp-2">{c.col.description}</span> : <span className="text-muted-foreground italic">No description</span>}
                        </td>
                      )}
                      {!open && (
                        <td className="hidden px-3 py-2.5 xl:table-cell">
                          <TagList terms={c.terms} tags={c.tags} />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{c.profile?.distinctCount !== undefined ? formatCount(c.profile.distinctCount) : '–'}</td>
                      <td className="py-2.5 pr-6 pl-3">
                        <FillBar share={filledShare(c.profile, rowCount)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!shown.length && <p className="px-6 py-10 text-center text-sm text-muted-foreground">{columns.length ? 'No columns match.' : 'This table has no columns.'}</p>}
          </div>
        </div>
        {current && (
          <ColumnInspector
            key={current.path}
            entity={entity}
            column={current}
            tests={tests.filter((t) => t.column === current.col.name)}
            rowCount={rowCount}
            profiledAt={profiledAt}
            onClose={() => onSelect(undefined)}
            onOpen={onOpen}
          />
        )}
      </Card>
    </div>
  )
}

export function TagList({ terms, tags }: { terms: TableColumn['terms']; tags: TableColumn['tags'] }) {
  if (!terms.length && !tags.length) return <span className="text-muted-foreground">–</span>
  return (
    <span className="flex flex-wrap gap-1">
      {terms.map((t) => (
        <Badge key={t.tagFQN} variant="info" className="font-normal">
          <BookOpen aria-hidden /> {t.tagFQN.split('.').pop()}
        </Badge>
      ))}
      {tags.map((t) => (
        <Badge key={t.tagFQN} variant="secondary" className="font-normal">
          {t.tagFQN}
        </Badge>
      ))}
    </span>
  )
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2.5 border-t pt-4">
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>
)

/** Everything about one column, beside the list. */
function ColumnInspector({ entity, column: c, tests, rowCount, profiledAt, onClose, onOpen }: {
  entity: OmEntity
  column: TableColumn
  tests: TableTest[]
  rowCount?: number
  profiledAt?: number
  onClose: () => void
  onOpen: (v: View) => void
}) {
  const p = c.profile
  const share = filledShare(p, rowCount)
  const lineage = useCall('getLineage', { type: 'table', id: entity.id, upstreamDepth: 1, downstreamDepth: 1 })
  const flow = columnLineage(lineage.data, c.fqn)
  const stats: [string, string][] = [
    ['Filled', percentText(share)],
    ['Distinct', p?.distinctCount !== undefined ? formatCount(p.distinctCount) : '–'],
    ...(p?.min !== undefined || p?.max !== undefined
      ? ([['Min', formatValue(p?.min)], ['Max', formatValue(p?.max)]] as [string, string][])
      : ([['Unique', p?.uniqueCount !== undefined ? formatCount(p.uniqueCount) : '–'], ['Empty', p?.nullCount !== undefined ? formatCount(p.nullCount) : '–']] as [string, string][])),
  ]
  const h = p?.histogram
  const peak = h ? Math.max(...h.frequencies, 1) : 1

  return (
    <aside className="flex min-w-0 flex-col gap-4 border-t bg-muted/30 p-6 @4xl:border-t-0 @4xl:border-l" aria-label={`Column ${c.path}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-lg font-semibold">{c.col.displayName || c.path}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TypeChip dataType={c.col.dataType} display={c.col.dataTypeDisplay} />
            {c.key && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                <Key aria-hidden /> {c.key}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close the column" onClick={onClose}>
          <X />
        </Button>
      </div>
      <Description text={c.col.description} />
      {(c.terms.length > 0 || c.tags.length > 0) && <TagList terms={c.terms} tags={c.tags} />}

      {p && (
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
          {stats.map(([label, value], i) => (
            <div key={label} className={cn('min-w-0 px-4 py-3', i % 2 === 0 && 'border-r', i < 2 && 'border-b')}>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <Section title="Value spread" hint={p ? `Last profile${profiledAt ? `, ${ago(profiledAt)}` : ''}${rowCount !== undefined ? ` · ${formatCount(rowCount)} rows` : ''}` : undefined}>
        {h ? (
          <figure className="flex flex-col gap-1.5">
            <div className="flex h-28 max-w-80 items-end gap-0.5 border-b" role="img" aria-label={`How the values of ${c.path} are spread over ${h.frequencies.length} ranges`}>
              {h.frequencies.map((f, i) => (
                <span
                  key={i}
                  className="max-w-6 min-w-1 flex-1 rounded-t bg-(--series-1) hover:brightness-110"
                  style={{ height: `${Math.max(2, (f / peak) * 100)}%` }}
                  title={`${h.boundaries[i] ?? `Range ${i + 1}`}: ${formatCount(f)}`}
                />
              ))}
            </div>
            <figcaption className="flex max-w-80 justify-between font-mono text-[11px] text-muted-foreground">
              <span>{h.boundaries[0]?.split(' to ')[0]}</span>
              <span>{h.boundaries[h.boundaries.length - 1]?.split(' to ').pop()}</span>
            </figcaption>
          </figure>
        ) : (
          <p className="text-sm text-muted-foreground">{p ? 'The profile has no value spread for this column.' : 'This column has not been profiled yet.'}</p>
        )}
      </Section>

      <Section title="Tests">
        {tests.length ? (
          <ul className="flex flex-col divide-y">
            {tests.map((t) => (
              <li key={t.entity.id} className="flex items-center gap-3 py-2">
                <TestMark status={t.status} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen({ type: 'testCase', fqn: t.entity.fullyQualifiedName ?? t.entity.name })}>
                  <span className="block truncate text-sm font-medium hover:underline">{displayName(t.entity)}</span>
                  {t.result && <span className="block truncate text-xs text-muted-foreground">{t.result}</span>}
                </button>
                <TestBadge status={t.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No tests on this column.</p>
        )}
      </Section>

      <Section title="Column lineage" hint="Where this column's values come from and where they go, one step each way">
        {lineage.loading && !lineage.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : flow.from.length || flow.to.length ? (
          <dl className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
            <Flow label="From" names={flow.from} none="Starts here" />
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">This</dt>
            <dd>
              <span className="inline-block max-w-full truncate rounded-md bg-primary-soft px-2 py-1 font-mono text-xs font-medium text-primary-soft-foreground">{shortColumn(c.fqn)}</span>
            </dd>
            <Flow label="Feeds" names={flow.to} none="Nothing yet" />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No column lineage is recorded for this column.</p>
        )}
      </Section>
    </aside>
  )
}

function Flow({ label, names, none }: { label: string; names: string[]; none: string }) {
  return (
    <>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1.5">
        {names.length ? (
          names.map((n) => (
            <span key={n} title={n} className="max-w-full truncate rounded-md px-2 py-1 font-mono text-xs ring-1 ring-foreground/10">
              {shortColumn(n)}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{none}</span>
        )}
      </dd>
    </>
  )
}

const formatValue = (v: number | string | undefined) => (v === undefined ? '–' : typeof v === 'number' ? v.toLocaleString() : v)
