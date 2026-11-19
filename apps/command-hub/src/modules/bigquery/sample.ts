/**
 * Fictional BigQuery data for the browser dev server (no backend). Every
 * name and number here is made up.
 */
import type { BqCell, BqField, BqJob, BqQueryResult, BqTable } from './types'

const PROJECT = 'demo-analytics-4821'
const now = Date.parse('2026-11-18T09:30:00Z')
const day = 86_400_000

interface SampleTable {
  meta: Omit<BqTable, 'projectId' | 'datasetId' | 'tableId'>
  rows: BqCell[][]
}

const CHANNELS = ['web', 'app', 'store', 'partner']
const REGIONS = ['North', 'South', 'East', 'West']

function orders(): BqCell[][] {
  const out: BqCell[][] = []
  for (let i = 0; i < 240; i++) {
    const t = now - (i % 60) * day - (i * 37 % 24) * 3_600_000
    out.push([
      String(100_000 + i),
      String(5000 + ((i * 7919) % 900)),
      CHANNELS[(i * 3) % 4],
      Math.round((12 + ((i * 131) % 380) + (i % 7) * 0.37) * 100) / 100,
      new Date(t).toISOString().replace('T', ' ').replace('Z', ' UTC'),
      i % 11 === 0 ? 'refunded' : 'complete',
    ])
  }
  return out
}

