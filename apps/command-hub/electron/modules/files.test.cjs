// Tests for files.cjs (Tools > Files): path and name checks, listing, preview,
// copy/move, search and folder size, all against a temp folder.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const files = require('./files.cjs')
const F = files._internal

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'files-'))
  fs.mkdirSync(path.join(root, 'docs', 'deep'), { recursive: true })
  fs.writeFileSync(path.join(root, 'readme.md'), '# Hello\n\nWorld\n')
  fs.writeFileSync(path.join(root, 'docs', 'plan.txt'), 'plan')
  fs.writeFileSync(path.join(root, 'docs', 'deep', 'plan-b.txt'), 'b')
  fs.writeFileSync(path.join(root, '.secret'), 'x')
  fs.writeFileSync(path.join(root, 'blob.bin'), Buffer.from([0, 1, 2, 0, 3]))
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  return root
}

describe('files: checks', () => {
  it('accepts only absolute paths', () => {
    assert.throws(() => F.absPath('relative/x'), /full path/)
    assert.throws(() => F.absPath(''), /valid location/)
    assert.throws(() => F.absPath('C:\\a\0b'), /valid location/)
    assert.throws(() => F.absPath(42), /valid location/)
    const p = path.join(os.tmpdir(), 'a', '..', 'b')
    assert.equal(F.absPath(p), path.join(os.tmpdir(), 'b'))
  })

  it('refuses names Windows would refuse', () => {
    for (const bad of ['', '  ', 'a/b', 'a\\b', 'a:b', 'what?', 'end.', 'CON', 'nul.txt', 'lpt1', '..', 'x'.repeat(256)]) {
      assert.throws(() => F.checkName(bad), undefined, bad)
    }
    assert.equal(F.checkName('  Report 2026.docx '), 'Report 2026.docx')
    assert.equal(F.checkName('.gitignore'), '.gitignore')
  })

  it('reads extensions and hidden names', () => {
    assert.equal(F.extOf('a.TAR.GZ'), 'gz')
    assert.equal(F.extOf('.env'), 'env')
    assert.equal(F.extOf('Dockerfile'), 'dockerfile')
    assert.equal(F.extOf('noext'), '')
    assert.ok(F.isHidden('.git', '/x'))
    assert.ok(F.isHidden('desktop.ini', '/x'))
    assert.ok(F.isHidden('NTUSER.DAT', '/x'))
    assert.ok(!F.isHidden('Templates', '/somewhere/else', '/home/me'))
    assert.ok(F.isHidden('AppData', '/home/me', '/home/me'))
  })

  it('matches wildcards and plain words', () => {
    assert.ok(F.wildcard('plan')('My-Plan.txt'))
    assert.ok(F.wildcard('*.txt')('plan.txt'))
    assert.ok(!F.wildcard('*.txt')('plan.txt.bak'))
    assert.ok(F.wildcard('pl?n*')('plan-b.txt'))
  })
})

