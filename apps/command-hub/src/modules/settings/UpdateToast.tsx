import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download, Loader2, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { invokeModule, isDesktop } from '@/modules/client'

import type { AppStatus } from './types'
import { WhatsNewBrief } from './WhatsNew'

// Update pop-up in the lower right. The settings backend checks for updates at
// startup and every few hours (start() in electron/modules/settings.cjs); this
// reads its status and, when a new version is available, offers it.
//
// - "Download and Restart" runs the same download as Settings; the backend
//   restarts into the new version once it lands.
// - "Ignore for six hours" is remembered across restarts (localStorage, which
//   lives in the app's data folder).
// - X hides it until the next background check finds the update again.

const MODULE_ID = 'settings'
const SNOOZE_KEY = 'commandHub.updateSnoozeUntil'
const SNOOZE_MS = 6 * 60 * 60 * 1000
const POLL_MS = 60 * 1000

function snoozedUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    // Storage unavailable: the pop-up stays hidden for this session via `dismissed`.
  }
}

export function UpdateToast() {
  const desktop = isDesktop()
  const [status, setStatus] = useState<AppStatus>()
  const [now, setNow] = useState(() => Date.now())
  // lastChecked of the check whose result was dismissed with X or Ignore.
  const [dismissed, setDismissed] = useState<string>()
  // Set once the download was started from this pop-up, so it keeps showing progress.
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    invokeModule<AppStatus>(MODULE_ID, 'getStatus').then(
      (s) => {
        setNow(Date.now())
        setStatus(s)
      },
      () => {},
    )
  }, [])

  const downloading = status?.state === 'downloading' || status?.state === 'downloaded'
  useEffect(() => {
    if (!desktop) return
    load()
    const t = setInterval(load, started && downloading ? 500 : POLL_MS)
    return () => clearInterval(t)
  }, [desktop, load, started, downloading])

  if (!status?.updatesSupported) return null

  const offer = status.state === 'available' && now >= snoozedUntil() && dismissed !== (status.lastChecked ?? '')
  const following = started && (downloading || status.state === 'error')
  if (!offer && !following) return null

  async function download() {
    setBusy(true)
    setStarted(true)
    try {
      setStatus(await invokeModule<AppStatus>(MODULE_ID, 'downloadUpdate'))
    } catch {
      load()
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setDismissed(status?.lastChecked ?? '')
    setStarted(false)
  }

  function ignore() {
    snooze()
    close()
  }

  const percent = Math.round(status.progress?.percent ?? 0)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-6 bottom-6 z-50 w-[24rem] max-w-[calc(100vw-3rem)] rounded-xl bg-popover p-4 text-popover-foreground shadow-elevation-3 ring-1 ring-foreground/10"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          {status.state === 'error' ? <AlertTriangle className="size-4" /> : <Sparkles className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          {status.state === 'error' ? (
            <>
              <div className="text-sm font-medium">The update could not be downloaded</div>
              <div className="mt-1 text-sm break-words text-muted-foreground">{status.error ?? 'Try again from Settings.'}</div>
            </>
          ) : downloading ? (
            <>
              <div className="text-sm font-medium">
                {status.state === 'downloaded' ? 'Restarting to update…' : `Downloading MonoRail ${status.latestVersion ?? ''}`}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">MonoRail restarts by itself when the download is done.</div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">MonoRail {status.latestVersion} is available</div>
              <div className="mt-1 text-sm text-muted-foreground">You have {status.currentVersion}.</div>
              <WhatsNewBrief status={status} />
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="-mt-1.5 -mr-1.5 size-8" onClick={close} aria-label="Close">
          <X />
        </Button>
      </div>

      {downloading && status.state === 'downloading' && (
        <div className="mt-4 flex items-center gap-3">
          <Progress value={percent} className="flex-1" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{percent}%</span>
        </div>
      )}

      {offer && !downloading && status.state !== 'error' && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={ignore}>
            Ignore for six hours
          </Button>
          <Button size="sm" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Download and Restart
          </Button>
        </div>
      )}
    </div>
  )
}
