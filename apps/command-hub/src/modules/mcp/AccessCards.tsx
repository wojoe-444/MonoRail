import { useState } from 'react'
import { Bot, CheckCircle2, PenLine, RefreshCw, Trash2, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { sampleAccess, sampleAudit } from './sample'
import type { McpAccess, McpAuditEntry } from './types'

/** Agents that have connected, with a switch per write tool. Everything starts off. */
export function AgentsCard({ className }: { className?: string }) {
  const desktop = isDesktop()
  const query = useModuleQuery<McpAccess>('mcp', 'getAccess')
  const [live, setLive] = useState<McpAccess>()
  const [error, setError] = useState<string>()
  const data = live ?? query.data ?? (desktop ? undefined : sampleAccess)

  async function change(method: string, args: unknown) {
    setError(undefined)
    if (!desktop) return
    try {
      setLive(await invokeModule<McpAccess>('mcp', method, args))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>Every agent that has connected. Write tools stay off until you turn them on here, per agent. Read tools are always available.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => { setLive(undefined); void query.refresh() }}>
            <RefreshCw /> Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!data?.agents.length ? (
          <p className="text-sm text-muted-foreground">No agent has connected yet. Add MonoRail to an agent above; it shows up here the first time it starts the server.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.agents.map((a) => (
              <li key={a.name} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start">
                <div className="flex w-64 shrink-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.title || a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.title && <span className="font-mono">{a.name} </span>}
                      {a.version ? `v${a.version} · ` : ''}first seen {formatRelative(a.firstSeen)}
                    </div>
                  </div>
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.writeTools.map((t) => {
                    const on = a.allow.includes(t.name)
                    return (
                      <label key={t.name} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1 ring-foreground/10">
                        <span className="min-w-0 text-sm">{t.title}</span>
                        <Switch checked={on} onCheckedChange={(v) => void change('setAllowed', { agent: a.name, tool: t.name, allowed: v })} aria-label={`${t.title} for ${a.name}`} />
                      </label>
                    )
                  })}
                </div>
                <Button variant="ghost" size="sm" className="self-start" onClick={() => void change('forgetAgent', { agent: a.name })} title="Forget this agent and what it may do">
                  <Trash2 /> Forget
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** The audit log: every tool call, newest first. */
export function ActivityCard({ className }: { className?: string }) {
  const desktop = isDesktop()
  const query = useModuleQuery<McpAuditEntry[]>('mcp', 'getAudit', { limit: 200 })
  const [writesOnly, setWritesOnly] = useState(false)
  const all = query.data ?? (desktop ? undefined : sampleAudit) ?? []
  const rows = writesOnly ? all.filter((e) => e.write) : all

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Every call agents made, newest first: who, which tool, and what a write changed. Arguments and results are not kept.</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button variant={writesOnly ? 'secondary' : 'outline'} size="sm" onClick={() => setWritesOnly((v) => !v)}>
            <PenLine /> Writes only
          </Button>
          <Button variant="outline" size="sm" onClick={() => void query.refresh()}>
            <RefreshCw /> Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!desktop || all.length === 0}
            onClick={() => void invokeModule('mcp', 'clearAudit').then(() => query.refresh())}
          >
            <Trash2 /> Clear
          </Button>
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{all.length ? 'No writes yet.' : 'Nothing yet. Calls show up here as agents use the tools.'}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
                {e.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.agent}</span>
                    <code className="font-mono text-xs text-muted-foreground">{e.tool}</code>
                    {e.write && <Badge variant="warning">Write</Badge>}
                  </div>
                  {(e.did || e.error) && <div className={cn('mt-1 break-words', e.ok ? 'text-foreground' : 'text-muted-foreground')}>{e.did ?? e.error}</div>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums" title={e.at}>
                  {formatRelative(e.at)}
                  <div className="font-mono">{e.ms} ms</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
