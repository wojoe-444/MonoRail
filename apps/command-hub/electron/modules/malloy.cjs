// Malloy backend, for the OpenMetadata page's Semantic models, Query builder
// and Malloy models tabs (src/modules/openmetadata/tabs/). Malloy ships with
// MonoRail: it is not a connection. The work is in malloy-lib.cjs; its
// settings (models folder, billing project, location, "Run queries on
// BigQuery", scan limit) are in malloy-settings.cjs, kept in this module's
// data folder as settings.json.
//
// Nothing is read until the user picks a models folder in the system dialog
// (pickFolder; the page never sends or receives a path). BigQuery is reached
// with the Google Cloud connection's access token (gcloud auth
// print-access-token), kept in memory 30 minutes, never stored. Running
// queries is off until the user turns it on. No start(): nothing runs while
// the page is closed.

const path = require('node:path')

const { createMalloy, listFiles } = require('./malloy-lib.cjs')
const { createSettingsStore, settingsOf } = require('./malloy-settings.cjs')

function connectionsApi() {
  return require('../connections/index.cjs')
}

async function gcloudCredentials() {
  const api = connectionsApi()
  if (!(await api.hasConnection('gcloud'))) return undefined
  return api.getCredentials('gcloud')
}

const services = new Map() // dataDir -> { store, service }

function forCtx(ctx) {
  let s = services.get(ctx.dataDir)
  if (!s) {
    let legacyDir
    try {
      legacyDir = ctx.layout?.folder('modules/connections')
    } catch {
      legacyDir = undefined
    }
    const store = createSettingsStore({ dir: ctx.dataDir, legacyDir })
    s = { store, service: makeService(store) }
    services.set(ctx.dataDir, s)
  }
  return s
}

function makeService(store) {
  return createMalloy({
    settings: async () => {
      const { values, damaged } = await store.read()
      return damaged ? undefined : settingsOf(values)
    },
    credentials: gcloudCredentials,
  })
}

/** After a change, start over so nothing compiled for the old folder or project is reused. */
function renew(ctx) {
  const s = forCtx(ctx)
  s.service = makeService(s.store)
}

/** The settings as the page sees them: the folder's name, never its path. */
async function publicSettings(ctx) {
  const { values, damaged, fromConnection } = await forCtx(ctx).store.read()
  let gcloud = false
  try {
    gcloud = await connectionsApi().hasConnection('gcloud')
  } catch {
    gcloud = false
  }
  return {
    folderName: values.folder ? path.basename(values.folder) : undefined,
    project: values.project,
    location: values.location,
    run: values.run,
    maxScanGb: values.maxScanGb,
    damaged: damaged || undefined,
    fromConnection: fromConnection || undefined,
    gcloud,
  }
}

module.exports = {
  id: 'malloy',
  desktopOnly: ['pickFolder'],
  methods: {
    status: (ctx) => forCtx(ctx).service.status(),
    listModels: (ctx) => forCtx(ctx).service.listModels(),
    compile: (ctx, args) => forCtx(ctx).service.compile(args),
    sql: (ctx, args) => forCtx(ctx).service.sql(args),
    run: (ctx, args) => forCtx(ctx).service.run(args),

    getSettings: (ctx) => publicSettings(ctx),

    /** Project, location, run and scan limit. The folder only changes through pickFolder. */
    async saveSettings(ctx, args = {}) {
      const change = {}
      for (const k of ['project', 'location', 'run', 'maxScanGb']) if (typeof args[k] === 'string') change[k] = args[k]
      if (args.forgetFolder === true) change.folder = ''
      await forCtx(ctx).store.save(change)
      renew(ctx)
      return publicSettings(ctx)
    },

    /** Asks for the models folder in the system dialog. */
    async pickFolder(ctx) {
      const { BrowserWindow, dialog } = require('electron')
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Choose the folder with your Malloy models', properties: ['openDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (r.canceled || !r.filePaths?.[0]) return { canceled: true, ...(await publicSettings(ctx)) }
      const folder = r.filePaths[0]
      await forCtx(ctx).store.save({ folder })
      renew(ctx)
      const { files } = await require('node:fs/promises')
        .realpath(folder)
        .then((root) => listFiles(root))
        .catch(() => ({ files: [] }))
      return { ...(await publicSettings(ctx)), files: files.length }
    },

    async resetSettings(ctx) {
      await forCtx(ctx).store.reset()
      renew(ctx)
      return publicSettings(ctx)
    },
  },
}
