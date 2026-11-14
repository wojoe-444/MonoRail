const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { writeJsonAtomic } = require('../cache/files.cjs')

const PROMPTS_FILE = 'prompts.json'
const queues = new Map()
async function read(dir) {
  try {
    const data = JSON.parse(await fs.readFile(path.join(dir, PROMPTS_FILE), 'utf8'))
    if (data.version !== 1 || !Array.isArray(data.templates)) throw new Error('Invalid prompt template data')
    return data
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, templates: [] }
    throw error
  }
}
function save(ctx, args = {}) {
  const previous = queues.get(ctx.dataDir) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    const text = typeof args.text === 'string' ? args.text : ''
    if (!name || name.length > 120 || !text.trim() || text.length > 200000) throw new Error('Provide a name (up to 120 characters) and prompt text (up to 200,000 characters).')
    const data = await read(ctx.dataDir)
    let template = args.id && data.templates.find((t) => t.id === args.id)
    if (args.id && !template) throw new Error('Prompt template not found.')
    if (template && args.baseVersion !== template.versions.length) throw new Error('This template changed since you opened it. Reload before saving.')
    if (!template) { template = { id: randomUUID(), versions: [] }; data.templates.push(template) }
    template.versions.push({ version: template.versions.length + 1, name, text, savedAt: new Date().toISOString() })
    await writeJsonAtomic(path.join(ctx.dataDir, PROMPTS_FILE), data)
    return template
  })
  queues.set(ctx.dataDir, next)
  return next
}
module.exports = { id: 'prompt-templates', methods: { list: async (ctx) => (await read(ctx.dataDir)).templates, save } }
