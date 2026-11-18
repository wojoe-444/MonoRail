import { useState } from 'react'
import { BookOpen, Cable, Loader2, PlugZap, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { prefs } from '@/lib/prefs'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { openWiki } from '@/modules/wiki/store'

import { useCall } from './api'
import { typeInfo } from './catalog'
import { EntityList } from './EntityList'
import { EntityView } from './EntityView'
import { Overview } from './Overview'
import type { View } from './util'
import { TypeNav } from './TypeNav'
import type { OmCounts, OmStatus } from './types'

const TYPE_KEY = 'monorail.openmetadata.type'

/**
 * OpenMetadata: every entity type in an OpenMetadata server, on one page.
 * The overview, one type's entities, or one entity with everything
 * OpenMetadata holds about it. Reads through electron/modules/openmetadata.cjs;
 * nothing runs until the OpenMetadata connection is set up.
 */
export default function OpenMetadataPage() {
  const status = useCall<OmStatus>('status', {})
  const ready = !!status.data && !status.data.block
  const counts = useCall<OmCounts>('counts', ready ? {} : null)
  const [view, setViewState] = useState<View>(() => {
    const type = prefs.getItem(TYPE_KEY) ?? undefined
    return typeInfo(type) ? { type } : {}
  })
  const setView = (v: View) => {
    setViewState(v)
    if (v.type) prefs.setItem(TYPE_KEY, v.type)
    else prefs.removeItem(TYPE_KEY)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="OpenMetadata"
        description="Every entity type in your OpenMetadata server, the way OpenMetadata stores it: browse any of them and see every field, relationship and version."
        actions={
          <>
            <Button variant="ghost" onClick={() => openWiki('guide/openmetadata')}>
              <BookOpen /> Guide
            </Button>
            <Button
              variant="outline"
              disabled={status.loading || counts.loading}
              onClick={() => {
                status.reload()
                counts.reload()
              }}
            >
              {status.loading || counts.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
          </>
        }
      />

      {!status.data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {status.error ? status.error : <><Loader2 className="size-4 animate-spin" /> Connecting to OpenMetadata…</>}
        </div>
      ) : status.data.block ? (
        <BlockedCard status={status.data} onRetry={status.reload} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <TypeNav current={view.type} counts={counts.data} onChoose={(type) => setView(type ? { type } : {})} />
          <div className="min-w-0">
            {!view.type ? (
              <Overview status={status.data} counts={counts.data} countsError={counts.error} onOpen={setView} />
            ) : view.fqn ? (
              <EntityView key={`${view.type}|${view.fqn}`} type={view.type} fqn={view.fqn} onOpen={setView} />
            ) : (
              <EntityList key={view.type} type={view.type} total={counts.data?.[view.type]} onOpen={setView} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const BLOCKS = {
  'not-set-up': {
    title: 'OpenMetadata is not set up in MonoRail',
    body: 'Add the OpenMetadata connection on Connections: your server (for example http://localhost:8585) and a bot token. Until then MonoRail contacts no server.',
    icon: PlugZap,
    warn: false,
  },
  rejected: {
    title: 'OpenMetadata rejected the sign-in',
    body: 'The bot token may have expired or been revoked, or the password changed. Update it on Connections.',
    icon: ShieldAlert,
    warn: true,
  },
  unreachable: {
    title: 'OpenMetadata did not answer',
    body: 'Is the server running? OpenMetadata takes a few minutes to start. Check the address on Connections, then try again.',
    icon: WifiOff,
    warn: true,
  },
} as const

function BlockedCard({ status, onRetry }: { status: OmStatus; onRetry: () => void }) {
  const b = BLOCKS[status.block ?? 'not-set-up']
  return (
    <Card className="items-start gap-4 px-6 py-8">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
        {status.error && <p className="font-mono text-xs text-muted-foreground">{status.error}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => navigate('/connections')}>
          <Cable /> {status.block === 'not-set-up' ? 'Set up on Connections' : 'Open Connections'}
        </Button>
        {status.block !== 'not-set-up' && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )}
      </div>
    </Card>
  )
}
