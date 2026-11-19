const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const sqlx = require('./sqlx.cjs')

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlx-test-'))
  const dataDir = path.join(base, 'data')
  const project = path.join(base, 'project')
  fs.mkdirSync(path.join(project, 'definitions', 'marts'), { recursive: true })
  fs.mkdirSync(path.join(project, 'node_modules', 'x'), { recursive: true })
  fs.writeFileSync(path.join(project, 'workflow_settings.yaml'), 'defaultProject: example\n')
  fs.writeFileSync(path.join(project, 'definitions', 'marts', 'orders.sqlx'), 'config { type: "table" }\nSELECT 1\n')
  fs.writeFileSync(path.join(project, 'definitions', 'notes.md'), '# not sqlx\n')
  fs.writeFileSync(path.join(project, 'node_modules', 'x', 'skip.sqlx'), 'SELECT 0\n')
  fs.writeFileSync(path.join(base, 'outside.sqlx'), 'SELECT 2\n')
  fs.mkdirSync(dataDir)
  const p = { id: 'p1', name: 'project', path: project }
  fs.writeFileSync(path.join(dataDir, 'projects.json'), JSON.stringify([p]))
  return { base, ctx: { dataDir, log() {} } }
}

test('lists .sqlx files, skipping node_modules and other files', async () => {
  const { ctx } = setup()
  const projects = await sqlx.methods.listProjects(ctx)
  assert.deepEqual(projects.map((p) => [p.id, p.core]), [['p1', 3]])
  assert.equal('path' in projects[0], false, 'the page never gets the folder path')
  const r = await sqlx.methods.listFiles(ctx, { projectId: 'p1' })
  assert.deepEqual(r.files.map((f) => f.path), ['definitions/marts/orders.sqlx'])
})

test('reads and saves a file, refusing a stale save', async () => {
  const { ctx } = setup()
  const file = await sqlx.methods.readFile(ctx, { projectId: 'p1', path: 'definitions/marts/orders.sqlx' })
  assert.match(file.text, /SELECT 1/)
  const saved = await sqlx.methods.saveFile(ctx, { projectId: 'p1', path: file.path, text: 'SELECT 3\n', mtimeMs: file.mtimeMs })
  const again = await sqlx.methods.readFile(ctx, { projectId: 'p1', path: file.path })
  assert.equal(again.text, 'SELECT 3\n')
  assert.equal(again.mtimeMs, saved.mtimeMs)
  await assert.rejects(sqlx.methods.saveFile(ctx, { projectId: 'p1', path: file.path, text: 'SELECT 4\n', mtimeMs: file.mtimeMs - 10_000 }), /changed on disk/)
  const dir = path.dirname(path.join(JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'projects.json'), 'utf8'))[0].path, file.path))
  assert.deepEqual(fs.readdirSync(dir), ['orders.sqlx'], 'no temporary files are left behind')
})

test('refuses paths outside the project and non-.sqlx files', async () => {
  const { ctx } = setup()
  await assert.rejects(sqlx.methods.readFile(ctx, { projectId: 'p1', path: '../outside.sqlx' }), /Invalid file name/)
  await assert.rejects(sqlx.methods.readFile(ctx, { projectId: 'p1', path: 'definitions/notes.md' }), /Only \.sqlx/)
  await assert.rejects(sqlx.methods.readFile(ctx, { projectId: 'p1', path: path.resolve('/x.sqlx') }), /Invalid file name/)
  await assert.rejects(sqlx.methods.readFile(ctx, { projectId: 'nope', path: 'a.sqlx' }), /no longer on the list/)
})

test('a damaged project list is reported, never overwritten', async () => {
  const { ctx } = setup()
  fs.writeFileSync(path.join(ctx.dataDir, 'projects.json'), '{"oops"')
  await assert.rejects(sqlx.methods.listProjects(ctx))
  await assert.rejects(sqlx.methods.removeProject(ctx, { id: 'p1' }))
  assert.equal(fs.readFileSync(path.join(ctx.dataDir, 'projects.json'), 'utf8'), '{"oops"')
})
