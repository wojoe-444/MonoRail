// BigQuery REST client for Tools > BigQuery (electron/modules/bigquery.cjs).
// No Electron dependency, so tests run it with a stubbed fetch.
//
// Only bigquery.googleapis.com is called, with the access token from the
// user's own gcloud login (connector `gcloud`, credentials()). Every name the
// page sends (project, dataset, table, job, location) is checked here and
// percent-encoded into a fixed URL shape; the page never sends a URL. Rows
// come back as BigQuery's typed strings and are turned into plain JSON values
// by the table's schema (toRows).

const BASE = 'https://bigquery.googleapis.com/bigquery/v2'

// Project ids may be domain-scoped (example.com:my-project).
const PROJECT_RE = /^(?:[a-z0-9.-]{1,63}:)?[a-z][a-z0-9-]{4,61}[a-z0-9]$/i
// Datasets: letters, digits, underscores. Tables may also hold dashes, spaces
// and other Unicode letters (BigQuery allows them); never a slash or dot.
const DATASET_RE = /^[\p{L}\p{N}_]{1,1024}$/u
const TABLE_RE = /^[\p{L}\p{M}\p{N}\p{Pc}\p{Pd}\p{Zs}$*]{1,1024}$/u
const JOB_RE = /^[A-Za-z0-9_-]{1,1024}$/
const LOCATION_RE = /^[A-Za-z0-9-]{1,40}$/

function check(re, value, what) {
  const s = String(value ?? '')
  if (!re.test(s)) throw new Error(`Not a valid BigQuery ${what}: ${s.slice(0, 80) || '(empty)'}`)
  return encodeURIComponent(s)
}
const project = (v) => check(PROJECT_RE, v, 'project id')
const dataset = (v) => check(DATASET_RE, v, 'dataset id')
const table = (v) => check(TABLE_RE, v, 'table id')
const job = (v) => check(JOB_RE, v, 'job id')
function location(v) {
  if (v === undefined || v === null || v === '') return undefined
  check(LOCATION_RE, v, 'location')
  return String(v)
}

function clampInt(v, min, max, fallback) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function query(params) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return q ? `?${q}` : ''
}

/** BigQuery's error message, without the token or request details. */
function apiError(status, body) {
  const err = body?.error
  const msg = err?.message || (typeof body === 'string' ? body.slice(0, 300) : '') || `BigQuery answered ${status}.`
  const e = new Error(msg)
  e.status = status
  e.reason = err?.errors?.[0]?.reason
  return e
}

// ---------- values ----------

/** BigQuery TIMESTAMP cells are epoch seconds (or micros as an int64 string in newer formats). */
function timestampText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const ms = Math.abs(n) > 1e14 ? n / 1000 : n * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC')
}

/** One cell by its field: plain JSON value. INT64/NUMERIC stay strings so nothing loses precision. */
function cell(field, v) {
  if (v === null || v === undefined) return null
  if (field.mode === 'REPEATED') {
    const items = Array.isArray(v) ? v : []
    const one = { ...field, mode: 'NULLABLE' }
    return items.map((x) => cell(one, x?.v))
  }
  switch (field.type) {
    case 'RECORD':
    case 'STRUCT': {
      const out = {}
      const sub = field.fields ?? []
      const cells = v?.f ?? []
      sub.forEach((f, i) => (out[f.name] = cell(f, cells[i]?.v)))
      return out
    }
    case 'FLOAT':
    case 'FLOAT64': {
      const n = Number(v)
      return Number.isFinite(n) ? n : String(v)
    }
    case 'BOOLEAN':
    case 'BOOL':
      return v === true || v === 'true'
    case 'TIMESTAMP':
      return timestampText(v)
    default:
      return typeof v === 'object' ? v : String(v)
  }
}

/** The schema as the page needs it. */
function fieldsOf(schema) {
  const map = (f) => ({
    name: String(f.name),
    type: String(f.type ?? ''),
    mode: f.mode ? String(f.mode) : 'NULLABLE',
    description: f.description ? String(f.description) : undefined,
    fields: Array.isArray(f.fields) ? f.fields.map(map) : undefined,
  })
  return Array.isArray(schema?.fields) ? schema.fields.map(map) : []
}

/** API rows ({ f: [{ v }] }) to arrays of plain values, column order = schema order. */
function toRows(schema, rows) {
  const fields = fieldsOf(schema)
  return (Array.isArray(rows) ? rows : []).map((r) => fields.map((f, i) => cell(f, r?.f?.[i]?.v)))
}

function int(v) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function msTime(v) {
  const n = int(v)
  return n === undefined ? undefined : new Date(n).toISOString()
}

