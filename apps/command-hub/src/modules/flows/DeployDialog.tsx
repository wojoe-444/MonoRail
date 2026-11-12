import { useState } from 'react'
import { Copy, Eye, Globe, MessagesSquare, Plug, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'

import type { FlowSummary } from './types'

type Tab = 'mcp' | 'chat' | 'api'

function Row({ title, children, on, onChange }: { title: string; children: React.ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>
      </div>
      <Switch checked={on} onCheckedChange={onChange} />
    </div>
  )
}

/** Design preview: where a flow can be used from. Everything starts off. */
export function DeployDialog({ open, onOpenChange, flow }: { open: boolean; onOpenChange: (v: boolean) => void; flow: FlowSummary }) {
  const [tab, setTab] = useState<Tab>('mcp')
  const [mcp, setMcp] = useState(true)
  const [chat, setChat] = useState(true)
  const [coord, setCoord] = useState(false)
  const [api, setApi] = useState(false)
  const tool = `flow_${flow.id.replace(/-/g, '_')}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deploy “{flow.name}”</DialogTitle>
          <DialogDescription>Choose where this flow can be run from. It always runs on this PC, with your spending limit.</DialogDescription>
        </DialogHeader>
        <Segmented
          aria-label="Deploy to"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mcp', label: 'MCP tool' },
            { value: 'chat', label: 'Chat & coordinator' },
            { value: 'api', label: 'Local API' },
          ]}
        />
        {tab === 'mcp' && (
          <div className="space-y-3">
            <Row title="Offer as an MCP tool" on={mcp} onChange={setMcp}>
              Agents connected to MonoRail’s MCP server see a tool named <span className="font-mono">{tool}</span>. Each agent still needs your OK on Agent access, like any write tool.
            </Row>
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium"><Plug className="size-3.5" /> Agents that may call it</div>
              {[
                ['claude-code', 'Claude Code', true],
                ['cursor', 'Cursor', false],
              ].map(([id, name, ok]) => (
                <div key={String(id)} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{name}</span>
                  {ok ? <Badge variant="success"><ShieldCheck /> Allowed</Badge> : <Badge variant="outline">Not allowed</Badge>}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
              <div className="mb-1 font-sans text-[11px] text-muted-foreground">Tool inputs, from the flow’s inputs</div>
              {`{ "message": string }  →  { "reply": string, "cost_usd": number }`}
            </div>
          </div>
        )}
        {tab === 'chat' && (
          <div className="space-y-3">
            <Row title="Show in Chat" on={chat} onChange={setChat}>
              Start a chat with this flow from Chat’s agent picker. Each message is one run; the steps show in the thread.
            </Row>
            <Row title="Let the coordinator use it" on={coord} onChange={setCoord}>
              The coordinator gets <span className="font-mono">run_flow</span> for this flow, next to its chat tools.
            </Row>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><MessagesSquare className="size-4" /> Flows are not Claude Code subagents: they run inside MonoRail, so other tools reach them through MCP.</div>
          </div>
        )}
        {tab === 'api' && (
          <div className="space-y-3">
            <Row title="Local API" on={api} onChange={setApi}>
              An HTTP endpoint on this PC only (127.0.0.1), guarded by a token. Off by default; never reachable from the internet.
            </Row>
            <div className={api ? '' : 'pointer-events-none opacity-50'}>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium"><Globe className="size-3.5" /> Endpoint</div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
                <span className="flex-1 truncate">POST http://127.0.0.1:5297/flows/{flow.id}/run</span>
                <Button size="icon" variant="ghost" className="size-6"><Copy /></Button>
              </div>
              <div className="mt-3 mb-1 text-xs font-medium">Token</div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
                <span className="flex-1">••••••••••••••••••••••••</span>
                <Button size="icon" variant="ghost" className="size-6"><Eye /></Button>
                <Button size="icon" variant="ghost" className="size-6"><Copy /></Button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">{`curl -X POST http://127.0.0.1:5297/flows/${flow.id}/run \\
  -H "Authorization: Bearer $MONORAIL_FLOW_TOKEN" \\
  -d '{"message": "Review the branch main"}'`}</pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
