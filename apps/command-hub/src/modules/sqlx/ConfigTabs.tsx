import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { ObjectFields, RawInput } from './ConfigForm'
import { objectAt, setEntry, str } from './config-values'
import { appliesTo, specFor } from './fields'
import type { Entry, ObjectValue, Value } from './parse'

// The Columns and Tests tabs: the config's `columns` and `assertions` shown
// as a table and as rules instead of nested form fields.

const typeOf = (config: ObjectValue) => {
  const t = config.entries.find((e) => e.key === 'type')?.value
  return t?.t === 'string' ? t.v : undefined
}


const stringItems = (v: Value | undefined): string[] => (v?.t === 'array' ? v.items.flatMap((x) => (x.t === 'string' ? [x.v] : [])) : [])

/** Puts `obj` at `key`, or removes the key when the object is empty. */
const putObject = (config: ObjectValue, key: string, obj: ObjectValue) => setEntry(config, key, obj.entries.length ? obj : undefined)

function Empty({ children }: { children: ReactNode }) {
  return <p className="max-w-lg text-sm text-muted-foreground">{children}</p>
}

// ---------------------------------------------------------------------------
// Columns

export function ColumnsTable({ value, onChange }: { value: ObjectValue; onChange: (v: ObjectValue) => void }) {
  const type = typeOf(value)
  const raw = value.entries.find((e) => e.key === 'columns')?.value
  if (!appliesTo(specFor('columns')!, type) && !raw) return <Empty>A file of type {type} has no columns to describe.</Empty>
  if (raw && raw.t !== 'object')
    return (
      <div className="flex max-w-lg flex-col gap-2">
        <Empty>The columns are written as JavaScript, so they stay as code.</Empty>
        <RawInput value={raw} onChange={(v) => onChange(setEntry(value, 'columns', v))} />
      </div>
    )

  const cols = raw ?? { t: 'object' as const, entries: [] }
  const assertions = objectAt(value, 'assertions') ?? { t: 'object' as const, entries: [] }
  const nonNull = stringItems(assertions.entries.find((e) => e.key === 'nonNull')?.value)
  const keyCols = new Set([...stringItems(value.entries.find((e) => e.key === 'uniqueKey')?.value), ...stringItems(assertions.entries.find((e) => e.key === 'uniqueKey')?.value)])
  const canTest = appliesTo(specFor('assertions')!, type)

  const setCols = (entries: Entry[]) => onChange(putObject(value, 'columns', { ...cols, entries }))
  const rename = (i: number, key: string) => {
    const old = cols.entries[i].key
    let next = putObject(value, 'columns', { ...cols, entries: cols.entries.map((e, k) => (k === i ? { ...e, key } : e)) })
    // A renamed column keeps its not-null rule.
    if (nonNull.includes(old)) next = setNonNull(next, nonNull.map((c) => (c === old ? key : c)))
    onChange(next)
  }
  const describe = (i: number, text: string) => {
    const v = cols.entries[i].value
    const next: Value =
      v.t === 'object'
        ? setEntry(v, 'description', str(text, v.entries.find((e) => e.key === 'description')?.value))
        : str(text, v)
    setCols(cols.entries.map((e, k) => (k === i ? { ...e, value: next } : e)))
  }
  const remove = (i: number) => setCols(cols.entries.filter((_, k) => k !== i))
  const add = () => {
    let n = cols.entries.length + 1
    while (cols.entries.some((e) => e.key === `column_${n}`)) n++
    setCols([...cols.entries, { key: `column_${n}`, value: str('') }])
  }
  const toggleNonNull = (name: string) => onChange(setNonNull(value, nonNull.includes(name) ? nonNull.filter((c) => c !== name) : [...nonNull, name]))

  return (
    <div className="flex flex-col gap-4">
      {cols.entries.length === 0 ? (
        <Empty>No columns are described yet. Descriptions end up in BigQuery and in the Dataform docs.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="w-[28%] px-3 py-2 font-semibold">Column</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                {canTest && <th className="w-36 px-3 py-2 font-semibold">Checks</th>}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {cols.entries.map((e, i) => {
                const v = e.value
                const desc = v.t === 'object' ? v.entries.find((x) => x.key === 'description')?.value : v
                const extra = v.t === 'object' ? v.entries.filter((x) => x.key !== 'description').map((x) => x.key) : []
                return (
                  <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-2 py-1.5 align-top">
                      <Input className="h-8 border-transparent bg-transparent font-mono text-[13px] shadow-none hover:border-input" value={e.key} aria-label="Column name" onChange={(ev) => rename(i, ev.target.value)} />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {desc === undefined || desc.t === 'string' ? (
                        <Input
                          className="h-8 border-transparent bg-transparent shadow-none hover:border-input"
                          value={desc?.t === 'string' ? desc.v : ''}
                          placeholder="Add a description"
                          aria-label={`${e.key} description`}
                          onChange={(ev) => describe(i, ev.target.value)}
                        />
                      ) : (
                        <RawInput value={desc} onChange={(d) => setCols(cols.entries.map((x, k) => (k === i ? { ...x, value: v.t === 'object' ? setEntry(v, 'description', d) : d } : x)))} />
                      )}
                      {extra.length > 0 && (
                        <p className="px-3 pt-0.5 text-xs text-muted-foreground" title="Edit these in the Raw file tab">
                          Also sets <span className="font-mono">{extra.join(', ')}</span>
                        </p>
                      )}
                    </td>
                    {canTest && (
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex h-8 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleNonNull(e.key)}
                            aria-pressed={nonNull.includes(e.key)}
                            title={nonNull.includes(e.key) ? 'Remove the not-null check' : 'Check that this column is never null'}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-xs transition-colors',
                              nonNull.includes(e.key) ? 'border-transparent bg-success-soft text-success-soft-foreground' : 'border-dashed text-muted-foreground hover:text-foreground',
                            )}
                          >
                            Not null
                          </button>
                          {keyCols.has(e.key) && <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs text-info-soft-foreground" title="Part of the unique key">Key</span>}
                        </div>
                      </td>
                    )}
                    <td className="px-1 py-1.5 align-top">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${e.key}`} onClick={() => remove(i)}>
                        <X />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="outline" size="sm" className="self-start" onClick={add}>
        <Plus /> Add column
      </Button>
    </div>
  )
}

function setNonNull(config: ObjectValue, cols: string[]): ObjectValue {
  const a = objectAt(config, 'assertions') ?? { t: 'object' as const, entries: [] }
  const old = a.entries.find((e) => e.key === 'nonNull')?.value
  // Keep the quote style the file already uses.
  const like = old?.t === 'array' ? old.items[0] : undefined
  return putObject(config, 'assertions', setEntry(a, 'nonNull', cols.length ? { t: 'array', items: cols.map((c) => str(c, like)) } : undefined))
}

// ---------------------------------------------------------------------------
// Tests

export function TestsForm({ value, onChange }: { value: ObjectValue; onChange: (v: ObjectValue) => void }) {
  const type = typeOf(value)
  const spec = specFor('assertions')!
  const raw = value.entries.find((e) => e.key === 'assertions')?.value
  if (type === 'assertion') return <Empty>This file is an assertion: its query is the test. Every row it returns counts as a failure.</Empty>
  if (!appliesTo(spec, type) && !raw) return <Empty>A file of type {type} has no built-in tests. Write an assertion file to test it.</Empty>
  if (raw && raw.t !== 'object')
    return (
      <div className="flex max-w-lg flex-col gap-2">
        <Empty>The tests are written as JavaScript, so they stay as code.</Empty>
        <RawInput value={raw} onChange={(v) => onChange(setEntry(value, 'assertions', v))} />
      </div>
    )
  const obj = raw ?? { t: 'object' as const, entries: [] }
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Empty>Dataform turns each check into an assertion that runs after this table is built. A failing check marks the run as failed.</Empty>
      {obj.entries.length === 0 && <p className="text-sm">No checks yet.</p>}
      <ObjectFields obj={obj} specs={spec.children ?? []} onChange={(next) => onChange(putObject(value, 'assertions', next))} addable addLabel="Add check" />
    </div>
  )
}
