import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Copy, Database, Eye, Loader2, RotateCw, Search, Table2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'

import { bq, errorText } from './api'
import { formatBytes, formatCount, formatTime, tableRef } from './format'
import { Pager, ResultGrid } from './ResultGrid'
import { SqlHighlight } from './SqlEditor'
import type { BqDatasetInfo, BqField, BqPreview, BqTable, BqTableItem } from './types'

type View = 'schema' | 'details' | 'preview'
const PREVIEW_PAGE = 50

function Header({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">{icon}</div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        <p className="truncate font-mono text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Info({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(10rem,14rem)_1fr] rounded-lg text-sm ring-1 ring-foreground/10">
      {items
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-b px-4 py-2 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 border-b px-4 py-2 break-words">{v}</dd>
          </div>
        ))}
    </dl>
  )
}

function SchemaRows({ fields, depth = 0, prefix = '' }: { fields: BqField[]; depth?: number; prefix?: string }) {
  return (
    <>
      {fields.map((f) => (
        <FieldRow key={prefix + f.name} f={f} depth={depth} prefix={prefix} />
      ))}
    </>
  )
}

function FieldRow({ f, depth, prefix }: { f: BqField; depth: number; prefix: string }) {
  return (
    <>
      <tr className="hover:bg-accent/50">
        <td className="border-b px-4 py-2 font-mono text-[13px]" style={{ paddingLeft: 16 + depth * 20 }}>
          {f.name}
        </td>
        <td className="border-b px-4 py-2 font-mono text-xs">{f.type}</td>
        <td className="border-b px-4 py-2 text-xs text-muted-foreground">{f.mode}</td>
        <td className="border-b px-4 py-2 text-sm text-muted-foreground">{f.description}</td>
      </tr>
      {f.fields && <SchemaRows fields={f.fields} depth={depth + 1} prefix={`${prefix}${f.name}.`} />}
    </>
  )
}

export function SchemaTable({ fields }: { fields: BqField[] }) {
  return (
    <div className="overflow-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-2 font-medium">Field name</th>
            <th className="border-b px-4 py-2 font-medium">Type</th>
            <th className="border-b px-4 py-2 font-medium">Mode</th>
            <th className="border-b px-4 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          <SchemaRows fields={fields} />
        </tbody>
      </table>
    </div>
  )
}

interface TableProps {
  projectId: string
  datasetId: string
  tableId: string
  onQuery: (sql: string) => void
}

