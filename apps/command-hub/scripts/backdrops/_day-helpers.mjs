/** Helpers for the daytime drawings (cherry-blossom, lagoon, lavender-fields, rice-terraces, coral-reef, meadow). */

export const f = (n) => (Math.round(n * 10) / 10).toString()

/** A smooth path through points (Catmull-Rom as cubic Beziers). `move` false continues an open path. */
export function smooth(p, move = true) {
  let d = move ? `M${f(p[0][0])} ${f(p[0][1])}` : `L${f(p[0][0])} ${f(p[0][1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

/** 1D value noise in -1..1, period `n`. */
export function noise(rand, n = 64) {
  const v = Array.from({ length: n + 1 }, () => rand() * 2 - 1)
  v[n] = v[0]
  return (t) => {
    t = ((t % n) + n) % n
    const i = Math.floor(t)
    const fr = t - i
    const s = fr * fr * (3 - 2 * fr)
    return v[i] * (1 - s) + v[i + 1] * s
  }
}

/** Layered noise, roughly -1..1. */
export function fbm(rand) {
  const a = noise(rand)
  const b = noise(rand)
  const c = noise(rand)
  return (t) => a(t) * 0.62 + b(t * 2.13 + 7) * 0.26 + c(t * 4.37 + 3) * 0.12
}

/** A hill line `y(x)` sampled every `step`, closed to the bottom. */
export function ridge(fn, step = 40, bottom = 1000) {
  const p = []
  for (let x = -60; x <= 1660; x += step) p.push([x, fn(x)])
  return `${smooth(p)}L1660 ${bottom}L-60 ${bottom}Z`
}

/** A tapered stroke along `pts` ([x, y, width]) as one filled path. */
export function taper(pts) {
  const L = []
  const R = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let nx = -(b[1] - a[1])
    let ny = b[0] - a[0]
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    const w = pts[i][2] / 2
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w])
    R.push([pts[i][0] - nx * w, pts[i][1] - ny * w])
  }
  return `${smooth(L)}${smooth(R.reverse(), false)}Z`
}

/** Film grain: a filter def and a full-size rect using it. */
export const grain = (id, opacity = 0.06, freq = 0.85, tint = '0 0 0') => {
  const [r, g, b] = tint.split(' ')
  return {
    def: `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch" seed="3"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 -1.4 1.05"/></filter>`,
    rect: `<rect width="1600" height="1000" filter="url(#${id})" opacity="${opacity}"/>`,
  }
}

/** A soft-blur filter def. */
export const blur = (id, sd, pad = 30) =>
  `<filter id="${id}" x="-${pad}%" y="-${pad}%" width="${100 + pad * 2}%" height="${100 + pad * 2}%"><feGaussianBlur stdDeviation="${sd}"/></filter>`

/**
 * A cumulus cloud: a few big domes on a flat base, to be drawn through
 * `cloudFilter` (which breaks the edges into billows). A shaded body sits
 * under a lit top; the bottom fades out through a mask.
 */
export function cloud(rand, cx, cy, w, h, light, shade, filterId, maskId, sun = 1) {
  const domes = [[cx, cy - h * 0.18, w * 0.5, h * 0.32]]
  const n = Math.max(3, Math.round(w / 75))
  const tower = 0.3 + rand() * 0.4
  for (let i = 0; i < n; i++) {
    const u = (i + 0.25 + rand() * 0.5) / n
    const prof = Math.sqrt(Math.max(0.05, 1 - (2 * u - 1) ** 2))
    const lift = 1 + 0.7 * Math.exp(-(((u - tower) / 0.22) ** 2))
    const ry = h * (0.25 + 0.4 * prof) * lift * (0.7 + rand() * 0.5)
    const rx = Math.max(ry * (0.8 + rand() * 0.4), (w / n) * 0.6)
    domes.push([cx + (u - 0.5) * w * 0.92, cy - ry * 0.85, rx, ry])
  }
  const el = (dx, dy, k) =>
    domes.map(([x, y, rx, ry]) => `<ellipse cx="${f(x + dx)}" cy="${f(y + dy)}" rx="${f(rx * k)}" ry="${f(ry * k)}"/>`).join('')
  const top = cy - h * 3
  const bot = cy + h * 0.1
  const fade = Math.min(0.5, (h * 0.5 + 20) / (bot - top))
  return `<linearGradient id="${maskId}g" x1="0" y1="0" x2="0" y2="1"><stop offset="${f((1 - fade) * 100) / 100}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${maskId}" maskUnits="userSpaceOnUse" x="${f(cx - w)}" y="${f(top)}" width="${f(w * 2)}" height="${f(bot - top)}"><rect x="${f(cx - w)}" y="${f(top)}" width="${f(w * 2)}" height="${f(bot - top)}" fill="url(#${maskId}g)"/></mask><g mask="url(#${maskId})"><g filter="url(#${filterId})"><g fill="${shade}">${el(0, 0, 1)}</g><g fill="${mixColor(light, shade)}">${el(sun * h * 0.02, -h * 0.08, 0.97)}</g><g fill="${light}">${el(sun * h * 0.05, -h * 0.17, 0.9)}</g></g></g>`
}

/** Billowy cloud edges: fractal noise displaces the shapes, then a soft blur. */
export const cloudFilter = (id, scale = 70, freq = 0.011, sd = 2.5, seed = 4) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2000" height="1400"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="${sd}"/></filter>`

/** A blur filter that works in page space, for groups whose bounding box is awkward. */
export const blurU = (id, sd) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2000" height="1400"><feGaussianBlur stdDeviation="${sd}"/></filter>`

/** The midpoint of two #rrggbb colours. */
export function mixColor(a, b, t = 0.5) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const x = p(a)
  const y = p(b)
  return (
    '#' +
    x
      .map((v, i) =>
        Math.round(v + (y[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

/** A towering cumulus built from several smaller heaps: a tall crown behind, a broad base in front. */
export function bigCloud(rand, cx, cy, w, h, light, shade, filterId, maskId, sun = 1) {
  const parts = [
    [cx + (rand() - 0.5) * w * 0.2, cy - h * 0.55, w * 0.42, h * 0.55],
    [cx - w * 0.22, cy - h * 0.28, w * 0.45, h * 0.5],
    [cx + w * 0.22, cy - h * 0.3, w * 0.42, h * 0.48],
    [cx - w * 0.05, cy, w * 0.9, h * 0.42],
  ]
  return parts
    .map(([x, y, ww, hh], i) =>
      cloud(rand, x, y, ww, hh, light, mixColor(shade, light, i === 3 ? 0 : 0.55), filterId, `${maskId}-${i}`, sun),
    )
    .join('')
}
