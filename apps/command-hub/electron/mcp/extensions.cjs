// MCP tools contributed by installed extensions (manifest contributes.mcpTools,
// extension API 1.2). Each tool calls one backend method of its extension.
//
// The MCP server is its own process, so it runs extension backends itself,
// with the same sandbox as the app (electron/extensions/host.cjs: Node's
// permission model, the network guard, the granted folders), the same data
// folder and ctx.runningIn = 'mcp'. What only the app can do is not
// available here: ctx.secrets rejects (safeStorage needs Electron's main
// process), secret settings read as null and ctx.emit reaches no page.
//
// Rules:
//   - only active extensions (enabled, compatible, permissions approved);
//   - every extension tool needs the user's OK per agent, whatever the
//     extension declares (MonoRail cannot check a "read-only" claim);
//   - a backend whose install or update the app has not yet started once
//     (its data version does not match) is refused, so migrate() only ever
//     runs inside the app.
//
// Tool names are "<extension id with _>__<tool name>", e.g. hello_monorail__list_notes.

const fs = require('node:fs')
const path = require('node:path')

const { API_VERSION } = require('../extensions/manifest.cjs')
const { BackendHost } = require('../extensions/host.cjs')
const { ExtensionManager } = require('../extensions/manager.cjs')
const { SecretStore } = require('../extensions/secrets.cjs')
const { SettingsStore } = require('../extensions/settings.cjs')

const NO_CIPHER = { isAvailable: () => false, encrypt: () => Buffer.alloc(0), decrypt: () => '' }

const toolName = (extId, name) => `${extId.replace(/-/g, '_')}__${name}`

/** A read-only view of the installed extensions, state re-read on every call. */
function createExtensionView(rootDir, { host } = {}) {
  const secretStore = new SecretStore({ root: path.join(rootDir, 'extension-secrets'), cipher: NO_CIPHER })
  const settingsStore = new SettingsStore({ root: path.join(rootDir, 'extension-settings'), secretStore })
  const manager = new ExtensionManager({ userData: rootDir, host, secretStore, settingsStore })
  // Never manager.init(): it clears the app's staging folder and starts backends.
  const reload = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(manager.stateFile, 'utf8'))
      manager.state = parsed && typeof parsed.extensions === 'object' ? parsed : { version: 1, extensions: {} }
    } catch {
      manager.state = { version: 1, extensions: {} }
    }
  }
  return { manager, settingsStore, reload }
}

/** Active extensions' tools, as metadata (for the Agent access page). */
function describeExtensionTools(rootDir) {
  const { manager, reload } = createExtensionView(rootDir)
  reload()
  const out = []
  for (const rec of manager.records()) {
    if (rec.status !== 'active') continue
    for (const t of rec.manifest.contributes?.mcpTools ?? []) {
      out.push({ rec, tool: t, name: toolName(rec.id, t.name), title: `${rec.manifest.name}: ${t.title}` })
    }
  }
  return out
}

/**
 * The MCP tools of every active extension, ready for createMcpServer. Returns
 * { tools, stop } where stop() ends the backends this process started.
 */
function extensionTools({ rootDir, log = () => {} }) {
  const host = new BackendHost({
    apiVersion: API_VERSION,
    runningIn: 'mcp',
    // Secrets need Electron's safeStorage, which only the app has.
    secrets: undefined,
    settings: async (id) => {
      const { manifest } = view.manager.record(id)
      const { values } = view.settingsStore.publicValues(manifest)
      for (const f of manifest.settings ?? []) if (f.type === 'secret') values[f.key] = null
      return values
    },
    // migrate() never runs here (see the data version check below).
    onMigrated: () => {},
  })
  const view = createExtensionView(rootDir, { host })

  let found = []
  try {
    found = describeExtensionTools(rootDir)
  } catch (e) {
    log('could not read extensions:', e.message)
  }

  const tools = found.map(({ rec, tool: t, name, title }) => ({
    name,
    title,
    description: `${t.description} (From the ${rec.manifest.name} extension.)`,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: !t.write, destructiveHint: false, idempotentHint: false, openWorldHint: !!rec.manifest.permissions?.network },
    write: t.write,
    consent: true,
    extension: rec.id,
    async handler(args, ctx) {
      view.reload()
      const fresh = view.manager.active(rec.id) // throws EXT_NOT_ACTIVE with a reason
      if (!(fresh.manifest.contributes?.mcpTools ?? []).some((x) => x.name === t.name && x.method === t.method)) {
        throw new Error(`${fresh.manifest.name} no longer offers this tool. Restart the agent's MonoRail server to see its current tools.`)
      }
      const recorded = view.manager.state.dataVersions?.[rec.id] ?? null
      if (recorded !== fresh.manifest.version) {
        throw new Error(`${fresh.manifest.name} has not finished setting up after its install or update. Open it in MonoRail once, then try again.`)
      }
      const value = await view.manager.invoke(rec.id, t.method, args)
      if (t.write) ctx.did(`${fresh.manifest.name}: ${t.title}`)
      return value === undefined ? null : value
    },
  }))

  return { tools, stop: () => host.stopAll() }
}

module.exports = { extensionTools, describeExtensionTools, toolName }
