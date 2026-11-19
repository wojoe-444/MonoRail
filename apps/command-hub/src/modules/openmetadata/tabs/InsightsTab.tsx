import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { OTHER_COLOR, SERIES_COLORS, axisProps, gridProps } from '@/components/charts/palette'
import { StatTile } from '@/components/charts/StatTile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { formatCount, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

import { typeInfo } from '../catalog'
import { tierOf } from '../util'
import { hasDescription, hasOwner, hasTags, hasTier, serviceOf, tierLabel, useAssets, type Asset } from './assets'
import { AssetRow, EmptyNote, ErrorNote, LoadNotes, Loading } from './assets-parts'
import type { OmTabProps } from './types'

type Scope = 'table' | 'all'

/** The four completeness measures, in fixed order: their series colors never change. */
const MEASURES = [
  { key: 'description', label: 'Description', test: hasDescription, color: SERIES_COLORS[0] },
  { key: 'owner', label: 'Owner', test: hasOwner, color: SERIES_COLORS[1] },
  { key: 'tier', label: 'Tier', test: hasTier, color: SERIES_COLORS[2] },
  { key: 'tags', label: 'Tags', test: hasTags, color: SERIES_COLORS[3] },
] as const
type MeasureKey = (typeof MEASURES)[number]['key']

/** Services shown on their own in "By service"; the rest fold into Other. */
const TOP_SERVICES = 8
const OTHER_SERVICES = 'Other services'

interface Row {
  key: string
  label: string
  total: number
  /** Share with each measure, 0..1. */
  description: number
  owner: number
  tier: number
  tags: number
}

function rowOf(key: string, label: string, items: Asset[]): Row {
  const share = (test: (e: Asset) => boolean) => (items.length ? items.filter(test).length / items.length : 0)
  return { key, label, total: items.length, description: share(hasDescription), owner: share(hasOwner), tier: share(hasTier), tags: share(hasTags) }
}

/** How complete the catalog is: descriptions, owners, tiers and tags across the data assets, by type and by service. */
export default function InsightsTab({ counts }: OmTabProps) {
  const assets = useAssets(counts)
  const [scope, setScope] = useState<Scope>('all')
  const all = assets.data?.assets

  if (counts.error && !counts.data) return <ErrorNote>{counts.error}</ErrorNote>
  if (!all) return <Loading>Reading the data assets…</Loading>
  const rows = scope === 'table' ? all.filter((e) => e.assetType === 'table') : all

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">How well the data assets are described, owned and classified, and what to fix first.</p>
        <Segmented
          aria-label="Assets to include"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All data assets' },
            { value: 'table', label: 'Tables' },
          ]}
        />
      </div>
      <LoadNotes load={assets.data!} />
      {rows.length === 0 ? (
        <EmptyNote title={scope === 'table' ? 'No tables yet' : 'No data assets yet'}>Run metadata ingestion to fill the catalog; how complete it is shows here.</EmptyNote>
      ) : (
        <Health rows={rows} all={all} scope={scope} />
      )}
    </div>
  )
}

