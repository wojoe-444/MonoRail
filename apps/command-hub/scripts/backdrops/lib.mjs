/**
 * Helpers shared by the backdrop drawings. Each drawing in this folder is a
 * module whose default export is `{ id, draw(dark) }`, returning the inside of
 * a 1600x1000 SVG. Set `dark: true` on the module when the drawing has its own
 * night version: `draw(true)` then becomes `<id>-dark.svg`. Otherwise dark mode
 * dims the light picture (see `backdrop.dim` in src/lib/palettes.ts).
 */

/** Deterministic random numbers, so a drawing comes out the same every build. */
export function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

/** A linear gradient. `stops` are [offset, color, opacity?]; vertical unless x2/y2 say otherwise. */
export const lg = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([of, c, op = 1]) => `<stop offset="${of}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</linearGradient>`

/** A radial glow from `color` to transparent. */
export const glow = (id, cx, cy, r, color, opacity = 0.9) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`

const pts = (list) => list.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')

/** A jagged conifer standing on `base`, `h` tall. */
export function pine(x, base, h, fill) {
  const w = h * 0.28
  const n = 6
  const left = [[x, base - h]]
  const right = []
  for (let i = 1; i <= n; i++) {
    const y = base - h + (h * 0.88 * i) / n
    const ww = (w * i) / n
    left.push([x - ww, y], [x - ww * 0.45, y - h * 0.02])
    right.unshift([x + ww * 0.45, y - h * 0.02], [x + ww, y])
  }
  const trunk = [
    [x - w * 0.1, base - h * 0.1],
    [x - w * 0.1, base],
    [x + w * 0.1, base],
    [x + w * 0.1, base - h * 0.1],
  ]
  return `<polygon fill="${fill}" points="${pts([...left, ...trunk, ...right])}"/>`
}

/** A row of rounded swells across the width; closed to the bottom unless `close` is false. */
export function wave(y, amp, len, close = true) {
  let d = `M-60 ${y}`
  for (let x = -60; x < 1700; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`
  return close ? d + ' V1000 H-60Z' : d
}

/** A random starfield in the top `h` pixels. */
export function stars(rand, count, h = 680) {
  let s = ''
  for (let i = 0; i < count; i++) {
    s += `<circle cx="${(rand() * 1600).toFixed(0)}" cy="${(rand() * h).toFixed(0)}" r="${(0.6 + rand() * 1.5).toFixed(1)}" fill="#fff" opacity="${(0.3 + rand() * 0.6).toFixed(2)}"/>`
  }
  return s
}

/** Wrap a drawing's body as a complete SVG file. */
export const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">${body.replace(/\s*\n\s*/g, '')}</svg>\n`
