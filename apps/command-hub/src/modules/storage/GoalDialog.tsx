import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBytes } from '@/lib/format'
import { invokeModule } from '@/modules/client'

import type { Drive, DriveGoal } from './types'

const GB = 1024 ** 3

/** Set, change or remove the free-space goal of one drive. */
export function GoalDialog({ drive, goal, onClose, onSaved }: { drive: Drive; goal?: DriveGoal; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(goal ? String(Math.round((goal.freeBytes / GB) * 10) / 10) : suggestion(drive))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const gb = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(gb) && gb > 0 && gb * GB <= drive.total

  async function save(freeBytes: number | null) {
    setBusy(true)
    setError(undefined)
    try {
      await invokeModule('storage', 'setGoal', { drive: drive.id, freeBytes })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Free-space goal for {drive.id}</DialogTitle>
          <DialogDescription>
            How much free space you want to keep on this drive. The page shows how close you are, and the Over time chart draws it as a line. Setting a goal never deletes anything.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !busy) void save(gb * GB)
          }}
        >
          <Label htmlFor="storage-goal">Keep at least (GB free)</Label>
          <Input id="storage-goal" type="number" inputMode="decimal" min={0.1} step={1} value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="w-40 font-mono" />
          <span className="text-xs text-muted-foreground tabular-nums">
            Now {formatBytes(drive.free)} free of {formatBytes(drive.total)}.
            {value.trim() !== '' && !valid && ` Enter a number between 0.1 and ${Math.floor(drive.total / GB)}.`}
          </span>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="mt-2">
            {goal && (
              <Button type="button" variant="ghost" className="mr-auto" disabled={busy} onClick={() => void save(null)}>
                Remove goal
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              Save goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A starting value: 15% of the drive, rounded to 5 GB (at least 5 GB). */
function suggestion(d: Drive) {
  return String(Math.max(5, Math.round((d.total * 0.15) / GB / 5) * 5))
}
