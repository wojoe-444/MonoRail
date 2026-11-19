import { useState } from 'react'
import { Cable, Cloud, FolderOpen, Loader2, RefreshCw, Settings2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { hasLocalScreen } from '@/modules/client'

import { openMalloySettings, pickMalloyFolder } from './malloySettings'

/** Why the Malloy tabs cannot read models yet. Malloy ships with MonoRail; only Google Cloud is a connection. */
export type MalloyBlockedReason = 'not-set-up' | 'no-folder' | 'no-gcloud'

const BLOCKS: Record<MalloyBlockedReason, { title: string; body: string; icon: typeof Sparkles; warn?: boolean }> = {
  'not-set-up': {
    title: 'Pick your Malloy models folder',
    body: 'Malloy comes with MonoRail: it compiles your .malloy files with the real Malloy compiler and runs their queries on BigQuery with your Google Cloud login. Choose the folder that holds them; MonoRail only reads it. Running queries stays off until you turn it on in Malloy settings.',
    icon: Sparkles,
  },
  'no-folder': {
    title: 'The Malloy models folder was not found',
    body: 'The folder in Malloy settings is missing or was moved. Choose it again.',
    icon: FolderOpen,
    warn: true,
  },
  'no-gcloud': {
    title: 'Sign in to Google Cloud',
    body: 'Malloy reads table schemas from BigQuery with your gcloud login, so models cannot be compiled or run until Google Cloud is set up on Connections. What each file declares is still shown below.',
    icon: Cloud,
    warn: true,
  },
}

export function MalloyBlockedCard({ reason, onRetry, compact }: { reason: MalloyBlockedReason; onRetry?: () => void; compact?: boolean }) {
  const b = BLOCKS[reason]
  const [busy, setBusy] = useState(false)
  const pick = async () => {
    setBusy(true)
    try {
      await pickMalloyFolder()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className={cn('items-start gap-4 px-6', compact ? 'py-4 sm:flex-row sm:items-center' : 'py-8')}>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
      </div>
      <div className={cn('flex flex-wrap gap-2', compact && 'sm:ml-auto')}>
        {reason === 'no-gcloud' ? (
          <Button onClick={() => navigate('/connections')}>
            <Cable /> Open Connections
          </Button>
        ) : hasLocalScreen() ? (
          <Button disabled={busy} onClick={pick}>
            {busy ? <Loader2 className="animate-spin" /> : <FolderOpen />} Choose folder
          </Button>
        ) : null}
        {reason !== 'no-gcloud' && (
          <Button variant="outline" onClick={openMalloySettings}>
            <Settings2 /> Malloy settings
          </Button>
        )}
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Check again
          </Button>
        )}
      </div>
    </Card>
  )
}
