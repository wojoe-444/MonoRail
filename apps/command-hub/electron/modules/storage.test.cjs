// Tests for the Storage Manager backend, on a fictional folder tree in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const storage = require('./storage.cjs')
const { locations, measure, measureLocation, listDrives } = storage._internal

function write(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.alloc(bytes))
}

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-'))
  write(path.join(root, 'big', 'a.bin'), 3000)
  write(path.join(root, 'big', 'deep', 'b.bin'), 2000)
  write(path.join(root, 'small', 'c.bin'), 100)
  write(path.join(root, 'top.txt'), 10)
  // Outside the tree, reached only through a link: must not be counted.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-out-'))
  write(path.join(outside, 'huge.bin'), 50_000)
  fs.symlinkSync(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
  return root
}

test('measure adds up files and never follows links', async () => {
  const root = tree()
  const m = await measure(root, { byChild: true })
  assert.equal(m.bytes, 5110)
  assert.equal(m.files, 4)
  assert.equal(m.truncated, false)
  assert.deepEqual(
    m.children.map((c) => [c.name, c.bytes]),
    [
      ['big', 5000],
      ['small', 100],
      ['top.txt', 10],
    ],
  )
})

test('measure stops at the deadline and says so', async () => {
  const m = await measure(tree(), { deadline: Date.now() - 1 })
  assert.equal(m.truncated, true)
})

test('measureLocation reports a missing folder as not there', async () => {
  const r = await measureLocation({ id: 'x', group: 'dev', label: 'X', path: path.join(os.tmpdir(), 'no-such-folder-here'), kind: 'dir' })
  assert.equal(r.exists, false)
})

test('locations come from environment folders and never repeat an id', () => {
  const home = path.join(path.sep, 'home', 'fictional')
  const rootDir = path.join(home, 'AppData', 'Roaming', 'MonoHub')
  const env = { APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), SystemDrive: 'C:' }
  const list = locations({ home, env, platform: 'win32', rootDir })
  const ids = list.map((l) => l.id)
  assert.equal(new Set(ids).size, ids.length)
  // The data folder in use is marked keep; the other names are listed as older folders.
  assert.equal(list.find((l) => l.id === 'monorail-data').advice, 'keep')
  assert.ok(ids.includes('old-data-monorail'))
  assert.ok(!ids.includes('old-data-monohub'))
  for (const l of list) {
    assert.ok(['monorail', 'agents', 'dev', 'system'].includes(l.group))
    assert.ok(['safe', 'review', 'keep'].includes(l.advice))
  }
})

test('the backend only reads: no method writes, moves or deletes', () => {
  const src = fs.readFileSync(path.join(__dirname, 'storage.cjs'), 'utf8')
  const writes = src.match(/\b(?:fs|fsp)\.(?:rm|rmdir|unlink|rename|writeFile|appendFile|copyFile|cp|mkdir|open|truncate|symlink|link)\w*\(|trashItem/g)
  assert.equal(writes, null, `storage.cjs must not write: ${writes}`)
  assert.deepEqual(Object.keys(storage.methods).sort(), ['getDrives', 'getScan', 'openLocation', 'openStorageSettings', 'startScan'])
})

test('listDrives finds at least the system volume', async () => {
  const drives = await listDrives()
  assert.ok(drives.length >= 1)
  assert.ok(drives.some((d) => d.system))
  for (const d of drives) assert.ok(d.total > 0 && d.free >= 0 && d.free <= d.total)
})