function Health({ rows, all, scope }: { rows: Asset[]; all: Asset[]; scope: Scope }) {
  const n = rows.length
  const count = (k: MeasureKey) => rows.filter(MEASURES.find((m) => m.key === k)!.test).length
  const complete = rows.filter((e) => MEASURES.every((m) => m.test(e))).length
  const noun = scope === 'table' ? 'tables' : 'assets'

  // Services ranked once on every asset, so switching the scope never reorders them.
  const serviceOrder = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of all) {
      const s = serviceOf(e) ?? 'No service'
      m.set(s, (m.get(s) ?? 0) + 1)
    }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s)
  }, [all])

  const byType = useMemo(() => {
    const m = new Map<string, Asset[]>()
    for (const e of rows) m.set(e.assetType, [...(m.get(e.assetType) ?? []), e])
    return [...m].sort((a, b) => b[1].length - a[1].length).map(([t, items]) => rowOf(t, typeInfo(t)?.plural ?? t, items))
  }, [rows])

  const byService = useMemo(() => {
    const top = new Set(serviceOrder.slice(0, TOP_SERVICES))
    const m = new Map<string, Asset[]>()
    for (const e of rows) {
      const s = serviceOf(e) ?? 'No service'
      const k = top.has(s) ? s : OTHER_SERVICES
      m.set(k, [...(m.get(k) ?? []), e])
    }
    const order = [...serviceOrder.slice(0, TOP_SERVICES), OTHER_SERVICES]
    return order.filter((k) => m.has(k)).map((k) => rowOf(k, k, m.get(k)!))
  }, [rows, serviceOrder])

  const tiers = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of rows) {
      const t = tierOf(e.tags)?.tagFQN
      if (t) m.set(t, (m.get(t) ?? 0) + 1)
    }
    const items = [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ key: k, label: tierLabel(k), value: v, color: SERIES_COLORS[0] as string }))
    const none = n - items.reduce((s, i) => s + i.value, 0)
    return none > 0 ? [...items, { key: 'none', label: 'No tier', value: none, color: OTHER_COLOR }] : items
  }, [rows, n])

  const byRecent = (a: Asset, b: Asset) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  const noOwner = rows.filter((e) => !hasOwner(e)).sort(byRecent)
  const noDescription = rows.filter((e) => !hasDescription(e)).sort(byRecent)

  return (
    <>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
        <StatTile hero label="Fully documented" value={formatPercent(complete / n)} hint={`${formatCount(complete)} of ${formatCount(n)} ${noun}`} className="col-span-2 md:col-span-1" />
        {MEASURES.map((m) => {
          const c = count(m.key)
          return <StatTile key={m.key} label={`With ${m.label.toLowerCase()}`} value={formatPercent(c / n)} hint={`${formatCount(n - c)} missing`} />
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>Share of {noun} with each piece of metadata.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {MEASURES.map((m) => (
              <CoverageRow key={m.key} label={m.label} value={count(m.key)} total={n} />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tiers</CardTitle>
            <CardDescription>How critical the {noun} are, Tier 1 most.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BarList items={tiers} of={n} />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Tier</th>
                  <th className="py-2 text-right font-medium">{scope === 'table' ? 'Tables' : 'Assets'}</th>
                  <th className="py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.key} className="border-b last:border-0">
                    <td className={cn('py-1.5', t.key === 'none' && 'text-muted-foreground')}>{t.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCount(t.value)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatPercent(t.value / n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {scope === 'all' && byType.length > 1 && <CoverageChart title="By type" description="Share of each type's assets with each piece of metadata." dimension="Type" rows={byType} />}
      <CoverageChart title="By service" description={`Share of each service's ${noun} with each piece of metadata. The ${TOP_SERVICES} largest services are shown; the rest fold into Other services.`} dimension="Service" rows={byService} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GapCard title="Missing an owner" rows={noOwner} done={`Every one of the ${noun} has an owner.`} />
        <GapCard title="Missing a description" rows={noDescription} done={`Every one of the ${noun} has a description.`} />
      </div>
    </>
  )
}

/** One coverage measure: label, percent, a meter, and "n of total". Green when complete, amber below 50%. */
function CoverageRow({ label, value, total }: { label: string; value: number; total: number }) {
  const share = total ? value / total : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{formatPercent(share)}</span>
      </div>
      <Progress value={share * 100} aria-label={`${label}: ${formatPercent(share)}`} indicatorClassName={share >= 0.999 ? 'bg-success' : share < 0.5 ? 'bg-warning' : 'bg-primary'} />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatCount(value)} of {formatCount(total)}
      </span>
    </div>
  )
}

/** Horizontal bars for one breakdown: label, bar, count and share. */
function BarList({ items, of }: { items: { key: string; label: string; value: number; color: string }[]; of: number }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="flex flex-col gap-2.5" aria-hidden>
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className={cn('truncate', i.key === 'none' && 'text-muted-foreground')}>{i.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </span>
          <span className="text-right text-xs whitespace-nowrap tabular-nums">
            {formatCount(i.value)}
            <span className="ml-1.5 text-muted-foreground">{formatPercent(i.value / of)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Grouped bars: one group per type or service, one bar per measure (0 to 100%), with the same numbers as a table. */
function CoverageChart({ title, description, dimension, rows }: { title: string; description: string; dimension: string; rows: Row[] }) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 border-t px-6 py-5">
        <Legend items={MEASURES.map((m) => ({ key: m.key, label: m.label, color: m.color }))} />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: 'var(--chart-axis)' }} interval={0} tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} />
            <YAxis {...axisProps} axisLine={false} width={48} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => formatPercent(v)} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={({ active, payload }) => {
                const r = active ? (payload?.[0]?.payload as Row | undefined) : undefined
                if (!r) return null
                return (
                  <ChartTooltipContent
                    title={r.label}
                    rows={MEASURES.map((m) => ({ key: m.key, label: m.label, value: formatPercent(r[m.key]), color: m.color }))}
                    footer={`${formatCount(r.total)} ${r.total === 1 ? 'asset' : 'assets'}`}
                  />
                )
              }}
            />
            {MEASURES.map((m) => (
              <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
      <CardContent className="overflow-x-auto border-t px-0 py-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-6 py-2 font-medium">{dimension}</th>
              <th className="px-3 py-2 text-right font-medium">Assets</th>
              {MEASURES.map((m) => (
                <th key={m.key} className="px-3 py-2 text-right font-medium last:pr-6">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className={cn('max-w-64 truncate px-6 py-2', r.key === OTHER_SERVICES && 'text-muted-foreground')}>{r.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.total)}</td>
                {MEASURES.map((m) => (
                  <td key={m.key} className={cn('px-3 py-2 text-right tabular-nums last:pr-6', r[m.key] >= 0.999 ? 'text-success' : r[m.key] < 0.5 && 'text-warning-soft-foreground')}>
                    {formatPercent(r[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function GapCard({ title, rows, done }: { title: string; rows: Asset[]; done: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length ? `Most recently changed first · ${formatCount(rows.length)} in all.` : 'Nothing to fix here.'}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="flex flex-col divide-y">
            {rows.slice(0, 8).map((e) => (
              <AssetRow key={`${e.assetType}:${e.id}`} e={e} compact />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{done}</p>
        )}
      </CardContent>
    </Card>
  )
}
