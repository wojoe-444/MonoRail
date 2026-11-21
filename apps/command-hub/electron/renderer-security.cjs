// Trust the app document Electron started with. Hashes are in-app routes.
function isRendererDocument(url, rendererUrl) {
  const target = URL.parse(url)
  if (!target) return false
  target.hash = ''
  const expected = new URL(rendererUrl)
  expected.hash = ''
  return target.href === expected.href
}

function isMainWindowSender(event, win, rendererUrl) {
  if (!win || win.isDestroyed() || event.sender !== win.webContents) return false
  const frame = event.senderFrame
  return !!frame && frame === win.webContents.mainFrame && isRendererDocument(frame.url, rendererUrl)
}

function isWebUrl(url) {
  return url?.protocol === 'https:' || url?.protocol === 'http:'
}

function guardNavigation(contents, rendererUrl, openExternal) {
  const renderer = new URL(rendererUrl)
  const guard = (event) => {
    if (event.isMainFrame) {
      if (!isRendererDocument(event.url, renderer)) event.preventDefault()
      return
    }
    const from = URL.parse(event.frame?.url)
    const to = URL.parse(event.url)
    if (from?.protocol === 'monorail-ext:') {
      if (to?.protocol !== from.protocol || to.host !== from.host) event.preventDefault()
      return
    }
    // Chat previews may use the web, but must stay cross-origin from Vite.
    // The packaged app also keeps local files out of child frames.
    if (isWebUrl(to) && to.origin !== renderer.origin) return
    if (to?.protocol === 'monorail-ext:' || to?.href === 'about:srcdoc' || to?.href === 'about:blank') return
    event.preventDefault()
  }

  contents.on('will-frame-navigate', guard)
  contents.on('will-redirect', guard)
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    const target = URL.parse(url)
    if (isWebUrl(target)) openExternal(target.href)
    return { action: 'deny' }
  })
}

module.exports = { guardNavigation, isMainWindowSender }
