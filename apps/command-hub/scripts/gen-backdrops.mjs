/**
 * Draws the picture-theme backdrops. Every module in scripts/backdrops/
 * (except lib.mjs and helper files starting with _) is drawn as an SVG, then
 * rendered by Chrome into three WebP files in src/assets/backdrops/:
 *
 *   <id>.webp        the picture, 2560x1600, behind the whole app
 *   <id>-blur.webp   a small, blurred and saturated copy that the frosted
 *                    glass shows, so the app never blurs anything live
 *   <id>-thumb.webp  a small sharp copy for the swatch in Settings
 *
 * plus the same three with `-dark` when the drawing has its own night
 * version. Rendering once here keeps the app fast: the browser never re-runs
 * the drawings' SVG filters (on load, resize or zoom) and never runs a
 * backdrop blur while scrolling.
 *
 * Run `npm run backdrops` after adding or editing a drawing, and commit the
 * WebP files. Needs Chrome or Edge; set CHROME to its path if it isn't found.
 * `npm run backdrops -- alpine` redraws only the named drawings.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { svg } from './backdrops/lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../src/assets/backdrops')
const only = process.argv.slice(2)

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('Chrome or Edge not found: set CHROME to its path.')

/**
 * The glass blur, in pixels of the 640x400 copy. The copy is stretched to the
 * window, so this is about 28px of blur on a 1600px-wide window.
 */
const BLUR = 11
const SATURATE = 1.4

const tmp = mkdtempSync(join(tmpdir(), 'backdrops-'))
mkdirSync(out, { recursive: true })
const run = promisify(execFile)

async function shot(url, file, w, h) {
  const profile = mkdtempSync(join(tmp, 'p-'))
  await run(CHROME, [
    '--headless=new',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    `--window-size=${w},${h}`,
    '--virtual-time-budget=5000',
    `--screenshot=${file}`,
    url,
  ])
}

/** Render one SVG into its picture, blurred copy and thumbnail. */
async function render(name, body) {
  const svgFile = join(tmp, `${name}.svg`)
  writeFileSync(svgFile, svg(body))
  // The blurred copy: the picture blurred in place, over a larger blurred copy
  // that fills the edges (a plain blur fades to transparent there).
  const blurFile = join(tmp, `${name}-blur.html`)
  const layer = (inset, blur) =>
    `<div style="position:fixed;inset:${inset}px;background:url('${name}.svg') center/cover;filter:blur(${blur}px) saturate(${SATURATE})"></div>`
  writeFileSync(blurFile, `<body style="margin:0;overflow:hidden">${layer(-48, BLUR * 1.6)}${layer(0, BLUR)}</body>`)
  await Promise.all([
    shot(pathToFileURL(svgFile).href, join(out, `${name}.webp`), 2560, 1600),
    shot(pathToFileURL(blurFile).href, join(out, `${name}-blur.webp`), 640, 400),
    shot(pathToFileURL(svgFile).href, join(out, `${name}-thumb.webp`), 400, 250),
  ])
  console.log(`${name}`)
}

const files = readdirSync(join(here, 'backdrops')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs' && !f.startsWith('_'))
const jobs = []
for (const f of files.sort()) {
  const { default: art } = await import(pathToFileURL(join(here, 'backdrops', f)).href)
  if (only.length && !only.includes(art.id)) continue
  jobs.push(() => render(art.id, art.draw(false)))
  if (art.dark) jobs.push(() => render(`${art.id}-dark`, art.draw(true)))
}
// A few Chromes at a time.
const workers = Array.from({ length: 4 }, async () => {
  while (jobs.length) await jobs.shift()()
})
await Promise.all(workers)
rmSync(tmp, { recursive: true, force: true })
