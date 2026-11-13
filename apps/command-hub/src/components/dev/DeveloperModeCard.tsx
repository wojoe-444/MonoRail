import { useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeftRight, Code2, Loader2, MousePointerClick, RotateCcw, SquareTerminal, UserRoundPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { openDevTools, setDevMode, setInspecting, useDevMode } from '@/lib/devMode'
import { NEW_USER_ID, switchProfile, useProfiles } from '@/lib/testProfile'
import { isDesktop } from '@/modules/client'

/**
 * Settings > Developer Mode (docs/developer-mode.md). Self-contained so it can
 * move to any Settings section: it needs no props and reads its own state.
 */
export function DeveloperModeCard({ className }: { className?: string }) {
  const on = useDevMode()
  const desktop = isDesktop()
  const view = useProfiles()
  const [confirm, setConfirm] = useState<'enter' | 'reset' | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const inNewUser = view?.activeId === NEW_USER_ID
  const own = view?.profiles.find((p) => p.id === (inNewUser ? (view.previousId ?? 'default') : view.activeId))
  const ownName = own?.name || 'your profile'

  async function go(id: string) {
    setBusy(true)
    setError(undefined)
    try {
      const restarted = await switchProfile(id)
      if (!restarted) setError('Switched. Restart MonoRail (npm run dev:browser) to open it: the browser bridge cannot restart itself.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2">
            Developer mode {on && <Badge variant="warning">On</Badge>}
          </CardTitle>
          <CardDescription>Tools for testing MonoRail and giving feedback on it: an element inspector and a blank New User profile.</CardDescription>
        </div>
        <Switch checked={on} onCheckedChange={setDevMode} aria-label="Developer mode" className="mt-1" />
      </CardHeader>
      {on && (
        <>
          <Separator />
          <CardContent className="flex flex-col divide-y">
            <Tool
              icon={<MousePointerClick className="size-5" />}
              title="Inspect elements"
              description="Hover anything to see the name of the component that draws it. Click to copy its name, the page and its text, ready to paste into feedback."
            >
              <Button variant="outline" onClick={() => setInspecting(true)}>
                <MousePointerClick /> Inspect <Kbd>Ctrl+Shift+C</Kbd>
              </Button>
              {desktop && (
                <Button variant="outline" onClick={openDevTools}>
                  <SquareTerminal /> Open DevTools <Kbd>F12</Kbd>
                </Button>
              )}
            </Tool>

            <Tool
              icon={<UserRoundPlus className="size-5" />}
              title={
                <span className="flex items-center gap-2">
                  New User profile {inNewUser && <Badge variant="warning">Open now</Badge>}
                </span>
              }
              description={
                inNewUser
                  ? `You are trying MonoRail as a first-time user. ${ownName === 'your profile' ? 'Your profile' : `${ownName}'s profile`} is untouched and comes back as it was.`
                  : 'A hidden test profile that is empty every time you switch to it, to try MonoRail as a first-time user. Your own profile and its data stay exactly as they are.'
              }
            >
              {inNewUser ? (
                <>
                  <Button disabled={busy || !desktop} onClick={() => go(own?.id ?? 'default')}>
                    {busy ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />} Back to {ownName}
                  </Button>
                  <Button variant="outline" disabled={busy || !desktop} onClick={() => setConfirm('reset')}>
                    <RotateCcw /> Start over blank
                  </Button>
                </>
              ) : (
                <Button variant="outline" disabled={busy || !desktop} onClick={() => setConfirm('enter')}>
                  <ArrowLeftRight /> Switch to New User
                </Button>
              )}
              {!desktop && <span className="text-xs text-muted-foreground">Works in the desktop app.</span>}
            </Tool>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}
          </CardContent>
        </>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === 'reset' ? 'Start New User over?' : 'Switch to New User?'}</DialogTitle>
            <DialogDescription>MonoRail restarts into a blank New User profile.</DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Anything made in New User last time is deleted first.</li>
            <li>
              {ownName === 'your profile' ? 'Your profile' : `${ownName}'s profile`} and its data are not touched. Switch back from the bar at the top or
              from here.
            </li>
            <li>This computer's installed extensions, Claude Stats and Storage are shared by every profile, so they still show.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(undefined)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setConfirm(undefined)
                void go(NEW_USER_ID)
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Code2 />} Restart as New User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Tool({ icon, title, description, children }: { icon: ReactNode; title: ReactNode; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 py-6 first:pt-0 last:pb-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">{icon}</div>
      <div className="min-w-0 flex-1 basis-64">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>
}
