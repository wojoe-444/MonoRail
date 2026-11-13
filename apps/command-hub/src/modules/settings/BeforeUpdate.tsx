import { AlertTriangle, HardDriveDownload, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/router'

import type { AppStatus } from './types'

// "Back up before updating" in the update UI (the pop-up and Settings >
// General). The backup itself runs in the settings backend
// (electron/modules/settings.cjs) between the download and the installer.

/** One line under an available update: whether it backs up first, or a gentle hint to set a folder. */
export function BeforeUpdateNote({ status, onNavigate }: { status: AppStatus; onNavigate?: () => void }) {
  const mode = status.backupBeforeUpdate
  if (mode === 'on')
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
        Your data is backed up to your backup folder before the update installs.
      </p>
    )
  if (mode === 'no-folder')
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Tip: choose a{' '}
        <button
          type="button"
          className="font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => {
            navigate('/settings/backups')
            onNavigate?.()
          }}
        >
          backup folder
        </button>{' '}
        and MonoRail backs up your data before every update.
      </p>
    )
  return null
}

/** Title and text while the backup runs. */
export const BACKING_UP = {
  title: 'Backing up your data first…',
  text: 'Tasks, Notes and Flashcards are saved to your backup folder. MonoRail restarts when it is done.',
}

/** What failed, and the two ways on: try again, or update without a backup. */
export function BackupFailed({ status, busy, onRetry, onSkip }: { status: AppStatus; busy?: boolean; onRetry: () => void; onSkip: () => void }) {
  const failed = status.backup?.items.filter((i) => !i.ok) ?? []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <div>Nothing was installed. Your data and this version are as they were.</div>
          {failed.length ? (
            <ul className="mt-1 list-disc pl-4 text-xs">
              {failed.map((i) => (
                <li key={i.id} className="break-words">
                  {i.title}: {i.error}
                </li>
              ))}
            </ul>
          ) : (
            status.backup?.error && <div className="mt-1 text-xs break-words">{status.backup.error}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}>
          Update without a backup
        </Button>
        <Button size="sm" onClick={onRetry} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Try again
        </Button>
      </div>
    </div>
  )
}

export const BackingUpIcon = HardDriveDownload
