import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Braces, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { appliesTo, CONFIG_FIELDS, SECTIONS, specFor, type FieldSpec, type Section, type Widget } from './fields'
import { setEntry, str } from './config-values'
import type { Entry, ObjectValue, Value } from './parse'

// ---------------------------------------------------------------------------
// Value helpers




function isStringArray(v: Value): v is { t: 'array'; items: { t: 'string'; v: string }[] } {
  return v.t === 'array' && v.items.every((x) => x.t === 'string')
}

/** The widget a spec asks for, when the value in the file fits it. */
function fits(widget: Widget, v: Value): boolean {
  switch (widget) {
    case 'text':
    case 'textarea':
    case 'sql':
    case 'select':
      return v.t === 'string'
    case 'bool':
      return v.t === 'bool'
    case 'number':
      return v.t === 'number'
    case 'chips':
    case 'list':
      return isStringArray(v)
    case 'map':
    case 'group':
      return v.t === 'object'
  }
}

/** A widget for a value no spec describes. */
function widgetOf(v: Value): Widget | 'raw' {
  if (v.t === 'string') return v.v.includes('\n') ? 'textarea' : 'text'
  if (v.t === 'bool') return 'bool'
  if (v.t === 'number') return 'number'
  if (isStringArray(v)) return 'chips'
  if (v.t === 'object') return 'map'
  return 'raw'
}

function emptyValue(spec: FieldSpec): Value {
  switch (spec.widget) {
    case 'bool':
      return { t: 'bool', v: true }
    case 'number':
      return { t: 'number', v: 1 }
    case 'chips':
    case 'list':
      return { t: 'array', items: [] }
    case 'map':
    case 'group':
      return { t: 'object', entries: [] }
    case 'select':
      return str(spec.options?.[0] ?? '')
    default:
      return str('')
  }
}

function rawSource(v: Value): string {
  switch (v.t) {
    case 'raw':
      return v.src
    case 'string':
      return JSON.stringify(v.v)
    case 'number':
      return String(v.v)
    case 'bool':
      return String(v.v)
    case 'null':
      return 'null'
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Widgets

function ChipsInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...items, ...parts.filter((p) => !items.includes(p))])
    setDraft('')
  }
  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && items.length) onChange(items.slice(0, -1))
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary-soft-foreground">
          {item}
          <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded-full p-0.5 hover:bg-primary/15">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={keyDown}
        onBlur={commit}
        placeholder={items.length ? '' : placeholder}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function ListInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input className="font-mono text-[13px]" value={item} placeholder={placeholder} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} />
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...items, ''])}>
        <Plus /> Add
      </Button>
    </div>
  )
}

