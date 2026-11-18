import { rng } from './lib.mjs'
import { lgu, ridgePts, smooth } from './_art-helpers.mjs'

/** Paper Cut: stacked paper hills and mountains in one tight colour ramp, each layer shading the one behind. */

const ri = (v) => Math.round(v)

/** A mountain ridge: peaks joined by softened slopes. */
function peaksPts(rand, { y, amp, n }) {
  const pts = [[-80, y + amp * 0.2]]
  const step = 1760 / n
  for (let i = 0; i < n; i++) {
    const x = -80 + step * (i + 0.5) + (rand() - 0.5) * step * 0.4
    const top = 0.45 + rand() * 0.55
    const sh = step * (0.18 + rand() * 0.14)
    pts.push([x - sh * 1.6, y - amp * top * (0.25 + rand() * 0.2)])
    pts.push([x - sh * 0.5, y - amp * top * (0.7 + rand() * 0.15)])
    pts.push([x, y - amp * top])
    pts.push([x + sh * 0.7, y - amp * top * (0.62 + rand() * 0.2)])
    pts.push([x + sh * 1.8, y - amp * top * (0.2 + rand() * 0.2)])
  }
  pts.push([1680, y])
  return pts
}

/** Little paper pines cut into a layer's edge. */
function pinesOn(rand, pts, count, h, x0 = -80, x1 = 1680) {
  let d = ''
  const at = (x) => {
    let j = 0
    while (j < pts.length - 2 && pts[j + 1][0] < x) j++
    const t = (x - pts[j][0]) / (pts[j + 1][0] - pts[j][0] || 1)
    return pts[j][1] * (1 - t) + pts[j + 1][1] * t
  }
  for (let i = 0; i < count; i++) {
    const x = x0 + rand() * (x1 - x0)
    const hh = h * (0.6 + rand() * 0.6)
    const b = at(x) + hh * 0.25
    const w = hh * 0.22
    d += `M${ri(x)} ${ri(b - hh)}L${ri(x + w * 0.6)} ${ri(b - hh * 0.62)}L${ri(x + w * 0.35)} ${ri(b - hh * 0.62)}L${ri(x + w)} ${ri(b - hh * 0.2)}L${ri(x - w)} ${ri(b - hh * 0.2)}L${ri(x - w * 0.35)} ${ri(b - hh * 0.62)}L${ri(x - w * 0.6)} ${ri(b - hh * 0.62)}Z`
  }
  return d
}

export default {
  id: 'paper-cut',
  draw() {
    const ramp = ['#f3c3ae', '#eaa79c', '#dc8c92', '#c4738a', '#a05d80', '#794a72', '#53375e', '#33254a']
    let defs = lgu('sky', 0, 700, [
      [0, '#f7cdb8'],
      [0.55, '#fbe2cf'],
      [1, '#fdeee0'],
    ])
    defs += `<filter id="ds" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="-3" stdDeviation="9" flood-color="#2a1430" flood-opacity=".42"/></filter>`
    defs += `<filter id="dsS" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="4" dy="7" stdDeviation="8" flood-color="#7a3a4a" flood-opacity=".28"/></filter>`
    // paper fibre: a soft lit relief plus fine grain
    defs += `<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="11" result="n"/><feDiffuseLighting in="n" surfaceScale="1.4" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting><feColorMatrix in="l" values="0 0 0 0 0.25 0 0 0 0 0.15 0 0 0 0 0.2 -0.9 0 0 0 0.86"/></filter>`
    defs += `<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 0.95 0 0 0 0 0.9 0 0 0 .5 -.18"/></filter>`

    let body = `<rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" filter="url(#mottle)"/>`
    // paper sun and clouds
    body += `<circle cx="1120" cy="300" r="118" fill="#fff4e4" filter="url(#dsS)"/><circle cx="1120" cy="300" r="86" fill="#fde4c6" filter="url(#dsS)"/>`
    const cloud = (x, y, s) =>
      `<path d="M${ri(x - 120 * s)} ${ri(y)}a${ri(40 * s)} ${ri(40 * s)} 0 0 1 ${ri(55 * s)} ${ri(-34 * s)}a${ri(52 * s)} ${ri(52 * s)} 0 0 1 ${ri(95 * s)} ${ri(-12 * s)}a${ri(38 * s)} ${ri(38 * s)} 0 0 1 ${ri(70 * s)} ${ri(24 * s)}a${ri(26 * s)} ${ri(26 * s)} 0 0 1 ${ri(20 * s)} ${ri(22 * s)}Z" fill="#fff6ee" filter="url(#dsS)"/>`
    body += cloud(360, 250, 1.1) + cloud(820, 170, 0.75) + cloud(1450, 420, 0.9) + cloud(150, 470, 0.6)

    // layers, back to front
    // tilt slopes a layer; bump adds a gaussian rise at [x, height, width]
    const L = [
      { kind: 'peaks', y: 590, amp: 260, n: 4, seed: 3 },
      { kind: 'peaks', y: 640, amp: 170, n: 6, seed: 8 },
      { kind: 'hill', y: 660, amp: 26, seed: 7, tilt: -0.05, bump: [300, 70, 260] },
      { kind: 'hill', y: 720, amp: 30, seed: 9, tilt: 0.06, bump: [1300, 90, 300], pines: [16, 44, 1020, 1640] },
      { kind: 'hill', y: 790, amp: 34, seed: 12, tilt: -0.07, bump: [180, 120, 280] },
      { kind: 'hill', y: 850, amp: 30, seed: 14, tilt: 0.05, bump: [1450, 110, 260], pines: [22, 56, -80, 520] },
      { kind: 'hill', y: 915, amp: 30, seed: 16, tilt: -0.03, bump: [700, 50, 360] },
      { kind: 'hill', y: 975, amp: 26, seed: 18, tilt: 0.04, bump: [1500, 120, 220], pines: [11, 120, 1150, 1680] },
    ]
    L.forEach((l, i) => {
      const r = rng(l.seed)
      let pts
      let d
      if (l.kind === 'peaks') {
        pts = peaksPts(r, l)
        d = smooth(pts, 1000, 0.55)
      } else {
        pts = ridgePts(r, { y: l.y, amp: l.amp, step: 40, waves: 2, minLen: 700, maxLen: 1800 }).map(([x, y]) => {
          const [bx, bh, bw] = l.bump
          return [x, y + l.tilt * (x - 800) - bh * Math.exp(-(((x - bx) / bw) ** 2))]
        })
        d = smooth(pts)
      }
      if (l.pines) d += pinesOn(rng(l.seed * 13), pts, l.pines[0], l.pines[1], l.pines[2], l.pines[3])
      // a faint lighter band along the top makes each sheet read as cut paper
      defs += lgu(`p${i}`, l.y - (l.amp || 0) - 40, l.y + 160, [
        [0, ramp[i]],
        [1, i < 7 ? ramp[i] : '#2a1e3d'],
      ])
      body += `<path d="${d}" fill="url(#p${i})" filter="url(#ds)"/>`
    })
    body += `<rect width="1600" height="1000" filter="url(#paper)" opacity=".55"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
