// Hello MonoRail backend. Runs in its own sandboxed process: it can read its
// own files and read/write ctx.dataDir, plus folders the user picks (because
// monorail.json asks for "filesystem": { "pickFolders": true }). Nothing else.

const fs = require('node:fs')
const path = require('node:path')

/** @typedef {{ id: string, text: string, createdAt: string }} Note */

function notesFile(ctx) {
  return path.join(ctx.dataDir, 'notes.json')
}

/** @returns {Note[]} */
function readNotes(ctx) {
  try {
    return JSON.parse(fs.readFileSync(notesFile(ctx), 'utf8'))
  } catch {
    return []
  }
}

function writeNotes(ctx, notes) {
  fs.writeFileSync(notesFile(ctx), JSON.stringify(notes, null, 2))
  ctx.emit('notes', notes) // every open page (module and app) refreshes
  return notes
}

let timer
const startedAt = Date.now()

/** @type {import('../monorail-sdk/backend').Backend} */
module.exports = {
  // Runs before start() when the version that last used ctx.dataDir differs
  // from this one (fromVersion is null on a fresh install). Convert old data
  // formats here; throwing keeps the backend from starting.
  async migrate(ctx, fromVersion) {
    if (fromVersion === null) return // nothing to convert yet
    ctx.log(`Data folder was last used by ${fromVersion}; notes.json has not changed since 1.0.0`)
  },

  async start(ctx) {
    ctx.log(`Hello MonoRail ${ctx.extension.version} started`)
    // A heartbeat, to show events pushed from the backend to the page.
    timer = setInterval(() => ctx.emit('heartbeat', { uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) }), 1000)
  },

  async stop() {
    clearInterval(timer)
  },

  methods: {
    async getInfo(ctx) {
      return {
        version: ctx.extension.version,
        apiVersion: ctx.apiVersion,
        notes: readNotes(ctx).length,
        folders: ctx.folders,
      }
    },

    async listNotes(ctx) {
      return readNotes(ctx)
    },

    async addNote(ctx, { text }) {
      const clean = String(text ?? '').trim().slice(0, 500)
      // The page receives this as error.code === 'EMPTY_NOTE'.
      if (!clean) ctx.fail('EMPTY_NOTE', 'A note needs some text')
      const note = { id: Date.now().toString(36), text: clean, createdAt: new Date().toISOString() }
      return writeNotes(ctx, [note, ...readNotes(ctx)])
    },

    async deleteNote(ctx, { id }) {
      return writeNotes(ctx, readNotes(ctx).filter((n) => n.id !== id))
    },

    /** The first entries of a folder the user granted. Any other path is refused by the sandbox. */
    async listFolder(ctx, { folder }) {
      if (!ctx.folders.some((f) => f.path === folder)) ctx.fail('NO_FOLDER', 'Pick the folder first')
      return fs
        .readdirSync(folder, { withFileTypes: true })
        .slice(0, 25)
        .map((e) => ({ name: e.name, dir: e.isDirectory() }))
    },
  },
}
