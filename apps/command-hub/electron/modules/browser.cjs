// Tools > Browser (src/modules/browser): an in-app browser with its own
// sign-ins. The webview rules live in electron/browser-pane.cjs; this backend
// only clears that session or hands a page to the system browser.
// Keeps no files: the session lives in Electron's Partitions\ folder.

const { shell } = require('electron')

function webUrl(value) {
  let url
  try {
    url = new URL(String(value ?? ''))
  } catch {
    throw new Error('Not a web address.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https addresses can be opened.')
  return url.href
}

module.exports = {
  id: 'browser',
  desktopOnly: ['openExternal'],
  methods: {
    /** Sign out of every site in this profile's in-app browser and drop its cache. */
    async clearData() {
      await require('../browser-pane.cjs').clearBrowserData()
      return { ok: true }
    },
    /** Open an http(s) address in the PC's default browser. */
    async openExternal(_ctx, args) {
      await shell.openExternal(webUrl(args?.url))
      return { ok: true }
    },
  },
}