/** A table or view: Schema, Details and Preview, like the console's table page. */
export function TableTab({ projectId, datasetId, tableId, onQuery }: TableProps) {
  const [view, setView] = useState<View>('schema')
  const [table, setTable] = useState<BqTable>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<BqPreview & { page: number; tokens: (string | undefined)[] }>()
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      setTable(await bq.getTable(projectId, datasetId, tableId))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, datasetId, tableId])

  useEffect(() => {
    void load()
  }, [load])

  async function loadPreview(page: number, tokens: (string | undefined)[]) {
    setPreviewBusy(true)
    setPreviewError(undefined)
    try {
      const p = await bq.previewTable(projectId, datasetId, tableId, PREVIEW_PAGE, tokens[page])
      const next = [...tokens]
      next[page + 1] = p.pageToken
      setPreview({ ...p, page, tokens: next })
    } catch (e) {
      setPreviewError(errorText(e))
    } finally {
      setPreviewBusy(false)
    }
  }

  const id = `${projectId}.${datasetId}.${tableId}`
  const isView = table?.type === 'VIEW' || table?.type === 'MATERIALIZED_VIEW'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header icon={isView ? <Eye className="size-5" /> : <Table2 className="size-5" />} title={tableId} sub={id}>
        {table?.type && <Badge variant="secondary">{table.type.replace('_', ' ').toLowerCase()}</Badge>}
        <Button size="sm" onClick={() => onQuery(`SELECT *\nFROM ${tableRef(projectId, datasetId, tableId)}\nLIMIT 1000\n`)}>
          <Search /> Query
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(id)}>
          <Copy /> Copy ID
        </Button>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Refresh" onClick={() => void load()}>
          <RotateCw className={loading ? 'animate-spin' : ''} />
        </Button>
      </Header>
      <div className="shrink-0 border-b px-4 py-2">
        <Segmented<View>
          aria-label="Table view"
          value={view}
          onChange={(v) => {
            setView(v)
            if (v === 'preview' && !preview && !previewBusy) void loadPreview(0, [undefined])
          }}
          options={[
            { value: 'schema', label: 'Schema' },
            { value: 'details', label: 'Details' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
      </div>
      {error ? (
        <p role="alert" className="m-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
          {error}
        </p>
      ) : !table ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : view === 'schema' ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <SchemaTable fields={table.fields} />
        </div>
      ) : view === 'details' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
          <Info
            items={[
              ['Table ID', <span key="v" className="font-mono text-xs">{id}</span>],
              ['Description', table.description],
              ['Created', formatTime(table.creationTime)],
              ['Last modified', formatTime(table.lastModifiedTime)],
              ['Table expiration', table.expirationTime ? formatTime(table.expirationTime) : 'Never'],
              ['Data location', table.location],
              ['Partitioned by', table.partitioning],
              ['Clustered by', table.clustering?.join(', ')],
              [
                'Labels',
                table.labels && Object.keys(table.labels).length ? (
                  <span key="v" className="flex flex-wrap gap-1">
                    {Object.entries(table.labels).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="font-mono">
                        {k}: {v}
                      </Badge>
                    ))}
                  </span>
                ) : undefined,
              ],
            ]}
          />
          {!isView && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Storage info</h3>
              <Info
                items={[
                  ['Number of rows', formatCount(table.numRows)],
                  ['Total logical bytes', formatBytes(table.numBytes)],
                  ['Long-term logical bytes', table.numLongTermBytes !== undefined ? formatBytes(table.numLongTermBytes) : undefined],
                ]}
              />
            </div>
          )}
          {table.viewQuery && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Query</h3>
                <Button size="sm" variant="outline" onClick={() => onQuery(table.viewQuery!)}>
                  Open in editor
                </Button>
              </div>
              <div className="rounded-lg bg-muted/40 p-4 ring-1 ring-foreground/10">
                <SqlHighlight code={table.viewQuery} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {previewError ? (
            <p role="alert" className="m-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
              {previewError}
            </p>
          ) : !preview ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : preview.view ? (
            <p className="p-6 text-sm text-muted-foreground">Views have no stored rows to preview. Query the view to see its data.</p>
          ) : (
            <>
              <ResultGrid fields={preview.fields} rows={preview.rows} startIndex={preview.page * PREVIEW_PAGE} className="flex-1" />
              <Pager
                start={preview.page * PREVIEW_PAGE}
                count={preview.rows.length}
                total={preview.totalRows}
                pageSize={PREVIEW_PAGE}
                canPrev={preview.page > 0}
                canNext={!!preview.tokens[preview.page + 1]}
                onPrev={() => void loadPreview(preview.page - 1, preview.tokens)}
                onNext={() => void loadPreview(preview.page + 1, preview.tokens)}
                busy={previewBusy}
              />
            </>
          )}
          <p className="shrink-0 border-t px-4 py-1.5 text-xs text-muted-foreground">Preview reads stored rows directly and is free; it does not run a query.</p>
        </div>
      )}
    </div>
  )
}

/** A dataset: its details and tables. */
export function DatasetTab({ projectId, datasetId, onOpenTable }: { projectId: string; datasetId: string; onOpenTable: (tableId: string) => void }) {
  const [info, setInfo] = useState<BqDatasetInfo>()
  const [tables, setTables] = useState<BqTableItem[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let stale = false
    Promise.all([bq.getDataset(projectId, datasetId), bq.listTables(projectId, datasetId)])
      .then(([i, t]) => {
        if (stale) return
        setInfo(i)
        setTables(t.tables)
      })
      .catch((e) => !stale && setError(errorText(e)))
    return () => {
      stale = true
    }
  }, [projectId, datasetId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header icon={<Database className="size-5" />} title={datasetId} sub={`${projectId}.${datasetId}`}>
        <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(`${projectId}.${datasetId}`)}>
          <Copy /> Copy ID
        </Button>
      </Header>
      {error ? (
        <p role="alert" className="m-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
          {error}
        </p>
      ) : !info ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
          <Info
            items={[
              ['Dataset ID', <span key="v" className="font-mono text-xs">{`${projectId}.${datasetId}`}</span>],
              ['Description', info.description],
              ['Data location', info.location],
              ['Created', formatTime(info.creationTime)],
              ['Last modified', formatTime(info.lastModifiedTime)],
              ['Default table expiration', info.defaultTableExpirationMs ? `${Math.round(info.defaultTableExpirationMs / 86_400_000)} days` : 'Never'],
            ]}
          />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Tables ({tables?.length ?? 0})</h3>
            <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
              {tables?.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTable(t.id)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent/50">
                    {t.type === 'VIEW' || t.type === 'MATERIALIZED_VIEW' ? <Eye className="size-4 text-muted-foreground" /> : <Table2 className="size-4 text-muted-foreground" />}
                    <span className="font-mono text-[13px]">{t.id}</span>
                    {t.partitioned && <Badge variant="outline">partitioned</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{t.type?.replace('_', ' ').toLowerCase()}</span>
                  </button>
                </li>
              ))}
              {tables && !tables.length && <li className="px-4 py-3 text-sm text-muted-foreground">This dataset has no tables.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
