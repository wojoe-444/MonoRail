import { useState, type ReactNode } from 'react'
import { BookOpen, Check, Copy, Loader2, Lock, Network, ShieldCheck, Terminal } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { isDesktop, useModuleQuery } from '@/modules/client'
import { openWiki } from '@/modules/wiki/store'

import { ActivityCard, AgentsCard } from './AccessCards'
import { sampleSetup } from './sample'
import type { McpSetup } from './types'

type Client = 'claudeCode' | 'json'

const CLIENTS: { value: Client; label: string; help: string }[] = [
  { value: 'claudeCode', label: 'Claude Code', help: 'Run this once in a terminal. It adds MonoRail for every project (user scope).' },
  { value: 'json', label: 'JSON config', help: 'For agents configured with an mcpServers file, such as Claude Desktop, Cursor or a project .mcp.json.' },
]

export default function McpPage() {
  const desktop = isDesktop()
  const query = useModuleQuery<McpSetup>('mcp', 'getSetup')
  const setup = query.data ?? (desktop ? undefined : sampleSetup)
  const [client, setClient] = useState<Client>('claudeCode')
  const current = CLIENTS.find((c) => c.value === client)!

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agent access"
        description="Claude Code and other agents can use MonoRail through its MCP server. The agent starts it when it needs it; writes need your OK."
        actions={
          <Button variant="outline" onClick={() => openWiki('mcp')}>
            <BookOpen /> How it works
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Connect an agent</CardTitle>
            <CardDescription>{current.help}</CardDescription>
            <CardAction>
              <Segmented aria-label="Agent" value={client} onChange={setClient} options={CLIENTS.map(({ value, label }) => ({ value, label }))} />
            </CardAction>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col gap-4">
            {!setup ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {query.error ? query.error.message : (<><Loader2 className="size-4 animate-spin" /> Loading…</>)}
              </div>
            ) : (
              <>
                <CodeBlock text={setup.snippets[client]} />
                {!setup.packaged && (
                  <p className="text-sm text-muted-foreground">
                    This is a development build, so the command runs the server file directly and serves this build's data folder. The installed app uses{' '}
                    <code className="font-mono text-xs">MonoRail.exe --mcp</code>.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Then ask your agent something like “What did my agents cost this week?” or “List the open local issues in my repo.” MonoRail does not need to be open.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What agents can reach</CardTitle>
            <CardDescription>On this machine, on your terms.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col gap-4 text-sm">
            <Point icon={Terminal} title="Started by the agent">
              It talks over the agent's own stdin and stdout. No network port is opened, so other programs can't reach it.
            </Point>
            <Point icon={ShieldCheck} title="Writes need your OK">
              Read tools change nothing. Write tools stay off for each agent until you turn them on below, and every call is logged.
            </Point>
            <Point icon={Lock} title="No secrets">
              Tokens, keys and passwords are never returned. Connection status says only whether an account works.
            </Point>
            <Point icon={Network} title="Your folders only">
              Chats come from repos allowed on the Chat page, issues from repos opened in GitHub+.
            </Point>
          </CardContent>
        </Card>

        <AgentsCard className="lg:col-span-3" />

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Tools</CardTitle>
            <CardDescription>What the server offers. Agents see these names and descriptions.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>
            <ul className="flex flex-col divide-y">
              {(setup?.tools ?? []).map((t) => (
                <li key={t.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                  <div className="w-64 shrink-0">
                    <div className="font-medium">{t.title}</div>
                    <code className="font-mono text-xs text-muted-foreground">{t.name}</code>
                  </div>
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t.description}</p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {t.extension && <Badge variant="info">{t.extension}</Badge>}
                    {t.readOnly ? <Badge variant="success">Read-only</Badge> : <Badge variant="warning">Write</Badge>}
                    {t.needsConsent && <Badge variant="outline">Needs your OK</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <ActivityCard className="lg:col-span-3" />
      </div>
    </div>
  )
}

function Point({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-24 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2"
        onClick={() =>
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
      >
        {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
