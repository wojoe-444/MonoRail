#!/usr/bin/env node
// Packs a MonoRail extension into <id>-<version>.monorail.zip, ready to attach
// to a GitHub release or install from Settings > Extensions > From a .zip.
//
//   node monorail-sdk/pack.mjs [--out release] [--include extra/path ...]
//
// Run it from the extension's root (where monorail.json is). It includes
// monorail.json, README/LICENSE, the icons, the "ui" folder and the folder of
// "backend.main". Bundle backend dependencies into that folder (or pass
// --include node_modules/<pkg>): the backend can only read its own files.
// No dependencies: Node 22+ only.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const args = process.argv.slice(2)
const outDir = path.resolve(root, valueOf('--out') ?? 'release')
const extra = args.flatMap((a, i) => (args[i - 1] === '--include' ? [a] : []))

function valueOf(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function fail(msg) {
  console.error(`pack: ${msg}`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(path.join(root, 'monorail.json'), 'utf8'))
} catch (e) {
  fail(`could not read monorail.json in ${root}: ${e.message}`)
}
if (manifest.manifestVersion !== 1) fail('manifestVersion must be 1')
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(manifest.id ?? '')) fail('id must be kebab-case')
if (!/^\d+\.\d+\.\d+/.test(manifest.version ?? '')) fail('version must be semver, e.g. 1.0.0')
if (!manifest.engines?.monorail) fail('engines.monorail is required, e.g. "^1.0.0"')

// The SDK in monorail-sdk/ is the API version this extension was written
// against; engines.monorail should allow it, or MonoRail may refuse to load it.
try {
  const sdk = /export const SDK_VERSION = '([^']+)'/.exec(fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8'))?.[1]
  const range = String(manifest.engines.monorail).replace(/^[\^~>=\s]+/, '')
  const [sdkMajor, sdkMinor] = (sdk ?? '').split('.').map(Number)
  const [major, minor = 0] = range.split('.').map(Number)
  if (sdk && (major !== sdkMajor || minor > sdkMinor))
    console.warn(`pack: engines.monorail is "${manifest.engines.monorail}" but monorail-sdk is ${sdk}. Use "^${sdk}" unless you mean it.`)
} catch {
  /* an old SDK copy without SDK_VERSION: nothing to compare */
}

const uiDir = manifest.ui ?? 'ui'
const contributions = [...(manifest.contributes?.modules ?? []), ...(manifest.contributes?.apps ?? [])]
for (const c of contributions) {
  const file = path.join(root, uiDir, c.entry.split('#')[0])
  if (!fs.existsSync(file)) fail(`${c.id}: entry ${path.relative(root, file)} does not exist. Did you build the UI?`)
}
if (manifest.backend && !fs.existsSync(path.join(root, manifest.backend.main))) fail(`backend.main ${manifest.backend.main} does not exist`)

const include = new Set(['monorail.json', ...extra])
for (const f of ['README.md', 'LICENSE', 'LICENSE.md', 'CHANGELOG.md']) if (fs.existsSync(path.join(root, f))) include.add(f)
if (manifest.icon) include.add(manifest.icon)
for (const c of contributions) if (c.icon) include.add(c.icon)
if (contributions.length) include.add(uiDir)
if (manifest.backend) include.add(path.dirname(manifest.backend.main) === '.' ? manifest.backend.main : path.dirname(manifest.backend.main))

/** All files under the included paths, as forward-slash paths relative to root. */
function collect(rel, out) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) fail(`${rel} does not exist`)
  const stat = fs.statSync(full)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(full)) if (name !== '.DS_Store' && name !== 'Thumbs.db') collect(path.join(rel, name), out)
  } else out.add(rel.split(path.sep).join('/'))
}
const files = new Set()
for (const rel of include) collect(rel, files)

// --- minimal zip writer (deflate, no external deps) ---
const local = []
const central = []
let offset = 0
for (const name of [...files].sort()) {
  const data = fs.readFileSync(path.join(root, name))
  const deflated = zlib.deflateRawSync(data)
  const crc = zlib.crc32(data)
  const nameBuf = Buffer.from(name, 'utf8')
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4)
  head.writeUInt16LE(0x0800, 6) // UTF-8 names
  head.writeUInt16LE(8, 8) // deflate
  head.writeUInt16LE(0x21, 12) // date 1980-01-01 (fixed, so builds are reproducible)
  head.writeUInt32LE(crc, 14)
  head.writeUInt32LE(deflated.length, 18)
  head.writeUInt32LE(data.length, 22)
  head.writeUInt16LE(nameBuf.length, 26)
  local.push(head, nameBuf, deflated)
  const dir = Buffer.alloc(46)
  dir.writeUInt32LE(0x02014b50, 0)
  dir.writeUInt16LE(20, 4)
  dir.writeUInt16LE(20, 6)
  dir.writeUInt16LE(0x0800, 8)
  dir.writeUInt16LE(8, 10)
  dir.writeUInt16LE(0x21, 14)
  dir.writeUInt32LE(crc, 16)
  dir.writeUInt32LE(deflated.length, 20)
  dir.writeUInt32LE(data.length, 24)
  dir.writeUInt16LE(nameBuf.length, 28)
  dir.writeUInt32LE(offset, 42)
  central.push(dir, nameBuf)
  offset += head.length + nameBuf.length + deflated.length
}
const centralSize = central.reduce((n, b) => n + b.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(files.size, 8)
end.writeUInt16LE(files.size, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)

fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, `${manifest.id}-${manifest.version}.monorail.zip`)
fs.writeFileSync(out, Buffer.concat([...local, ...central, end]))
console.log(`packed ${files.size} files into ${path.relative(root, out)}`)