describe('files: reading', () => {
  it('lists a folder, hiding dotfiles unless asked', async () => {
    const root = tree()
    const l = await F.list(root)
    const names = l.entries.map((e) => e.name).sort()
    assert.deepEqual(names, ['blob.bin', 'docs', 'dot.png', 'readme.md'])
    assert.equal(l.hiddenCount, 1)
    assert.equal(l.parent, path.dirname(root))
    const docs = l.entries.find((e) => e.name === 'docs')
    assert.equal(docs.kind, 'dir')
    assert.equal(docs.ext, '')
    const md = l.entries.find((e) => e.name === 'readme.md')
    assert.equal(md.kind, 'file')
    assert.equal(md.ext, 'md')
    assert.ok(md.size > 0)
    const all = await F.list(root, { showHidden: true })
    assert.equal(all.entries.length, 5)
    await assert.rejects(F.list(path.join(root, 'readme.md')), /not a folder/)
    await assert.rejects(F.list(path.join(root, 'missing')), /no longer there/)
  })

  it('finds the git repository and branch from .git/HEAD', async () => {
    const root = tree()
    fs.mkdirSync(path.join(root, '.git'))
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/feature/x\n')
    const g = await F.gitInfo(path.join(root, 'docs', 'deep'))
    assert.deepEqual(g, { root, branch: 'feature/x', detached: false })
    const l = await F.list(path.join(root, 'docs'))
    assert.equal(l.git.branch, 'feature/x')
  })

  it('previews text, images, binaries and folders', async () => {
    const root = tree()
    const t = await F.preview(path.join(root, 'readme.md'))
    assert.equal(t.kind, 'text')
    assert.match(t.text, /# Hello/)
    assert.equal(t.truncated, false)
    const img = await F.preview(path.join(root, 'dot.png'))
    assert.equal(img.kind, 'image')
    assert.match(img.dataUrl, /^data:image\/png;base64,/)
    const bin = await F.preview(path.join(root, 'blob.bin'))
    assert.equal(bin.kind, 'binary')
    const d = await F.preview(path.join(root, 'docs'))
    assert.equal(d.kind, 'dir')
    assert.equal(d.items, 2)
    assert.equal(d.folders, 1)
  })

  it('cuts long text at the preview limit', async () => {
    const root = tree()
    const big = path.join(root, 'big.log')
    fs.writeFileSync(big, 'x'.repeat(F.LIMITS.PREVIEW_TEXT_BYTES + 10))
    const t = await F.preview(big)
    assert.equal(t.truncated, true)
    assert.equal(t.text.length, F.LIMITS.PREVIEW_TEXT_BYTES)
  })

  it('searches names below a folder', async () => {
    const root = tree()
    const r = await F.search({ dir: root, query: 'plan' })
    assert.deepEqual(r.results.map((e) => e.name).sort(), ['plan-b.txt', 'plan.txt'])
    assert.equal(r.truncated, false)
    const none = await F.search({ dir: root, query: '   ' })
    assert.equal(none.results.length, 0)
    const hidden = await F.search({ dir: root, query: 'secret' })
    assert.equal(hidden.results.length, 0)
    const shown = await F.search({ dir: root, query: 'secret', showHidden: true })
    assert.equal(shown.results.length, 1)
  })

  it('adds up a folder', async () => {
    const root = tree()
    const s = await F.folderSize(path.join(root, 'docs'))
    assert.equal(s.files, 2)
    assert.equal(s.dirs, 1)
    assert.equal(s.bytes, 5)
    assert.equal(s.truncated, false)
  })

  it('stats a list of paths and drops missing ones', async () => {
    const root = tree()
    const r = await F.statMany([path.join(root, 'readme.md'), path.join(root, 'gone.txt'), 'relative', path.parse(root).root])
    assert.deepEqual(r.map((e) => e.name), ['readme.md'])
  })

  it('lists places that exist', async () => {
    const root = tree()
    const p = await F.places({ home: root, env: {} })
    assert.equal(p.home, root)
    assert.deepEqual(p.places.map((x) => x.id), ['home'])
    assert.ok(Array.isArray(p.drives))
  })
})

describe('files: writing', () => {
  it('creates folders and files without overwriting', async () => {
    const root = tree()
    const m = files.methods
    const f = await m.createFolder({}, { dir: root, name: 'New folder' })
    assert.ok(fs.statSync(f.path).isDirectory())
    await assert.rejects(m.createFolder({}, { dir: root, name: 'New folder' }), /already there/)
    await assert.rejects(m.createFolder({}, { dir: root, name: 'a/b' }), /cannot contain/)
    const n = await m.createFile({}, { dir: root, name: 'todo.txt' })
    assert.equal(fs.readFileSync(n.path, 'utf8'), '')
    await assert.rejects(m.createFile({}, { dir: root, name: 'readme.md' }), /already there/)
    assert.match(fs.readFileSync(path.join(root, 'readme.md'), 'utf8'), /Hello/)
  })

  it('renames, refusing to replace another item', async () => {
    const root = tree()
    const m = files.methods
    const r = await m.rename({}, { path: path.join(root, 'readme.md'), name: 'README.md' })
    assert.equal(path.basename(r.path), 'README.md')
    await assert.rejects(m.rename({}, { path: path.join(root, 'blob.bin'), name: 'docs' }), /already there/)
    assert.ok(fs.existsSync(path.join(root, 'blob.bin')))
  })

  it('copies with a fresh name and moves', async () => {
    const root = tree()
    const src = path.join(root, 'readme.md')
    const c1 = await F.paste({ sources: [src], dir: root, mode: 'copy' })
    assert.deepEqual(c1.done.map((p) => path.basename(p)), ['readme (2).md'])
    const c2 = await F.paste({ sources: [path.join(root, 'docs')], dir: path.join(root, 'docs', 'deep'), mode: 'copy' })
    assert.equal(c2.done.length, 0)
    assert.match(c2.failed[0].error, /inside itself/)
    const mv = await F.paste({ sources: [src, path.join(root, 'missing.txt')], dir: path.join(root, 'docs'), mode: 'move' })
    assert.deepEqual(mv.done, [path.join(root, 'docs', 'readme.md')])
    assert.equal(mv.failed.length, 1)
    assert.ok(!fs.existsSync(src))
    const dirCopy = await F.paste({ sources: [path.join(root, 'docs')], dir: root, mode: 'copy' })
    assert.ok(fs.existsSync(path.join(dirCopy.done[0], 'deep', 'plan-b.txt')))
    await assert.rejects(F.paste({ sources: [src], dir: root, mode: 'delete' }), /Unknown paste mode/)
  })

  it('lists the screen methods as desktop only', () => {
    assert.deepEqual([...files.desktopOnly].sort(), ['open', 'reveal', 'trash'])
  })
})
