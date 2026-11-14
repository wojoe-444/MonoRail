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
  const kind = args?.kind === 'folder' ? 'folder' : 'bookmark'
  const color = args?.color || ''
  if (!name || (kind === 'bookmark' && !target)) throw new Error('A name and destination are required.')
  if (name.length > 120 || description.length > 500 || target.length > 4096) throw new Error('A field is too long.')
  if (color && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('Invalid color.')
  if (kind === 'bookmark' && !path.isAbsolute(target)) {
    let url
    try { url = new URL(target) } catch { throw new Error('Enter an absolute local path or an http(s) URL.') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are supported.')
  }
  return { name, description, target: kind === 'folder' ? '' : target, kind, parentId: args?.parentId || null, color }
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
      const id = args?.id || randomUUID()
      if (args?.id) {
        const previous = items[find(items, id)]
        if ((previous.kind === 'folder') !== (values.kind === 'folder')) throw new Error('Cannot change the item type.')
      }
      let parentId = values.parentId
      const visited = new Set([id])
      while (parentId) {
        if (visited.has(parentId)) throw new Error('A folder cannot be placed inside itself.')
        visited.add(parentId)
        const parent = items[find(items, parentId)]
        if (parent.kind !== 'folder') throw new Error('Parent must be a folder.')
        parentId = parent.parentId
      }
      const item = { id, ...values }
      if (args?.id) items[find(items, id)] = item
      else items.push(item)
      write(ctx, items)
      return item
    },
    async remove(ctx, args) {
      const items = read(ctx)
      find(items, args?.id)
      const removed = new Set([args.id])
      let count
      do {
        count = removed.size
        for (const item of items) if (removed.has(item.parentId)) removed.add(item.id)
      } while (removed.size !== count)
      write(ctx, items.filter((item) => !removed.has(item.id)))
    },
    async open(ctx, args) {
      const items = read(ctx)
      const item = items[find(items, args?.id)]
      if (item.kind === 'folder') throw new Error('Folders cannot be opened as destinations.')
      const target = item.target
      fields({ name: 'Bookmark', target })
      const { shell } = require('electron')
      if (path.isAbsolute(target)) {
        const error = await shell.openPath(target)
        if (error) throw new Error(error)
      } else await shell.openExternal(target)
    },
  },
}