function MapInput({ obj, onChange, placeholder }: { obj: ObjectValue; onChange: (obj: ObjectValue) => void; placeholder?: string }) {
  const rename = (i: number, key: string) => onChange({ ...obj, entries: obj.entries.map((e, k) => (k === i ? { ...e, key } : e)) })
  const setValue = (i: number, value: Value) => onChange({ ...obj, entries: obj.entries.map((e, k) => (k === i ? { ...e, value } : e)) })
  const remove = (i: number) => onChange({ ...obj, entries: obj.entries.filter((_, k) => k !== i) })
  const add = () => {
    let n = obj.entries.length + 1
    while (obj.entries.some((e) => e.key === `${placeholder ?? 'key'}_${n}`)) n++
    onChange({ ...obj, entries: [...obj.entries, { key: `${placeholder ?? 'key'}_${n}`, value: str('') }] })
  }
  return (
    <div className="flex flex-col gap-1.5">
      {obj.entries.map((e, i) => (
        <MapRow key={i} entry={e} onRename={(k) => rename(i, k)} onValue={(v) => setValue(i, v)} onRemove={() => remove(i)} />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={add}>
        <Plus /> Add {placeholder ?? 'entry'}
      </Button>
    </div>
  )
}

function MapRow({ entry, onRename, onValue, onRemove }: { entry: Entry; onRename: (key: string) => void; onValue: (v: Value) => void; onRemove: () => void }) {
  const v = entry.value
  // A column given as { description: "..." } edits its description here; anything more stays as written.
  const descObj = v.t === 'object' && v.entries.length === 1 && v.entries[0].key === 'description' && v.entries[0].value.t === 'string' ? v.entries[0].value : undefined
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-start gap-1.5">
      <Input className="font-mono text-[13px]" value={entry.key} aria-label="Name" onChange={(e) => onRename(e.target.value)} />
      {v.t === 'string' ? (
        <Input value={v.v} aria-label={`${entry.key} value`} onChange={(e) => onValue(str(e.target.value, v))} />
      ) : descObj ? (
        <Input value={descObj.v} aria-label={`${entry.key} description`} onChange={(e) => onValue({ t: 'object', entries: [{ key: 'description', value: str(e.target.value, descObj) }] })} />
      ) : v.t === 'object' ? (
        <div className="rounded-md border border-dashed p-2">
          <ObjectFields obj={v} specs={[]} onChange={onValue} compact />
        </div>
      ) : (
        <RawInput value={v} onChange={onValue} />
      )}
      <Button variant="ghost" size="icon" className="size-9" aria-label={`Remove ${entry.key}`} onClick={onRemove}>
        <X />
      </Button>
    </div>
  )
}

export function RawInput({ value, onChange }: { value: Value; onChange: (v: Value) => void }) {
  return (
    <div className="relative">
      <Input className="pr-10 font-mono text-[13px]" value={rawSource(value)} onChange={(e) => onChange({ t: 'raw', src: e.target.value })} />
      <Braces className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-label="JavaScript expression" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fields

function FieldShell({ label, help, onRemove, children, inline }: { label: string; help?: string; onRemove?: () => void; children: ReactNode; inline?: boolean }) {
  return (
    <div className="group/field flex flex-col gap-1.5">
      <div className={cn('flex items-center gap-2', inline && 'justify-between')}>
        <span className="text-sm font-medium">{label}</span>
        {inline && <span className="ml-auto">{children}</span>}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className={cn('rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/field:opacity-100 hover:text-foreground focus-visible:opacity-100', !inline && 'ml-auto')}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {!inline && children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

function Field({ entry, spec, onChange, onRemove }: { entry: Entry; spec?: FieldSpec; onChange: (v: Value) => void; onRemove: () => void }) {
  const v = entry.value
  const widget = spec && fits(spec.widget, v) ? spec.widget : widgetOf(v)
  const label = spec?.label ?? entry.key
  const help = spec?.help
  const shell = (children: ReactNode, inline = false) => (
    <FieldShell label={label} help={help} onRemove={onRemove} inline={inline}>
      {children}
    </FieldShell>
  )
  switch (widget) {
    case 'bool':
      return shell(<Switch checked={v.t === 'bool' && v.v} onCheckedChange={(c) => onChange({ t: 'bool', v: c })} aria-label={label} />, true)
    case 'text':
      return shell(<Input value={v.t === 'string' ? v.v : ''} placeholder={spec?.placeholder} onChange={(e) => onChange(str(e.target.value, v))} />)
    case 'sql':
      return shell(<Textarea rows={1} className="min-h-9 font-mono text-[13px] field-sizing-content" value={v.t === 'string' ? v.v : ''} placeholder={spec?.placeholder} onChange={(e) => onChange(str(e.target.value, v))} />)
    case 'textarea':
      return shell(<Textarea className="field-sizing-content min-h-16" value={v.t === 'string' ? v.v : ''} placeholder={spec?.placeholder} onChange={(e) => onChange(str(e.target.value, v))} />)
    case 'number':
      return shell(<Input type="number" value={v.t === 'number' ? String(v.v) : ''} onChange={(e) => onChange({ t: 'number', v: Number(e.target.value) || 0 })} />)
    case 'select': {
      const current = v.t === 'string' ? v.v : ''
      const options = spec?.options ?? []
      return shell(
        <NativeSelect value={current} onChange={(e) => onChange(str(e.target.value, v))}>
          {!options.includes(current) && <option value={current}>{current || '(not set)'}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>,
      )
    }
    case 'chips':
      return shell(<ChipsInput items={isStringArray(v) ? v.items.map((x) => x.v) : []} placeholder={spec?.placeholder} onChange={(items) => onChange({ t: 'array', items: items.map((x) => str(x)) })} />)
    case 'list':
      return shell(<ListInput items={isStringArray(v) ? v.items.map((x) => x.v) : []} placeholder={spec?.placeholder} onChange={(items) => onChange({ t: 'array', items: items.map((x) => str(x)) })} />)
    case 'map':
      return shell(v.t === 'object' ? <MapInput obj={v} onChange={onChange} placeholder={spec?.placeholder} /> : null)
    case 'group':
      return shell(
        v.t === 'object' ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <ObjectFields obj={v} specs={spec?.children ?? []} onChange={onChange} compact addable />
          </div>
        ) : null,
      )
    default:
      return shell(<RawInput value={v} onChange={onChange} />)
  }
}

function AddFieldMenu({ specs, onAdd, label = 'Add field', sections }: { specs: FieldSpec[]; onAdd: (spec: FieldSpec) => void; label?: string; sections?: boolean }) {
  if (specs.length === 0) return null
  const groups = sections ? SECTIONS.map((s) => [s, specs.filter((f) => (f.section ?? 'More') === s)] as const).filter(([, l]) => l.length) : [['', specs] as const]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        {groups.map(([section, list], i) => (
          <div key={section || i}>
            {i > 0 && <DropdownMenuSeparator />}
            {section && <DropdownMenuLabel>{section}</DropdownMenuLabel>}
            {list.map((f) => (
              <DropdownMenuItem key={f.key} onSelect={() => onAdd(f)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ObjectFields({ obj, specs, onChange, compact, addable, addLabel = 'Add option', type }: { obj: ObjectValue; specs: FieldSpec[]; onChange: (obj: ObjectValue) => void; compact?: boolean; addable?: boolean; addLabel?: string; type?: string }) {
  const ordered = [...obj.entries].sort((a, b) => {
    const ia = specs.findIndex((s) => s.key === a.key)
    const ib = specs.findIndex((s) => s.key === b.key)
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
  })
  const missing = specs.filter((s) => !obj.entries.some((e) => e.key === s.key) && appliesTo(s, type))
  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {ordered.map((e) => (
        <Field key={e.key} entry={e} spec={specFor(e.key, specs)} onChange={(v) => onChange(setEntry(obj, e.key, v))} onRemove={() => onChange(setEntry(obj, e.key, undefined))} />
      ))}
      {addable && <div className="self-start"><AddFieldMenu specs={missing} label={addLabel} onAdd={(s) => onChange(setEntry(obj, s.key, emptyValue(s)))} /></div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The form

const BIGQUERY_TOP = new Set(['partitionBy', 'clusterBy', 'requirePartitionFilter', 'partitionExpirationDays', 'updatePartitionFilter', 'labels', 'additionalOptions'])

interface Props {
  value: ObjectValue
  onChange: (value: ObjectValue) => void
  /** Dataform core version of the project, when known. */
  core: 2 | 3 | null
  /** The sections to show (and offer fields for); all when missing. */
  sections?: Section[]
}

/**
 * The config block as a form, in sections. Fields in the file always show;
 * "Add field" offers the ones that apply to the file's type.
 */
export function ConfigForm({ value, onChange, core, sections = SECTIONS }: Props) {
  const type = value.entries.find((e) => e.key === 'type')?.value
  const typeName = type?.t === 'string' ? type.v : undefined
  const hasBigqueryBlock = value.entries.some((e) => e.key === 'bigquery')
  const hasTopLevel = value.entries.some((e) => BIGQUERY_TOP.has(e.key))
  // Core 3 puts BigQuery options at the top; core 2 under `bigquery`. Unknown: follow the file.
  const nested = core === 2 || (core === null && hasBigqueryBlock && !hasTopLevel)

  const offered = CONFIG_FIELDS.filter((f) => {
    if (value.entries.some((e) => e.key === f.key) || !appliesTo(f, typeName)) return false
    if (!sections.includes(f.section ?? 'More')) return false
    if (f.key === 'bigquery') return nested
    if (f.section === 'BigQuery' && BIGQUERY_TOP.has(f.key)) return !nested
    return true
  })

  const bySection = new Map<Section, Entry[]>()
  for (const e of value.entries) {
    const section = specFor(e.key)?.section ?? 'More'
    bySection.set(section, [...(bySection.get(section) ?? []), e])
  }

  return (
    <div className="grid items-start gap-x-10 gap-y-6 xl:grid-cols-2">
      {sections.filter((s) => bySection.has(s) || (s === 'Target' && !type)).map((section) => {
        const entries = bySection.get(section) ?? []
        const sectionObj: ObjectValue = { t: 'object', entries }
        return (
          <section key={section} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section}</h3>
            {section === 'Target' && !type && (
              <Field
                entry={{ key: 'type', value: str('') }}
                spec={specFor('type')}
                onChange={(v) => onChange({ ...value, entries: [{ key: 'type', value: v }, ...value.entries] })}
                onRemove={() => {}}
              />
            )}
            <ObjectFields
              obj={sectionObj}
              specs={CONFIG_FIELDS}
              type={typeName}
              onChange={(next) => {
                // Put the section's entries back where they were; new ones go at the end.
                const keys = new Set(entries.map((e) => e.key))
                const nextByKey = new Map(next.entries.map((e) => [e.key, e]))
                const merged: Entry[] = []
                for (const e of value.entries) {
                  if (!keys.has(e.key)) merged.push(e)
                  else if (nextByKey.has(e.key)) {
                    merged.push(nextByKey.get(e.key)!)
                    nextByKey.delete(e.key)
                  }
                }
                // Renamed keys (custom fields) keep their place by order.
                merged.push(...[...nextByKey.values()].filter((e) => !keys.has(e.key)))
                onChange({ ...value, entries: merged })
              }}
            />
          </section>
        )
      })}
      <div className="xl:col-span-2">
        <AddFieldMenu sections specs={offered} onAdd={(s) => onChange(setEntry(value, s.key, emptyValue(s)))} />
      </div>
    </div>
  )
}
