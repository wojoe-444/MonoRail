import { Cable, Cloud, FolderOpen, PlugZap, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

/** Why the Malloy tabs cannot read models yet, each pointing to Connections. */
export type MalloyBlockedReason = 'not-set-up' | 'no-folder' | 'no-gcloud'

const BLOCKS: Record<MalloyBlockedReason, { title: string; body: string; icon: typeof PlugZap; warn?: boolean }> = {
  'not-set-up': {
    title: 'Malloy is not set up in MonoRail',
    body: 'Malloy models (.malloy files) are compiled by the real Malloy compiler and run on BigQuery with your Google Cloud login. It is optional: on Connections, open Google Cloud and add Malloy, then pick the folder with your .malloy files. Until then MonoRail looks at nothing. Running queries stays off until you turn it on in that connection.',
    icon: PlugZap,
  },
  'no-folder': {
    title: 'The Malloy models folder was not found',
    body: 'The folder in the Malloy connection is missing or was moved. Edit the Malloy connection (under Google Cloud on Connections) and pick the folder again.',
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
  return (
    <Card className={cn('items-start gap-4 px-6', compact ? 'py-4 sm:flex-row sm:items-center' : 'py-8')}>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
      </div>
      <div className={cn('flex gap-2', compact && 'sm:ml-auto')}>
        <Button onClick={() => navigate('/connections')}>
          <Cable /> {reason === 'not-set-up' ? 'Set up on Connections' : 'Open Connections'}
        </Button>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Check again
          </Button>
        )}
      </div>
    </Card>
  )
}
