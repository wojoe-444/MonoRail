import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ExternalLink, GitBranch, Globe, Loader2, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import { sampleChanges } from './sample'

export type PanelKind = 'changes' | 'browser'

export interface ChangesResult {
  branch?: string
  files: { code: string; path: string; from?: string }[]
  moreFiles: number
  diff: string
  diffCut: boolean
  noHead: boolean
}

/** The side panel next to the conversation: a header with a close button, then the panel. */
export function SidePanel({ kind, target, onClose }: { kind: PanelKind; target?: { chatId?: string; repo?: string }; onClose: () => void }) {
  return (
    <aside className="flex w-[26rem] min-w-0 shrink-0 flex-col border-l max-xl:w-80">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        {kind === 'changes' ? <GitBranch className="size-4 text-muted-foreground" /> : <Globe className="size-4 text-muted-foreground" />}
        <span className="flex-1 text-sm font-semibold">{kind === 'changes' ? 'Changes' : 'Browser'}</span>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close panel">
          <X />
        </Button>
      </div>
      {kind === 'changes' ? <ChangesPanel target={target} /> : <BrowserPanel />}
    </aside>
  )
}

const STATUS_LABEL: Record<string, string> = { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', U: 'Conflict', '?': 'Untracked' }

/** W1: git status and git diff HEAD for the chat's folder. Read-only, with refresh. */
function ChangesPanel({ target }: { target?: { chatId?: string; repo?: string } }) {
  const desktop = isDesktop()
  const [data, setData] = useState<ChangesResult | undefined>(desktop ? undefined : sampleChanges)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const key = target?.chatId ?? target?.repo

  async function load() {
    if (!desktop || !key) return
    setLoading(true)
    setError(undefined)
    try {
      setData(await invokeModule<ChangesResult>('agent-chat', 'getChanges', target?.chatId ? { chatId: target.chatId } : { repo: target?.repo }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!key) return <p className="p-4 text-sm text-muted-foreground">Open a chat or pick a project to see its changes.</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        {data?.branch && (
          <span className="inline-flex min-w-0 items-center gap-1 font-mono">
            <GitBranch className="size-3.5 shrink-0" /> <span className="truncate">{data.branch}</span>
          </span>
        )}
        <span className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void load()} disabled={loading || !desktop}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {error && (
          <div className="m-4 flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading git status…
          </div>
        )}
        {data && (
          <>
            {data.files.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No changes: the working tree matches HEAD.</p>
            ) : (
              <ul className="divide-y border-b text-xs">
                {data.files.map((f) => {
                  const c = f.code.trim()[0] ?? '?'
                  return (
                    <li key={f.path} className="flex items-center gap-2 px-4 py-1.5" title={STATUS_LABEL[c] ?? f.code}>
                      <span
                        className={cn(
                          'w-5 shrink-0 text-center font-mono font-semibold',
                          c === 'A' || c === '?' ? 'text-success' : c === 'D' ? 'text-destructive' : 'text-warning',
                        )}
                      >
                        {f.code.trim() || f.code}
                      </span>
                      <span className="min-w-0 truncate font-mono">
                        {f.from ? `${f.from} → ` : ''}
                        {f.path}
                      </span>
                    </li>
                  )
                })}
                {data.moreFiles > 0 && <li className="px-4 py-1.5 text-muted-foreground">and {data.moreFiles} more files</li>}
              </ul>
            )}
            {data.noHead && <p className="p-4 text-xs text-muted-foreground">This repo has no commits yet, so there is no diff against HEAD.</p>}
            {data.diff && <DiffView text={data.diff} />}
            {data.diffCut && <p className="px-4 pb-4 text-xs text-muted-foreground">The diff was cut at 1 MB.</p>}
          </>
        )}
      </div>
    </div>
  )
}

function DiffView({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto p-0 font-mono text-[11px] leading-5">
      {text.split('\n').map((line, i) => (
        <div
          key={i}
          className={cn(
            'px-4 whitespace-pre',
            line.startsWith('diff --git')
              ? 'mt-2 border-t bg-muted/60 font-semibold text-foreground'
              : line.startsWith('@@')
                ? 'bg-info-soft text-info-soft-foreground'
                : line.startsWith('+') && !line.startsWith('+++')
                  ? 'bg-success-soft text-success-soft-foreground'
                  : line.startsWith('-') && !line.startsWith('---')
                    ? 'bg-destructive-soft text-destructive-soft-foreground'
                    : 'text-muted-foreground',
          )}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  )
}

/** W2: any http(s) page in a sandboxed frame, plus "Open in new tab" (the system browser). */
function BrowserPanel() {
  const [input, setInput] = useState('http://localhost:5173')
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [reloadKey, setReloadKey] = useState(0)

  function go(e: FormEvent) {
    e.preventDefault()
    let v = input.trim()
    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = (/^(localhost|127\.|\[::1\])/.test(v) ? 'http://' : 'https://') + v
    try {
      const u = new URL(v)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
      setError(undefined)
      setUrl(u.href)
      setInput(u.href)
      setReloadKey((k) => k + 1)
    } catch {
      setError('Only http and https addresses can be opened here.')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={go} className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Address" className="h-8 font-mono text-xs" spellCheck={false} />
        <Button type="submit" size="sm" className="h-8">
          Go
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!url}
          onClick={() => url && window.open(url, '_blank', 'noopener')}
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <ExternalLink />
        </Button>
      </form>
      {error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}
      {url ? (
        <iframe
          key={reloadKey}
          src={url}
          title="Browser"
          // Its own origin, no access to the hub; popups open in the system browser.
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          Type an address, for example a dev server on localhost. Some sites refuse to be shown inside another app; use Open in new tab for those.
        </p>
      )}
    </div>
  )
}
