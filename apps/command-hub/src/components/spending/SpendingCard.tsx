import { useState, type ReactNode } from 'react'
import { AlertTriangle, CircleDollarSign, Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { SaveBar } from '@/components/ui/save-bar'
import { countChanges, savedNow } from '@/lib/changes'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ClaudeAccountBadge } from '@/modules/connections/ClaudeAccountBadge'
import { useClaudeAccount } from '@/modules/connections/account'

import { allowOneMoreTurn, formatLimit, formatMoney, resetSpending, saveSpending, useSpending, type LiveSpending, type SpendingMeter, type SpendingSettings } from './spending'

/**
 * Settings > General > Spending limit (docs/guide/setup/spending-limit.md). Off by
 * default. Self-contained so it can move to any Settings section: it needs no
 * props and reads and saves its own state.
 */
export function SpendingCard({ className }: { className?: string }) {
  const { status, error: loadError } = useSpending()
  const account = useClaudeAccount()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const live = status && status.state !== 'damaged' ? status : undefined
  const saved = live?.settings

  // The form is a draft saved as a unit with the Save bar. It follows the saved
  // settings until the user edits it.
  const savedKey = saved ? JSON.stringify(saved) : ''
  const [form, setForm] = useState<Form>()
  const [base, setBase] = useState('')
  if (savedKey !== base) {
    setBase(savedKey)
    const old = base ? toForm(JSON.parse(base) as SpendingSettings) : undefined
    if (saved && (!form || !old || sameForm(form, old))) setForm(toForm(saved))
  }
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [savedAt, setSavedAt] = useState<number>()

  const edit = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch })
  const next = form && fromForm(form)
  const changes = !form || !saved ? 0 : next ? countChanges(saved, next) : Math.max(1, countChanges(toForm(saved), form))
  const dailyInvalid = !!form && parseLimit(form.daily) === undefined
  const monthlyInvalid = !!form && parseLimit(form.monthly) === undefined
  const on = !!form?.enabled

  async function saveForm() {
    if (!next) return
    setSaving(true)
    setSaveError(undefined)
    try {
      const s = await saveSpending(next)
      if (s.state !== 'damaged') setForm(toForm(s.settings))
      setSavedAt(savedNow())
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-highlight-soft text-highlight-soft-foreground">
          <CircleDollarSign className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Spending limit {account?.billedAtApiPrices && <ClaudeAccountBadge account={account} link prefix="Claude: " />}
          </CardTitle>
          <CardDescription>Cap what agent turns started from MonoRail can spend. Useful when your Claude login bills at API prices.</CardDescription>
        </div>
        <Switch
          checked={on}
          disabled={!form || busy || saving}
          onCheckedChange={(enabled) => edit({ enabled })}
          aria-label="Spending limit"
          className="mt-1"
        />
      </CardHeader>

      {status?.state === 'damaged' && (
        <>
          <Separator />
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2 text-sm text-destructive-soft-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {status.message}
            </div>
            <Button variant="outline" disabled={busy} onClick={() => run(resetSpending)}>
              <RotateCcw /> Reset
            </Button>
          </CardContent>
        </>
      )}

      {live && form && on && (
        <>
          <Separator />
          <CardContent className="flex flex-col gap-5">
            <Row label="Daily limit" hint="Resets at midnight">
              <LimitInput value={form.daily} invalid={dailyInvalid} label="Daily limit" disabled={saving} onChange={(daily) => edit({ daily })} />
            </Row>
            <Row label="Monthly limit" hint="Resets on the 1st">
              <LimitInput value={form.monthly} invalid={monthlyInvalid} label="Monthly limit" disabled={saving} onChange={(monthly) => edit({ monthly })} />
            </Row>
            <Row label="Warn me at">
              <Segmented<string>
                aria-label="Warn me at"
                value={String(form.warnAt)}
                onChange={(v) => edit({ warnAt: Number(v) })}
                options={['50', '80', '90'].map((v) => ({ value: v, label: `${v}%` }))}
              />
            </Row>
            <Row label="When the limit is reached">
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<SpendingSettings['onLimit']>
                  aria-label="When the limit is reached"
                  value={form.onLimit}
                  onChange={(onLimit) => edit({ onLimit })}
                  options={[
                    { value: 'stop', label: 'Stop new turns' },
                    { value: 'warn', label: 'Only warn' },
                  ]}
                />
                <span className="text-xs text-muted-foreground">A running turn is never cut off.</span>
              </div>
            </Row>
            <Row label="Spent so far">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Meter label="Today" meter={live.daily} />
                <Meter label={live.monthLabel} meter={live.monthly} />
              </div>
            </Row>
            {live.blocked && <BlockedNote status={live} busy={busy} onAllow={() => run(allowOneMoreTurn)} />}
            <p className="text-xs text-muted-foreground">
              Counts the turns MonoRail runs (Chat, the Coordinator and Agent access) at the cost Claude Code and pi report, from the moment you turn this on. Spend in your own
              terminal is not counted: Claude Stats shows that. Kept only on this computer.
            </p>
          </CardContent>
        </>
      )}

      {(error || loadError) && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive-soft-foreground">{error ?? loadError}</p>
        </CardContent>
      )}

      {live && saved && form && (
          <SaveBar
            className="mx-6"
            label="Spending limit"
            changes={changes}
            saving={saving}
            error={saveError}
            savedAt={savedAt}
            blocked={dailyInvalid || monthlyInvalid ? 'Fix the amount first' : undefined}
            savedNote={saved.enabled ? 'New limits apply to the next turn.' : 'The spending limit is off.'}
            onSave={() => void saveForm()}
            onDiscard={() => {
              setForm(toForm(saved))
              setSaveError(undefined)
            }}
          />
      )}
    </Card>
  )
}

