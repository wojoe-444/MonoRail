/** Helpers for the `art` drawings (canyon-mesa, winter-village, savanna, paper-cut, bauhaus, watercolor). */

export const f1 = (v) => (Math.round(v * 10) / 10).toString()

/** A smooth closed-to-bottom path through [x, y] points (Catmull-Rom as cubic Béziers). */
export function smooth(points, close = 1000, tension = 1) {
  const p = points
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const t = tension / 6
    d += `C${f1(p1[0] + (p2[0] - p0[0]) * t)} ${f1(p1[1] + (p2[1] - p0[1]) * t)} ${f1(p2[0] - (p3[0] - p1[0]) * t)} ${f1(p2[1] - (p3[1] - p1[1]) * t)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  if (close === false) return d
  return `${d}V${close}H${f1(p[0][0])}Z`
}

/** Points along a gently rolling ridge from x0 to x1: sum of random sines. */
export function ridgePts(rand, { y, amp, x0 = -80, x1 = 1680, step = 40, waves = 3, minLen = 300, maxLen = 1400 }) {
  const ws = []
  for (let i = 0; i < waves; i++) {
    const len = minLen + rand() * (maxLen - minLen)
    ws.push([(Math.PI * 2) / len, rand() * Math.PI * 2, (amp * (0.4 + rand() * 0.6)) / (i + 1)])
  }
  const out = []
  for (let x = x0; x <= x1 + 0.1; x += step) {
    let v = 0
    for (const [k, ph, a] of ws) v += Math.sin(x * k + ph) * a
    out.push([x, y + v])
  }
  return out
}

/** A fractal-noise grain overlay filter; use on a full-size rect. */
export const grainFilter = (id, freq = 0.8, alpha = 0.08, octaves = 2, tint = '0 0 0') => {
  const [r, g, b] = tint.split(' ')
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha * 2} -${alpha * 0.5}"/></filter>`
}

/** A radial gradient with arbitrary stops, in user space. */
export const rg = (id, cx, cy, r, stops, extra = '') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"${extra}>${stops
    .map(([of, c, op = 1]) => `<stop offset="${of}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</radialGradient>`

/** A vertical linear gradient in user space between y1 and y2. */
export const lgu = (id, y1, y2, stops) =>
  `<linearGradient id="${id}" x1="0" y1="${y1}" x2="0" y2="${y2}" gradientUnits="userSpaceOnUse">${stops
    .map(([of, c, op = 1]) => `<stop offset="${of}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</linearGradient>`

/** Mix two #rrggbb colours. */
export function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return (
    '#' +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
