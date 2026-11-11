import { useState } from 'react'
import { ArrowLeftRight, FlaskConical, Loader2, MousePointerClick } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { setInspecting, useDevMode, useInspecting } from '@/lib/devMode'
import { NEW_USER_ID, switchProfile, useProfiles } from '@/lib/testProfile'

/**
 * Top-bar items for Developer Mode: the inspect button (only with Developer
 * Mode on) and, whenever the New User test profile is open, a status chip with
 * the way back. The chip shows even if Developer Mode was turned off, so the
 * test profile can never strand anyone.
 */
export function DevTopBarItems() {
  const devMode = useDevMode()
  const inspecting = useInspecting()
  const view = useProfiles()
  const [busy, setBusy] = useState(false)

  const inNewUser = view?.activeId === NEW_USER_ID
  const back = view?.profiles.find((p) => p.id === (view.previousId ?? 'default'))

  return (
    <>
      {inNewUser && (
        <div className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-warning-soft pr-1 pl-3 text-xs font-medium text-warning-soft-foreground">
          <FlaskConical className="size-3.5" />
          New User · test profile
          <Button
            size="sm"
            variant="ghost"
            className="h-6 rounded-full px-2 text-xs hover:bg-warning/15"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              switchProfile(back?.id ?? 'default').catch(() => setBusy(false))
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />} Back to {back?.name || 'my profile'}
          </Button>
        </div>
      )}
      {devMode && (
        <Button
          variant={inspecting ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => setInspecting(!inspecting)}
          aria-label="Inspect elements (Ctrl+Shift+C)"
          title="Inspect elements (Ctrl+Shift+C)"
          aria-pressed={inspecting}
        >
          <MousePointerClick />
        </Button>
      )}
    </>
  )
}
