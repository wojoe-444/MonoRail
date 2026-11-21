const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { guardNavigation, isMainWindowSender } = require('./renderer-security.cjs')

const packaged = 'file:///app/dist/desktop.html'
const dev = 'http://localhost:5173/'

test('only the current MonoRail main frame can invoke desktop backends', () => {
  const frame = { url: `${packaged}#/agents/chat` }
  const otherFrame = { url: frame.url }
  const sender = { mainFrame: frame }
  const win = { webContents: sender, isDestroyed: () => false }
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, win, packaged), true)
  assert.equal(isMainWindowSender({ sender, senderFrame: otherFrame }, win, packaged), false)
  assert.equal(isMainWindowSender({ sender, senderFrame: null }, win, packaged), false)
  assert.equal(isMainWindowSender({ sender: { mainFrame: frame }, senderFrame: frame }, win, packaged), false)
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, undefined, packaged), false)
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, { ...win, isDestroyed: () => true }, packaged), false)
  frame.url = 'file:///app/dist/elsewhere.html'
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, win, packaged), false)
  frame.url = `${dev}#/agents/chat`
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, win, dev), true)
  frame.url = `${dev}other`
  assert.equal(isMainWindowSender({ sender, senderFrame: frame }, win, dev), false)
})

test('navigation and redirects keep the desktop and extension frames within their boundaries', () => {
  const contents = new EventEmitter()
  const external = []
  contents.setWindowOpenHandler = (handler) => { contents.open = handler }
  guardNavigation(contents, packaged, (url) => external.push(url))
  const blocked = (name, url, from) => {
    let prevented = false
    contents.emit(name, {
      isMainFrame: from === undefined,
      url,
      frame: from ? { url: from } : null,
      preventDefault() { prevented = true },
    })
    return prevented
  }
  for (const event of ['will-frame-navigate', 'will-redirect']) {
    assert.equal(blocked(event, `${packaged}#/wiki`), false)
    assert.equal(blocked(event, 'https://example.com/'), true)
    assert.equal(blocked(event, 'file:///app/dist/index.html'), true)
    assert.equal(blocked(event, 'monorail-ext://one/two', 'monorail-ext://one/start'), false)
    assert.equal(blocked(event, 'monorail-ext://two/', 'monorail-ext://one/start'), true)
    assert.equal(blocked(event, 'https://example.com/', 'monorail-ext://one/start'), true)
    assert.equal(blocked(event, 'https://example.com/', 'about:blank'), false)
    assert.equal(blocked(event, 'about:srcdoc', 'about:blank'), false)
    assert.equal(blocked(event, packaged, 'https://example.com/'), true)
  }
  assert.equal(blocked('will-attach-webview', packaged), true)
  assert.deepEqual(contents.open({ url: 'https://example.com/' }), { action: 'deny' })
  assert.deepEqual(contents.open({ url: 'file:///app/dist/index.html' }), { action: 'deny' })
  assert.deepEqual(external, ['https://example.com/'])

  contents.removeAllListeners()
  guardNavigation(contents, dev, () => {})
  assert.equal(blocked('will-frame-navigate', dev), false)
  assert.equal(blocked('will-frame-navigate', dev, 'about:blank'), true)
  assert.equal(blocked('will-redirect', dev, 'https://example.com/'), true)
  assert.equal(blocked('will-redirect', 'https://example.com/'), true)
})