/** A query response (jobs.query or jobs.getQueryResults) for the page. */
function queryResult(body) {
  const ref = body?.jobReference ?? {}
  return {
    jobComplete: body?.jobComplete !== false,
    job: { projectId: ref.projectId, jobId: ref.jobId, location: ref.location },
    fields: fieldsOf(body?.schema),
    rows: body?.jobComplete === false ? [] : toRows(body?.schema, body?.rows),
    totalRows: int(body?.totalRows),
    pageToken: body?.pageToken || undefined,
    totalBytesProcessed: int(body?.totalBytesProcessed),
    cacheHit: body?.cacheHit === true,
    numDmlAffectedRows: int(body?.numDmlAffectedRows),
    errors: Array.isArray(body?.errors) ? body.errors.map((e) => String(e?.message ?? '')).filter(Boolean) : [],
  }
}

/** The parts of a job resource the page shows (Job information, Execution details, history). */
function jobSummary(j) {
  const ref = j?.jobReference ?? {}
  const st = j?.statistics ?? {}
  const q = st.query ?? {}
  const cfg = j?.configuration?.query ?? {}
  const dest = cfg.destinationTable
  return {
    projectId: ref.projectId,
    jobId: ref.jobId,
    location: ref.location,
    user: j?.user_email,
    state: j?.status?.state,
    error: j?.status?.errorResult?.message,
    errors: (j?.status?.errors ?? []).map((e) => String(e?.message ?? '')).filter(Boolean),
    query: typeof cfg.query === 'string' ? cfg.query : undefined,
    useLegacySql: cfg.useLegacySql === true,
    jobType: j?.configuration?.jobType,
    statementType: q.statementType,
    destinationTable: dest ? `${dest.projectId}.${dest.datasetId}.${dest.tableId}` : undefined,
    creationTime: msTime(st.creationTime),
    startTime: msTime(st.startTime),
    endTime: msTime(st.endTime),
    totalBytesProcessed: int(q.totalBytesProcessed ?? st.totalBytesProcessed),
    totalBytesBilled: int(q.totalBytesBilled),
    totalSlotMs: int(q.totalSlotMs ?? st.totalSlotMs),
    cacheHit: q.cacheHit === true,
    numDmlAffectedRows: int(q.numDmlAffectedRows),
    stages: (q.queryPlan ?? []).map((s) => ({
      id: String(s.id ?? ''),
      name: String(s.name ?? ''),
      status: s.status,
      waitMsAvg: int(s.waitMsAvg),
      readMsAvg: int(s.readMsAvg),
      computeMsAvg: int(s.computeMsAvg),
      writeMsAvg: int(s.writeMsAvg),
      waitMsMax: int(s.waitMsMax),
      readMsMax: int(s.readMsMax),
      computeMsMax: int(s.computeMsMax),
      writeMsMax: int(s.writeMsMax),
      recordsRead: int(s.recordsRead),
      recordsWritten: int(s.recordsWritten),
      shuffleOutputBytes: int(s.shuffleOutputBytes),
      slotMs: int(s.slotMs),
      startMs: int(s.startMs),
      endMs: int(s.endMs),
      steps: (s.steps ?? []).map((x) => ({ kind: String(x.kind ?? ''), substeps: (x.substeps ?? []).map(String).slice(0, 40) })),
    })),
  }
}

function tableSummary(t) {
  const ref = t?.tableReference ?? {}
  return {
    projectId: ref.projectId,
    datasetId: ref.datasetId,
    tableId: ref.tableId,
    type: t?.type,
    description: t?.description,
    location: t?.location,
    fields: fieldsOf(t?.schema),
    numRows: int(t?.numRows),
    numBytes: int(t?.numBytes),
    numLongTermBytes: int(t?.numLongTermBytes),
    creationTime: msTime(t?.creationTime),
    lastModifiedTime: msTime(t?.lastModifiedTime),
    expirationTime: msTime(t?.expirationTime),
    partitioning: t?.timePartitioning
      ? `${t.timePartitioning.type ?? 'DAY'}${t.timePartitioning.field ? ` on ${t.timePartitioning.field}` : ' (ingestion time)'}`
      : t?.rangePartitioning
        ? `Integer range on ${t.rangePartitioning.field}`
        : undefined,
    clustering: t?.clustering?.fields ?? undefined,
    partitionField: t?.timePartitioning?.field ?? undefined,
    streamingRows: int(t?.streamingBuffer?.estimatedRows),
    labels: t?.labels ?? undefined,
    viewQuery: t?.view?.query ?? t?.materializedView?.query ?? undefined,
  }
}

