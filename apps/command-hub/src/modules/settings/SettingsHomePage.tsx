import { AlertTriangle, ArrowRight, CheckCircle2, Info, XCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

import { useSettingsAlerts, type AlertTone } from './alerts'

const TONE: Record<AlertTone, { tile: string; Icon: typeof Info }> = {
  destructive: { tile: 'bg-destructive-soft text-destructive-soft-foreground', Icon: XCircle },
  warning: { tile: 'bg-warning-soft text-warning-soft-foreground', Icon: AlertTriangle },
  info: { tile: 'bg-info-soft text-info-soft-foreground', Icon: Info },
}

/** Settings home: only what needs the user. Most of the time there is nothing, and it says so. */
export default function SettingsHomePage() {
  const { alerts, loaded } = useSettingsAlerts()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" description="Anything in your setup that needs you shows up here." />

      {!loaded ? null : alerts.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="font-medium">Nothing needs you</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Your connections, updates, backups and extensions are fine. If a sign-in expires or a backup fails, it is listed here.
          </p>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Needs attention
            <span className="min-w-5 rounded-full bg-warning px-1.5 text-center leading-5 text-black">{alerts.length}</span>
          </h2>
          <Card className="gap-0 divide-y py-0">
            {alerts.map((a) => {
              const { tile, Icon } = TONE[a.tone]
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tile)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="font-medium">{a.title}</div>
                    {a.text && <div className="text-sm break-words text-muted-foreground">{a.text}</div>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.where}
                    {a.at ? ` · ${formatRelative(a.at)}` : ''}
                  </span>
                  <Button variant={a.tone === 'info' ? 'outline' : 'default'} onClick={() => navigate(a.path)}>
                    Open {a.where} <ArrowRight />
                  </Button>
                </div>
              )
            })}
          </Card>
        </section>
      )}
    </div>
  )
}
