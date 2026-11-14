const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const DATA_FILE = 'bookmarks.json'
function read(ctx) {
  let raw
  try { raw = fs.readFileSync(path.join(ctx.dataDir, DATA_FILE), 'utf8') } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Bookmarks data is invalid.')
  return data
}
function write(ctx, items) {
  const file = path.join(ctx.dataDir, DATA_FILE)
  const temp = `${file}.${randomUUID()}.tmp`
  try { fs.writeFileSync(temp, JSON.stringify(items, null, 2), 'utf8'); fs.renameSync(temp, file) }
  finally { try { fs.unlinkSync(temp) } catch { /* Already renamed, or cleanup failed. */ } }
}
function fields(args) {
  const name = typeof args?.name === 'string' ? args.name.trim() : ''
  const description = typeof args?.description === 'string' ? args.description.trim() : ''
  const target = typeof args?.target === 'string' ? args.target.trim() : ''
  if (!name || !target) throw new Error('A name and destination are required.')
  if (name.length > 120 || description.length > 500 || target.length > 4096) throw new Error('A field is too long.')
  if (!path.isAbsolute(target)) {
    let url
    try { url = new URL(target) } catch { throw new Error('Enter an absolute local path or an http(s) URL.') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are supported.')
  }
  return { name, description, target }
}
function find(items, id) {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('Bookmark not found.')
  return index
}
module.exports = {
  id: 'bookmarks',
  desktopOnly: ['open'],
  methods: {
    async list(ctx) { return read(ctx) },
    async save(ctx, args) {
      const values = fields(args)
      const items = read(ctx)
      const item = { id: args?.id || randomUUID(), ...values }
      if (args?.id) items[find(items, args.id)] = item
      else items.push(item)
      write(ctx, items)
      return item
    },
    async remove(ctx, args) {
      const items = read(ctx)
      items.splice(find(items, args?.id), 1)
      write(ctx, items)
    },
    async open(ctx, args) {
      const items = read(ctx)
      const target = items[find(items, args?.id)].target
      fields({ name: 'Bookmark', target })
      const { shell } = require('electron')
      if (path.isAbsolute(target)) {
        const error = await shell.openPath(target)
        if (error) throw new Error(error)
      } else await shell.openExternal(target)
    },
  },
}
