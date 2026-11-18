// An opt-in connection to an existing local SQLite database. Checks are read-only.
const path = require('node:path')
const fs = require('node:fs/promises')

function validate({ values }) {
  const file = String(values?.file ?? '').trim()
  if (!file || !path.isAbsolute(file)) throw new Error('Enter the full path to an existing SQLite database file.')
}

async function status(conn) {
  const file = String(conn?.values?.file ?? '').trim()
  try {
    validate({ values: { file } })
    const stat = await fs.stat(file)
    if (!stat.isFile()) throw new Error('The path is not a file.')
    // Do not create the file, and do not load SQLite or touch the file until opted in.
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(file, { readOnly: true, timeout: 2000 })
    try {
      const tables = db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get().n
      return { state: 'ok', summary: `Database is readable (${tables} ${tables === 1 ? 'table' : 'tables'}).`, details: [{ label: 'Database', value: path.basename(file), ok: true }, { label: 'Access', value: 'Read-only check', ok: true }] }
    } finally { db.close() }
  } catch (err) {
    return { state: 'error', summary: 'Could not read the SQLite database.', hint: 'Check that the file exists, is a readable SQLite database, and is not locked.', details: [{ label: 'Error', value: String(err?.message ?? err), ok: false }] }
  }
}

module.exports = {
  kind: 'sqlite', title: 'SQLite', icon: 'database',
  // A data source: an OpenMetadata databaseService on the Services page, with local ingestion pipelines.
  service: { category: 'databaseService', serviceType: 'SQLite' },
  description: 'Connect an existing local SQLite database and check that MonoRail can read it.',
  fields: [{ key: 'file', label: 'Database file', type: 'text', placeholder: 'C:\\Users\\you\\Documents\\data.sqlite3', help: 'Full path to an existing SQLite database. Checks open it read-only.' }],
  actions: [], validate, status,
  credentials: (conn) => ({ file: String(conn?.values?.file ?? '').trim() }),
}
