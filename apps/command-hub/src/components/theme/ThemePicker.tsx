import { useId, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { groupPalettes, PALETTE_GROUPS, tokens, type Palette, type PaletteGroup } from '@/lib/palettes'
import { usePalette, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Strip of the colors that define a palette: drawer, page, card, primary, accent, highlight, success. */
export function Swatches({ p, dark, className }: { p: Palette; dark: boolean; className?: string }) {
  const t = tokens(p, dark)
  const cols = [t.sidebar, t.background, t.card, t.primary, t.accent, t.highlight, t.success]
  return (
    <span className={cn('flex h-5 overflow-hidden rounded-md ring-1 ring-black/10 dark:ring-white/15', className)}>
      {cols.map((c, i) => (
        <span key={i} className="h-full flex-1" style={{ background: c }} />
      ))}
    </span>
  )
}

/** Below Tailwind's `xl` the scheme grid drops to two columns and the list gets long. */
const SMALL_SCREEN = '(max-width: 1279px)'

function isSmallScreen(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(SMALL_SCREEN).matches
}

/** Settings card: light / dark mode and the color schemes, in collapsible sets. */
export function AppearanceCard({ className }: { className?: string }) {
  const [palette, setPalette] = usePalette()
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  // Every set starts open on a wide window and collapsed on a smaller one. Kept per visit only.
  const [open, setOpen] = useState<Set<string>>(() =>
    isSmallScreen() ? new Set() : new Set(PALETTE_GROUPS.map((g) => g.id)),
  )
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Pick light or dark mode and a color scheme. They apply instantly and are remembered.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Mode</span>
          {[false, true].map((d) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => d !== dark && toggle()}
              aria-pressed={dark === d}
              className={cn(
                'rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                dark === d ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              {d ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
        <div className="flex flex-col divide-y rounded-xl border">
          {PALETTE_GROUPS.map((g) => (
            <PaletteSet
              key={g.id}
              group={g}
              dark={dark}
              active={palette}
              onPick={setPalette}
              open={open.has(g.id)}
              onToggle={() =>
                setOpen((s) => {
                  const next = new Set(s)
                  if (next.has(g.id)) next.delete(g.id)
                  else next.add(g.id)
                  return next
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/** One collapsible set: a header row (name, blurb, count, current scheme, swatch preview) over a grid of schemes. */
function PaletteSet({
  group,
  dark,
  active,
  onPick,
  open,
  onToggle,
}: {
  group: PaletteGroup
  dark: boolean
  active: string
  onPick: (id: string) => void
  open: boolean
  onToggle: () => void
}) {
  const panelId = useId()
  const palettes = groupPalettes(group)
  const current = palettes.find((p) => p.id === active)
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none first:rounded-t-xl hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRight
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{group.label}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{palettes.length}</span>
            {current && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">
                <Check className="size-3" />
                {current.name}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{group.blurb}</span>
        </span>
        {!open && (
          <span className="hidden shrink-0 gap-1 sm:flex" aria-hidden>
            {palettes.slice(0, 6).map((p) => (
              <Swatches key={p.id} p={p} dark={dark} className="h-4 w-10" />
            ))}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="grid gap-4 px-4 pt-1 pb-4 sm:grid-cols-2 xl:grid-cols-3">
          {palettes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={p.id === active}
              className={cn(
                'flex flex-col gap-3 rounded-xl border p-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-elevation-2 focus-visible:ring-[3px] focus-visible:ring-ring',
                p.id === active && 'border-primary ring-2 ring-primary/30',
              )}
            >
              <Swatches p={p} dark={dark} className="h-9" />
              <span className="flex items-center justify-between gap-2">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.blurb}</span>
                </span>
                {p.id === active && <Check className="size-4 shrink-0 text-primary" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
