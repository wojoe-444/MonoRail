// Which backend methods act on this PC's own screen: a system dialog, Explorer,
// a terminal window, DevTools, a restart, a link opened in the PC's browser.
//
// A backend lists them in `desktopOnly: ['method', ...]` next to `methods`. The
// desktop window and the browser dev bridge (same PC, same screen) run them as
// always. The optional Remote access mode (a phone, off by default) refuses
// them, because a dialog on a PC screen nobody is looking at would hang the
// call or surprise whoever is at the PC. electron/bridge/desktop-only.test.cjs
// fails when a method uses one of those Electron APIs without being listed.

// Electron APIs that need the PC's screen. Matched against a method's source.
const SCREEN_API = /\b(?:dialog|shell|BrowserWindow|autoUpdater|webContents)\.|\bapp\.(?:relaunch|exit|quit)\(/

/** Methods of `backend` whose own source calls a screen API (direct calls only). */
function screenApiMethods(backend) {
  return Object.entries(backend?.methods ?? {})
    .filter(([, fn]) => typeof fn === 'function' && SCREEN_API.test(String(fn)))
    .map(([name]) => name)
}

/**
 * Index of desktop-only methods over the running backends.
 * @param {Iterable<[string, { methods: object, desktopOnly?: string[] }]>} entries [moduleId, backend]
 */
function desktopOnlyIndex(entries) {
  const byModule = new Map()
  for (const [moduleId, backend] of entries) {
    const names = Array.isArray(backend?.desktopOnly) ? backend.desktopOnly : []
    for (const name of names) {
      if (!Object.hasOwn(backend.methods ?? {}, name)) console.error(`[bridge] ${moduleId}.desktopOnly names an unknown method: ${name}`)
    }
    byModule.set(moduleId, new Set(names))
  }
  return {
    /** True when moduleId.method needs this PC's screen. Extension backends (ext:<id>) never do. */
    isDesktopOnly(moduleId, method) {
      return byModule.get(moduleId)?.has(method) ?? false
    },
    /** { [moduleId]: method[] } for every backend that has any. */
    list() {
      const out = {}
      for (const [id, names] of byModule) if (names.size) out[id] = [...names].sort()
      return out
    },
  }
}

module.exports = { SCREEN_API, screenApiMethods, desktopOnlyIndex }
