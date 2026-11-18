import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { TYPE_INFO, call, errorText } from './api'
import type { FilterPattern, Pipeline, PipelineType, ServiceRef, SourceConfig } from './types'

const STEPS = ['Type', 'Configure', 'Schedule', 'Review'] as const

const PRESETS = [
  { value: 'manual', label: 'Manual only', cron: '' },
  { value: 'hourly', label: 'Hourly', cron: '0 * * * *' },
  { value: '6h', label: 'Every 6 hours', cron: '0 */6 * * *' },
  { value: 'daily', label: 'Daily', cron: '0 2 * * *' },
  { value: 'weekly', label: 'Weekly', cron: '0 2 * * 1' },
  { value: 'custom', label: 'Custom cron', cron: undefined },
] as const
type Preset = (typeof PRESETS)[number]['value']

const lines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)
const join = (l?: string[]) => (l ?? []).join('\n')

interface Props {
  target: ServiceRef
  /** Pipeline types this service can have here. */
  types: PipelineType[]
  /** A local pipeline to edit (the type is fixed then). */
  existing?: Pipeline
  onClose: () => void
  onSaved: (message: string) => void
}

/** Add or edit an ingestion pipeline: OpenMetadata's four steps (type, configure, schedule, deploy). */
export function PipelineDialog({ target, types, existing, onClose, onSaved }: Props) {
  const local = target.where === 'local'
  const serviceName = target.service.name
  const old = existing?.sourceConfig?.config ?? {}
  const [step, setStep] = useState(existing ? 1 : 0)
  const [type, setType] = useState<PipelineType>(existing?.pipelineType ?? types[0])
  const [name, setName] = useState(existing?.name ?? `${serviceName}_${types[0]}`.replace(/[^A-Za-z0-9_.-]/g, '_'))
  const [nameTouched, setNameTouched] = useState(!!existing)
  const [filters, setFilters] = useState<Record<string, { includes: string; excludes: string }>>(() => {
    const f = (p?: FilterPattern) => ({ includes: join(p?.includes), excludes: join(p?.excludes) })
    return { databaseFilterPattern: f(old.databaseFilterPattern), schemaFilterPattern: f(old.schemaFilterPattern), tableFilterPattern: f(old.tableFilterPattern) }
  })
  const [opts, setOpts] = useState<SourceConfig>({
    includeViews: old.includeViews ?? true,
    includeTags: old.includeTags ?? true,
    markDeletedTables: old.markDeletedTables ?? true,
    queryLogDuration: old.queryLogDuration ?? 1,
    profileSample: old.profileSample,
    columnMetricsRowLimit: old.columnMetricsRowLimit,
    dbtUpdateDescriptions: old.dbtUpdateDescriptions ?? true,
  })
  const [logger, setLogger] = useState(existing?.loggerLevel ?? 'INFO')
  const initialCron = existing?.airflowConfig?.scheduleInterval ?? ''
  const [preset, setPreset] = useState<Preset>(() => (PRESETS.find((p) => p.cron === initialCron)?.value ?? 'custom') as Preset)
  const [cronText, setCronText] = useState(initialCron)
  const [retries, setRetries] = useState(String(existing?.airflowConfig?.retries ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const category = target.service.category
  const isDb = category === 'databaseService'
  // SQLite has one database and schema, so only tables are filtered; other categories keep OpenMetadata's defaults here.
  const filterKeys = useMemo(() => (!isDb ? [] : local && type !== 'dbt' ? ['tableFilterPattern'] : ['databaseFilterPattern', 'schemaFilterPattern', 'tableFilterPattern']), [isDb, local, type])

  const sourceConfig = useMemo(() => {
    const cfg: Record<string, unknown> = {}
    for (const k of filterKeys) {
      const includes = lines(filters[k].includes)
      const excludes = lines(filters[k].excludes)
      if (includes.length || excludes.length) cfg[k] = { includes, excludes }
    }
    if (!isDb) return cfg
    if (type === 'metadata') Object.assign(cfg, { includeViews: opts.includeViews, includeTags: opts.includeTags, markDeletedTables: opts.markDeletedTables })
    if (type === 'usage' || type === 'lineage') cfg.queryLogDuration = opts.queryLogDuration
    if (type === 'profiler') {
      if (!local && opts.profileSample) cfg.profileSample = opts.profileSample
      if (local && opts.columnMetricsRowLimit) cfg.columnMetricsRowLimit = opts.columnMetricsRowLimit
    }
    if (type === 'dbt') Object.assign(cfg, { dbtUpdateDescriptions: opts.dbtUpdateDescriptions, includeTags: opts.includeTags, markDeletedTables: opts.markDeletedTables })
    return cfg
  }, [filterKeys, filters, isDb, local, opts, type])

  const schedule = preset === 'custom' ? cronText.trim() : (PRESETS.find((p) => p.value === preset)?.cron ?? '')

  const pipeline = {
    id: existing?.id,
    name: name.trim(),
    pipelineType: type,
    serviceKind: local ? target.service.kind : undefined,
    sourceConfig: { config: sourceConfig },
    airflowConfig: { scheduleInterval: schedule, retries: Number(retries) || 0 },
    loggerLevel: logger,
  }

  async function save(deploy: boolean) {
    setSaving(true)
    setError('')
    try {
      if (local) {
        await call('savePipeline', { pipeline: { ...pipeline, deploy } })
        onSaved(existing ? `Saved ${pipeline.name}.` : deploy ? `${pipeline.name} is deployed to this PC.` : `Saved ${pipeline.name}. Deploy it to start its schedule.`)
      } else {
        const res = await call<{ deployError?: string }>('serverCreate', { service: { id: target.service.id, category }, pipeline, deploy })
        onSaved(res.deployError ? `Created ${pipeline.name} on the server, but deploying failed: ${res.deployError}` : deploy ? `Created and deployed ${pipeline.name} on the server.` : `Created ${pipeline.name} on the server.`)
      }
    } catch (e) {
      setError(errorText(e))
      setSaving(false)
    }
  }

  const chooseType = (t: PipelineType) => {
    setType(t)
    if (!nameTouched) setName(`${serviceName}_${t}`.replace(/[^A-Za-z0-9_.-]/g, '_'))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : 'Add ingestion'}</DialogTitle>
          <DialogDescription>
            {target.service.displayName || target.service.name} · {local ? 'runs on this PC while MonoRail is open' : 'runs on your OpenMetadata server'}. Nothing runs until you deploy it.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-4 gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={(!!existing && i === 0) || saving}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={cn('w-full border-t-[3px] pt-2 text-left text-sm disabled:cursor-not-allowed', i <= step ? 'border-primary' : 'border-border', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}
              >
                <span className="block text-[11px] tracking-wide uppercase">Step {i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => chooseType(t)}
                className={cn('grid gap-1 rounded-lg p-3 text-left ring-1 ring-border transition-colors', type === t ? 'bg-primary-soft ring-2 ring-primary' : 'hover:bg-muted')}
              >
                <span className="font-medium">{TYPE_INFO[t].label}</span>
                <span className="text-sm text-muted-foreground">{TYPE_INFO[t].description}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-name">Name</Label>
              <Input
                id="ing-name"
                className="font-mono"
                value={name}
                disabled={!!existing && !local}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameTouched(true)
                }}
              />
              <p className="text-xs text-muted-foreground">Letters, digits, dots, dashes and underscores.</p>
            </div>
            {filterKeys.map((k) => (
              <fieldset key={k} className="grid gap-2 rounded-lg p-3 ring-1 ring-border">
                <legend className="px-1 text-sm font-medium">
                  {k === 'databaseFilterPattern' ? 'Databases' : k === 'schemaFilterPattern' ? 'Schemas' : 'Tables'} <span className="font-mono text-xs text-muted-foreground">{k}</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['includes', 'excludes'] as const).map((side) => (
                    <div key={side} className="grid gap-1">
                      <Label htmlFor={`ing-${k}-${side}`} className="text-xs text-muted-foreground">
                        {side === 'includes' ? 'Include (empty: all)' : 'Exclude'}
                      </Label>
                      <Textarea
                        id={`ing-${k}-${side}`}
                        rows={2}
                        className="font-mono text-xs"
                        placeholder={side === 'includes' ? 'sales.*' : '.*_tmp'}
                        value={filters[k][side]}
                        onChange={(e) => setFilters((f) => ({ ...f, [k]: { ...f[k], [side]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Regular expressions, one per line, matched from the start of the name and ignoring case.</p>
              </fieldset>
            ))}
            {isDb && (type === 'metadata' || type === 'dbt') && (
              <div className="grid gap-3">
                {type === 'metadata' && <Toggle id="ing-views" label="Include views" field="includeViews" opts={opts} setOpts={setOpts} />}
                {type === 'dbt' && <Toggle id="ing-desc" label="Use dbt descriptions" field="dbtUpdateDescriptions" opts={opts} setOpts={setOpts} />}
                <Toggle id="ing-tags" label="Include tags" field="includeTags" opts={opts} setOpts={setOpts} />
                <Toggle id="ing-deleted" label="Mark deleted tables" hint="Tables that disappear from the source are kept and marked deleted in the catalog." field="markDeletedTables" opts={opts} setOpts={setOpts} />
              </div>
            )}
            {isDb && (type === 'usage' || type === 'lineage') && (
              <NumberField id="ing-days" label="Query history (days)" value={opts.queryLogDuration} onChange={(v) => setOpts((o) => ({ ...o, queryLogDuration: v }))} />
            )}
            {isDb && type === 'profiler' && !local && (
              <NumberField id="ing-sample" label="Sample (percent of rows, empty: OpenMetadata's default)" value={opts.profileSample} onChange={(v) => setOpts((o) => ({ ...o, profileSample: v }))} />
            )}
            {isDb && type === 'profiler' && local && (
              <NumberField id="ing-rows" label="Column metrics up to this many rows per table (empty: 1,000,000)" value={opts.columnMetricsRowLimit} onChange={(v) => setOpts((o) => ({ ...o, columnMetricsRowLimit: v }))} />
            )}
            <div className="grid gap-1.5 sm:max-w-48">
              <Label htmlFor="ing-log">Log level</Label>
              <NativeSelect id="ing-log" value={logger} onChange={(e) => setLogger(e.target.value)}>
                {['DEBUG', 'INFO', 'WARN', 'ERROR'].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">How often</span>
              <Segmented
                aria-label="How often"
                value={preset}
                onChange={(v) => {
                  setPreset(v)
                  const c = PRESETS.find((p) => p.value === v)?.cron
                  if (c !== undefined) setCronText(c)
                }}
                options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            {preset !== 'manual' && (
              <div className="grid gap-1.5">
                <Label htmlFor="ing-cron">
                  Cron <span className="font-mono text-xs text-muted-foreground">airflowConfig.scheduleInterval</span>
                </Label>
                <Input id="ing-cron" className="font-mono" value={schedule} readOnly={preset !== 'custom'} onChange={(e) => setCronText(e.target.value)} placeholder="0 */6 * * *" />
                <p className="text-xs text-muted-foreground">
                  Minute, hour, day of month, month, day of week{local ? ", in this PC's time zone. A run missed while MonoRail was closed runs once when it opens." : ', in the server’s time zone.'}
                </p>
              </div>
            )}
            <div className="grid gap-1.5 sm:max-w-48">
              <Label htmlFor="ing-retries">Retries after a failed scheduled run</Label>
              <NativeSelect id="ing-retries" value={retries} onChange={(e) => setRetries(e.target.value)}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{TYPE_INFO[type].label}</Badge>
              <Badge variant="outline">{schedule ? schedule : 'Manual only'}</Badge>
              <Badge variant={local ? 'secondary' : 'info'}>{local ? 'This PC' : 'OpenMetadata server'}</Badge>
            </div>
            {local ? (
              <p className="text-sm text-muted-foreground">
                Results go to MonoRail’s local database on this PC, which the OpenMetadata page and Explore show. The connection’s details stay encrypted on this PC.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The pipeline uses the connection the server already keeps for this service. MonoRail sends it no passwords. The server’s Airflow runs it, even when this PC is off.
              </p>
            )}
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {JSON.stringify({ name: pipeline.name, pipelineType: type, service: { type: category, name: serviceName }, sourceConfig: pipeline.sourceConfig, airflowConfig: pipeline.airflowConfig, loggerLevel: logger }, null, 2)}
            </pre>
          </div>
        )}

        {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={step === 0 || (!!existing && step === 1) || saving} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!type}>
                Next
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled={saving || !pipeline.name} onClick={() => void save(false)}>
                  {existing ? 'Save' : 'Save without deploying'}
                </Button>
                {(!existing || !existing.deployed) && (
                  <Button disabled={saving || !pipeline.name} onClick={() => void save(true)}>
                    {saving && <Loader2 className="animate-spin" />} {existing ? 'Save and deploy' : 'Deploy'}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Toggle({ id, label, hint, field, opts, setOpts }: { id: string; label: string; hint?: string; field: 'includeViews' | 'includeTags' | 'markDeletedTables' | 'dbtUpdateDescriptions'; opts: SourceConfig; setOpts: (f: (o: SourceConfig) => SourceConfig) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={!!opts[field]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [field]: v }))} />
      <div className="grid gap-0.5">
        <Label htmlFor={id}>
          {label} <span className="font-mono text-xs font-normal text-muted-foreground">{field}</span>
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="grid gap-1.5 sm:max-w-sm">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="numeric" className="tabular-nums" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() ? Number(e.target.value) : undefined)} />
    </div>
  )
}
