import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { currentPath } from '@/lib/router'
import { useAsyncResource } from '@/lib/useAsyncResource'

import { isSettingsPath } from './page-index'
import { closeSearch, openSearch, useSearchState, type SearchState } from './store'

const loadPalette = () => import('./PaletteBody')

/**
 * The command palette: one search over pages, Settings, the catalog (entity
 * types of the MonoRail standard, opened in Explore), chats and the wiki.
 * Ctrl+K opens it anywhere in the hub (on the Settings scope when a Settings
 * page is open); so does the top bar's search field. Before anything is
 * typed it shows recent results and the catalog's sections.
 */
export function CommandPalette() {
  const state = useSearchState()

  // Ctrl+K anywhere in the hub; a second press closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      if (state.open) closeSearch()
      else openSearch(isSettingsPath(currentPath()) ? { scope: 'settings' } : {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open])

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && closeSearch()}>
      <DialogContent
        showClose={false}
        aria-describedby="command-palette-help"
        className="top-[10vh] flex max-h-[min(640px,80vh)] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Search MonoRail</DialogTitle>
        <DialogDescription id="command-palette-help" className="sr-only">
          Search pages, the catalog, chats, settings and the wiki. Up and down move, Enter opens, Tab changes what is searched, Escape closes.
        </DialogDescription>
        {/* Keyed by the open, so every open starts fresh from how it was opened; chats are re-read each time. */}
        <PaletteLoader key={state.openId} start={state} />
      </DialogContent>
    </Dialog>
  )
}

function PaletteLoader({ start }: { start: SearchState }) {
  const [palette, retry, retried] = useAsyncResource(loadPalette)
  if (palette.status === 'ready') {
    const Body = palette.data.default
    return <Body start={start} />
  }
  return (
    <div className="flex items-center justify-between gap-4 p-5 text-sm text-muted-foreground">
      {palette.status === 'loading' ? (
        <p role="status">Loading search…</p>
      ) : (
        <>
          <p role="alert">Search couldn’t load.</p>
          <Button size="sm" variant="outline" onClick={retried ? () => window.location.reload() : retry}>
            {retried ? 'Reload MonoRail' : 'Try again'}
          </Button>
        </>
      )}
    </div>
  )
}
