import { Check, ChevronDown, Moon, Palette as PaletteIcon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { findPalette, PALETTE_GROUPS, PALETTES, tokens, type Palette } from '@/lib/palettes'
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

/** Top-bar color scheme picker: the current scheme's name, a menu of every scheme with its swatches. */
export function ThemeSelect({ className }: { className?: string }) {
  const [palette, setPalette] = usePalette()
  const [theme] = useTheme()
  const dark = theme === 'dark'
  const current = findPalette(palette)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('w-48 justify-start font-normal', className)} aria-label="Color scheme">
          <PaletteIcon className="text-muted-foreground" />
          <span className="flex-1 truncate text-left">{current.name}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(70vh,560px)] min-w-64 overflow-y-auto">
        {PALETTE_GROUPS.map((g, gi) => (
          <div key={g.label} role="group" aria-label={g.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[11px] tracking-wider">{g.label}</DropdownMenuLabel>
            {PALETTES.slice(g.from, g.to).map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => setPalette(p.id)} className="gap-3">
                <Swatches p={p} dark={dark} className="w-16 shrink-0" />
                <span className="flex-1">{p.name}</span>
                {p.id === palette && <Check className="text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Light / dark toggle for the top bar. */
export function ModeToggle({ className }: { className?: string }) {
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

/** Settings card: light / dark mode and every color scheme as a card with swatches. */
export function AppearanceCard({ className }: { className?: string }) {
  const [palette, setPalette] = usePalette()
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Pick a color scheme. It applies instantly and is remembered. The same picker lives in the top bar.
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
        {PALETTE_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {PALETTES.slice(g.from, g.to).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPalette(p.id)}
                  aria-pressed={p.id === palette}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-elevation-2 focus-visible:ring-[3px] focus-visible:ring-ring',
                    p.id === palette && 'border-primary ring-2 ring-primary/30',
                  )}
                >
                  <Swatches p={p} dark={dark} className="h-9" />
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.blurb}</span>
                    </span>
                    {p.id === palette && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
