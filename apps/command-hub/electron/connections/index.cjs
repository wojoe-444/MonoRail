// Connections: one place to set up and watch the accounts MonoRail's
// modules and apps sign in with.
//
// A connector is a plain object in ./connectors:
//
//   kind, title, description, icon   identity, shown on the page
//   fields     [{ key, label, type: 'text'|'secret'|'select', options?,
//                 defaultValue?, placeholder?, help?, showIf? }]
//              what the user fills in. 'secret' fields are encrypted with
//              safeStorage and never sent back to the page.
//   validate?  ({ values, secretsSet, secrets }) => void, throws a readable
//              message. secrets holds only what was typed in this save.
//   status     (conn, deps) => { state, summary, hint?, details[] }
//              state: ok | expired | needs-setup | error | unavailable.
//              conn is undefined until the connection is added.
//   actions    [{ id, label, description, showWhen[], steps?, run(conn, job) }]
//              e.g. "Sign in again". run may be long; the page polls the job.
//   credentials? (conn) => what other backends need to call the service.
//   afterSave? (conn, deps) => runs after the connection is saved, before
//              the check (pi writes its scoped models into pi's settings).
//   afterRemove? (deps) => runs after the connection is removed (undo what
//              afterSave wrote that only makes sense while it is set up).
//   parent?    kind of another connector: this one is a subconnector, shown
//              nested inside the parent's card (pi > Playwright browser,
//              Claude > Playwright browser).
//
// A status may also carry actions: [ids], the actions that fit right now;
// the page shows only those (on top of showWhen). A running job may set
// job.note, one line the page shows instead of the generic sign-in text.
//
// Other backends reach a connection through getCredentials(kind) below, in
// the main process. The page only ever sees describe-level data.
//
// Opt-in: a connector runs nothing (no status(), no actions, no process, no
// file probe, no network call) until the user sets it up on the page. A
// check of a connector that is not added returns NOT_ADDED without calling
// status(), runAction refuses, and nothing checks connections on startup.
// Test users must never have MonoRail probing tools or accounts they did
// not ask it to look at.

const path = require('node:path')

const cacheLib = require('../cache/index.cjs')
const { createStore } = require('./store.cjs')
const wincred = require('./wincred.cjs')

const CONNECTORS = [
  require('./connectors/gcloud.cjs'),
  require('./connectors/atlassian.cjs'),
  require('./connectors/claude.cjs'),
  require('./connectors/claude-playwright.cjs'),
  require('./connectors/openai.cjs'),
  require('./connectors/pi.cjs'),
  require('./connectors/pi-playwright.cjs'),
  require('./connectors/git.cjs'),
  require('./connectors/github.cjs'),
  require('./connectors/docker.cjs'),
  require('./connectors/metricflow.cjs'),
]
const byKind = new Map(CONNECTORS.map((c) => [c.kind, c]))

const OUTPUT_LIMIT = 8_000

/** The status of a connector the user has not set up. Nothing was run to make it. */
function notAdded() {
  return {
    state: 'needs-setup',
    summary: 'Not set up. MonoRail checks nothing until you set it up.',
    details: [],
    added: false,
    checkedAt: undefined,
  }
}

function connectorOf(kind) {
  const c = typeof kind === 'string' ? byKind.get(kind) : undefined
  if (!c) throw new Error(`Unknown connector: ${kind}`)
  return c
}

/** What the page may know about a connector kind. */
function describeConnector(c) {
  return {
    kind: c.kind,
    title: c.title,
    description: c.description,
    icon: c.icon,
    parent: c.parent,
    fields: c.fields,
    actions: c.actions.map(({ id, label, description, showWhen, steps }) => ({ id, label, description, showWhen, steps })),
  }
}

function publicJob(job) {
  if (!job) return undefined
  const { id, kind, action, state, step, steps, stepLabel, note, url, output, error, startedAt, endedAt } = job
  return { id, kind, action, state, step, steps, stepLabel, note, url, output, error, startedAt, endedAt }
}

/**
 * The Connections service. cipher wraps safeStorage (see store.cjs); deps are
 * passed to connectors (tests use them to stub fetch and Credential Manager).
 */
