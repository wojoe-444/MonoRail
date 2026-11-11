#!/usr/bin/env node
// Regenerates the SDK's generated files and the starter extension's copy of the SDK.
//
//   node packages/extension-sdk/sync.mjs          write
//   node packages/extension-sdk/sync.mjs --check  fail if anything is out of date (CI)
//
// theme.css is MonoRail's design tokens, cut from apps/command-hub/src/index.css,
// so extension pages can use the same Tailwind colors, radius and elevation.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const check = process.argv.includes('--check')

/** Files every extension carries in its monorail-sdk/ folder. */
export const SDK_FILES = ['client.js', 'client.d.ts', 'backend.d.ts', 'theme.css', 'pack.mjs', 'README.md']

export function buildTheme(indexCss) {
  const start = indexCss.indexOf('@custom-variant dark')
  const themeStart = indexCss.indexOf('@theme inline')
  const end = indexCss.indexOf('\n}\n', themeStart)
  if (start < 0 || themeStart < 0 || end < 0) throw new Error('index.css layout changed; update sync.mjs')
  return [
    '/*',
    ' * MonoRail design tokens for extension pages. Generated from',
    ' * apps/command-hub/src/index.css by packages/extension-sdk/sync.mjs: do not edit.',
    ' *',
    ' * Use with Tailwind CSS v4:',
    ' *   @import "tailwindcss";',
    ' *   @import "../monorail-sdk/theme.css";',
    ' * The SDK client adds the "dark" class to <html> when MonoRail is dark.',
    ' */',
    indexCss.slice(start, end + 2).trimEnd(),
    '',
  ].join('\n')
}

const targets = new Map()
targets.set(path.join(here, 'theme.css'), buildTheme(fs.readFileSync(path.join(repo, 'apps/command-hub/src/index.css'), 'utf8')))
for (const f of SDK_FILES) {
  const content = f === 'theme.css' ? targets.get(path.join(here, 'theme.css')) : fs.readFileSync(path.join(here, f), 'utf8')
  targets.set(path.join(repo, 'extensions/hello-monorail/monorail-sdk', f), content)
}

let stale = 0
for (const [file, content] of targets) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined
  if (current === content) continue
  stale++
  if (check) console.error(`out of date: ${path.relative(repo, file)}`)
  else {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
    console.log(`wrote ${path.relative(repo, file)}`)
  }
}
if (check && stale) {
  console.error('Run: node packages/extension-sdk/sync.mjs')
  process.exit(1)
}