// ---------- the client ----------

/**
 * getToken({ refresh }) resolves to an access token; fetchImpl defaults to
 * the global fetch. A 401 asks for a fresh token once.
 */
function createClient({ getToken, fetchImpl = (...a) => fetch(...a), timeoutMs = 120_000 }) {
  async function call(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getToken({ refresh: attempt > 0 })
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      let res
      try {
        res = await fetchImpl(`${BASE}${path}`, {
          method,
          headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        })
      } catch (e) {
        throw new Error(e?.name === 'AbortError' ? 'BigQuery did not answer in time.' : `Could not reach BigQuery: ${e?.message ?? e}`)
      } finally {
        clearTimeout(timer)
      }
      const text = await res.text()
      let json
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        json = text
      }
      if (res.status === 401 && attempt === 0) continue
      if (!res.ok) throw apiError(res.status, json)
      return json
    }
    throw new Error('Google sign-in was refused. Use Sign in again on Connections.')
  }

  async function listAll(path, key, params, limit = 5000) {
    const out = []
    let pageToken
    do {
      const body = await call('GET', `${path}${query({ ...params, pageToken })}`)
      out.push(...(body?.[key] ?? []))
      pageToken = body?.nextPageToken
    } while (pageToken && out.length < limit)
    return { items: out.slice(0, limit), truncated: !!pageToken }
  }

  return {
    async listProjects() {
      const { items, truncated } = await listAll('/projects', 'projects', { maxResults: 1000 }, 2000)
      return {
        projects: items
          .map((p) => ({ id: p?.projectReference?.projectId ?? p?.id, name: p?.friendlyName }))
          .filter((p) => p.id)
          .sort((a, b) => a.id.localeCompare(b.id)),
        truncated,
      }
    },

    async listDatasets(args) {
      const { items, truncated } = await listAll(`/projects/${project(args?.projectId)}/datasets`, 'datasets', { maxResults: 1000 })
      return {
        datasets: items.map((d) => ({ id: d?.datasetReference?.datasetId, location: d?.location })).filter((d) => d.id).sort((a, b) => a.id.localeCompare(b.id)),
        truncated,
      }
    },

    async getDataset(args) {
      const d = await call('GET', `/projects/${project(args?.projectId)}/datasets/${dataset(args?.datasetId)}`)
      return {
        projectId: d?.datasetReference?.projectId,
        datasetId: d?.datasetReference?.datasetId,
        description: d?.description,
        location: d?.location,
        creationTime: msTime(d?.creationTime),
        lastModifiedTime: msTime(d?.lastModifiedTime),
        defaultTableExpirationMs: int(d?.defaultTableExpirationMs),
        labels: d?.labels,
      }
    },

    async listTables(args) {
      const { items, truncated } = await listAll(
        `/projects/${project(args?.projectId)}/datasets/${dataset(args?.datasetId)}/tables`,
        'tables',
        { maxResults: 1000 },
      )
      return {
        tables: items
          .map((t) => ({ id: t?.tableReference?.tableId, type: t?.type, partitioned: !!(t?.timePartitioning || t?.rangePartitioning) }))
          .filter((t) => t.id)
          .sort((a, b) => a.id.localeCompare(b.id)),
        truncated,
      }
    },

    async getTable(args) {
      return tableSummary(await call('GET', `/projects/${project(args?.projectId)}/datasets/${dataset(args?.datasetId)}/tables/${table(args?.tableId)}`))
    },

    async previewTable(args) {
      const base = `/projects/${project(args?.projectId)}/datasets/${dataset(args?.datasetId)}/tables/${table(args?.tableId)}`
      const meta = await call('GET', `${base}${query({ fields: 'schema,numRows,type' })}`)
      if (meta?.type === 'VIEW' || meta?.type === 'MATERIALIZED_VIEW') return { fields: fieldsOf(meta.schema), rows: [], view: true }
      const data = await call('GET', `${base}/data${query({ maxResults: clampInt(args?.maxResults, 1, 500, 100), pageToken: args?.pageToken })}`)
      return { fields: fieldsOf(meta?.schema), rows: toRows(meta?.schema, data?.rows), totalRows: int(data?.totalRows), pageToken: data?.pageToken || undefined }
    },

    /**
     * One page of a table's rows as BigQuery sends them ({ f: [{ v }] }), with
     * only `selectedFields` (in table schema order) and TIMESTAMPs as int64
     * microseconds. tabledata.list runs no query, so BigQuery bills nothing
     * for it; the metadata copy (localdb/bigquery-mirror.cjs) downloads with it.
     */
    async listTableData(args) {
      const base = `/projects/${project(args?.projectId)}/datasets/${dataset(args?.datasetId)}/tables/${table(args?.tableId)}`
      const fields = Array.isArray(args?.selectedFields) ? args.selectedFields.map((f) => check(/^[A-Za-z_][A-Za-z0-9_]{0,299}$/, f, 'column name')) : undefined
      const data = await call(
        'GET',
        `${base}/data${query({
          maxResults: clampInt(args?.maxResults, 1, 10_000, 1000),
          pageToken: args?.pageToken,
          selectedFields: fields?.join(','),
          'formatOptions.useInt64Timestamp': 'true',
        })}`,
      )
      return { rows: Array.isArray(data?.rows) ? data.rows : [], totalRows: int(data?.totalRows), pageToken: data?.pageToken || undefined }
    },

    /** Start a query (or dry-run it). Waits up to timeoutMs; an unfinished job comes back with jobComplete false. */
    async runQuery(args) {
      const sql = String(args?.query ?? '')
      if (!sql.trim()) throw new Error('Write a query first.')
      if (sql.length > 1_000_000) throw new Error('The query is longer than BigQuery allows (1 MB).')
      const req = {
        query: sql,
        useLegacySql: false,
        dryRun: args?.dryRun === true,
        useQueryCache: args?.useQueryCache !== false,
        maxResults: clampInt(args?.maxResults, 1, 1000, 100),
        timeoutMs: args?.dryRun ? undefined : clampInt(args?.timeoutMs, 0, 20_000, 10_000),
        location: location(args?.location),
        maximumBytesBilled: args?.maximumBytesBilled ? String(clampInt(args.maximumBytesBilled, 1, Number.MAX_SAFE_INTEGER, 0)) : undefined,
      }
      if (args?.defaultDataset?.projectId && args?.defaultDataset?.datasetId) {
        project(args.defaultDataset.projectId)
        dataset(args.defaultDataset.datasetId)
        req.defaultDataset = { projectId: args.defaultDataset.projectId, datasetId: args.defaultDataset.datasetId }
      }
      const body = await call('POST', `/projects/${project(args?.projectId)}/queries`, req)
      const out = queryResult(body)
      if (req.dryRun) {
        return { ...out, dryRun: true, rows: [], totalBytesProcessed: int(body?.totalBytesProcessed), statementType: body?.statementType }
      }
      return out
    },

    /** Results of a query job, one page at a time; also how the page waits for a running job. */
    async getQueryResults(args) {
      const body = await call(
        'GET',
        `/projects/${project(args?.projectId)}/queries/${job(args?.jobId)}${query({
          location: location(args?.location),
          maxResults: clampInt(args?.maxResults, 1, 1000, 100),
          pageToken: args?.pageToken,
          startIndex: args?.pageToken ? undefined : args?.startIndex,
          timeoutMs: clampInt(args?.timeoutMs, 0, 20_000, 5_000),
        })}`,
      )
      return queryResult(body)
    },

    async getJob(args) {
      return jobSummary(
        await call('GET', `/projects/${project(args?.projectId)}/jobs/${job(args?.jobId)}${query({ location: location(args?.location) })}`),
      )
    },

    async cancelJob(args) {
      const body = await call(
        'POST',
        `/projects/${project(args?.projectId)}/jobs/${job(args?.jobId)}/cancel${query({ location: location(args?.location) })}`,
      )
      return jobSummary(body?.job)
    },

    /** Recent query jobs: the user's own, or everyone's in the project (needs bigquery.jobs.listAll). */
    async listJobs(args) {
      const body = await call(
        'GET',
        `/projects/${project(args?.projectId)}/jobs${query({
          projection: 'full',
          allUsers: args?.allUsers === true ? 'true' : undefined,
          maxResults: clampInt(args?.maxResults, 1, 200, 50),
          pageToken: args?.pageToken,
        })}`,
      )
      return {
        jobs: (body?.jobs ?? [])
          .map((j) => jobSummary({ ...j, jobReference: j.jobReference, status: j.status ?? { state: j.state, errorResult: j.errorResult } }))
          .filter((j) => j.jobType === 'QUERY' || j.query)
          .map(({ stages: _stages, ...rest }) => rest),
        pageToken: body?.nextPageToken || undefined,
      }
    },
  }
}

module.exports = { createClient, toRows, fieldsOf, queryResult, jobSummary, tableSummary, timestampText, BASE, _ids: { PROJECT_RE, DATASET_RE, TABLE_RE, JOB_RE } }