function createConnections({ dataDir, cipher, deps = {}, checks = cacheLib.keyed('connections.sign-in') }) {
  const store = createStore(dataDir, cipher)
  const lastStatus = new Map()
  const jobs = new Map()
  let jobSeq = 0

  // Checks spawn gcloud or call Atlassian, so a result is reused (declared
  // in electron/cache/declared.cjs: 15 minutes after success, 2 after a
  // failure). Editing the connection changes the definition and discards it;
  // the Check button, a save and a finished sign-in pass force.
  async function check(kind, { force = false } = {}) {
    const c = connectorOf(kind)
    const conn = await store.get(kind)
    if (!conn) return notAdded()
    const definition = { added: !!conn, values: conn?.values ?? {} }
    const result = await checks.get(
      kind,
      async () => {
        let s
        try {
          s = await c.status(conn, deps)
        } catch (e) {
          s = { state: 'error', summary: e instanceof Error ? e.message : String(e), details: [] }
        }
        return { ...s, added: !!conn, checkedAt: new Date().toISOString() }
      },
      { definition, force, failed: (r) => r.state !== 'ok' },
    )
    if (conn) {
      lastStatus.set(kind, result)
      void saveSummary(kind, result)
    }
    return result
  }

  // The last result per connection, on disk (declared 'connections.summary'),
  // so Home and the MCP server can show it without running a check. Only the
  // state and one-line summary: never secrets or check details.
  let summaryWrites = Promise.resolve()
  function saveSummary(kind, result) {
    summaryWrites = summaryWrites
      .then(async () => {
        if (!dataDir) return
        const all = (await cacheLib.readSummaries(path.dirname(path.dirname(dataDir))))['connections.summary']?.summary?.connections ?? {}
        if (result) {
          const { state, summary, hint, checkedAt, account } = result
          const c = connectorOf(kind)
          const parent = c.parent ? byKind.get(c.parent) : undefined
          all[kind] = { title: parent ? `${parent.title}: ${c.title}` : c.title, state, summary, hint, checkedAt }
          // The Claude account type (no names or emails), for Home and the MCP server.
          if (account) all[kind].account = { type: account.type, source: account.source, billedAtApiPrices: account.billedAtApiPrices }
        } else delete all[kind]
        await cacheLib.writeSummary({ dataDir }, 'connections.summary', { connections: all })
      })
      .catch(() => {})
    return summaryWrites
  }

  return {
    async list() {
      const saved = await store.describe()
      return {
        connectors: CONNECTORS.map(describeConnector),
        connections: saved
          .filter((s) => byKind.has(s.kind))
          .map((s) => ({ ...s, status: lastStatus.get(s.kind), job: publicJob(jobs.get(s.kind)) })),
        encryptionAvailable: cipher.isAvailable(),
        platform: process.platform,
      }
    },

    check,

    /** Add or update a connection, then check it. */
    async save({ kind, values = {}, secrets = {}, clearSecrets = [] } = {}) {
      const c = connectorOf(kind)
      const prev = (await store.describe()).find((s) => s.kind === kind)
      const secretsSet = { ...(prev?.secretsSet ?? {}) }
      for (const f of c.fields) {
        if (f.type !== 'secret') continue
        if (clearSecrets.includes(f.key)) delete secretsSet[f.key]
        if (typeof secrets[f.key] === 'string' && secrets[f.key].trim()) secretsSet[f.key] = true
      }
      const clean = {}
      for (const f of c.fields) if (f.type !== 'secret') clean[f.key] = typeof values[f.key] === 'string' ? values[f.key].trim() : (f.defaultValue ?? '')
      c.validate?.({ values: clean, secretsSet, secrets })
      // Secrets of a field that is hidden by the current choice are dropped.
      const hidden = c.fields.filter((f) => f.type === 'secret' && f.showIf && Object.entries(f.showIf).some(([k, v]) => clean[k] !== v)).map((f) => f.key)
      await store.save(kind, c.fields, { values: clean, secrets, clearSecrets: [...clearSecrets, ...hidden] })
      if (c.afterSave) {
        try {
          await c.afterSave(await store.get(kind), deps)
        } finally {
          checks.invalidate(kind)
        }
      }
      return check(kind, { force: true })
    },

    async remove({ kind } = {}) {
      connectorOf(kind)
      const job = jobs.get(kind)
      if (job?.state === 'running') throw new Error('Wait for the sign-in to finish, or cancel it, before removing the connection.')
      jobs.delete(kind)
      lastStatus.delete(kind)
      checks.invalidate(kind)
      await saveSummary(kind, undefined)
      const removed = await store.remove(kind)
      await connectorOf(kind).afterRemove?.(deps)
      return removed
    },

    /** Start an action. Returns the job; long ones keep running and the page polls getJob. */
    async runAction({ kind, action } = {}) {
      const c = connectorOf(kind)
      const a = c.actions.find((x) => x.id === action)
      if (!a) throw new Error(`Unknown action ${kind}.${action}`)
      const running = jobs.get(kind)
      if (running?.state === 'running') return publicJob(running)
      const conn = await store.get(kind)
      if (!conn) throw new Error(`Set up ${c.title} first. MonoRail runs nothing for a connection you have not added.`)
      const job = {
        id: ++jobSeq,
        kind,
        action,
        state: 'running',
        step: 0,
        steps: a.steps ?? 1,
        output: '',
        startedAt: new Date().toISOString(),
        cancelled: false,
        appendOutput(text) {
          job.output = (job.output + text).slice(-OUTPUT_LIMIT)
        },
      }
      jobs.set(kind, job)
      Promise.resolve()
        .then(() => a.run(conn, job, deps))
        .then(
          () => {
            job.state = 'done'
            checks.invalidate(kind)
          },
          (e) => {
            job.state = job.cancelled ? 'cancelled' : 'failed'
            job.error = e instanceof Error ? e.message : String(e)
          },
        )
        .finally(() => {
          job.endedAt = new Date().toISOString()
          job.kill = undefined
        })
      // Quick actions (opening a window) are usually done by now.
      await new Promise((r) => setTimeout(r, 50))
      return publicJob(job)
    },

    getJob({ kind } = {}) {
      connectorOf(kind)
      return publicJob(jobs.get(kind))
    },

    cancelJob({ kind } = {}) {
      const job = jobs.get(kind)
      if (job?.state === 'running') {
        job.cancelled = true
        job.kill?.()
      }
      return publicJob(job)
    },

    /**
     * The Claude account type (subscription | api | enterprise | unknown),
     * with the user's override applied. Anything that shows Claude costs
     * should use it: Enterprise and API logins bill at API prices, a
     * subscription does not bill per token. Reuses a recent check.
     * Undefined until the user has set up the Claude connection: nothing is
     * run to find out otherwise.
     */
    async claudeAccount() {
      if (!(await store.get('claude'))) return undefined
      const s = await check('claude')
      return s.account
    },

    /** True once the user has added this connection. Runs nothing (no status(), no process, no request). */
    async has(kind) {
      connectorOf(kind)
      return !!(await store.get(kind))
    },

    /** For other backends in the main process: what a connector's credentials() returns. */
    async getCredentials(kind) {
      const c = connectorOf(kind)
      if (typeof c.credentials !== 'function') throw new Error(`${c.title} does not provide credentials.`)
      const conn = await store.get(kind)
      if (!conn) throw new Error(`Set up ${c.title} on the Connections page first.`)
      return c.credentials(conn, deps)
    },

    /** Generic Credential Manager entries (names only), for the entry picker. */
    async listWindowsCredentials() {
      return (deps.listCredentials ?? wincred.listCredentials)()
    },
  }
}

// ---------- the app's instance ----------

let instance
/** The Connections service over the active profile's modules\connections (electron/profiles). Main process only. */
function connections() {
  if (instance) return instance
  const { safeStorage } = require('electron')
  instance = createConnections({
    dataDir: require('../profiles/index.cjs').appLayout().folder('modules/connections'),
    cipher: {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
      decrypt: (enc) => safeStorage.decryptString(Buffer.from(enc, 'base64')),
    },
  })
  return instance
}

/**
 * Credentials of a connection, for other backends. For example Jira+:
 *   const { siteUrl, email, token } = await getCredentials('atlassian')
 */
function getCredentials(kind) {
  return connections().getCredentials(kind)
}

/** Whether the user has set up a connection of this kind. Checks the saved list only. */
function hasConnection(kind) {
  return connections().has(kind)
}

/** The Claude account type for cost views: `const { type, billedAtApiPrices } = await claudeAccount()`. */
function claudeAccount() {
  return connections().claudeAccount()
}

module.exports = { connections, getCredentials, hasConnection, claudeAccount, createConnections, CONNECTORS, notAdded }