/** The form's draft: the limits stay as typed until they are saved. */
type Form = Omit<SpendingSettings, 'dailyUsd' | 'monthlyUsd'> & { daily: string; monthly: string }

const toForm = (s: SpendingSettings): Form => ({
  enabled: s.enabled,
  daily: s.dailyUsd == null ? '' : String(s.dailyUsd),
  monthly: s.monthlyUsd == null ? '' : String(s.monthlyUsd),
  warnAt: s.warnAt,
  onLimit: s.onLimit,
})

const sameForm = (a: Form, b: Form) =>
  a.enabled === b.enabled && a.daily === b.daily && a.monthly === b.monthly && a.warnAt === b.warnAt && a.onLimit === b.onLimit

/** A typed dollar amount: null for empty (no limit), undefined when it is not an amount above 0. */
function parseLimit(text: string): number | null | undefined {
  const t = text.trim().replace(/^\$/, '').replace(/,/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** The settings to save, or undefined while a limit is not a valid amount. */
function fromForm(f: Form): SpendingSettings | undefined {
  const dailyUsd = parseLimit(f.daily)
  const monthlyUsd = parseLimit(f.monthly)
  if (dailyUsd === undefined || monthlyUsd === undefined) return undefined
  return { enabled: f.enabled, dailyUsd, monthlyUsd, warnAt: f.warnAt, onLimit: f.onLimit }
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[13rem_1fr] md:gap-6">
      <div className="text-sm font-medium">
        {label}
        {hint && <div className="text-xs font-normal text-muted-foreground">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** A dollar amount as typed; saved with the rest of the form. Empty means no limit. */
function LimitInput({ value, invalid, label, disabled, onChange }: { value: string; invalid: boolean; label: string; disabled: boolean; onChange: (text: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-40">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          aria-label={label}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder="None"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className="pl-6 font-mono tabular-nums"
        />
      </div>
      {invalid ? (
        <span className="text-xs text-destructive-soft-foreground">Enter a dollar amount above 0, or leave it empty</span>
      ) : (
        value.trim() === '' && <span className="text-xs text-muted-foreground">Leave empty for none</span>
      )}
    </div>
  )
}

const METER_COLOR = { ok: 'bg-primary', warn: 'bg-warning', reached: 'bg-destructive' } as const

function Meter({ label, meter }: { label: string; meter: SpendingMeter }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {formatMoney(meter.spent)}
          {meter.limit != null && <span className="text-muted-foreground"> / {formatLimit(meter.limit)}</span>}
        </span>
      </div>
      {meter.limit != null ? (
        <Progress value={Math.min(100, meter.pct ?? 0)} indicatorClassName={METER_COLOR[meter.state]} aria-label={`${label} spending`} />
      ) : (
        <span className="text-xs text-muted-foreground">No limit</span>
      )}
    </div>
  )
}

function BlockedNote({ status, busy, onAllow }: { status: LiveSpending; busy: boolean; onAllow: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {status.period === 'month' ? "This month's" : "Today's"} limit is reached, so new turns are paused until {status.period === 'month' ? 'the 1st' : 'midnight'}.
      </span>
      <Button size="sm" variant="outline" disabled={busy} onClick={onAllow}>
        {busy && <Loader2 className="animate-spin" />} Allow one more turn
      </Button>
    </div>
  )
}
