// Serves the built web app (dist/) over HTTP for a page that has no Electron
// window: Remote access (electron/remote/server.cjs) and the self-hosted mode
// (electron/host/server.cjs). index.html gets a script tag (the bridge client)
// put right after <head>; every other file is sent as it is. No Electron
// dependency, so tests run under Node.

const fs = require('node:fs/promises')
const path = require('node:path')
const { send } = require('./server.cjs')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Answer a GET for one path of the built app.
 * @param {import('node:http').ServerResponse} res
 * @param {object} o
 * @param {string} o.distDir the built web app
 * @param {string} o.urlPath the request's path (still URL-encoded)
 * @param {Record<string, string>} [o.headers] added to every file (security headers)
 * @param {string} [o.headTag] markup put right after index.html's <head>
 * @param {(res: import('node:http').ServerResponse) => void} [o.notBuilt] answers when there is no index.html
 */
async function serveDist(res, { distDir, urlPath, headers = {}, headTag = '', notBuilt }) {
  let rel
  try {
    rel = decodeURIComponent(urlPath)
  } catch {
    return send(res, 400, { ok: false, error: { message: 'Bad path' } })
  }
  if (rel === '/' || rel === '') rel = '/index.html'
  const root = path.resolve(distDir)
  const file = path.resolve(root, `.${rel}`)
  if (file !== root && !file.startsWith(root + path.sep)) return send(res, 404, { ok: false, error: { message: 'Not found' } })
  let data
  try {
    data = await fs.readFile(file)
  } catch {
    if (rel === '/index.html' && notBuilt) return notBuilt(res)
    return send(res, 404, { ok: false, error: { message: 'Not found' } })
  }
  if (rel === '/index.html') {
    const html = data.toString('utf8').replace(/<head>/i, `<head>${headTag}`)
    res.writeHead(200, { ...headers, 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
    return res.end(html)
  }
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    ...headers,
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': rel.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'no-cache',
  })
  res.end(data)
}

module.exports = { serveDist, TYPES }
