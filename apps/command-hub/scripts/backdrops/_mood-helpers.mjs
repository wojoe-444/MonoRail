/** Helpers for the moody night drawings (neon-rain, misty-pines, storm-sea, moonlit-lake, ember, nebula). */

export const f0 = (v) => Math.round(v)
export const f1 = (v) => +v.toFixed(1)

/** Smooth 1D value noise on [0, 1]. */
export function noise1(rand, n) {
  const v = Array.from({ length: n + 2 }, () => rand())
  return (t) => {
    const x = Math.max(0, Math.min(1, t)) * n
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return v[i] * (1 - s) + v[i + 1] * s
  }
}

/** Fractal 1D noise in [0, 1]: `oct` octaves starting at `n` cells. */
export function fbm(rand, n = 4, oct = 4) {
  const ns = Array.from({ length: oct }, (_, k) => noise1(rand, n * 2 ** k))
  const norm = 2 - 2 ** (1 - oct)
  return (t) => ns.reduce((a, f, k) => a + f(t) / 2 ** k, 0) / norm
}

/** A filled ridge closed to the bottom; `yAt(x)` gives the crest. */
export function ridge(yAt, step = 12, bottom = 1000) {
  let d = `M-20 ${bottom}`
  for (let x = -20; x <= 1620; x += step) d += `L${x} ${f0(yAt(x))}`
  return d + `L1620 ${bottom}Z`
}

/**
 * A fir as one closed subpath: tiers of jagged, slightly drooping branches.
 * `tiers` defaults to one per ~26px of height. Winds the same way as `ridge`.
 */
export function fir(rand, x, by, h, w = h * 0.3, tiers = Math.max(3, Math.round(h / 26))) {
  const top = by - h
  const th = (h * 0.9) / tiers
  const L = []
  const R = []
  for (let i = 1; i <= tiers; i++) {
    const y = top + th * i
    const k = (i / tiers) ** 0.85
    const wl = (w / 2) * k * (0.75 + rand() * 0.5)
    const wr = (w / 2) * k * (0.75 + rand() * 0.5)
    const notch = i === tiers ? 0 : th * (0.35 + rand() * 0.25)
    L.push(`${f0(x - wl)} ${f0(y + th * 0.12)}`)
    R.push(`${f0(x + wr)} ${f0(y + th * 0.12)}`)
    if (notch) {
      L.push(`${f0(x - wl * 0.35)} ${f0(y - notch * 0.2)}`)
      R.push(`${f0(x + wr * 0.35)} ${f0(y - notch * 0.2)}`)
    }
  }
  // Clockwise on screen: up the left side to the tip, down the right side.
  const left = L.reverse().join('L')
  return `M${f0(x - w * 0.06)} ${f0(by)}L${left}L${f0(x)} ${f0(top)}L${R.join('L')}L${f0(x + w * 0.06)} ${f0(by)}Z`
}

/** Fine white film grain: put `grainDefs()` in <defs>, then lay `grainRect()` over the picture. */
export const grainDefs = () =>
  `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" seed="5"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 -.5"/></filter>`

export const grainRect = (opacity = 0.06) => `<rect width="1600" height="1000" filter="url(#grain)" opacity="${opacity}"/>`

export const blur = (id, sd, pad = 50) =>
  `<filter id="${id}" x="-${pad}%" y="-${pad}%" width="${100 + 2 * pad}%" height="${100 + 2 * pad}%"><feGaussianBlur stdDeviation="${sd}"/></filter>`

/** Radial gradient in user space. */
export const rg = (id, cx, cy, r, stops, extra = '') =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"${extra}>${stops
    .map(([of, c, op = 1]) => `<stop offset="${of}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</radialGradient>`

/** A dark vignette around the frame. */
export const vignette = (strength = 0.55, color = '#000') =>
  `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="${strength}"/></radialGradient>`

/** A blur whose region is the whole canvas plus margin, for thin or scattered groups. */
export const blurU = (id, sd) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="${sd}"/></filter>`
