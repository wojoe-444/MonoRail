// Getting extension files onto disk: from a folder, a .zip, or a GitHub release.
//
// Every install is staged first: files land in <extensionsRoot>/.staging/<token>,
// the manifest is validated, and only after the user approves the permissions
// does manager.cjs move the folder into place. Nothing from a staged package
// runs before that.

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { unzipSync } = require('fflate')

const { MANIFEST_FILE, ManifestError, validateManifest } = require('./manifest.cjs')

const MAX_ZIP_BYTES = 200 * 1024 * 1024
const MAX_UNPACKED_BYTES = 600 * 1024 * 1024
const MAX_FILES = 30000
const SKIP_DIRS = new Set(['.git'])

/** Read and validate monorail.json in `dir`. */
function readManifest(dir) {
  const file = path.join(dir, MANIFEST_FILE)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    throw new ManifestError(`No ${MANIFEST_FILE} found in ${dir}`)
  }
  let raw
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    throw new ManifestError(`${MANIFEST_FILE} is not valid JSON: ${e.message}`)
  }
  return validateManifest(raw)
}

function newStagingDir(stagingRoot) {
  const token = crypto.randomBytes(12).toString('hex')
  const dir = path.join(stagingRoot, token)
  fs.mkdirSync(dir, { recursive: true })
  return { token, dir }
}

/** A package may have monorail.json at its root or inside one top-level folder. */
function findPackageRoot(dir) {
  if (fs.existsSync(path.join(dir, MANIFEST_FILE))) return dir
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== '__MACOSX')
  if (entries.length === 1 && entries[0].isDirectory()) {
    const inner = path.join(dir, entries[0].name)
    if (fs.existsSync(path.join(inner, MANIFEST_FILE))) return inner
  }
  throw new ManifestError(`The package has no ${MANIFEST_FILE} at its top level`)
}

function copyDir(from, to) {
  fs.cpSync(from, to, {
    recursive: true,
    dereference: false,
    filter: (src) => !SKIP_DIRS.has(path.basename(src)),
  })
}

/** Stage a copy of a folder. */
function stageFolder(stagingRoot, dir) {
  const manifest = readManifest(dir) // fail before copying anything
  const { token, dir: target } = newStagingDir(stagingRoot)
  copyDir(dir, target)
  return { token, root: target, manifest }
}

/**
 * Unpack zip bytes into `target`, refusing entries that would land outside
 * it (zip-slip), absolute paths, and archives that unpack to absurd sizes.
 */
function unpackZip(bytes, target) {
  if (bytes.length > MAX_ZIP_BYTES) throw new Error(`The .zip is larger than ${MAX_ZIP_BYTES / 1024 / 1024} MB`)
  let count = 0
  let total = 0
  const files = unzipSync(bytes, {
    filter: (f) => {
      count++
      total += f.originalSize
      if (count > MAX_FILES) throw new Error(`The .zip has more than ${MAX_FILES} files`)
      if (total > MAX_UNPACKED_BYTES) throw new Error(`The .zip unpacks to more than ${MAX_UNPACKED_BYTES / 1024 / 1024} MB`)
      return true
    },
  })
  const base = path.resolve(target)
  for (const [name, data] of Object.entries(files)) {
    const clean = name.replace(/\\/g, '/')
    if (clean.startsWith('/') || /^[A-Za-z]:/.test(clean) || clean.split('/').includes('..'))
      throw new Error(`The .zip contains an unsafe path: ${name}`)
    const dest = path.resolve(base, clean)
    if (dest !== base && !dest.startsWith(base + path.sep)) throw new Error(`The .zip contains an unsafe path: ${name}`)
    if (clean.endsWith('/')) {
      fs.mkdirSync(dest, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, data)
  }
}

function stageZipBytes(stagingRoot, bytes) {
  const { token, dir } = newStagingDir(stagingRoot)
  try {
    unpackZip(bytes, dir)
    const root = findPackageRoot(dir)
    return { token, root, manifest: readManifest(root) }
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw err
  }
}

function stageZip(stagingRoot, zipPath) {
  return stageZipBytes(stagingRoot, new Uint8Array(fs.readFileSync(zipPath)))
}

/** "owner/name", "https://github.com/owner/name" or "github.com/owner/name/..." -> "owner/name". */
function parseRepo(input) {
  const s = String(input ?? '').trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '')
  const m = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/.exec(s)
  if (!m) throw new Error('Enter a GitHub repository as owner/name, e.g. octo-org/my-extension')
  return `${m[1]}/${m[2]}`
}

const GITHUB_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'MonoRail-extensions' }

/** The newest release of `repo` and its extension package asset. */
async function latestRelease(repo, fetchImpl) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers: GITHUB_HEADERS })
  if (res.status === 404) throw new Error(`${repo} has no published releases (or is private)`)
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${repo}`)
  const rel = await res.json()
  const assets = Array.isArray(rel.assets) ? rel.assets : []
  const asset = assets.find((a) => /\.monorail\.zip$/i.test(a.name)) ?? assets.find((a) => /\.zip$/i.test(a.name))
  if (!asset) throw new Error(`The latest release of ${repo} has no .monorail.zip file attached`)
  if (asset.size > MAX_ZIP_BYTES) throw new Error(`${asset.name} is larger than ${MAX_ZIP_BYTES / 1024 / 1024} MB`)
  return {
    tag: rel.tag_name,
    version: String(rel.tag_name ?? '').replace(/^v/, ''),
    publishedAt: rel.published_at,
    notes: typeof rel.body === 'string' ? rel.body.slice(0, 4000) : '',
    asset: { name: asset.name, url: asset.browser_download_url, size: asset.size },
  }
}

async function stageGitHub(stagingRoot, repoInput, fetchImpl) {
  const repo = parseRepo(repoInput)
  const release = await latestRelease(repo, fetchImpl)
  const res = await fetchImpl(release.asset.url, { headers: { 'User-Agent': GITHUB_HEADERS['User-Agent'] } })
  if (!res.ok) throw new Error(`Downloading ${release.asset.name} failed (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const staged = stageZipBytes(stagingRoot, bytes)
  if (staged.manifest.repository && staged.manifest.repository.toLowerCase() !== repo.toLowerCase()) {
    fs.rmSync(path.join(stagingRoot, staged.token), { recursive: true, force: true })
    throw new ManifestError(`The package says it comes from ${staged.manifest.repository}, not ${repo}`)
  }
  return { ...staged, repo, release }
}

module.exports = {
  readManifest,
  stageFolder,
  stageZip,
  stageZipBytes,
  stageGitHub,
  unpackZip,
  parseRepo,
  latestRelease,
  copyDir,
}