function customers(): BqCell[][] {
  const first = ['Avery', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Quinn', 'Rowan', 'Sage', 'Emerson', 'Finley']
  return Array.from({ length: 60 }, (_, i) => [
    String(5000 + i * 15),
    `${first[i % first.length]} ${String.fromCharCode(65 + ((i * 7) % 26))}.`,
    REGIONS[i % 4],
    new Date(now - (400 - i * 5) * day).toISOString().slice(0, 10),
    { tier: i % 5 === 0 ? 'gold' : 'standard', opted_in: i % 3 !== 0 },
  ])
}

function sessions(): BqCell[][] {
  return Array.from({ length: 90 }, (_, i) => [
    new Date(now - (i % 30) * day).toISOString().slice(0, 10),
    CHANNELS[i % 3],
    String(800 + ((i * 271) % 2400)),
    Math.round((0.18 + ((i * 17) % 40) / 100) * 1000) / 1000,
    ['landing', i % 2 ? 'pricing' : 'docs'],
  ])
}

const ORDER_FIELDS: BqField[] = [
  { name: 'order_id', type: 'INTEGER', mode: 'REQUIRED', description: 'Unique order number.' },
  { name: 'customer_id', type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'channel', type: 'STRING', mode: 'NULLABLE', description: 'Where the order was placed.' },
  { name: 'amount', type: 'FLOAT', mode: 'NULLABLE', description: 'Order total in USD.' },
  { name: 'ordered_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  { name: 'status', type: 'STRING', mode: 'NULLABLE' },
]

export const SAMPLE_DATA: Record<string, Record<string, SampleTable>> = {
  shop: {
    orders: {
      meta: {
        type: 'TABLE',
        description: 'One row per order (fictional sample data).',
        location: 'US',
        fields: ORDER_FIELDS,
        numRows: 240,
        numBytes: 18_432,
        creationTime: new Date(now - 300 * day).toISOString(),
        lastModifiedTime: new Date(now - 2 * 3_600_000).toISOString(),
        partitioning: 'DAY on ordered_at',
        clustering: ['channel'],
        labels: { team: 'sample' },
      },
      rows: orders(),
    },
    customers: {
      meta: {
        type: 'TABLE',
        location: 'US',
        fields: [
          { name: 'customer_id', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'name', type: 'STRING', mode: 'NULLABLE' },
          { name: 'region', type: 'STRING', mode: 'NULLABLE' },
          { name: 'signup_date', type: 'DATE', mode: 'NULLABLE' },
          {
            name: 'profile',
            type: 'RECORD',
            mode: 'NULLABLE',
            fields: [
              { name: 'tier', type: 'STRING', mode: 'NULLABLE' },
              { name: 'opted_in', type: 'BOOLEAN', mode: 'NULLABLE' },
            ],
          },
        ],
        numRows: 60,
        numBytes: 4_210,
        creationTime: new Date(now - 300 * day).toISOString(),
        lastModifiedTime: new Date(now - 5 * day).toISOString(),
      },
      rows: customers(),
    },
    daily_revenue: {
      meta: {
        type: 'VIEW',
        location: 'US',
        description: 'Revenue per day and channel.',
        fields: [
          { name: 'day', type: 'DATE', mode: 'NULLABLE' },
          { name: 'channel', type: 'STRING', mode: 'NULLABLE' },
          { name: 'revenue', type: 'FLOAT', mode: 'NULLABLE' },
        ],
        creationTime: new Date(now - 120 * day).toISOString(),
        lastModifiedTime: new Date(now - 120 * day).toISOString(),
        viewQuery: `SELECT DATE(ordered_at) AS day, channel, SUM(amount) AS revenue\nFROM \`${PROJECT}.shop.orders\`\nWHERE status = 'complete'\nGROUP BY day, channel`,
      },
      rows: [],
    },
  },
  web: {
    sessions: {
      meta: {
        type: 'TABLE',
        location: 'US',
        fields: [
          { name: 'day', type: 'DATE', mode: 'NULLABLE' },
          { name: 'channel', type: 'STRING', mode: 'NULLABLE' },
          { name: 'sessions', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'bounce_rate', type: 'FLOAT', mode: 'NULLABLE' },
          { name: 'top_pages', type: 'STRING', mode: 'REPEATED' },
        ],
        numRows: 90,
        numBytes: 7_980,
        creationTime: new Date(now - 200 * day).toISOString(),
        lastModifiedTime: new Date(now - day).toISOString(),
      },
      rows: sessions(),
    },
  },
}

export const SAMPLE_PROJECTS = [{ id: PROJECT, name: 'Demo analytics' }]
export const SAMPLE_PROJECT = PROJECT

export const SAMPLE_SQL = `SELECT channel, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
FROM \`${PROJECT}.shop.orders\`
WHERE status = 'complete'
GROUP BY channel
ORDER BY revenue DESC
`

/** Which sample table a query reads, by its FROM clause. */
function tableOf(sql: string): { dataset: string; table: string; t: SampleTable } | undefined {
  const m = sql.match(/from\s+`?(?:[\w.-]+?\.)?(\w+)\.(\w+)`?/i)
  if (!m) return undefined
  const t = SAMPLE_DATA[m[1]]?.[m[2]]
  return t ? { dataset: m[1], table: m[2], t } : undefined
}

let jobSeq = 1
const sampleJobs: BqJob[] = []
const sampleResults = new Map<string, { fields: BqField[]; rows: BqCell[][]; bytes: number }>()

/** A pretend query: aggregates the sample orders by channel, or returns the table it reads. */
export function sampleQuery(sql: string, opts: { dryRun?: boolean; pageSize?: number } = {}): BqQueryResult {
  if (/^\s*$/.test(sql)) throw new Error('Write a query first.')
  if (!/^\s*(with|select|\()/i.test(sql.replace(/^(\s*(--|#)[^\n]*\n)+/, '')))
    throw new Error('The sample data in the browser only answers SELECT queries.')
  const src = tableOf(sql)
  if (/\bfrom\b/i.test(sql) && !src) throw new Error('Not found: Table was not found in the sample project (try shop.orders, shop.customers or web.sessions).')
  const bytes = src ? (src.t.meta.numBytes ?? 4096) : 0
  const ref = { projectId: PROJECT, jobId: `sample_job_${jobSeq++}`, location: 'US' }
  if (opts.dryRun) return { jobComplete: true, job: ref, fields: [], rows: [], cacheHit: false, errors: [], dryRun: true, totalBytesProcessed: bytes }

  let fields: BqField[]
  let rows: BqCell[][]
  if (src?.dataset === 'shop' && src.table === 'orders' && /group\s+by\s+channel/i.test(sql)) {
    const byChannel = new Map<string, { n: number; sum: number }>()
    for (const r of src.t.rows) {
      if (/status\s*=\s*'complete'/i.test(sql) && r[5] !== 'complete') continue
      const c = String(r[2])
      const cur = byChannel.get(c) ?? { n: 0, sum: 0 }
      cur.n++
      cur.sum += Number(r[3])
      byChannel.set(c, cur)
    }
    fields = [
      { name: 'channel', type: 'STRING', mode: 'NULLABLE' },
      { name: 'orders', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'revenue', type: 'FLOAT', mode: 'NULLABLE' },
    ]
    rows = [...byChannel].map(([c, v]) => [c, String(v.n), Math.round(v.sum * 100) / 100]).sort((a, b) => Number(b[2]) - Number(a[2]))
  } else if (src && src.t.rows.length) {
    const limit = Number(sql.match(/limit\s+(\d+)/i)?.[1] ?? 1000)
    fields = src.t.meta.fields
    rows = src.t.rows.slice(0, limit)
  } else {
    fields = [{ name: 'f0_', type: 'INTEGER', mode: 'NULLABLE' }]
    rows = [['1']]
  }
  sampleResults.set(ref.jobId, { fields, rows, bytes })
  const start = Date.now()
  sampleJobs.unshift({
    ...ref,
    user: 'you@example.com',
    state: 'DONE',
    query: sql,
    jobType: 'QUERY',
    statementType: 'SELECT',
    creationTime: new Date(start).toISOString(),
    startTime: new Date(start + 40).toISOString(),
    endTime: new Date(start + 820).toISOString(),
    totalBytesProcessed: bytes,
    totalBytesBilled: bytes ? Math.max(bytes, 10 * 1024 * 1024) : 0,
    totalSlotMs: 412,
    cacheHit: false,
    destinationTable: `${PROJECT}._sample_anon.anon_${ref.jobId}`,
    stages: [
      { id: '0', name: 'S00: Input', status: 'COMPLETE', waitMsAvg: 4, readMsAvg: 61, computeMsAvg: 22, writeMsAvg: 8, recordsRead: src?.t.rows.length ?? 1, recordsWritten: rows.length * 4, slotMs: 240, steps: [{ kind: 'READ', substeps: ['FROM sample'] }, { kind: 'AGGREGATE', substeps: ['GROUP BY'] }] },
      { id: '1', name: 'S01: Aggregate', status: 'COMPLETE', waitMsAvg: 2, readMsAvg: 3, computeMsAvg: 14, writeMsAvg: 5, recordsRead: rows.length * 4, recordsWritten: rows.length, slotMs: 120, steps: [{ kind: 'AGGREGATE', substeps: ['SUM', 'COUNT'] }] },
      { id: '2', name: 'S02: Output', status: 'COMPLETE', waitMsAvg: 1, readMsAvg: 1, computeMsAvg: 3, writeMsAvg: 6, recordsRead: rows.length, recordsWritten: rows.length, slotMs: 52, steps: [{ kind: 'WRITE', substeps: ['TO __stage02_output'] }] },
    ],
  })
  const pageSize = opts.pageSize ?? 50
  return {
    jobComplete: true,
    job: ref,
    fields,
    rows: rows.slice(0, pageSize),
    totalRows: rows.length,
    pageToken: rows.length > pageSize ? String(pageSize) : undefined,
    totalBytesProcessed: bytes,
    cacheHit: false,
    errors: [],
  }
}

/** Later pages of a sample result (the page token is the start index). */
export function samplePage(jobId: string, pageToken: string | undefined, pageSize: number): BqQueryResult {
  const r = sampleResults.get(jobId)
  if (!r) throw new Error('That sample result is gone. Run the query again.')
  const start = Number(pageToken ?? 0)
  return {
    jobComplete: true,
    job: { projectId: PROJECT, jobId, location: 'US' },
    fields: r.fields,
    rows: r.rows.slice(start, start + pageSize),
    totalRows: r.rows.length,
    pageToken: start + pageSize < r.rows.length ? String(start + pageSize) : undefined,
    totalBytesProcessed: r.bytes,
    cacheHit: false,
    errors: [],
  }
}

export function sampleJob(jobId: string): BqJob | undefined {
  return sampleJobs.find((j) => j.jobId === jobId)
}

export function sampleJobList(allUsers: boolean): BqJob[] {
  const others: BqJob[] = allUsers
    ? [
        {
          projectId: PROJECT,
          jobId: 'sample_job_teammate',
          location: 'US',
          user: 'teammate@example.com',
          state: 'DONE',
          jobType: 'QUERY',
          query: `SELECT region, COUNT(*) FROM \`${PROJECT}.shop.customers\` GROUP BY region`,
          creationTime: new Date(now - 3 * 3_600_000).toISOString(),
          startTime: new Date(now - 3 * 3_600_000).toISOString(),
          endTime: new Date(now - 3 * 3_600_000 + 1400).toISOString(),
          totalBytesProcessed: 4210,
        },
      ]
    : []
  const earlier: BqJob = {
    projectId: PROJECT,
    jobId: 'sample_job_earlier',
    location: 'US',
    user: 'you@example.com',
    state: 'DONE',
    jobType: 'QUERY',
    query: `SELECT * FROM \`${PROJECT}.web.sessions\` LIMIT 100`,
    creationTime: new Date(now - day).toISOString(),
    startTime: new Date(now - day).toISOString(),
    endTime: new Date(now - day + 900).toISOString(),
    totalBytesProcessed: 7980,
  }
  return [...sampleJobs, ...others, earlier].sort((a, b) => String(b.creationTime).localeCompare(String(a.creationTime)))
}

export function sampleTable(datasetId: string, tableId: string): BqTable {
  const t = SAMPLE_DATA[datasetId]?.[tableId]
  if (!t) throw new Error(`Not found: Table ${PROJECT}:${datasetId}.${tableId}`)
  return { projectId: PROJECT, datasetId, tableId, ...t.meta }
}
