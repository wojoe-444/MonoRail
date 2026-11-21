import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, Cable, FolderOpen, Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { navigate } from '@/lib/router'
import { hasLocalScreen, moduleClient } from '@/modules/client'

/*
 * Malloy's own settings. Malloy ships with MonoRail (it is not a connection),
 * so its models folder, billing project, location, "Run queries on BigQuery"
 * and scan limit are set here, kept by the `malloy` backend
 * (electron/modules/malloy-settings.cjs). The folder is picked in the system
 * dialog; the page only ever sees its name. One dialog, mounted by the
 * OpenMetadata page; any Malloy tab opens it with openMalloySettings(), and
 * the tabs reload when `useMalloySettingsVersion()` changes.
 */

export interface MalloySettings {
  folderName?: string
  project: string
  location: string
  run: 'on' | 'off'
  maxScanGb: string
  damaged?: boolean
  /** Still the values of the Malloy connection an older version saved. */
  fromConnection?: boolean
  /** The Google Cloud connection is added. */
  gcloud: boolean
}

const SCAN_GB = ['0.1', '1', '5', '10', '50']

let open = false
let version = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function openMalloySettings() {
  open = true
  emit()
}

function close() {
  open = false
  emit()
}

function changed() {
  version += 1
  emit()
}

/** Bumps after every saved change, so Malloy tabs can read the folder again. */
export function useMalloySettingsVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

const sample: MalloySettings = { folderName: 'lantern-models', project: 'lantern-demo', location: 'US', run: 'on', maxScanGb: '1', gcloud: true }

const settingsCall = moduleClient('malloy', (_method, args) => Promise.resolve({ ...sample, ...args }))

/** Asks for the models folder in the system dialog; true when one was picked. */
export async function pickMalloyFolder(): Promise<boolean> {
  const r = await settingsCall('pickFolder')
  if (r.canceled) return false
  changed()
  return true
}

export function MalloySettingsDialog() {
  const isOpen = useSyncExternalStore(subscribe, () => open)
  const [s, setS] = useState<MalloySettings>()
  const [draft, setDraft] = useState<Pick<MalloySettings, 'project' | 'location' | 'run' | 'maxScanGb'>>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!isOpen) return
    // oxlint-disable-next-line react/set-state-in-effect -- Clear the previous dialog's error before reading the saved Malloy settings.
    setError(undefined)
    settingsCall('getSettings')
      .then((r) => {
        setS(r)
        setDraft({ project: r.project, location: r.location, run: r.run, maxScanGb: r.maxScanGb })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [isOpen])

  const act = async (name: string, work: () => Promise<MalloySettings | undefined>, done?: boolean) => {
    setBusy(name)
    setError(undefined)
    try {
      const r = await work()
      if (r) {
        setS(r)
        setDraft({ project: r.project, location: r.location, run: r.run, maxScanGb: r.maxScanGb })
      }
      changed()
      if (done) close()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  const local = hasLocalScreen()
  const dirty = !!(s && draft) && (draft.project !== s.project || draft.location !== s.location || draft.run !== s.run || draft.maxScanGb !== s.maxScanGb || !!s.fromConnection)

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Malloy settings</DialogTitle>
          <DialogDescription>Malloy comes with MonoRail. Pick the folder with your .malloy files; MonoRail only reads it. Queries run on BigQuery with your own Google Cloud login.</DialogDescription>
        </DialogHeader>

        {!s || !draft ? (
          error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading the settings…
            </div>
          )
        ) : s.damaged ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Malloy&apos;s settings file is damaged, so nothing is read. Resetting keeps the damaged file aside and starts from the defaults.
            </p>
            <Button variant="outline" className="self-start" disabled={!!busy} onClick={() => act('reset', () => settingsCall('resetSettings'))}>
              {busy === 'reset' ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset the settings
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {s.fromConnection && <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">These come from the Malloy connection an earlier version used. Save to keep them here.</p>}

            <div className="flex flex-col gap-1.5">
              <Label>Models folder</Label>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-md border px-3 py-1.5 font-mono text-sm">{s.folderName ?? <span className="font-sans text-muted-foreground">None picked yet</span>}</span>
                <Button variant="outline" size="sm" disabled={!!busy || !local} title={local ? undefined : 'Pick the folder on your PC'} onClick={() => act('pick', async () => ((await pickMalloyFolder()) ? settingsCall('getSettings') : undefined))}>
                  {busy === 'pick' ? <Loader2 className="animate-spin" /> : <FolderOpen />} {s.folderName ? 'Change' : 'Choose folder'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Subfolders are read too (not dot folders, node_modules or target).</p>
            </div>

            {!s.gcloud && (
              <p className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                Malloy reads BigQuery with your gcloud login. Set up Google Cloud first.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    close()
                    navigate('/connections')
                  }}
                >
                  <Cable /> Open Connections
                </Button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="malloy-project">Bill queries to</Label>
                <Input id="malloy-project" className="font-mono" placeholder="Your gcloud project" value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="malloy-location">BigQuery location</Label>
                <Input id="malloy-location" className="font-mono" placeholder="US" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="malloy-run">Run queries on BigQuery</Label>
              <NativeSelect id="malloy-run" value={draft.run} onChange={(e) => setDraft({ ...draft, run: e.target.value === 'on' ? 'on' : 'off' })}>
                <option value="off">Off: compile and show SQL only</option>
                <option value="on">On: run queries I start</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">When on, a query you run is billed to your project. Compiling reads table schemas only, which is free.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="malloy-scan">Most a query may scan</Label>
              <NativeSelect id="malloy-scan" value={draft.maxScanGb} onChange={(e) => setDraft({ ...draft, maxScanGb: e.target.value })}>
                {SCAN_GB.map((gb) => (
                  <option key={gb} value={gb}>
                    {gb} GB
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Every query is dry-run first and does not run if it would scan more. BigQuery enforces it too.</p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {s && draft && !s.damaged && (
            <Button disabled={!dirty || !!busy} onClick={() => act('save', () => settingsCall('saveSettings', draft), true)}>
              {busy === 'save' && <Loader2 className="animate-spin" />} Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
