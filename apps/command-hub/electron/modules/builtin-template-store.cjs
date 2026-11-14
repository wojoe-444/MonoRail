// User edits to shipped templates live in the active profile's Chat folder.
const fs = require('node:fs')
const path = require('node:path')
const { writeJsonAtomic } = require('../cache/files.cjs')
const NAMES = new Set(['coordinator', 'storage-detective', 'pr-reviewer'])
function file(dir, name) {
  if (!dir || !NAMES.has(name)) throw new Error('Unknown built-in template.')
  return path.join(dir, 'template-overrides', `${name}.json`)
}
function read(dir, name) {
  const f = file(dir, name)
  try {
    const raw = fs.readFileSync(f, 'utf8')
    const value = JSON.parse(raw)
    if (!value || typeof value.prompt !== 'string' || !value.prompt.trim()) throw new Error('Invalid template override')
    return { value, raw, updatedAt: fs.statSync(f).mtimeMs }
  } catch (e) {
    if (e.code === 'ENOENT') return undefined
    throw new Error(`Could not read the ${name} template override; it was not changed.`)
  }
}
async function write(dir, name, value, updatedAt) {
  const previous = read(dir, name)
  if (typeof updatedAt === 'number' && Math.abs((previous?.updatedAt ?? 0) - updatedAt) > 1) throw new Error('This template changed since it was opened. Reopen it and try again.')
  if (previous) await writeJsonAtomic(file(dir, `${name}`) + '.backup', previous.value)
  await writeJsonAtomic(file(dir, name), value)
}
async function reset(dir, name, updatedAt) {
  const previous = read(dir, name)
  if (typeof updatedAt === 'number' && Math.abs((previous?.updatedAt ?? 0) - updatedAt) > 1) throw new Error('This template changed since it was opened. Reopen it and try again.')
  if (previous) { await writeJsonAtomic(file(dir, name) + '.backup', previous.value); await fs.promises.unlink(file(dir, name)) }
}
module.exports = { read, write, reset }
