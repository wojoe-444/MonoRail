import { useEffect, useState } from 'react'
import { AlertTriangle, KeyRound, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { ExtensionSummary, SettingField, SettingsSnapshot } from '@/extensions/types'
import { invokeModule, isDesktop } from '@/modules/client'

type Draft = Record<string, string | boolean>

/** Form values as the inputs hold them: numbers as text, secrets blank (blank = keep). */
function toDraft(snap: SettingsSnapshot): Draft {
  const d: Draft = {}
  for (const f of snap.fields) {
    if (f.type === 'secret') d[f.key] = ''
    else if (f.type === 'boolean') d[f.key] = snap.values[f.key] === true
    else d[f.key] = snap.values[f.key] === null || snap.values[f.key] === undefined ? '' : String(snap.values[f.key])
  }
  return d
}

/** Only what changed, in the shape the backend validates. */
function toInput(fields: SettingField[], draft: Draft, initial: Draft, cleared: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = draft[f.key]
    if (f.type === 'secret') {
      if (cleared.has(f.key)) out[f.key] = null
      else if (v !== '') out[f.key] = v
      continue
    }
    if (v === initial[f.key]) continue
    if (f.type === 'number') out[f.key] = v === '' ? null : Number(v)
    else out[f.key] = v === '' ? null : v
  }
  return out
}

/** The form MonoRail generates from the "settings" block of an extension's monorail.json. */
export function SettingsDialog({ ext, onClose }: { ext: ExtensionSummary; onClose: () => void }) {
  const [snap, setSnap] = useState<SettingsSnapshot>()
  const [draft, setDraft] = useState<Draft>({})
  const [initial, setInitial] = useState<Draft>({})
  const [cleared, setCleared] = useState<Set<string>>(new Set())
  const [error, setError] = useState<{ message: string; field?: string }>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    const load = isDesktop()
      ? invokeModule<SettingsSnapshot>('extensions', 'getSettings', { id: ext.id })
      : Promise.resolve<SettingsSnapshot>({
          fields: ext.settings,
          values: Object.fromEntries(ext.settings.filter((f) => f.type !== 'secret').map((f) => [f.key, f.default ?? null])),
          secrets: {},
        })
    load
      .then((s) => {
        if (!alive) return
        setSnap(s)
        setDraft(toDraft(s))
        setInitial(toDraft(s))
      })
      .catch((e) => alive && setError({ message: e instanceof Error ? e.message : String(e) }))
    return () => {
      alive = false
    }
  }, [ext.id, ext.settings])

  async function save() {
    if (!snap) return
    if (!isDesktop()) {
      setError({ message: 'Settings are saved in the desktop app.' })
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      await invokeModule('extensions', 'saveSettings', { id: ext.id, values: toInput(snap.fields, draft, initial, cleared) })
      onClose()
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      const field = snap.fields.find((f) => message.startsWith(`${f.title} `))?.key
      setError({ message, field })
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ext.name} settings</DialogTitle>
          <DialogDescription>Saved by MonoRail on this computer. Secret fields are encrypted and never shown again.</DialogDescription>
        </DialogHeader>

        {!snap ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <form
            id="ext-settings"
            className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            {snap.fields.map((f) => (
              <Field
                key={f.key}
                field={f}
                value={draft[f.key]}
                isSet={snap.secrets[f.key]}
                cleared={cleared.has(f.key)}
                invalid={error?.field === f.key}
                onChange={(v) => set(f.key, v)}
                onClear={(c) =>
                  setCleared((s) => {
                    const n = new Set(s)
                    if (c) n.add(f.key)
                    else n.delete(f.key)
                    return n
                  })
                }
              />
            ))}
          </form>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error.message}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ext-settings" disabled={!snap || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FieldProps {
  field: SettingField
  value: string | boolean | undefined
  isSet?: boolean
  cleared: boolean
  invalid: boolean
  onChange: (v: string | boolean) => void
  onClear: (cleared: boolean) => void
}

function Field({ field: f, value, isSet, cleared, invalid, onChange, onClear }: FieldProps) {
  const id = `setting-${f.key}`
  const label = (
    <Label htmlFor={id}>
      {f.title}
      {f.required && <span className="text-destructive"> *</span>}
    </Label>
  )
  const help = f.description && <p className="text-xs text-muted-foreground">{f.description}</p>

  if (f.type === 'boolean') {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {label}
          {help}
        </div>
        <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
      </div>
    )
  }

  let control
  switch (f.type) {
    case 'text':
      control = <Textarea id={id} value={String(value ?? '')} placeholder={f.placeholder} maxLength={f.maxLength} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} rows={4} />
      break
    case 'number':
      control = <Input id={id} type="number" value={String(value ?? '')} min={f.min} max={f.max} step={f.step ?? 'any'} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} className="font-mono" />
      break
    case 'select':
      control = (
        <NativeSelect id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
          {!f.required && <option value="">—</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      )
      break
    case 'secret':
      control = (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="password"
            autoComplete="off"
            value={String(value ?? '')}
            disabled={cleared}
            placeholder={cleared ? 'Will be removed' : isSet ? 'Saved. Type to replace it' : (f.placeholder ?? '')}
            maxLength={f.maxLength}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid}
          />
          {isSet && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onClear(!cleared)}>
              {cleared ? 'Keep' : 'Remove'}
            </Button>
          )}
        </div>
      )
      break
    default:
      control = <Input id={id} value={String(value ?? '')} placeholder={f.placeholder} maxLength={f.maxLength} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {label}
        {f.type === 'secret' && <KeyRound className="size-3.5 text-muted-foreground" aria-label="Encrypted" />}
      </div>
      {control}
      {help}
    </div>
  )
}
