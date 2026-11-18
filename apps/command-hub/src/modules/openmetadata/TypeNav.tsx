import { LayoutGrid } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

import { GROUPS } from './catalog'
import { CountText } from './parts'
import { countOf } from './util'
import type { OmCounts } from './types'

/** Every entity type by group, with its count: a rail on wide screens, a select on narrow ones. */
export function TypeNav({ current, counts, onChoose }: { current?: string; counts?: OmCounts; onChoose: (type?: string) => void }) {
  const row = (active: boolean, dim: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
      dim && !active && 'text-muted-foreground',
      active && 'bg-primary/10 font-medium text-primary',
    )
  return (
    <>
      <div className="flex flex-col gap-2 lg:hidden">
        <Label htmlFor="om-type">Entity type</Label>
        <NativeSelect id="om-type" value={current ?? ''} onChange={(e) => onChoose(e.target.value || undefined)}>
          <option value="">Overview</option>
          {GROUPS.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.types.map((x) => (
                <option key={x.type} value={x.type}>
                  {x.plural}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
      <nav aria-label="Entity types" className="hidden lg:block">
        <Card className="sticky top-0 max-h-[calc(100dvh-10rem)] gap-4 overflow-y-auto px-2 py-3">
          <button type="button" aria-current={current ? undefined : 'page'} className={row(!current, false)} onClick={() => onChoose(undefined)}>
            <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Overview
          </button>
          {GROUPS.map((g) => (
            <div key={g.id} className="flex flex-col gap-0.5">
              <div className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.name}</div>
              {g.types.map((x) => {
                const c = countOf(counts, x.type)
                return (
                  <button
                    key={x.type}
                    type="button"
                    aria-current={x.type === current ? 'page' : undefined}
                    title={c.error ? `Not on this server: ${c.error}` : x.summary}
                    className={row(x.type === current, c.n === 0 || !!c.error)}
                    onClick={() => onChoose(x.type)}
                  >
                    <x.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{x.plural}</span>
                    <CountText counts={counts} type={x.type} />
                  </button>
                )
              })}
            </div>
          ))}
        </Card>
      </nav>
    </>
  )
}
