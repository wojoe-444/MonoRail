// The Browser page's <webview> tabs (Tools > Browser, src/modules/browser).
//
// A webview is a full web page with its own process, so the main process sets
// every rule here and the renderer cannot loosen them:
// - Partition: always the active profile's own browser session
//   (`persist:browser`, `persist:browser-<id>` for later profiles, and an
//   in-memory session for Developer Mode's New User profile, so it starts
//   blank). Sign-ins persist in Electron's own `Partitions\` folder under the
//   data folder. Chrome's own cookies are never read: Chrome locks them to
//   itself (app-bound encryption) and copying them would be cookie theft.
// - No preload, no Node, context isolation, sandbox; http(s) pages only.
// - The session's user agent drops the Electron and app tokens, so sites
//   (Google sign-in above all) see a plain Chrome of the same version.
// - Permissions: only full screen and clipboard writes; everything else
//   (camera, microphone, location, notifications, ...) is denied.
// - New tabs (links with target=_blank, middle click) go to the page over the
//   'browser:open-tab' push channel; real popups (window.open with a size,
//   used by "Sign in with ..." flows) open as a small sandboxed window in the
//   same session so the sign-in can hand its result back.
//
// Docs: docs/guide/workspace/browser.md.

const { app, session } = require('electron')
const { profiles, NEW_USER_ID, DEFAULT_PROFILE_ID } = require('./profiles/index.cjs')

const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])

/** The browser session partition for a profile id. */
function partitionFor(profileId) {
  if (profileId === NEW_USER_ID) return 'browser-new-user' // in memory: blank every start
  return profileId === DEFAULT_PROFILE_ID ? 'persist:browser' : `persist:browser-${profileId}`
}

function activePartition() {
  let id = DEFAULT_PROFILE_ID
  try {
    id = profiles().active().id
  } catch {
    // Profiles unreadable: the default profile's session.
  }
  return partitionFor(id)
}

/** A user agent without the Electron and app tokens. */
function plainUserAgent(ua) {
  const names = [app.getName(), 'MonoRail', 'command-hub', 'Electron'].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return ua.replace(new RegExp(`\\s(?:${names.join('|')})/\\S+`, 'gi'), '')
}

function isWebUrl(url) {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const prepared = new WeakSet()
/** The browser session for a partition, set up once. */
function browserSession(partition) {
  const ses = session.fromPartition(partition)
  if (prepared.has(ses)) return ses
  prepared.add(ses)
  ses.setUserAgent(plainUserAgent(ses.getUserAgent()))
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  return ses
}

/** Keep a browser page's web contents on http(s) and route its new windows. */
function guardContents(contents, win) {
  const block = (event, url) => {
    if (!isWebUrl(url) && url !== 'about:blank') event.preventDefault()
  }
  contents.on('will-navigate', block)
  contents.on('will-redirect', block)
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (!isWebUrl(url) && url !== 'about:blank') return { action: 'deny' }
    if (disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          parent: win,
          webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false },
        },
      }
    }
    if (isWebUrl(url) && !win.isDestroyed()) win.webContents.send('browser:open-tab', { url })
    return { action: 'deny' }
  })
  contents.on('did-create-window', (popup) => guardContents(popup.webContents, win))
}

/** Apply the rules above to every webview the window attaches. */
function attachBrowserPane(win) {
  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isWebUrl(params.src) && params.src !== 'about:blank') {
      event.preventDefault()
      return
    }
    delete webPreferences.preload
    delete webPreferences.preloadURL
    Object.assign(webPreferences, {
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    })
    const partition = activePartition()
    browserSession(partition)
    params.partition = partition
    webPreferences.partition = partition
  })
  win.webContents.on('did-attach-webview', (_event, contents) => guardContents(contents, win))
}

/** Clear the active profile's browser session: sign-ins, cookies, cache, site data. */
async function clearBrowserData() {
  const ses = browserSession(activePartition())
  await ses.clearStorageData()
  await ses.clearCache()
  await ses.clearAuthCache()
}

module.exports = { attachBrowserPane, clearBrowserData, partitionFor, plainUserAgent }
