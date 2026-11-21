import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, DatabaseZap, FileCode, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCount, formatRelative } from '@/lib/format'
import { openWiki } from '@/modules/wiki/store'

import { call, errorText } from './api'
import type { BqStatus, BqSync } from './types'

const EVERY: Record<string, string> = { '15m': 'every 15 minutes', '1h': 'every hour', '6h': 'every 6 hours', '24h': 'once a day' }
/** Problems the setup SQL fixes. */
const SETUP_CODES = new Set(['missing', 'empty', 'foreign', 'create-failed'])

function bytes(n: number | undefined) {
  if (!n) return '0 MB'
  return n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`
}

function summary(last: BqSync) {
  const changed = (last.entities ?? 0) + (last.removed ?? 0) + (last.lineage ?? 0) + (last.lineageRemoved ?? 0)
  if (last.mode === 'full') return `${last.reason === 'asked' ? 'rebuilt' : 'first copy:'} ${formatCount(last.entities ?? 0)} entities${last.lineage ? ` and ${formatCount(last.lineage)} lineage edges` : ''} (free in BigQuery)`
  if (last.seeded?.length) return `${formatCount(changed)} ${changed === 1 ? 'change' : 'changes'}, plus the new ${last.seeded.join(', ')} table read once (free), ${bytes(last.bytesProcessed)} scanned`
  return changed ? `${formatCount(changed)} ${changed === 1 ? 'change' : 'changes'}, ${bytes(last.bytesProcessed)} scanned` : `no changes, ${bytes(last.bytesProcessed)} scanned`
}

/**
 * Shown while the page reads the BigQuery copy: which dataset is the source
 * feeds SQLite, how fresh SQLite is, and Sync now / Rebuild / Setup SQL.
 */
export function BigQueryNote({ status, onChanged }: { status: BqStatus; onChanged: () => void }) {
  const [syncing, setSyncing] = useState<'now' | 'full'>()
  const [error, setError] = useState<string>()
  const [confirmFull, setConfirmFull] = useState(false)
  const [showSql, setShowSql] = useState(false)
  const busy = !!syncing || !!status.running
  const last = status.last

  // A sync started by the schedule is followed by the page (useBigQuerySyncWatch),
  // which also reloads every open list and entity when one finishes.

  async function sync(full: boolean) {
    setSyncing(full ? 'full' : 'now')
    setError(undefined)
    try {
      await call('syncBigQuery', { full })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSyncing(undefined)
      onChanged()
    }
  }

  const failed = last && !last.ok ? last : undefined
  return (
    <Card className="flex-row flex-wrap items-start gap-4 px-6 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        <DatabaseZap className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <p>
          This page reads the SQLite database on this PC, fed by <span className="font-medium">BigQuery {status.source ?? 'metadata'}</span>. Each sync asks BigQuery only for rows changed since the second the last sync started; browsing runs no BigQuery queries. MonoRail changes nothing in BigQuery, except creating the default METADATA dataset with empty tables when it does not exist yet.
        </p>
        <p className="text-muted-foreground">
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> {syncing === 'full' || status.running?.full ? 'Rebuilding from BigQuery…' : status.synced ? 'Fetching changes since the last sync…' : 'Making the first copy…'}
            </span>
          ) : last?.ok ? (
            <>
              Synced {formatRelative(last.at)}: {summary(last)}.
              {status.nextAt ? ` Next ${formatRelative(status.nextAt)}.` : status.syncEvery === 'manual' ? ' Refreshed only when you press Sync now.' : ''}
            </>
          ) : !status.synced ? (
            `Not copied yet. The first sync reads the dataset once into SQLite, which is free in BigQuery${status.syncEvery && status.syncEvery !== 'manual' ? `; after that, only rows changed since the last sync, ${EVERY[status.syncEvery]}` : ''}.`
          ) : null}
        </p>
        {(failed || error || status.error) && (
          <p role="alert" className="mt-1 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {error ?? failed?.error ?? status.error}
              {failed && !error ? <span className="opacity-80"> ({formatRelative(failed.at)}; SQLite keeps what it had, and the next sync asks from the same second.)</span> : null}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void sync(false)}>
          {syncing === 'now' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync now
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmFull(true)}>
          Rebuild…
        </Button>
        <Button variant={failed?.code && SETUP_CODES.has(failed.code) ? 'default' : 'ghost'} size="sm" onClick={() => setShowSql(true)}>
          <FileCode /> Setup SQL
        </Button>
      </div>

      <Dialog open={confirmFull} onOpenChange={setConfirmFull}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rebuild SQLite from BigQuery?</DialogTitle>
            <DialogDescription>
              You do not need this to stay up to date: Sync now already brings every change. A rebuild reads every row of {status.source} again{last?.remote ? ` (${formatCount(last.remote.entities)} entities, about ${bytes(last.remote.bytes)})` : ''} and drops anything deleted outright in BigQuery instead of marked deleted. It is free in BigQuery, since it runs no query, but it can take a while on a large dataset. SQLite stays usable meanwhile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFull(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmFull(false)
                void sync(true)
              }}
            >
              Rebuild
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showSql && <SetupSqlDialog onClose={() => setShowSql(false)} />}
    </Card>
  )
}

/** The SQL that creates MonoRail's layout in the chosen dataset. MonoRail runs it itself only for the default METADATA dataset when it does not exist; otherwise the user runs it, in BigQuery. */
function SetupSqlDialog({ onClose }: { onClose: () => void }) {
  const [sql, setSql] = useState<{ sql: string; source: string }>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    call('bigquerySetupSql').then(setSql, (e: unknown) => setError(errorText(e)))
  }, [])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Setup SQL{sql ? ` for ${sql.source}` : ''}</DialogTitle>
          <DialogDescription>
            Creates the dataset and MonoRail's tables, partitioned so each sync reads only recent rows, and is safe to run again. MonoRail runs it by itself for the default METADATA dataset when that does not exist yet; for any other dataset, run it yourself in the BigQuery console. Then fill the tables from your own pipeline.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : !sql ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <pre className="max-h-[50vh] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">{sql.sql}</pre>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => openWiki('bigquery-metadata')}>
            Layout reference
          </Button>
          <Button
            variant="outline"
            disabled={!sql}
            onClick={() => {
              if (!sql) return
              void navigator.clipboard.writeText(sql.sql).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
