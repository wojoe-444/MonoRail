/**
 * Draws the picture-theme backdrops: every module in scripts/backdrops/
 * (except lib.mjs and helper files starting with _) becomes src/assets/backdrops/<id>.svg, plus <id>-dark.svg
 * when the drawing has its own night version. Run `npm run backdrops` after
 * adding or editing a drawing, and commit the SVGs.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { svg } from './backdrops/lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../src/assets/backdrops')
mkdirSync(out, { recursive: true })

const write = (name, body) => {
  const file = svg(body)
  writeFileSync(join(out, name), file)
  console.log(`${name.padEnd(24)} ${(Buffer.byteLength(file) / 1024).toFixed(1)} KB`)
}

const files = readdirSync(join(here, 'backdrops')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs' && !f.startsWith('_'))
for (const f of files.sort()) {
  const { default: art } = await import(pathToFileURL(join(here, 'backdrops', f)).href)
  write(`${art.id}.svg`, art.draw(false))
  if (art.dark) write(`${art.id}-dark.svg`, art.draw(true))
}
