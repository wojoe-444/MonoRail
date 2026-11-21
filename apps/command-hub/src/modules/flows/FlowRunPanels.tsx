import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, PanelRight, Send, Square, SquareTerminal, X } from 'lucide-react'

import { AgentMochi } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'

import type { RunSnapshot, RunStep } from './types'

const dur = (s: RunStep) => (s.startedAt && s.endedAt ? s.endedAt - s.startedAt : undefined)
const fmtMs = (v?: number) => (v === undefined ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)

export type ChatMsg = { from: 'you'; text: string } | { from: 'flow'; run: RunSnapshot }

export function Playground({ name, msgs, run, busy, onSend, onStop, onClose }: { name: string; msgs: ChatMsg[]; run?: RunSnapshot; busy: boolean; onSend: (text: string) => void; onStop: () => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const running = run?.status === 'running'
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [msgs, run])
  const send = () => {
    if (!text.trim() || running || busy) return
    onSend(text)
    setText('')
  }
  return (
    <aside className="flex min-h-0 w-[380px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <PanelRight className="size-4 text-muted-foreground" />
        <div className="flex-1 text-sm font-semibold">Playground</div>
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close the Playground"><X /></Button>
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="grid place-items-center gap-3 py-12 text-center">
            <AgentMochi name={name} size={56} />
            <div className="text-sm font-medium">Try the flow</div>
            <p className="max-w-64 text-xs text-muted-foreground">Your message goes to Chat input. Each step lights up on the canvas while it runs; agent steps are Chat turns in your repo.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.from === 'you' ? (
            <div key={i} className="ml-10 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.text}</div>
          ) : (
            <RunCard key={i} name={name} run={m.run} />
          ),
        )}
      </div>
      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder="Message the flow"
            className="min-h-0 flex-1 resize-none bg-transparent text-sm outline-none"
          />
          {running ? (
            <Button size="icon" variant="outline" className="size-8" onClick={onStop} aria-label="Stop"><Square /></Button>
          ) : (
            <Button size="icon" className="size-8" disabled={busy || !text.trim()} onClick={send} aria-label="Send">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">Agent steps count toward your spending limit like any Chat turn.</div>
      </div>
    </aside>
  )
}

function RunCard({ name, run }: { name: string; run: RunSnapshot }) {
  const running = run.status === 'running'
  const doneSteps = run.steps.filter((s) => s.status === 'done').length
  return (
    <div className="space-y-2">
      {run.reply !== undefined && (
        <div className="flex gap-2">
          <AgentMochi name={name} size={28} />
          <div className="min-w-0 rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
            <ChatMarkdown text={run.reply || '(empty reply)'} />
            {run.details && <div className="mt-2 border-t pt-2 text-xs text-muted-foreground"><ChatMarkdown text={run.details} /></div>}
          </div>
        </div>
      )}
      {run.error && (
        <div className="flex gap-2 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground">
          <AlertTriangle className="size-4 shrink-0" /> {run.error}
        </div>
      )}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
          <span>
            {running ? 'Running' : run.status === 'done' ? 'Finished' : run.status === 'stopped' ? 'Stopped' : 'Failed'} · {doneSteps} of {run.steps.length} steps{run.costUsd > 0 ? ` · $${run.costUsd.toFixed(3)}` : ''}
          </span>
          <Badge variant={running ? 'info' : run.status === 'done' ? 'success' : 'warning'}>{running ? 'Live' : run.status === 'done' ? 'Done' : run.status.replace('_', ' ')}</Badge>
        </div>
        <ol className="divide-y">
          {run.steps
            .filter((s) => s.status !== 'queued' || running)
            .map((s) => (
              <li key={s.nodeId} className="flex gap-2 px-3 py-2 text-xs">
                <span className={cn('mt-1 size-2 shrink-0 rounded-full', s.status === 'running' ? 'animate-pulse bg-primary' : s.status === 'done' ? 'bg-success' : s.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.label}</div>
                  <div className="truncate text-muted-foreground" title={s.error ?? s.output}>
                    {s.error ?? (s.status === 'running' ? (s.tools ? `Working · ${s.tools} tool calls` : 'Working…') : s.output || s.status)}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {fmtMs(dur(s))}
                  {s.costUsd !== undefined && <div>${s.costUsd.toFixed(3)}</div>}
                </div>
              </li>
            ))}
        </ol>
      </div>
    </div>
  )
}

export function LogsDrawer({ run, onClose }: { run?: RunSnapshot; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-60 border-t bg-card shadow-elevation-3">
      <div className="flex h-10 items-center gap-2 border-b px-4 text-sm font-semibold">
        <SquareTerminal className="size-4 text-muted-foreground" /> Logs
        <span className="font-normal text-muted-foreground">· {run ? `run started ${new Date(run.startedAt).toLocaleTimeString()}` : 'no run yet'}</span>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close logs"><X /></Button>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead className="sticky top-0 bg-card text-left text-muted-foreground">
            <tr>
              <th className="w-48 px-4 py-1.5 font-medium">Step</th>
              <th className="w-24 px-2 font-medium">Status</th>
              <th className="px-2 font-medium">Output (first 600 characters)</th>
              <th className="w-20 px-2 text-right font-medium">Time</th>
              <th className="w-20 px-4 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {run?.steps.map((s) => (
              <tr key={s.nodeId}>
                <td className="truncate px-4 py-1.5 font-medium">{s.label}</td>
                <td className="px-2">{s.status}</td>
                <td className={cn('truncate px-2 font-mono', s.error ? 'text-destructive' : 'text-muted-foreground')} title={s.error ?? s.output}>{s.error ?? s.output ?? ''}</td>
                <td className="px-2 text-right font-mono">{fmtMs(dur(s))}</td>
                <td className="px-4 text-right font-mono">{s.costUsd !== undefined ? `$${s.costUsd.toFixed(3)}` : ''}</td>
              </tr>
            ))}
            {!run && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Run the flow from the Playground to see each step here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
