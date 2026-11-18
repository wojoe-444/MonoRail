import { useEffect, useState } from 'react'
import { Calculator, ExternalLink, FolderGit2, FolderOpen, GitBranch, Link2, Loader2, Pin } from 'lucide-react'

import { openInGitHubPlus } from '@/apps/github-plus/handoff'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'

import { call, errorText, thumbnail } from './api'
import { formatDate, formatSize, lookOf, samePath, TAGS, typeLabel } from './kinds'
import type { Ops } from './Pane'
import type { FileEntry, FolderSize, Preview, TagColor } from './types'

/**
 * The right-hand panel: what the selected item is, a look inside (image, text,
 * Markdown, a shell thumbnail for video/PDF/Office), its tag and quick actions.
 * With nothing selected it describes the open folder.
 */
export function PreviewPanel({ target, count, tags, pinned, ops }: { target: { path: string; name: string; kind: FileEntry['kind']; ext: string; modified: number } | null; count: number; tags: Record<string, TagColor>; pinned: string[]; ops: Ops }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string>()
  const [thumb, setThumb] = useState<string | null>(null)
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered')
  const [size, setSize] = useState<FolderSize | 'busy' | null>(null)

  const path = target?.path
  useEffect(() => {
    setPreview(null)
    setError(undefined)
    setThumb(null)
    setSize(null)
    if (!path) return
    let alive = true
    const t = setTimeout(() => {
      call<Preview>('preview', { path })
        .then((p) => {
          if (!alive) return
          setPreview(p)
          if (p.kind === 'binary') void thumbnail(p.path, p.modified, 320).then((s) => alive && setThumb(s))
        })
        .catch((e) => alive && setError(errorText(e)))
    }, 80)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [path, target?.modified])

  if (!target) return <div className="p-6 text-sm text-muted-foreground">Select something to see it here.</div>
  if (count > 1)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <div className="text-3xl font-semibold tabular-nums">{count}</div>
        <div className="text-sm text-muted-foreground">items selected</div>
      </div>
    )

  const look = lookOf({ kind: target.kind, ext: target.ext, name: target.name }, preview?.kind === 'dir' && !!preview.git && samePath(preview.git.root, target.path))
  const Icon = look.icon
  const entry = { path: target.path, name: target.name, kind: target.kind, ext: target.ext } as FileEntry
  const isPinned = pinned.some((p) => samePath(p, target.path))
  const markdown = preview?.kind === 'text' && /^(md|markdown|mdx)$/.test(preview.ext)

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex min-h-48 items-center justify-center border-b bg-muted/40 p-4">
        {preview?.kind === 'image' && preview.dataUrl ? (
          <img src={preview.dataUrl} alt={target.name} className="max-h-64 max-w-full rounded-md object-contain shadow-elevation-1" />
        ) : thumb ? (
          <img src={thumb} alt={target.name} className="max-h-64 max-w-full rounded-md object-contain shadow-elevation-1" />
        ) : (
          <span className={cn('flex size-20 items-center justify-center rounded-2xl', look.tile)}>
            <Icon className="size-10" />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold break-words">{target.name}</h2>
          <p className="text-xs text-muted-foreground">{typeLabel(target)}</p>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Tag">
          {TAGS.map((t) => {
            const on = tags[target.path] === t.color
            return (
              <button
                key={t.color}
                type="button"
                aria-pressed={on}
                aria-label={`Tag ${t.label.toLowerCase()}`}
                title={on ? `Remove the ${t.label.toLowerCase()} tag` : `Tag ${t.label.toLowerCase()}`}
                onClick={() => ops.setTag([target.path], on ? null : t.color)}
                className={cn('size-5 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110', on && 'ring-2 ring-foreground ring-offset-2 ring-offset-card')}
                style={{ background: t.css }}
              />
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => ops.open(entry)}>
            <FolderOpen /> Open
          </Button>
          {ops.canUseScreen && (
            <Button size="sm" variant="outline" onClick={() => ops.reveal(entry)}>
              <ExternalLink /> Explorer
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => ops.copyPath([entry])}>
            <Link2 /> Copy path
          </Button>
          {target.kind === 'dir' && (
            <Button size="sm" variant="outline" onClick={() => ops.togglePin(target.path)}>
              <Pin /> {isPinned ? 'Unpin' : 'Pin'}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!preview && !error && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

        {preview && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {preview.kind === 'dir' ? (
              <>
                <dt className="text-muted-foreground">Contains</dt>
                <dd>{preview.items == null ? 'Not readable' : `${preview.items} items (${preview.folders} folders)`}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd>
                  {size && size !== 'busy' ? (
                    <span className="font-mono tabular-nums">
                      {formatSize(size.bytes)} · {size.files.toLocaleString()} files{size.truncated ? ' (stopped early)' : ''}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={size === 'busy'}
                      className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60"
                      onClick={() => {
                        setSize('busy')
                        void call<FolderSize>('folderSize', { path: preview.path })
                          .then(setSize)
                          .catch((e) => (setSize(null), setError(errorText(e))))
                      }}
                    >
                      {size === 'busy' ? <Loader2 className="size-3 animate-spin" /> : <Calculator className="size-3" />} Work it out
                    </button>
                  )}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-mono tabular-nums">
                  {formatSize(preview.size)}
                  {preview.size >= 1024 && <span className="text-muted-foreground"> ({preview.size.toLocaleString()} bytes)</span>}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Modified</dt>
            <dd>{new Date(preview.modified).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDate(preview.created)}</dd>
            {preview.kind === 'text' && (
              <>
                <dt className="text-muted-foreground">Lines</dt>
                <dd className="font-mono tabular-nums">
                  {preview.lines.toLocaleString()}
                  {preview.truncated ? '+' : ''}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Where</dt>
            <dd className="font-mono break-all text-muted-foreground">{preview.path}</dd>
          </dl>
        )}

        {preview?.kind === 'dir' && preview.git && (
          <div className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
            <GitBranch className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              Git repository · <span className="font-mono">{preview.git.branch}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => openInGitHubPlus(preview.git!.root)}>
              <FolderGit2 /> GitHub+
            </Button>
          </div>
        )}

        {preview?.kind === 'image' && preview.tooBig && <p className="text-xs text-muted-foreground">Too large to preview here; open it instead.</p>}

        {preview?.kind === 'text' && (
          <div className="flex min-h-0 flex-col gap-2">
            {markdown && (
              <Segmented
                aria-label="Rendered or source"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'rendered', label: 'Rendered' },
                  { value: 'source', label: 'Source' },
                ]}
              />
            )}
            {markdown && mode === 'rendered' ? (
              <div className="max-h-[480px] overflow-auto rounded-lg border p-3 text-sm">
                <ChatMarkdown text={preview.text} />
              </div>
            ) : (
              <pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre">{preview.text || ' '}</pre>
            )}
            {preview.truncated && <p className="text-xs text-muted-foreground">Showing the start of the file.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
